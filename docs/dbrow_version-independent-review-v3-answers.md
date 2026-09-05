# Audit foundation — answers to the implementing agent's ten questions

Date: 2026-09-05.
Status: design answers with proposed contracts and reference code; nothing here is implemented.
Answers the ten questions in [follow-up questions](dbrow_version-independent-review-v3-follow-up-questions.md), numbered the same way. Companion to [independent review v3](dbrow_version-independent-review-v3.md). Where an answer refines something the review said, the review is marked as superseded in place.

Agreed baseline, restated so nothing below is read as reopening it: a sequence with gaps, local `entity_version`, optional INOUT parameters, centralized allocation in `data.dbrow_version_ensure`, explicit transaction ownership, a real default tenant for single-tenant installations, and legitimately shared catalogs, role definitions and platform actors.

Two of the ten questions assume a mechanism I proposed and that I now think is the wrong one. Question 3 assumed a stored engine transaction id; the reliable mechanism is a session-scoped marker (§3). Question 8 assumed `UPDLOCK, HOLDLOCK` on every catalog lookup, which my §11.3 in the review did imply; the correct pattern reads without hints and locks only on a miss (§8). Both corrections are folded into the review.

---

## 1. History when nested calls write the same row several times in one transaction

### Short answer
History at version `v` records the **net effect** of transaction `v` on each touched row, as a post-image, written by an **upsert restricted to the current transaction's own history rows** (`WHERE dbrow_version = @v`). No finalization step, no touched-row registry. Intermediate values that carry business meaning belong in `entities.event.event_args`, not in row history.

### Why intermediate states are not audit facts
Under the root-lock protocol (§4), no other transaction can observe or act on an aggregate between the first and last write of one transaction. `111 → 222 → 333` inside one unit of work is invisible to everyone; only `333` is a committed fact. The spec's fraud scenario (change, act, revert) spans three transactions and is preserved untouched. Within one transaction, "the user typed 222 and then corrected it" is a UI fact, not a database state.

### Contract: net transition per touched row

| Committed state before `v` | State at end of `v` | History row at `v` |
| --- | --- | --- |
| absent | present | op 1 (INSERT), final values |
| present | present, any column differs | op 2 (UPDATE), final values |
| present | present, all columns identical | none (see equality rule) |
| present | absent | op 3 (DELETE), last values before removal |
| absent | absent (inserted then deleted) | none; the row this transaction inserted is removed |

Equality rule: each write statement compares against the current live row and skips history when nothing changed. This eliminates the "echo snapshots" the spec objects to at statement level. The residual case `111 → 222 → 111` inside one transaction leaves an op-2 row equal to the previous committed version. Eliminating that too requires reading the last committed history row on every write; I would not pay for it. Document it as an accepted echo.

### Reference pattern for a child family (phone)

```sql
-- Inside the canonical protocol: root already locked, @dbrow_version ensured.
-- UPDATE path
UPDATE cp
   SET [phone_id] = @phone_id, [location_id] = @location_id, [extension] = @extension, [is_public] = @is_public
  FROM [contacts].[contact_phone] AS cp
 WHERE cp.[contact_id] = @contact_id AND cp.[ordinal] = @ordinal
   AND NOT EXISTS (SELECT cp.[phone_id], cp.[location_id], cp.[extension], cp.[is_public]
                   INTERSECT
                   SELECT @phone_id, @location_id, @extension, @is_public);   -- NULL-safe equality
IF @@ROWCOUNT = 1
BEGIN
    UPDATE h SET [dboperation_type_id] = CASE WHEN h.[dboperation_type_id] = 1 THEN 1 ELSE 2 END,
                 [phone_id] = @phone_id, [location_id] = @location_id, [extension] = @extension, [is_public] = @is_public
      FROM [contacts].[contact_phone_history] AS h
     WHERE h.[dbrow_version] = @dbrow_version AND h.[contact_id] = @contact_id AND h.[ordinal] = @ordinal;
    IF @@ROWCOUNT = 0
        INSERT [contacts].[contact_phone_history] ([dbrow_version],[dboperation_type_id],[contact_id],[ordinal],[phone_id],[location_id],[extension],[is_public])
        VALUES (@dbrow_version, 2, @contact_id, @ordinal, @phone_id, @location_id, @extension, @is_public);
END;

-- DELETE path
DECLARE @op_in_txn INT = (SELECT [dboperation_type_id] FROM [contacts].[contact_phone_history]
                          WHERE [dbrow_version] = @dbrow_version AND [contact_id] = @contact_id AND [ordinal] = @ordinal);
IF @op_in_txn = 1
    DELETE [contacts].[contact_phone_history]                 -- inserted in this transaction: net no-op
     WHERE [dbrow_version] = @dbrow_version AND [contact_id] = @contact_id AND [ordinal] = @ordinal;
ELSE IF @op_in_txn IS NULL
    INSERT [contacts].[contact_phone_history] ([dbrow_version],[dboperation_type_id],[contact_id],[ordinal],[phone_id],[location_id],[extension],[is_public])
    SELECT @dbrow_version, 3, [contact_id],[ordinal],[phone_id],[location_id],[extension],[is_public]
      FROM [contacts].[contact_phone] WHERE [contact_id] = @contact_id AND [ordinal] = @ordinal;
ELSE
    UPDATE h SET [dboperation_type_id] = 3, [phone_id] = cp.[phone_id], [location_id] = cp.[location_id], [extension] = cp.[extension], [is_public] = cp.[is_public]
      FROM [contacts].[contact_phone_history] AS h
      JOIN [contacts].[contact_phone] AS cp ON cp.[contact_id] = h.[contact_id] AND cp.[ordinal] = h.[ordinal]
     WHERE h.[dbrow_version] = @dbrow_version AND h.[contact_id] = @contact_id AND h.[ordinal] = @ordinal;
DELETE [contacts].[contact_phone] WHERE [contact_id] = @contact_id AND [ordinal] = @ordinal;
```

The same upsert rule applies to `entity_history` and `contact_history` for root payload. The spine row is written once per aggregate per transaction by the bump-once idiom (§4).

Why `WHERE dbrow_version = @v` is the safety boundary: those rows are uncommitted and owned by this transaction, so rewriting them destroys nothing observable. §3 guarantees that `@v` really is this transaction's allocation, so the predicate can never reach committed history. A CI scan can enforce that every `UPDATE`/`DELETE` against a `*_history` table carries that predicate (§9).

### Where business intent goes
A quote issued at 222 and corrected to 333 before saving is two facts: a state (333) and an action (quoted at 222). The action is an `entities.event` row with `event_args` JSON carrying 222, tied to the same `dbrow_version`. Modules with richer needs add an action table with the same key. Row history stays a state log; events are the action log. Both exist in the schema today.

### Aggregate bump when the net delta is empty
The bump happens on the first write, before the net effect is known. A version whose delta is empty is allowed and honest: the actor performed an action at that time. Do not try to un-bump.

---

## 2. Tenant-owned data, shared definitions, global actors

### What the schema already encodes
`security.role.tenant_id` is nullable with `UNIQUE (tenant_id, role_name)`: NULL is a **global definition**, non-NULL is a **tenant-defined role**. SQL Server treats NULLs as equal in a unique constraint, so global names are unique among themselves. `security.user_role` is the **assignment**; it is tenant-scoped implicitly through the user's `entity.tenant_id`. The model is right; the rules around it are what is missing.

### Four classes and their rules

| Class | Examples | tenant_id | Who writes | Read scope |
| --- | --- | --- | --- | --- |
| Tenant-owned | entity and subtypes, children, junctions, history, ledger, events, sequences, tenant-defined roles, role assignments | required, via the aggregate root or carried explicitly | application procedures under a tenant-scoped actor | own tenant only |
| Shared definitions | language, dboperation_type, entity_type, event_type, contact_type, person_name_type, relationship_type, global roles, module, schema_version | none (or NULL) | migrations and seeds only, System actor | everyone |
| Shared immutable values | person_name, email, phone, address parts, country/state/city, identifier | none | interned by any tenant's write path; never updated or deleted | only through tenant-owned junctions |
| Global actors | System User, Anonymous, integration accounts | live in the default tenant, `is_system = 1` | bootstrap and administration | exempt from the actor tenant-match rule |

Rules the migration can copy:

1. Every procedure resolves `@tenant_id` once, explicitly, and every entity lookup includes `AND [tenant_id] = @tenant_id`. Unresolved tenant is an error, never a fallback.
2. Entity-to-entity references (relationships, event author and subject, role assignment, actor) must be same-tenant. Only `is_system = 1` actors cross tenants. Checked when the root is locked, because that is when the entity row is read anyway.
3. Shared definitions have no application write path. Tenant-defined roles are the one exception and are tenant-owned rows.
4. Shared values are insert-only (§8). A tenant can only enumerate values through its own junctions; never expose the raw catalog to an application query.
5. A role assignment is a business change to the user aggregate: it needs `dbrow_version`, a `user_role_history` sibling, and a bump of the user's `entity_version`. Today `user_role` has none of these and carries `ON DELETE CASCADE` from `security.user`, which would physically destroy assignment evidence; remove the cascade, since users are soft-deleted only.
6. A role is assignable to a user when `role.tenant_id IS NULL OR role.tenant_id = user's tenant`. If a tenant defines a role with the same name as a global one, decide once whether that shadows the global (prefer tenant-specific) or is forbidden. I recommend forbidding shadowing: fewer surprises in authorization.

### The two lookups in `user_insert`

Existing-contact lookup (today: by `public_key` only):
```sql
SELECT @contact_id = c.[contact_id], @contact_tenant = e.[tenant_id], @is_deleted = CASE WHEN e.[deleted] IS NULL THEN 0 ELSE 1 END
  FROM [entities].[entity] AS e WITH (UPDLOCK, HOLDLOCK)
  LEFT JOIN [contacts].[contact] AS c ON c.[contact_id] = e.[entity_id]
 WHERE e.[public_key] = @public_key;
IF @contact_id IS NOT NULL AND @contact_tenant <> @tenant_id THROW 51013, 'The contact belongs to a different tenant.', 1;
IF @contact_id IS NOT NULL AND @is_deleted = 1 THROW 51014, 'The contact is deleted; undelete it first.', 1;
IF EXISTS (SELECT 1 FROM [security].[user] WHERE [user_id] = @contact_id) THROW 51015, 'The contact is already a user.', 1;
```
Taking the lock here is the root lock of §4 for the promote-to-user path. Promotion is an aggregate change: bump `entity_version`, write the spine row, write a `user_history` row (without secrets), and update `entity.entity_type_id` to the user type with an `entity_history` row. `entity_history` does not carry `entity_type_id` today; add it, or declare the type immutable and never promote. I recommend adding it, because "most specific type" is what `entity_type.database_table` implies.

Role lookup (today: silently skips an unknown role):
```sql
SELECT @role_id = [role_id] FROM [security].[role]
 WHERE [role_name] = @user_primary_role AND ([tenant_id] IS NULL OR [tenant_id] = @tenant_id);
IF @role_id IS NULL THROW 51016, 'The requested role does not exist for this tenant.', 1;
```
The silent skip is a security-relevant defect: a user requested with a role is created without it and nothing records that. Fail instead.

Login uniqueness: `security.user.login_name` has no unique constraint. Decide the scope. If per tenant, add `tenant_id` to `security.user` (denormalized from the entity, set by the procedure) with `UNIQUE (tenant_id, login_name)`; if global, `UNIQUE (login_name)`. Single-tenant installations are unaffected either way. Enforcing it only in the procedure is weaker than a constraint and I would not accept that for a credential.

---

## 3. What the engine transaction-id check actually guarantees, and how two NULL calls behave

### Intended guarantee
"A `dbrow_version` supplied to, or joined by, a nested call is accepted only if it was allocated by the **current SQL transaction on the current session**." Anything weaker lets two commits masquerade as one atomic business operation.

### Scenario analysis of a stored `xact_id` column

| Scenario | `CURRENT_TRANSACTION_ID()` stored on the ledger row and compared on reuse |
| --- | --- |
| Reuse after commit, same session | Rejected: the new transaction has a new id. |
| Reuse after commit, other session | Rejected: different id. |
| Instance restart | Ids are instance-scoped counters. Microsoft documents them as unique within an instance, not across instances, and says nothing about monotonicity across restarts. A collision with a stored value cannot be excluded. |
| Restore onto another instance | Stored ids come from another instance; the id spaces are unrelated. Collision possible in principle. |
| Database clone or copy | Same as restore. |

So the stored column is sufficient for the common case and not provably sufficient for the last three. It also adds a durable column whose only purpose is a check.

### The smallest reliable mechanism: a session-scoped marker
The property we need is "allocated by *this* transaction", and the only thing that dies exactly when a transaction's session dies is the session itself. Combine `SESSION_CONTEXT` (SQL Server 2016+, no permissions, not transactional) with `CURRENT_TRANSACTION_ID()` compared **within the same session lifetime**:

- Allocation stores `audit_xact = CURRENT_TRANSACTION_ID()`, `audit_version`, `audit_tenant` in session context.
- Join or supplied-version path requires `SESSION_CONTEXT('audit_xact') = CURRENT_TRANSACTION_ID()` and `SESSION_CONTEXT('audit_version') = @dbrow_version`, then verifies the ledger row exists (guards a savepoint rollback) and its actor matches.

| Scenario | Outcome |
| --- | --- |
| After commit, same session | New transaction id differs from the marker: rejected. Within one session lifetime the id cannot repeat. |
| Other session | No marker: rejected. |
| Restart, restore, clone | The session does not survive any of them; a new session has no marker: rejected. |
| Rollback then new transaction | Marker is stale but its id no longer matches: harmless. |
| Savepoint rollback inside the transaction | Marker matches but the ledger row is gone: the existence check rejects. |
| Pooled connection reset | `sp_reset_connection` clears session context; the id check would reject anyway. |
| MARS with interleaved transactions on one session | Edge case; the id check still distinguishes transactions. Document that the framework does not support MARS on writer connections. |

No durable column is needed. The review's Tier 0 item 5 is superseded by this.

### Two NULL calls in one transaction: join
Policy: **one SQL transaction produces at most one ledger row.** The primary design already states one ledger entry per unit of work; the marker lets the helper enforce it instead of relying on every caller plumbing INOUT correctly.

- NULL when the session marker shows an allocation by this transaction: **join** it, after checking tenant and actor.
- NULL with no live marker: allocate, set the marker.
- Supplied version that does not equal the marker's version: **fail** (51009).
- Join with a different actor: **fail** (51005). Two actors in one atomic unit is a defect, or a delegation case that belongs to `on_behalf_of`.
- Join with a different operation type: **ignored**, the enclosing business operation wins, as ADR 0001 already says.

Why not allocate twice: it breaks the one-unit-one-row rule and makes the reuse contract meaningless. Why not fail: it makes composition fragile in exactly the way question 4 worries about; a forgotten INOUT would become an error in production rather than correct behavior. Consequence to document for application developers: if you need two audit entries, use two transactions. A batch action on fifty aggregates is one ledger row and fifty spine rows, which is the right reading of "who did what, when".

INOUT parameters stay. They are now a convenience that returns the version to the caller and lets it assert, not the correctness mechanism.

### Helper v2 sketch

```sql
CREATE OR ALTER PROCEDURE [data].[dbrow_version_ensure] (
     @tenant_id            INT
    ,@actor_entity_id      INT
    ,@dboperation_type_id  INT
    ,@dbrow_version        BIGINT    = NULL OUTPUT
    ,@recorded_at          DATETIME2 = NULL OUTPUT      -- one clock per transaction (§11.4 of the review)
    ,@origin_uid           UNIQUEIDENTIFIER = NULL      -- §7: import path only
    ,@origin_dbrow_version BIGINT = NULL                 -- §7: import path only
)
AS
BEGIN
    SET NOCOUNT ON;
    IF XACT_STATE() <> 1 THROW 51001, 'dbrow_version_ensure requires an active, committable caller transaction.', 1;
    IF @tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM [data].[tenant] WHERE [tenant_id] = @tenant_id) THROW 51002, 'An existing tenant is required.', 1;
    IF @actor_entity_id IS NULL THROW 51003, 'An actor entity ID is required.', 1;

    DECLARE @xact BIGINT = CURRENT_TRANSACTION_ID();
    DECLARE @ambient BIGINT = CASE WHEN CONVERT(BIGINT, SESSION_CONTEXT(N'audit_xact')) = @xact
                                   THEN CONVERT(BIGINT, SESSION_CONTEXT(N'audit_version')) END;

    IF @dbrow_version IS NULL SET @dbrow_version = @ambient;                       -- auto-join

    IF @dbrow_version IS NOT NULL
    BEGIN
        IF @ambient IS NULL OR @dbrow_version <> @ambient
            THROW 51009, 'The supplied audit version was not allocated by the current transaction.', 1;
        IF CONVERT(INT, SESSION_CONTEXT(N'audit_tenant')) <> @tenant_id
            THROW 51004, 'The audit version belongs to a different tenant.', 1;
        DECLARE @ledger_actor INT;
        SELECT @ledger_actor = [modified_by], @recorded_at = [recorded_at]
          FROM [data].[dbrow_version] WHERE [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version;
        IF @ledger_actor IS NULL THROW 51004, 'The audit version has no ledger row in this transaction.', 1;
        IF @ledger_actor <> @actor_entity_id THROW 51005, 'The audit version belongs to a different actor.', 1;
        RETURN;
    END;

    IF @dboperation_type_id IS NULL OR NOT EXISTS (SELECT 1 FROM [data].[dboperation_type] WHERE [dboperation_type_id] = @dboperation_type_id)
        THROW 51007, 'An existing operation type is required.', 1;

    SET @recorded_at = SYSUTCDATETIME();
    SET @dbrow_version = NEXT VALUE FOR [data].[dbrow_version_seq];
    INSERT [data].[dbrow_version] ([tenant_id],[dbrow_version],[dboperation_type_id],[recorded_at],[modified_by],[origin_uid],[origin_dbrow_version])
    VALUES (@tenant_id, @dbrow_version, @dboperation_type_id, @recorded_at, @actor_entity_id,
            COALESCE(@origin_uid, [data].[local_origin_uid]()), COALESCE(@origin_dbrow_version, @dbrow_version));

    EXEC sp_set_session_context @key = N'audit_xact',    @value = @xact;
    EXEC sp_set_session_context @key = N'audit_version', @value = @dbrow_version;
    EXEC sp_set_session_context @key = N'audit_tenant',  @value = @tenant_id;
END;
```

`recorded_at` replaces the caller-supplied `modified` for the ledger. Keep `modified` only if a business-effective time is needed on the ledger; otherwise drop it and let imports carry the source time in the import receipt (§7).

---

## 4. Root-lock-before-allocation with composable procedures

### Reframe the requirement
What the `<= bound` reconstruction algorithm needs is one invariant per aggregate: **spine rows are strictly increasing in `dbrow_version` as `entity_version` increases.** Locking the root before allocating is one way to obtain it. It is not the only way, and it is not enforceable when a nested call discovers an aggregate late. The enforceable form is to **assert the invariant at the moment the aggregate is bumped**, which every change must do anyway to write its spine row.

### The protocol

```sql
-- entities.entity_lock: take the root lock and validate. Idempotent within a transaction.
CREATE OR ALTER PROCEDURE [entities].[entity_lock] (
     @entity_id INT, @tenant_id INT
    ,@dbrow_version BIGINT = NULL              -- NULL before allocation; the current version after
    ,@expected_entity_version INT = NULL       -- optimistic token from the caller
    ,@current_entity_version INT = NULL OUTPUT)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @current_dbrow BIGINT;
    SELECT @current_entity_version = [entity_version], @current_dbrow = [dbrow_version]
      FROM [entities].[entity] WITH (UPDLOCK, HOLDLOCK)
     WHERE [entity_id] = @entity_id AND [tenant_id] = @tenant_id;
    IF @current_entity_version IS NULL THROW 51010, 'Entity not found in this tenant.', 1;
    IF @dbrow_version IS NOT NULL AND @current_dbrow > @dbrow_version
        THROW 51012, 'The aggregate was changed by a later audit transaction; restart the unit of work.', 1;
    IF @expected_entity_version IS NOT NULL AND @expected_entity_version <> @current_entity_version
        THROW 51011, 'Stale entity_version.', 1;
END;

-- entities.entity_bump: one version per aggregate per transaction; re-asserts the invariant.
CREATE OR ALTER PROCEDURE [entities].[entity_bump] (
     @entity_id INT, @tenant_id INT, @dbrow_version BIGINT, @actor_id INT, @recorded_at DATETIME2
    ,@new_entity_version INT = NULL OUTPUT)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [entities].[entity]
       SET [entity_version] += 1, [dbrow_version] = @dbrow_version, [modified] = @recorded_at, [modified_by] = @actor_id
         , @new_entity_version = [entity_version] + 1
     WHERE [entity_id] = @entity_id AND [tenant_id] = @tenant_id AND [dbrow_version] < @dbrow_version;
    IF @@ROWCOUNT = 1
        INSERT [entities].[entity_version_history] ([tenant_id],[dbrow_version],[entity_id],[entity_version])
        VALUES (@tenant_id, @dbrow_version, @entity_id, @new_entity_version);
    ELSE
    BEGIN
        SELECT @new_entity_version = [entity_version] FROM [entities].[entity]
         WHERE [entity_id] = @entity_id AND [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version;
        IF @new_entity_version IS NULL
            THROW 51012, 'The aggregate was changed by a later audit transaction; restart the unit of work.', 1;
        -- else: already bumped in this transaction; nothing to do
    END;
END;
```

Order inside any mutating procedure: intern catalogs (§8) → `entity_lock` for the aggregates known up front, ascending `entity_id` → `dbrow_version_ensure` → mutate and write history (§1) → `entity_bump` for each changed aggregate → `event_create` → commit if owner.

### Why this is sound with late discovery
Suppose T1 allocated 100, then a nested call must modify aggregate B, which T2 (101) changed and committed meanwhile. T1's `entity_lock` on B blocks until T2 commits, then sees `B.dbrow_version = 101 > 100` and throws 51012. Without the interleaving, `B.dbrow_version < 100` and T1 proceeds; B's spine gets `(ver n+1, 100)` after `(ver n, < 100)`, which preserves the invariant. The invariant cannot be violated by any call order, because the only statement that writes a spine row checks it. Lock-first for the known set is an optimization that avoids restarts; the assert is the safety net for everything else. No transaction-context object is needed beyond the scalars already passed.

### Existing roots versus new roots
Existing roots: `entity_lock` as above. New roots: no lock is possible or needed. The row is invisible until commit, nobody can reference it, and it is created with the current `dbrow_version`. Duplicates by natural key are a business question: two companies with the same name are legitimate, so the auto-created company in `contact_insert` should not take a range lock on `full_name`. Where a natural key must be unique (login name, tenant public key), a unique constraint is the protection; under `XACT_ABORT ON` a violation fails the unit of work, and the application retries or reports. That is the correct outcome.

### Deadlocks
Two transactions discovering each other's aggregates late in opposite order can deadlock; SQL Server kills one with error 1205 and the application retries the whole unit of work. That is the standard contract for any lock-based protocol and is much cheaper than a global ordering scheme. Ordering the known set ascending removes the common case.

### Enforceability
"Every procedure that writes a table with `dbrow_version` calls `entity_bump` for the owning aggregate" is a mechanical CI assertion over procedure text, and `entity_bump` is where the invariant lives. Tests: two connections, opposite lock order, expect one 1205 and a consistent spine after retry; a late-discovered aggregate with an interleaved commit, expect 51012 and no partial writes.

---

## 5. Where actor resolution and authorization live

### Split by layer

| Concern | Layer | Mechanism |
| --- | --- | --- |
| Authentication, session, authorization policy | application service | outside the database, as spec §8 already decides |
| Actor identity shape: exists, is a user, not deleted, tenant rule | entities | `entities.actor_resolve`, using only `entities.entity` and `entities.entity_type` |
| Actor consistency inside a transaction | data | helper's join check against the ledger actor |
| Eligibility beyond shape (locked out, disabled) | security / application | at authentication time, not at write time |

The entities layer can verify "is a user" without depending on security tables: `entities.entity_type.code_name = 'user'` is an entities-layer fact; the seed that inserts type 4 happens to live in the security script, but the lookup does not reference `security.user`. Add `OR e.is_system = 1` for platform actors, and `e.deleted IS NULL`.

```sql
CREATE OR ALTER PROCEDURE [entities].[actor_resolve] (
     @tenant_id INT
    ,@actor UNIQUEIDENTIFIER = NULL          -- public key from the application
    ,@actor_id INT = NULL OUTPUT)            -- pre-resolved id from a trusted nested caller; validated either way
AS
BEGIN
    SET NOCOUNT ON;
    IF @actor IS NULL AND @actor_id IS NULL THROW 51020, 'An actor is required.', 1;
    DECLARE @resolved INT, @actor_tenant INT, @is_system BIT, @is_user BIT, @deleted DATETIME2;
    SELECT @resolved = e.[entity_id], @actor_tenant = e.[tenant_id], @is_system = e.[is_system], @deleted = e.[deleted]
         , @is_user = CASE WHEN et.[code_name] = N'user' THEN 1 ELSE 0 END
      FROM [entities].[entity] AS e JOIN [entities].[entity_type] AS et ON et.[entity_type_id] = e.[entity_type_id]
     WHERE (@actor_id IS NOT NULL AND e.[entity_id] = @actor_id) OR (@actor_id IS NULL AND e.[public_key] = @actor);
    IF @resolved IS NULL THROW 51021, 'Unknown actor.', 1;
    IF @is_user = 0 AND @is_system = 0 THROW 51022, 'The actor is not a user.', 1;
    IF @deleted IS NOT NULL THROW 51023, 'The actor is deleted.', 1;
    IF @is_system = 0 AND @actor_tenant <> @tenant_id THROW 51024, 'The actor belongs to a different tenant.', 1;
    SET @actor_id = @resolved;
END;
```

### Which entry points accept what
- Public procedures (called by the application) accept `@actor UNIQUEIDENTIFIER` and call `actor_resolve` **once, before allocation**.
- Nested procedures accept `@actor_id INT` and do not re-resolve. They call the helper, which on join verifies the id equals the ledger actor. A wrong id fails there.
- A caller that passes a raw `@actor_id` with no ambient transaction reaches the allocation path, and allocation requires that a public procedure ran `actor_resolve` first. To make that mechanical, public procedures call `actor_resolve` and nested ones do not exist as public entry points (no EXECUTE grant to the application principal on nested-only procedures).
- `@self_registration BIT` exists only on `user_insert` and the tenant bootstrap. When set, the procedure allocates `@entity_id` itself and uses it as `@actor_id`; it never accepts an entity id from the caller in that mode, so it cannot be used to act as an existing user.

What prevents bypass: the database trusts the application principal, as the spec's threat model states. These checks catch mistakes, not a hostile application. Their value is that an application bug produces an error instead of a plausible-looking wrong audit row.

### Concrete changes for pre-allocated entity ids

| Location | Change |
| --- | --- |
| `entities` schema | `CREATE SEQUENCE [entities].[entity_id_seq] AS INT START WITH 1`; `entity_id INT NOT NULL CONSTRAINT def_entity_id DEFAULT (NEXT VALUE FOR [entities].[entity_id_seq])`; remove `IDENTITY`. Fresh builds only; no deployed remake database exists yet. |
| `entity_insert` | `@entity_id INT = NULL OUTPUT` becomes INOUT: `IF @entity_id IS NULL SET @entity_id = NEXT VALUE FOR …`; insert the explicit id; remove `SCOPE_IDENTITY()`; remove the self-creation branch and the ledger `UPDATE`; accept `@actor_id INT`. |
| `contact_insert` | Add `@entity_id INT = NULL OUTPUT` and `@actor_id INT`; pass both through; replace the two `SELECT entity_id … WHERE public_key = @public_key` lookups with `@entity_id`; company creation passes `NULL` so the company gets its own id; add `@entity_type_id INT = NULL` so a subtype can pass its type. |
| `user_insert` | Add `@self_registration BIT = 0`. If set: `@entity_id = NEXT VALUE FOR`, `@actor_id = @entity_id`, event `security.user.self_registered`; else `actor_resolve`. Existing-contact path: lock, validate (§2), promote, bump, `user_history`. Pass entity type `user` down. |
| `security.tenant_bootstrap` (new, security layer so it may call down) | `@sys_id = NEXT VALUE FOR entity_id_seq`; `data.tenant_insert @actor_id = @sys_id` (which calls the helper); `user_insert @self_registration = 1, @entity_id = @sys_id, @is_system = 1` joining the same version. One ledger row for the platform bootstrap. |
| `data.tenant_insert` | Accept `@actor_id INT`; call the helper instead of hard-coding version 1; `BIGINT` variable; bare `THROW`. |
| `SecurityDatabaseSchemaBuilder.InsertSystemUser` | Replace the ad-hoc SQL with `EXEC [security].[tenant_bootstrap]`. Fixes the `MAX()+1`, the hard-coded version 1, and entity type 1 for the System User. |
| Tests | Assertions that assume `entity_id = 1` from `IDENTITY` change to reading the OUTPUT. Add: no `UPDATE` ever runs against `data.dbrow_version`; System User bootstrap yields type `user`. |

Child catalogs (`email`, `phone`, `person_name`, …) keep `IDENTITY`; they are not aggregates.

---

## 6. Change Tracking export and recovery protocol

### Why Change Tracking rather than CDC, in one paragraph
Change Tracking records, for each committed transaction that touched a tracked table, a commit-ordered version number in the internal `syscommittab`, keyed by the engine transaction. `CHANGETABLE(CHANGES …)` joins the tracked rows to that table, so `SYS_CHANGE_VERSION` is a **commit** sequence, not an allocation sequence. That is exactly the property the late-lower-number problem needs. It runs on every edition including Express, needs no SQL Agent, and is synchronous with the writing transaction. Verify the commit-order property with the two-connection test in §10 before relying on it.

### Setup
```sql
ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE CURRENT SET CHANGE_TRACKING = ON (CHANGE_RETENTION = 30 DAYS, AUTO_CLEANUP = ON);
ALTER TABLE [data].[dbrow_version] ENABLE CHANGE_TRACKING;          -- PK (tenant_id, dbrow_version) exists
GRANT VIEW CHANGE TRACKING ON [data].[dbrow_version] TO [export_role];
```
Only the ledger is tracked. History, spine and event rows are read by `dbrow_version` under the same snapshot; they are append-only, so their content for a committed version never changes except through erasure (§7 of the review, and §6 below).

### Consumer state
Each consumer stores `(producer_origin_uid, last_change_version)` durably on its own side, updated in the same consumer transaction that applies a batch. The producer is stateless; optionally it mirrors cursors for monitoring.

### Export batch
```sql
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION;
DECLARE @min_valid BIGINT = CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID(N'data.dbrow_version'));
IF @last_change_version < @min_valid THROW 51030, 'Cursor is older than retention; reinitialize.', 1;
DECLARE @to BIGINT = CHANGE_TRACKING_CURRENT_VERSION();

;WITH page AS (
    SELECT TOP (@page_size + 1) ct.SYS_CHANGE_VERSION, v.*
      FROM CHANGETABLE(CHANGES [data].[dbrow_version], @last_change_version) AS ct
      JOIN [data].[dbrow_version] AS v ON v.[tenant_id] = ct.[tenant_id] AND v.[dbrow_version] = ct.[dbrow_version]
     WHERE ct.SYS_CHANGE_OPERATION = 'I' AND ct.SYS_CHANGE_VERSION <= @to
       AND v.[origin_uid] <> @consumer_origin_uid                  -- do not echo the consumer's own transactions back
     ORDER BY ct.SYS_CHANGE_VERSION, v.[tenant_id], v.[dbrow_version])
SELECT * FROM page;   -- caller trims trailing rows that share the last SYS_CHANGE_VERSION unless the page was exhausted
-- For each ledger row in the page: SELECT spine, history and event rows WHERE dbrow_version = v.dbrow_version (same snapshot).
COMMIT;
```

Rules:

1. **Snapshot boundary.** `CHANGE_TRACKING_CURRENT_VERSION()` and `CHANGETABLE` are evaluated inside one snapshot transaction, which Microsoft documents as the way to keep the version and the data consistent. Under read committed a transaction could commit between the two reads and be skipped forever.
2. **Cursor acquisition.** The new cursor is the `SYS_CHANGE_VERSION` of the last **complete** version group in the page, or `@to` when the page was not full. Never `MAX(dbrow_version)`.
3. **Equal change versions.** All rows of one transaction share one version. By the one-row-per-transaction contract (§3) a version normally maps to one ledger row; the trimming rule still protects the case where it does not.
4. **Durable acknowledgment.** The consumer applies the batch and advances its cursor in one consumer transaction; redelivery is idempotent through the unique original identity (§7). The producer never needs an acknowledgment to stay correct.
5. **Outage beyond retention.** `MIN_VALID_VERSION` exceeds the cursor: stop, reinitialize. Reinitialization is a full export of the consumer's scope read under one snapshot, with `CHANGE_TRACKING_CURRENT_VERSION()` taken at the start of that snapshot as the new cursor; then continue incrementally. Order inside the full export is `(tenant_id, dbrow_version)`, which is allocation order and therefore approximate for historical rows. Say so in the export manifest.

### Historical replay order after retention
Not preserved by Change Tracking alone; that is what retention means. If a deployment needs commit order for rows older than retention (branches offline for months, forensic replay), add a **companion journal** `data.dbrow_version_commit (tenant_id, dbrow_version, commit_version)` filled by a stamping worker that runs the same cursor protocol well inside the retention window. Your instinct is right on placement: it must be a **separate, untracked** table, never a column on the tracked ledger, because updating the ledger would create another tracked change and would break append-only. For most deployments a generous retention (30 to 90 days; cost is one small internal row per ledger insert) makes the journal unnecessary. Make the journal an opt-in profile.

### Erasure and exports
Regulatory erasure rewrites history rows in place. Copies exported before erasure still hold the data. An erasure transaction (op 10) travels through the same export as an instruction to redact, and consumers apply it to their copies. Reserve that in the envelope from the start.

---

## 7. Portable identity across forks and forwarding, and conflict detection without a revision graph

### Principle
**Identity travels on the row.** Every ledger row carries the identity of the transaction that originally produced it, `(origin_uid, origin_dbrow_version)`. For local transactions that is `(local origin, dbrow_version)`; for imported ones it is the sender's original pair, preserved unchanged through any number of hops. A separate map is not needed for identity, only for hop provenance.

### Minimum schema
```sql
CREATE TABLE [data].[origin] (
     [origin_uid]                 UNIQUEIDENTIFIER NOT NULL PRIMARY KEY
    ,[parent_origin_uid]          UNIQUEIDENTIFIER NULL      -- set on a writable fork
    ,[forked_after_dbrow_version] BIGINT NULL                -- last inherited local version at the fork
    ,[is_local]                   BIT NOT NULL DEFAULT 0
    ,[created]                    DATETIME2 NOT NULL
    ,[description]                NVARCHAR(256) NULL);
CREATE UNIQUE INDEX [ux_origin_local] ON [data].[origin]([is_local]) WHERE [is_local] = 1;   -- exactly one local origin

ALTER TABLE [data].[dbrow_version] ADD
     [origin_uid]           UNIQUEIDENTIFIER NOT NULL
    ,[origin_dbrow_version] BIGINT NOT NULL;
CREATE UNIQUE INDEX [ux_dbrow_version_origin] ON [data].[dbrow_version]([origin_uid],[origin_dbrow_version]);  -- idempotent import

CREATE TABLE [data].[import_receipt] (
     [origin_uid]               UNIQUEIDENTIFIER NOT NULL
    ,[origin_dbrow_version]     BIGINT NOT NULL
    ,[local_tenant_id]          INT NOT NULL
    ,[local_dbrow_version]      BIGINT NOT NULL
    ,[received_from_origin_uid] UNIQUEIDENTIFIER NOT NULL   -- last hop
    ,[received_at]              DATETIME2 NOT NULL
    ,[envelope_version]         INT NOT NULL
    ,[source_recorded_at]       DATETIME2 NOT NULL          -- the sender's recorded_at, kept separate from local recorded_at
    ,[status]                   TINYINT NOT NULL            -- applied / staged / rejected
    ,PRIMARY KEY ([origin_uid],[origin_dbrow_version],[received_from_origin_uid]));
```
The helper takes `@origin_uid, @origin_dbrow_version` on the import path (§3 sketch). Cost: 24 bytes per ledger row plus one index whose leading key is nearly constant per database, which compresses well. The review's objection to a per-row random UUID stands; this is not random and it is the identity, not a decoration.

### Forks
A restored copy allowed to accept writes inserts a new `origin` row with `is_local = 1`, `parent_origin_uid` = the source, and `forked_after_dbrow_version` = the last inherited version. Inherited ledger rows are untouched: their `(origin_uid, origin_dbrow_version)` still name the original transactions, so both branches agree on their shared ancestry and neither will treat it as duplicate. New local rows on the fork carry the new origin; their local `dbrow_version` continues the inherited sequence, which is fine because uniqueness is per origin.

### Forwarding
B forwards A's transaction to C. The envelope carries `(A, n)` as identity and B as the last hop. C deduplicates on `(A, n)`. If C later receives `(A, n)` directly from A, it is a duplicate and is ignored; the receipt records the second hop. Loops are prevented by the identity, not by hop ids. Exporting from any node excludes transactions whose `origin_uid` equals the consumer's origin (§6 query), so a node never receives its own work back.

### Conflict detection without a revision graph
An incoming operation on aggregate X carries **the identity of the last transaction that changed X as the sender saw it**: `(base_origin_uid, base_origin_dbrow_version)`, plus the sender's `entity_version` of X for display. The receiver resolves its own X: `entity.dbrow_version → ledger row → (origin_uid, origin_dbrow_version)`.

| Receiver's current identity of X versus incoming base | Outcome |
| --- | --- |
| Equal | Fast-forward: apply as a new local transaction, new local `dbrow_version`, `entity_version + 1`. |
| Different, and the incoming base is in the receiver's history (an ancestor) | The receiver's X moved since the sender's base: **conflict**; stage for review, or merge under an explicit per-domain policy. The base state is reconstructible locally at the base's `dbrow_version`. |
| Different, and the incoming base is unknown | **Missing dependency**: stage, and request the sender's transactions from the last known one forward. Applying a sender's transactions in its commit order (§6) makes this rare. |

Two disconnected copies both at `entity_version = 4` with different content are detected because their base identities differ; the local version number is never compared across databases. A three-way merge base, if a domain wants one, is the base transaction's state; when the receiver does not have it, the envelope may carry a base snapshot. This is a parent pointer per aggregate change, which is what the general revision graph reduces to for the single-authority-with-branches case. It can grow into a DAG later without changing the identity scheme.

Tenants and entities travel by `public_key`. Children travel by `(root public_key, ordinal)`, which is portable because ordinals are stable ids per root; concurrent ordinal allocation on two nodes is exactly a conflict on the root and is caught by the base check. Catalog values travel by value.

---

## 8. Concurrency and value identity for shared immutable catalogs

### Correction
`UPDLOCK, HOLDLOCK` on an **existing** catalog value holds an update lock until commit and blocks every other transaction that touches the same value. Two contacts named "Juan" created concurrently would serialize; "México" would serialize a whole tenant. The review's §11.3 implied that pattern; it is wrong for the hit path.

### The pattern: read without hints; lock only on a miss
```sql
CREATE OR ALTER PROCEDURE [contacts].[person_name_intern] (@name NVARCHAR(256), @person_name_id INT OUTPUT)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @person_name_id = [person_name_id] FROM [contacts].[person_name] WHERE [name] = @name;   -- hit: shared lock, released immediately
    IF @person_name_id IS NOT NULL RETURN;

    INSERT [contacts].[person_name] ([name],[name_normalized])
    SELECT @name, [contacts].[normalize_name](@name)
     WHERE NOT EXISTS (SELECT 1 FROM [contacts].[person_name] WITH (UPDLOCK, HOLDLOCK) WHERE [name] = @name);
    IF @@ROWCOUNT = 1 SET @person_name_id = SCOPE_IDENTITY();
    ELSE SELECT @person_name_id = [person_name_id] FROM [contacts].[person_name] WHERE [name] = @name;
END;
```
Behavior on a race: T1 inserts "Nuevo" (row X-locked, uncommitted). T2 misses on its plain read, then its `NOT EXISTS … UPDLOCK, HOLDLOCK` blocks on T1's row. If T1 commits, T2 sees the row, inserts nothing, re-reads the id. If T1 rolls back, T2 inserts. No duplicate-key error is ever raised, which matters because under `XACT_ABORT ON` a caught constraint error still dooms the transaction. The range lock T2 takes when it does insert covers the key gap around the new value until commit; with a dense catalog that gap is narrow, and it only blocks other **inserters** of neighboring new values, never readers. If a specific catalog shows gap contention, `sp_getapplock` keyed by `(catalog, value)` on the miss path is the more precise alternative.

Catalogs without a unique key (`city`, `colony`) accumulate duplicates under any pattern. Give them a unique key scoped to the parent, `(state_id, city)`, or accept duplicates explicitly and stop calling them catalogs.

### Value identity for names
Today `person_name.name` has `UNIQUE ([name])` under the database's default collation, which the database creator does not set (the `COLLATE` line is commented out), so it inherits the **server** default. On a `CI_AS` server "Jose" and "jose" are one row and the first spelling wins; on the once-considered `CI_AI` they would merge with "José" too. Audit fidelity would then depend on which server the customer installed on. Fix it in the schema:

- Store the value **exactly as entered**: `[name] NVARCHAR(256) COLLATE Latin1_General_100_BIN2 NOT NULL` with the unique constraint on it. History then resolves to the exact spelling forever.
- Add `[name_normalized] NVARCHAR(256) COLLATE Latin1_General_100_CI_AI NOT NULL` (upper-cased, or just relying on the CI_AI collation) with a non-unique index for search, autocomplete and duplicate suggestions.
- Matching for **business** purposes ("is this the same person?") uses the normalized column and is a domain decision; **audit** uses the exact row.
- The same split applies to `email` (store exactly; normalize lower-case for matching) and to location names.

Historical references: catalog rows are immortal and immutable, so an id in a history row means the exact value forever. Correcting a typo re-points the junction to another catalog row and writes a new history row; the catalog is never edited. Erasure re-points to the sentinel row. Tenant visibility: values are global, but a tenant can only reach them through its own junctions; autocomplete must query through tenant-owned rows, never the raw catalog, or one tenant's names leak to another.

### The dictionary approach on its merits

| Dimension | Inline `NVARCHAR` | Interned `INT` reference |
| --- | --- | --- |
| Live storage, 1M contacts × 3 name parts, avg 8 chars | ≈ 54 MB | ≈ 12 MB + catalog (≈ 50k names, ≈ 2 MB) |
| History storage at 5 versions per contact | ≈ 270 MB | ≈ 60 MB |
| Emails and phones (mostly unique per person) | no difference in live size | no dedupe; still narrow history rows |
| Write cost | none | one index seek per value; range lock only on a miss |
| Read cost | none | one join per value; views already do it |
| Same-value identity ("same email on two contacts") | string compare, collation-dependent | exact row identity |
| Erasure | rewrite every occurrence in live and history | re-point junctions to the sentinel |
| Schema-drift and collation risk | per column | centralized on the catalog |

Storage savings are real but modest at these scales; narrow history rows are the more useful saving because history is the table that grows without bound. The decisive benefits are value identity and erasure by re-pointing. Costs are a seek per value on write and a join on read. Verdict: keep interning for names and locations (high reuse), keep it for emails and phones for the erasure and narrow-history reasons, and leave free text (`address1`, `summary`) inline.

---

## 9. What enforces committed-history protection

### What ownership chaining does and does not give you
When the application principal executes a procedure owned by `dbo` that touches tables owned by `dbo`, SQL Server does **not** check the principal's table permissions. Therefore table-level `DENY UPDATE, DELETE` (and `DENY INSERT` on the ledger and history) to the application principal:

- **Prevents**: any direct DML against ledger or history from that principal: ORM or Dapper mistakes, ad-hoc scripts run with the application connection, injected DML that escapes a procedure call, a `db_datawriter` grant added later by mistake. Direct `INSERT` into the ledger without the helper is also prevented.
- **Does not prevent**: any UPDATE or DELETE inside a procedure the principal may execute. The in-transaction history upsert of §1, the erasure procedure, and any bug in any procedure all pass.

So the guarantee is precise: **history can only change through the procedure layer**, and the procedure layer is the trusted code. That matches the spec's threat model (hostile users and buggy application code, not hostile DBAs). Do both things: grant the principal nothing but EXECUTE on public procedures and SELECT on views, and add the explicit DENYs so a later broad grant cannot silently widen the surface.

### Constraining the procedure layer itself
1. **CI text assertion** over procedure definitions: every `UPDATE` or `DELETE` whose target is a `*_history` table or `data.dbrow_version` must either carry the predicate `[dbrow_version] = @dbrow_version` (the §1 in-transaction upsert) or live in the one erasure procedure. Anything else fails the build. This is cheap and catches the realistic failure, which is a developer copying the wrong pattern.
2. **Erasure under a distinct execution context.** `entities.entity_erase` runs `WITH EXECUTE AS 'audit_redactor'`, a user that alone holds UPDATE on history tables in a separate `audit` role; ordinary procedures never run as it. This does not stop a buggy ordinary procedure from updating history through chaining, but it makes the one legitimate rewriting path visibly different in the catalog and in permission reports.
3. **Reconciliation query in tests**: every `(tenant_id, dbrow_version)` referenced by history, spine or event rows exists in the ledger; every ledger row has at least one spine row; no history row has a version greater than its aggregate's current version.

If a stronger boundary is ever required, the option is to put history tables under a different owner so chaining breaks and procedures need explicit INSERT-only grants; that forbids the §1 upsert and would force a finalization design. I would not pay that until a customer needs it.

### Tests under the application principal
Run each as `EXECUTE AS USER = 'app_principal'`:

| Test | Expected |
| --- | --- |
| `UPDATE contacts.contact_history SET full_name = …` | permission denied (229) |
| `DELETE data.dbrow_version WHERE …` | permission denied |
| `INSERT data.dbrow_version …` | permission denied |
| `EXEC contacts.contact_phone_update …` twice in one transaction on the same phone | one history row at that version with the final values |
| `EXEC entities.entity_erase …` by a principal in the redaction role | history rows redacted, op-10 ledger row present |
| Same erase by an ordinary principal | permission denied on EXECUTE |
| Helper called with a committed version from a new transaction | 51009 |
| Helper called from another session with a version the first session allocated | 51009 |

---

## 10. Smallest reference implementation, what must settle first, and where performance will bite

### Bounded object set (about eighteen objects)

| Layer | Objects |
| --- | --- |
| data | `dbrow_version_ensure` v2 (§3), `recorded_at` and origin columns, `origin` table, `local_origin_uid()` function, `tenant_insert` via helper |
| entities | `entity_id_seq`, `actor_resolve`, `entity_lock`, `entity_bump`, `entity_insert` (INOUT id, no self-creation), `entity_update` (root payload), `entity_soft_delete`, `entity_undelete`, `entity_as_of` (table-valued function) |
| contacts | `person_name_intern` (the catalog pattern), `contact_insert` (pass-through), `contact_update`, `contact_phone_insert` / `contact_phone_update` / `contact_phone_delete` (one full child family), `contact_as_of` |
| security | `user_insert` (self-registration, promotion), `user_role_assign` / `user_role_revoke` with history, `tenant_bootstrap` |

### Behavioral and concurrency tests
- **Reconstruction**: fraud scenario across three transactions; phone added, changed, deleted across three versions, each version reconstructs; `111 → 222 → 333` in one transaction yields one history row with 333; insert-then-delete in one transaction yields no history row and one spine row; delete then undelete round trip.
- **Tenant isolation**: actor from another tenant rejected; existing contact of another tenant rejected on promotion; tenant-defined role not assignable across tenants; role name lookup fails loudly when missing.
- **Self-registration**: `created_by = modified_by = entity_id`; no `UPDATE` executed against the ledger (assert via a temporary trigger in the test database only, or by comparing `recorded_at` and actor to allocation-time values); company auto-created in the same transaction shares the version; self-creation via `entity_insert` directly rejected; System User bootstrap yields entity type `user`.
- **Nested writes**: two NULL calls join; supplied mismatching version fails with 51009; join with a different actor fails with 51005; late-discovered aggregate with interleaved commit fails with 51012 and leaves no partial writes; opposite-order lock acquisition on two connections yields one 1205 and a consistent spine after retry.
- **Shared catalogs**: twenty connections interning the same new name produce one row and no error; twenty connections reading an existing popular name show no lock waits.
- **Reuse guard**: committed version reused in a new transaction, same session, rejected; other session, rejected.
- **Change Tracking**: allocate A, allocate B, commit B, commit A; `CHANGETABLE` orders B before A; a cursor older than `MIN_VALID_VERSION` triggers reinitialization.
- **Permissions**: the §9 table.

### Settle before migration versus safely later

| Must settle before migrating procedures | Can wait |
| --- | --- |
| One ledger row per transaction, auto-join, session marker (§3) | Change Tracking export worker and consumer (§6) |
| `entity_lock` / `entity_bump` protocol and error numbers (§4) | Companion commit journal (§6) |
| Net-transition history rule and the `dbrow_version = @v` upsert (§1) | Import receipt and conflict staging workflow (§7) |
| Actor resolution, pre-allocated entity ids, self-registration flag, tenant bootstrap (§5) | Domain merge policies |
| Tenant / shared / global classes and the `user_insert` checks (§2) | Anonymous and integration actor seeding |
| Catalog interning pattern and explicit collations on catalog columns (§8) | Journal-based historical ordering |
| Permission model and CI text assertion (§9) | Erasure procedure (after sentinel rows exist) |
| Ledger columns `recorded_at`, `origin_uid`, `origin_dbrow_version` (cheap now, a migration later) | Anything that reads them |

### Workloads most likely to expose weaknesses at millions of records
1. **Reconstruction of a hot aggregate with a long history.** All history primary keys lead with `dbrow_version`; without `(entity_id, dbrow_version)` and `(contact_id, ordinal, dbrow_version)` nonclustered indexes, `contact_as_of` scans. Add them before measuring anything else.
2. **A hub aggregate.** Ten thousand employees related to one company: if a relationship change bumped the company, every hire would serialize on the company's root lock. The rule "a relationship belongs to `from_contact_id`" exists to prevent exactly this; test it with a hub.
3. **Popular catalog values.** Must show zero waits on the hit path after the §8 correction; measure `sys.dm_os_wait_stats` deltas during a burst of inserts sharing common names and cities.
4. **History append rate.** About five rows per business change plus one Change Tracking internal row. The transaction-leading clustered keys append at the end, which is good; the new entity-leading nonclustered indexes insert randomly. Measure page splits and log bytes per operation, and set fill factors accordingly.
5. **Spine inserts.** `entity_version_history` is clustered on `(entity_id, entity_version)`, so inserts scatter by entity. Acceptable, but watch fragmentation on the busiest deployments.
6. **Change Tracking side tables.** Growth is proportional to ledger inserts within the retention window; autocleanup is periodic. On a large tenant with 30-day retention this is millions of small rows; confirm cleanup keeps pace.
7. **Restart storms under 51012 and 1205.** If a workload deliberately writes to overlapping aggregate sets from many connections, restarts multiply. Measure retry rates; ordering the known aggregate set removes most of them.

---

## Where I think a question assumes the wrong problem

- **Question 3** assumed the stored engine transaction id was the mechanism. It was my proposal, and it is not reliable across restore or clone. The session marker is, and it also enables auto-join, which removes most of question 4's difficulty.
- **Question 4** assumed composability needs either strict rejection of late aggregates or a transaction-context framework. The invariant lives in one statement, so it can be asserted where it matters and nowhere else.
- **Question 6** implicitly asked for permanent commit order. Synchronization between nodes that meet within retention does not need it, and per-aggregate audit never needs it. Only very long offline branches or forensic tenant-wide replay do, and that is an opt-in journal.
- **Question 8** correctly caught that my catalog locking advice would serialize unrelated work. The corrected pattern is above.
- **Question 1** treats intermediate in-transaction states as something history might need to preserve. Under the root lock nobody can observe them, so they are not audit facts; business intent belongs in events.
- **Question 2** asks how to distinguish global definitions from tenant assignments; the schema already does, through nullable `tenant_id` on `role`. What is missing is the audit trail on the assignment and the two failing-loudly checks in `user_insert`.
