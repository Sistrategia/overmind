# Audit foundation — independent review v3

Date: 2026-09-05.
Status: independent review of the whole `dbrow_version` / audit-trail thread; recommendations for decision, not implementation.

Reviewed: [original analysis](dbrow_version-allocation-analysis.md), [analysis v2](dbrow_version-allocation-analysis_v2.md), [primary design](dbrow_version-allocation-design.md), [chained-history alternative](dbrow_version-allocation-design-immutable-chained-history.md), [session handoff](dbrow_version-design-session-handoff.md), [ADR 0001](adr/0001-dbrow-version-allocation-helper.md), `AGENTS.md`, the upstream spec `SistrategiaDataAnalysis/schema-analysis/05-design-recommendations.md` (§2, §5, §6, §7, §8, §10) and `06-research-audit-temporal.md`, and every SQL script, schema builder and test under `src/Framework/Sistrategia.Data.SqlClient` and `tests/sql`.

> **Scope note (user clarification, 2026-09-05).** This repository is a **remake** of the platform, not the complete code of the previous products. It deliberately contains only the bare-minimum partial schemas and the three insert procedures needed to reach a first user insertion. The absence of update, delete, undelete and child-history procedures is therefore expected at this stage, not neglect. The purpose of this partial implementation is to settle the **mechanisms** (allocation, transaction ownership, locking, actor and tenant resolution, history shape) that will then be applied across all the code still to be migrated from the earlier generations. Every finding below should be read in that light: the value of fixing something here is that it is fixed once, before it is stamped into dozens of procedures.

---

## 1. Verdict in one page

**The allocation decision is right and is now correctly implemented.** A database-local BIGINT sequence with gaps, one ledger row per business transaction, `entity_version` as the user-facing aggregate revision, and the `data.dbrow_version_ensure` helper are the correct kernel. Nothing in this review argues for reopening that.

**The mechanisms still to settle are the ones the migrated code will copy.** Since analysis v2 the documents have grown toward distributed identity, revision graphs, CDC-based commit indexes and cryptographic anchoring. Those are legitimate future questions, but they are not what the migration will stamp into every procedure. What will be stamped is: how a mutating procedure locks its aggregate before allocating, how it resolves the actor and tenant, how it writes child history, and how delete and undelete work. Today the reference inserts still **silently attribute unknown actors to the System User**, fall back to the highest tenant, accept caller-supplied audit time, and write no child history rows. If those patterns are migrated as they stand, the audit that customers praise (who changed what, delete and undelete, reconstruction) would be weaker in the remake than in the products it replaces.

**Recommendation:** before migrating the bulk of the procedures, settle the canonical write mechanism on one reference family (§5), fix the short list of attribution and integrity defects in the existing inserts so they are not copied (§4), and shrink the distribution proposal to the two concrete workflows the user actually described (§6). Adopt SQL Server **Change Tracking**, not CDC, as the commit-order primitive for synchronization. Treat whole-tenant "as of" reconstruction as a backup/PITR feature, not a ledger feature.

---

## 2. What is true in the code today (evidence)

Facts checked against the scripts on branch `dev` at commit `19fc2cb`. Given the scope note above, the table separates two kinds of observation: **defects in the mechanisms already written** (which the migration would copy) and **coverage not yet migrated** (expected, listed so the migration checklist is complete).

| Area | Observation | Consequence for audit |
| --- | --- | --- |
| Allocation | Sequence + ledger insert live only in `data.dbrow_version_ensure`; three public procs call it with INOUT versions; 80 concurrent allocations tested. | Settled. Good. |
| Ledger row | `modified` is the caller-supplied `@created` (defaults differ: `SYSUTCDATETIME()` in `entity_insert`, `GETUTCDATE()` in the other two). No server-stamped time. | The audit's "when" can be set by the caller. A bug or a hostile client can back-date an operation. |
| Actor | `COALESCE((SELECT entity_id … WHERE public_key = @created_by), 1)` in `entity_insert`, `contact_insert`, `user_insert`. | An unresolvable actor becomes System User and the ledger looks legitimate. This is the single most damaging silent behaviour for an audit product. |
| Tenant | `user_insert`: `IF @tenant_id IS NULL SET @tenant_id = (SELECT MAX(tenant_id) FROM data.tenant)`. | A user can be created in the wrong tenant with no error. |
| Bootstrap | `entity_insert` treats `@created_by = @public_key` as self-creation and makes the new entity its own actor. Any caller can trigger it with two fresh GUIDs. | Unauthenticated self-attribution path in the data layer. |
| Reuse proof | Helper validates ledger existence, tenant and actor. ADR 0001 admits it cannot prove the row belongs to the *current* transaction. | A committed version can be reused in a later transaction, misrepresenting two commits as one. |
| Child history (coverage not yet migrated) | `contact_insert` writes `contact_email` and `contact_phone` but **no** `contact_email_history` / `contact_phone_history` rows. `contact_address`, `contact_person_name`, `contact_relationship`, `security.user`, `security.user_role` have **no history table yet**. `contact_phone` and `contact_address` lack `dbrow_version`. | Expected at this stage. Listed so the migration checklist covers it: reconstruction of "contact as of version 1" (spec §2.2 step 3) needs the op-1 child rows, and a name, address, company relationship or role change must leave a trace once those families are migrated. |
| Existing-contact user path (mechanism) | Inserts `security.user` with no history row and does not bump `entity_version` or write a spine row. | Converting a contact into a user is invisible to the aggregate's version history. Settle the rule now (spec §6.3: one entity, one version, one spine) because every multi-level extension will copy it. |
| Lifecycle procedures (coverage not yet migrated) | No update, soft-delete, undelete or erase procedure exists yet. | Expected. The point is that the first ones written become the template; §5 proposes writing them on one reference family before the bulk migration. |
| FK enforcement | `contact_phone` and `contact_address` FKs are `WITH NOCHECK` + `NOCHECK CONSTRAINT`. Spec §8 forbids this. | Orphans possible; inherited defect #5 in spec §8.1 is still open. |
| Column drift | `contact_phone_history.extension` is `NVARCHAR(10)` while `contact_phone.extension` is `NVARCHAR(25)`. `contact_history` has `line_of_business_id`; `contact` does not. | A 25-character extension will fail the history insert. The drift the research doc warns about is already present. |
| Indexes | All history PKs lead with `dbrow_version`. No `(entity_id, dbrow_version)` index on `entity_history`, no `(contact_id, dbrow_version)` on `contact_history`. | Per-aggregate reconstruction scans. Fine now, painful at millions of rows. |
| Bootstrap writers | `tenant_insert` hard-codes ledger version 1 for every new tenant and declares `@dbrow_version INT`. `InsertSystemUser` reserves a sequence value, then inserts `MAX()+1` and hard-codes version 1. | Two writers outside the helper, one active `MAX()+1`. Already noted in ADR 0001; still open. |
| Operation vocabulary | All ten codes seeded, including DELETE(3), UNDODL(5), ERASED(10). | Good. The vocabulary exists; the procedures that use codes 2 to 10 do not. |
| Tests | Behavioural SQL suite plus 4×20 concurrent allocations. No reconstruction test, no update/delete test, no fraud-scenario test. | The tests prove allocation; they cannot yet prove the product promise. |

---

## 3. Assessment of each document

### 3.1 Original analysis
Correct on the decision. Its claim that allocation order is "fine for as-of queries" was too broad; v2 qualifies it properly. Its stale checklist and the XACT_ABORT leak claim have been corrected. Keep as history.

### 3.2 Analysis v2
The two most valuable technical insights in the entire thread are here and I agree with both:

- **§4.1 allocation order is not commit order.** A late lower-numbered commit breaks any `> last_id` export cursor and any tenant-wide `<= N` snapshot.
- **§4.2 aggregate order needs root protection before allocation.** Without it, the numeric-bound reconstruction algorithm and the version spine can disagree.

§4.3 (application timestamps are not commit timestamps) and §4.5 (a transactional tenant counter buys a stable committed prefix at the cost of per-tenant serialization) are also correct. Where v2 overreaches is §3 and §7: it widens the requirement set to distributed merge and tamper evidence before those were requirements. The handoff already records the user's clarification that they are not.

### 3.3 Primary design
Thoughtful and internally consistent, but it is a design for a considerably larger product than the one described in the handoff. Specific concerns:

- **CDC as a prerequisite** for tenant-wide reconstruction and ordered export. CDC needs SQL Agent, is absent on Express, has retention management, and is asynchronous. For deployments that are "one database, often one tenant" with unreliable connectivity in Mexico, that is a heavy operational tax. SQL Server **Change Tracking** gives commit-ordered change versions on every edition without Agent and was built for exactly the disconnected-sync case (see §6.2).
- **Four identities** (`transaction_uid`, `origin_uid`, `revision_uid`, `request_uid`). The handoff's later position is better: `(origin_uid, source dbrow_version)` is already a portable transaction identity. Add `request_uid` only at the API boundary for idempotency. Do not add a random UUID index to every ledger row until a consumer needs it.
- **Revision DAG with parents and merges.** Correct theory, premature machinery. Defer until a second real multi-writer workflow exists.
- **Whole-tenant committed boundary as a ledger feature.** I would not advertise it from the ledger at all. Per-aggregate reconstruction is the product feature customers use; whole-database "as of Tuesday 15:00" is what backups and point-in-time restore already provide.

What to keep from it: the vocabulary separation (allocation ID vs. commit order vs. recorded time vs. effective time), the canonical write protocol in §5, the acceptance cases in §11, and the honesty about what a BIGINT does and does not prove.

### 3.4 Chained-history alternative
Well reasoned and honest about its limits. Spec §10 already recorded the operator decision: the threat model is hostile users, not DBAs, and PITR is the backstop. Nothing the user has said since changes that. If a customer ever requires tamper evidence, SQL Server 2022 ledger tables on one dedicated evidence table (its own §9) is the pragmatic route. Keep the document; do not schedule it.

### 3.5 ADR 0001
A sound, well-scoped decision. Two things I would change:

- It states "no session token or engine transaction-ID machinery is introduced here". The engine already provides `CURRENT_TRANSACTION_ID()` (SQL Server 2016+). One `xact_id BIGINT` column on the ledger, written at allocation and compared on reuse, closes the admitted ownership gap for the cost of one comparison (§4, item 5).
- It does not say where **root locking** sits relative to allocation. That is the next contract and deserves ADR 0002 (§5.1).

### 3.6 Session handoff
Accurate. Its "latest assistant recommendation" (origin identity, source transaction number, idempotent import, versioned envelope, defer the DAG) is the right shape. I add one thing to it: use Change Tracking for the sync cursor.

---

## 4. Tier 0 — attribution and integrity fixes (small, do first)

These are hours of work each and every one of them protects the "who / when / which tenant" that customers trust.

1. **Fail on unknown actor.** Replace every `COALESCE(…, 1)` actor resolution with `THROW`. System User attribution is allowed only through an explicit bootstrap path. The fallback exists today only because self-registration cannot resolve an actor that does not exist yet; §10 shows how to remove that need so the fallback can go.
2. **Fail on unresolved tenant.** Remove the `MAX(tenant_id)` fallback in `user_insert`.
3. **Make self-creation explicit and confined.** Replace the inferred `@created_by = @public_key` coincidence with an explicit parameter, allow it only where actors are created (`user_insert` and tenant bootstrap), and pre-allocate the entity id so no post-insert correction of `entity` or the ledger is needed. Full analysis and options in §10.
4. **Server-stamp the ledger.** Add `recorded_at DATETIME2 NOT NULL` set inside the helper from `SYSUTCDATETIME()`, never from a parameter. Keep `modified` as the business/effective time for now and document the distinction. Standardize on `SYSUTCDATETIME()` everywhere.
5. **Bind allocation to the current transaction.** *Superseded by [answers §3](dbrow_version-independent-review-v3-answers.md):* a stored `xact_id` column is not reliable across restore or clone. Use a session-scoped marker instead: the helper stores `CURRENT_TRANSACTION_ID()` and the allocated version in `SESSION_CONTEXT` on allocation, and accepts a supplied or ambient version only when the marker matches the current transaction. No durable column. The same marker lets a NULL call inside an already-allocating transaction join it automatically, so one SQL transaction yields at most one ledger row.
6. **Route the two bootstrap writers through the helper.** `tenant_insert` and `InsertSystemUser` should call `dbrow_version_ensure`; remove the hard-coded version 1 and the active `MAX()+1`. Fix `DECLARE @dbrow_version INT` to `BIGINT`.
7. **Fix the column drift now** (`extension` width, `line_of_business_id`) and enforce the `contact_phone` / `contact_address` FKs `WITH CHECK`.
8. **Type users as users.** `user_insert` calls `contact_insert`, which stamps `entity_type_id` = contact (2) on the entity row; `InsertSystemUser` stamps type 1. Both should be type 4 (`user`), which is what `entity_type.database_table = 'user'` already implies and what the "actors are users" rule in §10.3 needs. Add an optional `@entity_type_id` to `contact_insert` so a subtype can pass its own type through.

---

## 5. Tier 1 — settle the canonical write mechanism on one reference family before the bulk migration

The remake will migrate many procedures from the earlier generations. The cheapest moment to get the audit mechanism right is before that migration starts, on one fully worked family that then serves as the template (spec §6.2 already proposes stamping procedures from a checked skeleton). Everything in this section is about that template.

### 5.1 The write protocol that makes numeric-bound reconstruction sound (ADR 0002)

The key insight, stated plainly: **if every change to an aggregate takes an update lock on its root row before allocating a version, then within that aggregate allocation order equals commit order.** Transaction A cannot allocate until B, which holds the root, commits or rolls back. That is exactly the scope spec §2.2 needs. The tenant-wide problem from v2 §4.1 remains, but it belongs to sync (§6), not to audit reconstruction.

Concrete order for every mutating procedure:

```sql
-- 1. Resolve actor and tenant explicitly; THROW on failure.
-- 2. Lock the root(s) in ascending entity_id order, then validate the optimistic token.
SELECT @current_version = [entity_version]
FROM [entities].[entity] WITH (UPDLOCK, HOLDLOCK)
WHERE [entity_id] = @entity_id AND [tenant_id] = @tenant_id;
IF @current_version IS NULL THROW 51010, 'Entity not found in tenant.', 1;
IF @expected_entity_version IS NOT NULL AND @expected_entity_version <> @current_version
    THROW 51011, 'Stale entity_version.', 1;
-- 3. Only now allocate (or join) the audit transaction.
EXEC [data].[dbrow_version_ensure] … @dbrow_version = @dbrow_version OUTPUT;
-- 4. Mutate; 5. write history rows with the ROW operation; 
-- 6. UPDATE entity SET entity_version += 1, dbrow_version, modified, modified_by; INSERT spine row;
-- 7. event_create; commit if owner.
```

Rules to record in the ADR: the affected aggregate set is discovered before step 2, never extended after step 3; multi-aggregate operations lock in deterministic order; a child change bumps only its owning aggregate (decide and document that a `contact_relationship` belongs to `from_contact_id`); repeated changes to one row inside one unit of work leave one history row.

### 5.2 Write the lifecycle once, as the template

Implement, as reference code for the canonical template, on `entity` + `contact` + one child family (phone or email):

- `*_update` with the optimistic token (op 2).
- `entity_soft_delete` (op 3) and `entity_undelete` (op 5) exactly as spec §7.1–7.2 describe. This is the "delete and undelete" customers praise; the earlier generations carried the codes without a uniform implementation, and the remake is the chance to make it mechanical.
- Child insert/update/delete with history written before the physical junction delete, ordinal allocated under `UPDLOCK, HOLDLOCK` on the contact's junction range (spec §5), no renumbering.
- `entity_erase` (op 10) can follow once sentinel catalog rows exist; do not block delete/undelete on it.

### 5.3 History coverage checklist for the migration

These are not defects of the current partial code; they are the coverage the migration must bring in, listed so nothing is inherited silently a fourth time (spec §8.1).

- Write `contact_email_history` and `contact_phone_history` rows (op 1) in `contact_insert`.
- Add `dbrow_version` to `contact_phone` and `contact_address`; add `contact_address_history`.
- Decide where names live: either `contact_person_name` gets a history sibling or names become root payload snapshotted in `contact_history`. Today a name change is unauditable.
- Add `contact_relationship_history` (a "works for" change is a business change).
- Add `user_history` that records credential *changes* without storing hashes, and make the existing-contact user path bump `entity_version` and write a spine row (spec §6.3: one entity, one version, one spine).
- Add the missing `entity_history → entity` FK for consistency with `contact_history`.

### 5.4 Make reconstruction a shipped artifact, with tests

- `contacts.contact_as_of(@contact_id, @entity_version)` and a two-bound diff, implemented as the §2.2 algorithm inside one snapshot transaction. This is the audit viewer's engine and the thing to demo.
- Tests to add to the existing harness: the fraud scenario (change, act, revert leaves three versions with actors and times); delete then undelete round trip; add and remove a phone then reconstruct each version; two concurrent updates to one contact yield serialized versions or a stale error; a nested writer that adds an unlocked aggregate after allocation is rejected.
- A metadata assertion in CI: every table with `dbrow_version` has a `_history` sibling with matching column names and types; every procedure that writes such a table also writes its history. Cheap, and it is the real replacement for per-procedure discipline (spec §6.2).

### 5.5 Indexes and growth

Add nonclustered `(entity_id, dbrow_version DESC)` on `entity_history`, `(contact_id, dbrow_version DESC)` on `contact_history`, and `(contact_id, ordinal, dbrow_version DESC)` on child histories. Keep the transaction-leading clustered keys for "what happened in transaction T". Measure before partitioning; write amplification per business change is about five rows, which is acceptable.

---

## 6. Tier 2 — synchronization and migration (the distribution the user actually needs)

### 6.1 Identity
`data.origin (origin_uid UNIQUEIDENTIFIER PK, created, description)` with one row per writable database incarnation. A restored copy that is allowed to diverge gets a new origin before accepting writes. `(origin_uid, dbrow_version)` is the portable transaction identity. No per-row UUID, no hash.

### 6.2 Commit-ordered export without CDC
Enable SQL Server **Change Tracking** on the database and on `data.dbrow_version`. Change Tracking is available on every edition including Express, needs no SQL Agent, and assigns its change version at **commit** time, which is precisely what defeats the late-lower-number problem in v2 §4.1. Export reads under `SNAPSHOT` isolation:

```sql
SELECT ct.SYS_CHANGE_VERSION, v.*
FROM CHANGETABLE(CHANGES [data].[dbrow_version], @last_sync_version) AS ct
JOIN [data].[dbrow_version] AS v ON v.tenant_id = ct.tenant_id AND v.dbrow_version = ct.dbrow_version
ORDER BY ct.SYS_CHANGE_VERSION;
```

Persist the consumer's cursor; validate it against `CHANGE_TRACKING_MIN_VALID_VERSION` and reinitialize on a retention gap. Verify the commit-order property with an explicit two-connection test (allocate A, allocate B, commit B, commit A, assert B precedes A) before relying on it. If a permanent commit-order column is ever wanted, stamp it from these versions asynchronously; do not make it a prerequisite for audit.

### 6.3 Import and reconciliation
`data.import_map (origin_uid, source_dbrow_version, local_dbrow_version, applied_at, status)` unique on the source pair makes import idempotent. Each accepted source transaction allocates a **new local** `dbrow_version` through the helper and keeps the mapping; late imports never insert into old local numbering. An incoming operation names its base `entity_version`; apply when it matches, stage for review when it does not, merge only under an explicit per-domain rule. Record the reconciliation as a new linked transaction. No DAG until a second multi-writer workflow demands it.

### 6.4 Historical migration
Separate tool, same identity rules: one origin per source database, source outcomes preserved as history rows with their recorded actors and times in `modified`, import time in `recorded_at`, legacy ordering marked approximate. Never replay old commands through current business rules.

### 6.5 Evidence envelope
A versioned JSON document per ledger transaction generated with `FOR JSON` from the ledger, spine and history rows. Typed, versioned, no canonicalization until something hashes it.

---

## 7. Explicitly not recommended now

| Item | Why not |
| --- | --- |
| Transactional tenant counter | Serializes every write to a tenant; tenant contiguity was never a requirement; folios use `data.sequence`. |
| CDC as a release prerequisite | Edition, Agent and retention burden for small on-premises deployments; Change Tracking covers the sync need. |
| Per-row random `transaction_uid` | `(origin_uid, dbrow_version)` already identifies the transaction portably. |
| Revision DAG, fenced ownership transfer, distributed snapshot manifests | No concrete multi-writer workflow yet. |
| Hash chains, Merkle checkpoints, external anchoring | Threat model excludes hostile DBAs; PITR is the backstop; SQL 2022 ledger tables if that ever changes. |
| Whole-tenant "as of" from the ledger | Backups and PITR already provide it; the ledger's promise is per-aggregate. |

---

## 8. Where I disagree with or qualify the existing documents

- **v2 §1 and primary design §6**: a durable commit-order index is not needed to advertise the audit product. It is needed for sync, and Change Tracking is the cheaper primitive.
- **Primary design §3**: too many identities. Start with origin plus local number.
- **ADR 0001**: introduce the engine transaction ID; it is the cheapest available proof of ownership.
- **Original analysis**: "fine for as-of queries" holds only per aggregate and only with root locking before allocation.
- **Handoff**: agree that a serialized local client (SQLite, Electron) has the simpler problem; the same schema shape with a local counter works there, and Change Tracking on the server side is what lets that client resume safely.

---

## 9. Suggested sequence for the next sessions

1. ADR 0002: root-lock-before-allocation protocol, aggregate ownership rules, error numbers 51010+. ADR 0003: actor policy and self-registration bootstrap (§10). Implement Tier 0 in the same change set; they are small.
2. Reference implementation: `contact_update`, `entity_soft_delete`, `entity_undelete`, phone family insert/update/delete, `contact_as_of`; extend the SQL harness with the tests in §5.4.
3. History coverage sweep (§5.3) plus the CI metadata assertion.
4. Origin table, Change Tracking export, import map, one disconnected-branch pilot.
5. Migration tool and evidence envelope.
6. Revisit distribution and tamper evidence only against a named customer need.

The thread's documents are good thinking. The product's advantage is realized in the procedures customers actually call. In a remake, the moment those procedures are migrated is the moment the mechanism becomes hard to change, so the mechanism deserves to be settled first, on the small reference set that exists today.

---

## 10. Actor resolution and the self-registration bootstrap

Added 2026-09-05 after the user asked for deeper thinking on the step that "corrects" `created_by` / `modified_by` from System User to the entity that is creating itself.

### 10.1 Why the correction exists

`created_by` and `modified_by` are `INT NOT NULL` and semantically must reference a **user** entity. When a person self-registers, the actor is the very row being inserted, and with `IDENTITY` its `entity_id` is unknown until the INSERT returns. The chain is `user_insert → contact_insert → entity_insert`, and the ledger row is created at the top of that chain, before the entity exists. So the code resolves the actor to System User (1) as a placeholder, inserts, and then, inside the same transaction, rewrites `entity.created_by`, `entity.modified_by` and `data.dbrow_version.modified_by` to the new id. The committed state is correct.

The user's own analysis is right: this is the **only** case where an actor genuinely cannot be resolved before the write, because the actor is the row being created. Every other actor is a pre-existing user. The remaining question is not *whether* the actor should be self (it should), but *how* to get there without a placeholder, and *who* is allowed to trigger it.

### 10.2 Why the placeholder-then-correct shape is worth removing

1. It is the only place the ledger is ever `UPDATE`d. Everything else in the design treats `data.dbrow_version` and the history tables as append-only. Removing this one exception lets the ledger be declared immutable and protected (§11.5).
2. It is why the `COALESCE(…, 1)` actor fallback exists at all. As long as the self case needs System User as a stand-in, every procedure keeps a path that silently attributes to System, and that path also catches genuine bugs (wrong GUID, deleted actor, wrong tenant). Solve the self case properly and the fallback becomes a plain `THROW`.
3. The trigger is an inferred coincidence (`@created_by = @public_key`) rather than a stated intent, and it is honored by `entity_insert` for **any** entity type, although a non-user entity can never be an actor.
4. The helper's reuse check compares the ledger actor with the resolved actor; the bootstrap must rewrite the ledger before nested calls (for example the auto-created company) can pass that check. It works, but only because of ordering that a future reader has to rediscover.

### 10.3 Recommended design: pre-allocate the entity id, resolve the actor once, pass scalars down

**Pre-allocate.** Replace `IDENTITY` on `entities.entity.entity_id` with a sequence (`entities.entity_id_seq`) and a column default of `NEXT VALUE FOR`. `entity_insert` treats `@entity_id` as INOUT exactly like `@dbrow_version`: allocate when NULL, use when supplied. Nothing else changes for ordinary callers. With the id known before any write, a self-registration is a plain insert with `created_by = @entity_id`, and the ledger is written once with the correct actor. If a self-referencing FK `entity.created_by → entity.entity_id` is ever added, SQL Server accepts a row that references itself within one statement, so that becomes possible too. The remake is the right moment for this: `IDENTITY` cannot be removed in place on a deployed table, only rebuilt.

**Resolve once, in one place.** Introduce `entities.actor_resolve(@actor_public_key, @tenant_id, @actor_id OUTPUT)` as the single implementation of the actor rule, mirroring what `dbrow_version_ensure` did for allocation. It resolves the GUID, requires the entity to be a user (entity type `user`, or `is_system = 1`), applies the tenant policy in §10.4, and `THROW`s otherwise. Public procedures accept the GUID and call it; nested procedures accept the already-resolved `@actor_id INT` and never re-resolve. That removes the need for a nested procedure to understand self-registration at all.

**Confine self-registration to where actors are created.** Only `user_insert` (and the tenant bootstrap, below) may create an actor. Give it an explicit `@self_registration BIT = 0`. When set, it allocates `@entity_id` from the sequence, uses that value as `@actor_id`, calls the helper with it, and passes both `@entity_id` and `@actor_id` down the chain. `entity_insert` and `contact_insert` lose their self-creation branches entirely. The event becomes `security.user.self_registered`, distinct from `security.user.new`, so the audit viewer shows registration versus administrative creation without inspecting ids.

**The transaction context is four scalars.** Tenant id, `dbrow_version`, actor id, and, for a creation chain, the pre-allocated entity id. This is the primary design's "context" reduced to what SQL Server can pass cheaply, and it is consistent with ADR 0001's INOUT approach.

**Fallback if the id generation must stay `IDENTITY`.** Keep the two-step, but make it principled: the explicit `@self_registration` flag, confinement to `user_insert`, and a second helper operation (`dbrow_version_actor_rebind`) that permits changing the ledger actor only when the current value is System User and only when the row's `xact_id` equals `CURRENT_TRANSACTION_ID()`. This keeps the correction auditable and impossible after commit, but it still leaves one `UPDATE` on the ledger, which is why the pre-allocation route is preferred.

### 10.4 Who may be an actor: a policy the migration can copy

| Actor situation | Recommended rule |
| --- | --- |
| Ordinary operation | A pre-existing entity of type `user`, in the same tenant as the ledger row. Unknown or non-user identity: `THROW`. |
| Self-registration | The pre-allocated id of the user being created (§10.3). Explicit flag, `user_insert` only. |
| First user of a new tenant (SaaS sign-up) | A dedicated `tenant_bootstrap` procedure creating tenant and first user in one transaction with one ledger row, actor = the pre-allocated first user. Alternatively attribute tenant creation to the sign-up service account. Decide once. |
| System User (1) | Reserved for its own bootstrap and for platform-initiated operations with no better identity: schema migrations, seeds, maintenance. Never a fallback. Its entity row should be type `user`. |
| Integrations, scheduled jobs, API clients | One real user entity per integration, `is_system = 1`. Otherwise every automated change collapses into "System" and the audit loses which integration acted. |
| Anonymous or public actions (lead forms, password-reset requests) | A seeded, well-known `Anonymous` user entity, `is_system = 1`, so the audit says "anonymous" rather than "System". Decide whether it is global or per tenant; global is simpler, per tenant is more precise for public sites. |
| Support acting on behalf of a customer user | Add a nullable `on_behalf_of INT` to the ledger later (Tier 2). `modified_by` is the authenticated actor; `on_behalf_of` is the effective one. |
| Imported or migrated history | Create the source actors first as user entities (login-less if needed), then import their actions with `modified_by` = the mapped source actor, `modified` = the original time, `recorded_at` = import time, and provenance naming the importing service account. Never attribute imported history to the importer or to System. |
| Cross-tenant actor (provider staff in a hosted multi-tenant database) | Decide: either the actor's tenant must equal the ledger tenant unless `is_system = 1`, or introduce a provider tenant concept. The helper cannot check this (layer order); `actor_resolve` can. |
| Soft-deleted or erased actor | Still resolvable because the entity row remains; erasure only redacts values. This is one more reason actors must never be physically deleted. |

### 10.5 Tests to add for this mechanism

- Self-registration produces `created_by = modified_by = entity_id` on the entity and the same actor on the ledger with **no UPDATE** executed against `data.dbrow_version` (assert via the `xact_id`/`recorded_at` columns being untouched, or via a trigger-free check that the row's values equal the allocation-time values).
- Self-registration with an auto-created company shares one ledger row whose actor is the new user.
- Self-creation requested through `entity_insert` or `contact_insert` directly is rejected.
- An actor GUID that resolves to a non-user entity is rejected; an unknown GUID is rejected; an actor from another tenant is rejected or accepted per the policy chosen in §10.4.
- System User bootstrap goes through the same path and yields entity type `user`.

---

## 11. Further mechanism notes for the canonical template

These are small rules that fall out of the protocol in §5.1 and are cheap to state now so the migrated procedures inherit them.

### 11.1 Bump the aggregate exactly once per transaction
Nested procedures that change the same aggregate must not double-increment `entity_version`. The idempotent form is:

```sql
UPDATE [entities].[entity]
   SET [entity_version] += 1, [dbrow_version] = @dbrow_version,
       [modified] = @recorded_at, [modified_by] = @actor_id
 WHERE [entity_id] = @entity_id AND [dbrow_version] <> @dbrow_version;
IF @@ROWCOUNT = 1
    INSERT [entities].[entity_version_history] ([tenant_id],[dbrow_version],[entity_id],[entity_version])
    SELECT @tenant_id, @dbrow_version, [entity_id], [entity_version] FROM [entities].[entity] WHERE [entity_id] = @entity_id;
```

"The entity already carries this transaction's version" means "already bumped". The unique index `ux_evh_clock (entity_id, dbrow_version)` backs the invariant, and repeated changes to one aggregate inside one unit of work naturally collapse to one version.

### 11.2 The root lock subsumes child-level races
Once every writer to a contact holds `UPDLOCK, HOLDLOCK` on its `entities.entity` row, the child ordinal `MAX(ordinal) + 1`, the "find or create relationship" reads, and the "one history row per child per transaction" rule are all serialized per contact for free. The extra range lock on the junction that spec §5 proposes becomes belt-and-braces rather than the primary protection.

### 11.3 Catalog interning under `XACT_ABORT ON`
Catalog tables with unique keys (`person_name`, `email`, `country`, …) are interned with `IF NOT EXISTS … INSERT`. Two concurrent transactions interning the same new value race; the loser gets a duplicate-key error. With `SET XACT_ABORT ON`, a duplicate-key error caught by `TRY/CATCH` still leaves the transaction **uncommittable**, so "catch and re-select" cannot be the pattern here.

*Corrected per [answers §8](dbrow_version-independent-review-v3-answers.md):* do **not** take `UPDLOCK, HOLDLOCK` on the lookup of an existing value; that holds an update lock until commit and serializes every transaction that shares a popular value ("Juan", "México"). Read without hints first; take the range lock only on the miss path:

```sql
SELECT @id = [person_name_id] FROM [contacts].[person_name] WHERE [name] = @value;      -- hit: no hints
IF @id IS NULL
BEGIN
    INSERT [contacts].[person_name] ([name]) SELECT @value
     WHERE NOT EXISTS (SELECT 1 FROM [contacts].[person_name] WITH (UPDLOCK, HOLDLOCK) WHERE [name] = @value);
    IF @@ROWCOUNT = 1 SET @id = SCOPE_IDENTITY();
    ELSE SELECT @id = [person_name_id] FROM [contacts].[person_name] WHERE [name] = @value;  -- another transaction won
END
```

The second inserter blocks on the first's uncommitted row until it commits, then finds it, with no error raised. Catalogs that lack a unique key today (`city`, `colony`) will accumulate duplicates under any pattern; give them a unique key scoped to their parent, or accept duplicates explicitly. Give catalog value columns an explicit exact collation plus a normalized search column, so audit fidelity does not depend on the server's default collation. Intern catalogs before locking roots so catalog locks are taken in a consistent position in every procedure.

### 11.4 One clock per transaction, from the helper
Have `dbrow_version_ensure` return `@recorded_at DATETIME2 OUTPUT` (server time on allocation, the stored value on reuse). Every row written in the transaction then shares one identical timestamp, and `entity.created` / `entity.modified` stop depending on a caller-supplied `@created`. Keep an explicit caller-supplied time only on the import path, where back-dating is the intent.

### 11.5 Make the ledger and history append-only at the permission level
With §10.3 in place no procedure updates `data.dbrow_version`. Then `DENY UPDATE, DELETE ON data.dbrow_version` and on every `*_history` table to the application principal. Regulatory erasure (op 10) runs through one dedicated procedure with `EXECUTE AS OWNER`, so the only path that can rewrite history is the audited one. This is a cheap tamper barrier that fits the stated threat model (hostile users and buggy code, not DBAs) and documents the contract in the schema itself.

### 11.6 Small integrity additions
- FK `entities.entity (tenant_id, dbrow_version) → data.dbrow_version`, matching the history and spine tables.
- FK `entities.entity_history (entity_id) → entities.entity`, matching `contact_history`.
- `entity_history` omits `is_system`; either declare it immutable in the contract or add it to the snapshot.
- Enable `ALLOW_SNAPSHOT_ISOLATION` so reconstruction and export read under one consistent snapshot; consider `READ_COMMITTED_SNAPSHOT` for ordinary reads after measuring version-store cost. The write protocol's `UPDLOCK` behaves correctly under both.

### 11.7 Erasure must propagate through sync
Regulatory erasure rewrites history rows in place (spec §7.3). Any copy exported before the erasure still holds the personal data. When the Tier 2 export exists, an erasure transaction must travel as an instruction to redact, and receivers must apply it to their copies. Note this now so the envelope design in §6.5 reserves room for it.
