# Email reference family — independent review

Date: 2026-09-05.
Status: independent review of the implemented email family and its audit-unit foundation. Findings and recommendations only; no production code was changed. Probe code lives under `tests/review/email-reference-family/`.

## Checkpoint, scope and what was actually run

| Item | Value |
| --- | --- |
| Baseline | `f320fa15ce0040624d6ba26187e57d41f6b196aa` |
| Reviewed commit (first adds the review prompt) | `48f2cd90baf38125af5c3aa4cc3b52468ca3a3f9`, "Implement audited email reference family and review checkpoint" |
| HEAD at review time | same commit; working tree clean before this review's files were added |
| Diff since baseline | 52 files, +2,649 / −415 |
| Environment | Windows 11, SQL Server 2022 Developer 16.0.1190.2, .NET SDK 8.0.424, Python 3.13, sqlcmd (ODBC 17) |

Read in full: `AGENTS.md`, ADR 0005, `email-reference-family.md`, ADRs 0002 and 0003, every changed SQL script, the C# `SqlAuditUnit`, `SqlContactEmailReader`, `SqlDatabase`, the four schema builders, the Overmind manager and seed, both SQL test files, the Python runner and both C# harness programs. The legacy findings document was skimmed for the CFUS email behaviour.

Commands run, with outcomes:

```powershell
dotnet build tests/EmailReference/EmailReference.csproj --nologo     # 0 warnings, 0 errors
python tests/sql/run_dbrow_version_tests.py --server localhost       # every PASS line printed; 3 disposable DBs removed
python tests/review/email-reference-family/run_review_probes.py --server localhost   # probes A–G below; 2 disposable DBs removed
```

The reference suite passed on this machine exactly as the implementing agent reported. The probe script was iterated several times to fix harness mistakes of my own (header parsing, `PRINT` with a subquery, a rendezvous race); the final version is the one committed here, and its results are quoted verbatim below. Execution limitations: no Azure SQL Database, no PostgreSQL or MySQL, no fault injection on commit, no multi-hour soak. Provider reasoning in §10 is unexecuted.

### Probe results (all against disposable `OvermindAuditTest_<random>` databases)

| Probe | What it did | Result |
| --- | --- | --- |
| A | Allocate after `SAVE TRANSACTION`, then `ROLLBACK TRANSACTION` to the savepoint; inspect guards | Per-version applock released (`NoLock`), unit lock retained, ledger row gone, `audit_unit_assert` finds nothing, reuse of the rolled-back number fails 51103, a fresh NULL allocation succeeds. Guards are safe under savepoints. |
| B | 300 roots each with one email; the oldest root then gets one email change. Replay the reader's two root-payload statements in a SERIALIZABLE transaction and count locks | Without root-leading indexes: **301 KEY locks** on `entity_history` and **301** on `contact_history`. With `(entity_id, dbrow_version DESC)` and `(contact_id, dbrow_version DESC)`: **1 KEY lock** each. |
| C | Contact with email (ordinal 1); delete it; insert another (ordinal 2); read `contacts.contact_view` | One live email row exists; `contact_view.email_address` is **NULL**. |
| D | Same two SQL fixture files in a database with `READ_COMMITTED_SNAPSHOT ON` (Azure SQL Database default), plus the same-root stale-writer and concurrent-catalog-miss schedules | All 16 PASS lines; stale writer rejected with 51206; one catalog row from concurrent misses. |
| E | Two units lock roots in opposite order using existing catalog values only | One writer commits, the other is the 1205 deadlock victim; both roots advanced exactly once. Documented, retryable, not a template defect. |
| F | A unit inserts a new email value and stays open; another root inserts a different new value in the same unique-index gap, then one in a different gap | Same gap: **1222 lock timeout** until the holder commits. Different gap: commits immediately. |
| G | Probe-only interning procedure using a transaction-owned applock keyed by the exact value hash and a plain recheck | Plain READ COMMITTED seek for an absent neighbouring value does not block; a different new value in the same gap **does not block**; the same value **is** serialized (1222). |

---

## Findings, most severe first

Confirmed findings were reproduced by a probe or are directly visible in the reviewed source. Plausible concerns are marked as such and were not reproduced.

### 1. Root-payload history has no root-leading index; the serializable reader scans and range-locks other roots' history — confirmed (probe B)

- **Where:** `src/Framework/Sistrategia.Data.SqlClient/Scripts/Entities/create_entities_schema.sql:124` (`entity_history`, clustered PK `(dbrow_version, entity_id)` at line 145, no other index) and `Scripts/Contacts/create_contact_schema.sql:178` (`contact_history`, PK `(dbrow_version, tenant_id, contact_id)` at line 202). Consumer: `Scripts/Contacts/Emails/create_contact_email_read.sql:37` and `:42`.
- **Trigger:** read any revision of a contact whose last root-payload change is older than other roots' changes. The `TOP(1) … WHERE entity_id=@c AND dbrow_version<=@bound ORDER BY dbrow_version DESC` statements seek the clustered key backward from the bound and test every row until the target appears. Email-only changes never write `entity_history`, so for an active contact the distance between its revision bound and its last root-payload row is the whole system's history in between.
- **Invariant violated:** "as-of seeks" (ADR 0005 §Reconstruction) and the reader's own claim that it "does not need to scan every revision". The email family got `ix_email_history_root`; the root tables did not.
- **Impact:** read cost grows with total history, not with the contact's history. Under SERIALIZABLE every examined row is key-range locked until the reader commits, so a reader can block unrelated writers whose allocation number falls inside the scanned range (a narrow but real window given allocation order ≠ commit order). 300 roots produced 301 locks per table; at millions of history rows this is the dominant read cost.
- **Smallest correction:** add `CREATE INDEX ix_entity_history_root ON entities.entity_history (entity_id, dbrow_version DESC)` and `CREATE INDEX ix_contact_history_root ON contacts.contact_history (contact_id, dbrow_version DESC)`, and add "root-leading index on every history table the reader touches" to the family template checklist. Keep the transaction-leading clustered keys for export.

### 2. Stable child ordinals break the `ordinal = 1` primary convention that the application views still use — confirmed (probe C)

- **Where:** `Scripts/Contacts/create_contact_view_schema.sql:70`, `:72`, `:75` (phone, email, address joined on `ordinal = 1`) and `Scripts/Entities/create_entity_view_schema.sql:35` (modified-by email).
- **Trigger:** delete a contact's first email and add another. Ordinals are now retained identities (`contact_email_identity`), so the new email is ordinal 2 and the views show no email at all while a live row exists.
- **Invariant violated:** ADR 0002 "child ordinals are stable local child IDs, not display positions; reordering uses a separate display-order value". The display-order value does not exist yet, and the reading side still treats ordinal as position.
- **Impact:** functional regression in the application's main contact projection as soon as any first child is deleted. Phone and address will copy the same design and the same views already assume `ordinal = 1` for them.
- **Smallest correction:** decide the primary semantics before the phone copy. Cheapest interim: join on the lowest live ordinal (`ordinal = (SELECT MIN(ordinal) FROM contacts.contact_email WHERE contact_id = c.contact_id)`). Proper fix: an explicit `is_primary` or `display_order` on each junction, written by the family writer and snapshotted in history so "which email was primary at revision N" is reconstructible. This is the kind of small invariant that becomes expensive once three families have copied the pattern.

### 3. Catalog miss-path range locks are held for the whole unit and block unrelated roots inserting different new values — confirmed (probe F), corrected pattern validated (probe G)

- **Where:** `Scripts/Contacts/Emails/create_email_values_ensure.sql:19` and `:31` (`WITH (UPDLOCK, HOLDLOCK)` recheck on a miss).
- **Trigger:** unit U1 inserts a new email value and stays open (a `SqlAuditUnit` may stay open across application work between commands). Unit U2 on an unrelated root inserts a *different* new value that sorts into the same unique-index gap. U2 blocks until U1 commits (1222 under a lock timeout). A new value in a different gap does not block.
- **Invariant at stake:** the design's promise that catalog interning does not serialize unrelated roots. ADR 0005 states the caveat; the measurement shows the blocking lasts the unit's lifetime, and with a small catalog "the same gap" is most of the key space. In a mature catalog, addresses that share a long prefix (`first.last@bigcompany.com`) sort adjacently and will contend.
- **Impact:** medium. New-email inserts are the common CRM case; contention scales with how many new values land in the same gap while units are open.
- **Smallest correction (validated by probe G):** on a miss, take a transaction-owned application lock keyed by the exact value hash, then re-read without hints, then insert:

```sql
DECLARE @res NVARCHAR(255) = N'overmind:email:' + CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', @email_key), 2);
EXEC @r = sys.sp_getapplock @Resource=@res, @LockMode='Exclusive', @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=5000;
IF @r < 0 THROW 5130x, 'Could not serialize catalog value.', 1;
SELECT @email_id = [email_id] FROM [contacts].[email] WHERE [value_key]=@email_key AND [value_length]=DATALENGTH(@email_address);
IF @email_id IS NULL BEGIN INSERT [contacts].[email] ([email_address]) VALUES (@email_address); SET @email_id = SCOPE_IDENTITY(); END;
```

  Identical values serialize on the same resource; different values never do; the unique constraint remains the final boundary and a hash collision between *different* values cannot cause a violation. Probe G also showed a plain READ COMMITTED seek for an absent neighbouring key does not block on the uncommitted row, so this works without RCSI. Alternative for the C# path: intern values on a separate short connection before opening the unit, since values are immortal and an unused value is harmless.

### 4. `entities.entity_child_sequence` duplicates information the identity table already holds — confirmed by inspection

- **Where:** `Scripts/Entities/create_entities_schema.sql:95`; used at `Scripts/Contacts/Emails/create_contact_email_write.sql:56`–`59`.
- **Reasoning:** `contact_email_identity` retains every issued ordinal (committed ones forever, rolled-back ones disappear with their transaction), and the writer holds the root's exclusive lock before allocating. `MAX(ordinal) + 1` over the identity table under that lock is therefore exactly the high-water mark, with identical semantics: committed ordinals are never reused, provisional rolled-back ones may be. The spec's objection to `MAX()+1` was the unlocked read over *live* rows; neither applies here.
- **Impact:** one extra table, FK, insert-or-update per child creation, drop-order entry and family discriminator, with no additional guarantee. Every family will copy it.
- **Smallest correction:** allocate `@ordinal = COALESCE((SELECT MAX([ordinal]) FROM [contacts].[contact_email_identity] WHERE [contact_id]=@contact_id), 0) + 1` after `entity_write_lock`; drop the counter table. Keep `contact_email_identity`: it is the valuable half (FK target for live/history/action rows, `created_version`, restore target, reconstruction driver).

### 5. `CommitAsync` accepts a cancellation token and callers cannot tell "rolled back" from "outcome unknown" — confirmed by inspection

- **Where:** `src/Framework/Sistrategia.Data.SqlClient/SqlAuditUnit.cs:107`–`119`.
- **Trigger:** a caller passes a token that fires after `transaction.CommitAsync` has sent the commit. The client raises `OperationCanceledException`, `AbortAsync` attempts a rollback that fails silently, and the caller is told the unit failed although the commit may have succeeded.
- **Invariant at stake:** the API documents that uncertain commits are not retried, which is accurate, but it also manufactures the uncertain case gratuitously and reports it with the same exception shape as a definite rollback.
- **Impact:** medium for correctness of application retry logic; low frequency.
- **Smallest correction:** remove the token from `CommitAsync` (or ignore it once the commit is issued), and wrap failures raised by the commit call itself in a distinct exception type such as `AuditUnitCommitUncertainException`, so callers can distinguish "definitely rolled back" from "unknown, reconcile through idempotency".

### 6. Business seeds must each remember to enroll the runner's transaction — confirmed by inspection and by the 51102 incident

- **Where:** `src/Framework/Sistrategia.Data.SqlClient/SqlDatabase.cs:30` (every embedded resource runs inside a transaction opened by the runner) and `src/Data/…/insert_ernesto_sample_data.sql:3`–`4` (the per-script enrollment).
- **Trigger:** any future seed or migration batch that calls a constructor without the two-line preamble fails with 51102 on `CreateSchema`, exactly as happened once already.
- **Impact:** low-medium; a recurring class of deployment failure whose fix is copy-paste discipline.
- **Smallest correction:** enroll once at the runner: an overload `RunLocalStoredCommands(resource, enrollAuditUnit: true)` used by the `InsertMinimalData` and sample-data phases, executing `IF OBJECT_ID('data.audit_unit_begin') IS NOT NULL EXEC data.audit_unit_begin` after `BeginTransaction`. Enrollment only takes a lock; it does not allocate, so enrolling a batch that ends up writing nothing is harmless.

### 7. Email evidence inherits attribution and time from the legacy constructor — confirmed by inspection, deferred by ADR 0005

- **Where:** `Scripts/Contacts/create_contact_insert.sql:115` (`COALESCE(actor, 1)`), `:84` (`GETUTCDATE()` default for a caller-supplied `@created` that becomes ledger `modified`), and `Scripts/Contacts/Emails/create_contact_email_write.sql` which reads the actor back from the ledger row for the initial email.
- **Trigger:** `contact_insert` called with an unresolvable actor GUID (by a seed, a migration or any dbo path) creates the contact, its email, its history and its action rows attributed to System User with a caller-chosen time.
- **Invariant at stake:** ADR 0003 "unknown identities never fall back to System"; ADR 0002 "recorded_at is server time". The email writer itself is correct; it trusts what the constructor put on the ledger.
- **Impact:** not reachable through `email_runtime` (the constructors are denied), so not a blocker for this boundary. It becomes one the moment any application role is granted `contact_insert`, and every constructor written from this template will copy it.
- **Smallest correction:** make the constructors call `actor_resolve` (with the existing self-registration exception isolated as ADR 0003 describes) and stop writing caller time into the ledger. Related: the ledger now carries both `modified` and `recorded_at`; on email paths they are the same instant taken twice. Define `modified` as nullable business-effective time or drop it.

### 8. The historical reader holds a shared lock on the actor's own entity row for the read — plausible, by inspection

- **Where:** `Scripts/Contacts/Emails/create_contact_email_read.sql:14`–`18` (`SERIALIZABLE`, then `actor_resolve` inside the transaction).
- **Trigger:** user X reads any contact's history while another unit is editing X's own contact record (root lock held exclusively). X's read waits for that unit; symmetrically a writer editing X waits for X's in-flight reads.
- **Impact:** low; avoidable coupling between unrelated aggregates.
- **Smallest correction:** resolve actor and contact ids before `BEGIN TRANSACTION` (ids are immutable) or read them `WITH (READCOMMITTEDLOCK)`; keep the serializable barrier for the target root and history only.

### 9. Writers assume READ COMMITTED but do not check the caller's isolation level — plausible, by inspection

- **Where:** `Scripts/Entities/create_entity_write_lock.sql:14` and the plain reads in `contact_email_write`.
- **Reasoning:** under RCSI everything holds (probe D). Under a caller session set to SNAPSHOT isolation, lock hints and plain reads have different semantics than the design assumes. Nothing rejects that today.
- **Smallest correction:** in `audit_unit_begin`, `IF (SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) = 5 THROW …`. One line, closes an undocumented assumption; document "READ COMMITTED with or without RCSI" as the supported writer profile.

### 10. Hygiene and policy items — confirmed by inspection, low severity

- `email_runtime` is created (`Scripts/Security/create_email_runtime_permissions.sql:4`) but never dropped; `DropSchema` leaves the role behind and the schema-cycle check does not look at principals. Drop it after removing members, or document it as deployment-owned.
- `data.tenant_insert` defaults `@actor_entity_id INT = 1` (`Scripts/Data/create_tenant_insert.sql:5`): System by omission, contrary to ADR 0003. Make it required.
- `entity_history` has no `entity_type_id` (`create_entities_schema.sql:124`), so the deferred contact-to-user promotion cannot be audited; adding the column now is free, later it is a migration across every deployment.
- `ix_dbrow_allocation_transaction` (`create_data_schema.sql:116`) is filtered on `IS NOT NULL`, but every new ledger row has the hint, so it is a full secondary index on the ledger. Acceptable; record it as the cost of native discovery rather than as "small".
- `actor_resolve` hard-codes the default tenant GUID (`create_actor_resolve.sql:12`) while the legacy constructors derive an omitted tenant from the actor. Two rules for the same omission; ADR 0003 asks for one configured default.

---

## Responses to the ten question groups

### 1. Does native enrollment prove active allocation ownership?

Yes, for the stated guarantee. The per-version application lock is acquired only on the allocation path, under `EXECUTE AS OWNER`, in the `dbo` principal namespace, with transaction lifetime. `audit_unit_assert` accepts a number only if this transaction currently owns that lock; `APPLOCK_MODE` reports the calling transaction's own holdings, and application locks are scoped by database and principal, so the cross-database test is meaningful. A supplied committed number, a forged `allocation_transaction_id`, a session-context value, a `USE` into another database, or a `public`-principal lock on the same resource name all fail because none of them puts an exclusive `dbo`-namespace lock into the current transaction. `email_runtime` cannot acquire the resource (error 1202, tested) and cannot execute the internal procedures directly (denied; ownership chaining is what lets the public procedures reach them).

Lifetime behaviour: commit and rollback release both locks; savepoint rollback releases the per-version lock and the ledger row together while the enrollment lock survives, and every subsequent path behaves safely (probe A). Nested `BEGIN TRANSACTION` shares the engine transaction and changes nothing. Pool resets end the transaction. After restart, restore or clone no lock survives, and a reused engine transaction id finds hint rows whose locks nobody holds, so discovery excludes them.

Operational assumptions to state plainly: the guarantee depends on the application principal not being `db_owner`, not impersonating `dbo`, and not holding `ALTER` on the procedures. Many legacy deployments run applications as `db_owner`; that single configuration choice removes every guard here. Privileged-owner attacks are out of scope by design. No correction to the mechanism is needed; the enrollment lock itself is a policy device (see §Balance) rather than part of the ownership proof.

### 2. Is the history/action state machine correct?

I traced every sequence the prompt lists plus a few more against `contact_email_write`, and the net-transition table in ADR 0002 is implemented faithfully: absent→insert→updates ends as INSERT with final values; present→updates ends as UPDATE; present→update→delete→restore ends as UPDATE with the restored values (test 2 verifies); absent→insert→delete removes the current-unit history row and leaves identity and both actions; the later restore of that committed cancellation passes the 51309 consistency check because the birth unit's last action is `delete` and records new presence as INSERT; delete of a pre-existing child then restore across commits gives DELETE then INSERT snapshots, and `contact_emails_as_of` excludes tombstones correctly at each bound. Attribution never leaks because one unit has one actor (51005 is re-asserted in the writer). No path can touch history outside `dbrow_version = @v`, and §1's guard proves `@v` is this transaction's.

Two things worth knowing rather than fixing. First, the redundant UPDATE snapshot after change/revert inside one unit is accepted by ADR 0002 and is truthful. Second, `restore` re-creates the identity with caller-supplied values; a restore with different values is recorded honestly as a `restore` action with those values, but a UI could mislabel it. An optional convenience, NULL email on restore meaning "last committed snapshot", would make the common undo cheaper to call correctly.

The reader's rule "identity exists but no snapshot at or below the bound means absent" is correct for fresh schemas. For imported history it would silently manufacture known absence; ADR 0004's coverage manifest is the right place for that, and the reader should eventually surface coverage. Not a defect at this boundary.

Retaining `contact_email_identity` is justified: it is the FK target that makes every history and action row point at a known child, it carries `created_version`, it is the restore target, and it makes reconstruction a seek per child instead of a distinct over history. The separate root/family counter is not justified (finding 4).

### 3. Are root ordering and optimistic concurrency enforced?

Yes. `entity_write_lock` takes the exclusive clustered-key lock before the first allocation, rejects a late root whose stamp exceeds the unit's version (51204, tested with an interleaved commit), derives the entry version from the spine when the unit has already bumped the root (including entry version 0 for a newly constructed contact, which is a neat use of the spine), and requires an expected version (NULL is rejected, stricter than ADR 0002 and better). `entity_version_bump` re-asserts ordering with a conditional update and writes one spine row. Two writers on one root serialize on the lock and the loser gets 51206 (tested). A multi-root unit in opposite order deadlocks and one side gets 1205 with a consistent spine afterwards (probe E). Failures propagate with bare `THROW` under `XACT_ABORT`, so an ambient owner cannot commit partial work (tested).

The isolation assumption should be narrower in words and enforced in code: "READ COMMITTED, with or without RCSI" is what the mechanism supports (probe D shows RCSI passes); SNAPSHOT on the caller's session is not (finding 9).

### 4. Is the historical reader consistent, and is its locking cost acceptable?

Consistent, yes: one serializable transaction, root first, then spine, then history, catalog and actions, and the C# reader consumes command completion so a late error is not mistaken for success. Historical names and deletion context come from history, not current rows (tested). Missing revisions and missing root payload throw instead of returning empty sets.

Deadlock analysis: the reader acquires its root barrier before any history or catalog access, and the writer holds the root exclusively from its first statement, so the only cycles I can construct are the documented multi-root writer deadlocks and the actor-row coupling in finding 8. The XLOCK-instead-of-UPDLOCK correction the implementer made is right; a U lock would have admitted the reader before child mutation and produced the lock-upgrade deadlock they observed.

Cost: the design intends a short read that blocks same-root writers briefly. Finding 1 changes the picture: without root-leading indexes the reader range-locks *other roots'* history proportional to system size, which is neither short nor local. Fix the indexes first; then short serializable reading is a reasonable first profile. Snapshot isolation would remove reader/writer blocking entirely and is on by default in Azure SQL Database, but requires a database option on-premises and version-store capacity; make it a measured second profile, not a prerequisite.

### 5. Are the C# transaction lifetime claims too strong?

Mostly accurate. The semaphore serializes commands, commit and dispose on one connection; a cancelled queued call re-acquires the gate without cancellation and aborts the unit, so a later `CommitAsync` is refused (`EnsureActive` also checks `transaction.Connection`, which SqlClient nulls after completion). Rollback errors in `AbortAsync` are swallowed so the original failure surfaces. I did not find a path where work commits after another caller was told the unit failed: a queued command that reaches the gate after commit gets `InvalidOperationException`; one that reaches it before commit becomes part of the commit.

Two qualifications. The queued-command versus commit versus dispose races are argued from the code, not exercised; the harness tests a pre-cancelled token only. And finding 5: cancelling `CommitAsync` is the one place the API creates the uncertain state itself and then reports it indistinguishably from a clean rollback. The documentation describes the uncertain-commit limitation accurately; the API should make it visible in the exception type.

### 6. Do actor/tenant checks and permissions match the trust boundary?

Yes for the shipped role. Unknown or omitted tenant, unknown or non-user actor, deleted or locked actor, deleted or locked target, cross-tenant actor and `is_system` without user type are all rejected on the new paths (tested). The role can execute enrollment, the five commands and the reader, and nothing else; raw table access and internal helpers are denied and verified under a non-owner user. Chaining is what lets the public procedures reach denied internals, and that is the intended design.

Where it relies on application authorization: which actor may touch which contact, `is_private`, and anything about credentials. Where it relies on legacy behaviour: only the constructors (finding 7), which the role cannot reach. One capability to be aware of rather than fix: an `email_runtime` caller that knows any active user GUID in another tenant can act there by passing that tenant. That is exactly the "a GUID is not authentication" caveat and belongs in the deployment notes.

### 7. Is exact dictionary identity correct and worth its cost?

Correct. The `(binary value, byte length)` key closes both padding behaviours (space padding for string collations, zero padding for `VARBINARY`), the predicates use both columns, output variables are reset before no-row lookups, widths are validated rather than truncated, and case, trailing spaces and trailing zero code units are all distinct (tested). Two concurrent misses yield one row (tested).

Cost and contention: the miss path holds a key-range lock for the unit's lifetime (finding 3, with a validated cheaper alternative). The persisted `VARBINARY(512)` copy doubles catalog storage for long values; `(email_address COLLATE Latin1_General_100_BIN2, value_length)` would be equivalent and smaller, at the cost of a case-sensitive collation on the column itself. Optional. Keep exact accepted spelling separate from normalized matching and from business email validation, as the ADR already says.

### 8. Is application integration complete for this boundary?

Yes, verified by the real `OvermindSqlDatabaseManager` cycle, the real System bootstrap with a default tenant whose id is 2, repeat bootstrap, subsequent tenant creation and the first business email. Registration and drop order are consistent (data helpers before entities, entities before contacts, contacts before security; `email_runtime` grants after every referenced object exists). The seed fix preserves runner ownership of the transaction and enrolls only when ambient.

What could still bypass or fail enrollment: any other resource that calls a constructor (finding 6). What the green suite could conceal: nothing I found in this boundary; the schema-cycle test is the right kind of test. The only remaining application entry points are `DevController`'s `CreateSchema`/`DropSchema`, which go through the same manager.

### 9. What should we measure before scaling or copying?

Workloads most likely to expose weaknesses, in order:

1. As-of reads on roots with old root-payload history in a large system (finding 1). Acceptance: reader p95 under 20 ms warm, lock count on `entity_history`/`contact_history` equal to 1 per statement.
2. New-value inserts under open units (finding 3). Acceptance: zero waits on `contacts.email` key ranges for distinct values; identical-value serialization only.
3. Per-command overhead of native discovery: four `audit_unit_assert` calls per email command, each an index seek plus `APPLOCK_MODE` per candidate row, two application locks per unit, one ledger update per action. Acceptance: uncontended email command p95 under 15 ms; measure log bytes per command (expect roughly ten row writes).
4. Same-root contention with readers: N editors and M readers on one contact. Acceptance: no 1205 between reader and writer, reader p95 under 100 ms.
5. Ledger growth cost of `uq_dbrow_version_global` and the effectively full `ix_dbrow_allocation_transaction`.
6. Spine inserts scattering on `(entity_id, entity_version)` and the new root-leading indexes: measure page splits and set fill factors.

A representative benchmark: 1M contacts, 2M email identities, 5 revisions per contact (10M history rows, 12M action rows), 200k distinct email values; run the six workloads above with 16 concurrent connections; record p50/p95/p99, deadlocks, lock waits, log bytes per operation. Do not infer capacity from the four-connection allocation loop.

Complexity that can go now without losing a guarantee: the child counter table (finding 4); the duplicated `modified` clock on the ledger (finding 7); arguably the enrollment lock if the runner enrolls automatically (see §Balance). Small invariants that get expensive to retrofit: root-leading history indexes, primary/display-order semantics for children, `entity_type_id` in `entity_history`, and the unit-wide action ordinal, which is already right and should be kept exactly as is.

### 10. Are the portability and audit claims honest?

Yes, and unusually careful. What depends on SQL Server: application locks with transaction lifetime and ownership inspection, `CURRENT_TRANSACTION_ID`, `EXECUTE AS OWNER`, `XLOCK/HOLDLOCK` hints, serializable range locking, persisted computed binary keys, `IDENTITY_INSERT`, `THROW` with `XACT_ABORT`, and `CREATE OR ALTER` (2016 SP1+). PostgreSQL can supply an equivalent contract: `pg_advisory_xact_lock` for both guards, `pg_locks` filtered by `pg_backend_pid()` for ownership inspection, `SECURITY DEFINER` functions, `SELECT … FOR UPDATE` for the root, `INSERT … ON CONFLICT DO NOTHING RETURNING` for catalogs, and `COLLATE "C"` text without padding for exact identity; its serializable reader does not block writers but may abort with 40001 and needs retry. MySQL cannot supply transaction-lifetime named locks (`GET_LOCK` is session-scoped), so the coordinator, not the database, must own enrollment there, as ADR 0002 already says; use a `NO PAD` binary collation such as `utf8mb4_0900_bin` for exact identity. These are unexecuted reasoning.

Assumptions to document or test: application principal is not `db_owner`; writer sessions run READ COMMITTED with or without RCSI (probe D covers RCSI once; the reference runner should add that leg because Azure defaults to it); SQL Server 2016 SP1 or later; no MARS on writer connections. The audit claims are stated correctly: local audit order is not commit order, no decentralized delivery, no certification.

---

## Verdict

**Ready after named fixes.** The audit unit, the ownership guard, the state machine, the exact-value catalogs, the bootstrap and the C# lifetime are sound and well tested, and the documentation is honest about limits. Copy the pattern to phone only after these are settled, because each of them is copied by every family and is cheap now:

| Blocks copying | Why it must precede the copy |
| --- | --- |
| Finding 1: root-leading indexes on `entity_history` and `contact_history` | Every family's reader shares these two tables; the template checklist must say "root-leading index on every history table". |
| Finding 2: primary/display-order semantics for children | Phone and address views already assume `ordinal = 1`; deciding after three families exist means three migrations. |
| Finding 3: interning lock strategy | `*_values_ensure` is copied verbatim per family; pick the exact-value applock once. |
| Finding 4: drop the child counter table | Otherwise phone adds a second family row and write to a table that should not exist. |

Subsequent work, not blocking the copy: findings 5 through 10, the RCSI leg in the runner, the deadlock and queued-race tests, and the constructor attribution policy (which must be settled before any application role is granted a constructor).

## Balance: audit value, complexity, performance, portability

The implementation buys real audit value: final-state history with exact reconstruction, retained child identity with explicit restore, intermediate values preserved as ordered typed actions with a unit-wide ordinal, exact spelling preserved, and an ownership proof that does not trust the client. That is the differentiator the product sells, and it is delivered.

The complexity is mostly earned. Two pieces are not: the child counter (finding 4) and the two ledger clocks (finding 7). One is debatable: the enrollment lock. It exists to reject raw ambient transactions, a policy ADR 0002 chose so that a receiving transaction cannot silently share one allocation across several imported source transactions. It is also what produced the 51102 seed incident and adds a step to every native composition and every migration script. If the runner enrolls automatically (finding 6) the friction disappears and the policy can stay; if not, I would rather treat the first allocation as enrollment and let the importer, which is trusted code anyway, manage units explicitly. Either way, decide it deliberately rather than by the next incident.

Performance is acceptable in shape and untested in scale. The two confirmed hot spots (findings 1 and 3) are both fixable in one file each and both scale with system size rather than with the aggregate. Portability is honestly scoped; the SQL Server specifics are concentrated in three small procedures and one catalog pattern, which is the right place for them.

## Highest-value missing tests

1. Reader footprint: assert one key lock per root-history statement (probe B as a permanent test) and the presence of the root-leading indexes.
2. Primary-email projection after deleting the first child (probe C).
3. Catalog gap contention: a different new value in the same gap must commit while another unit is open (probe F/G, against whichever interning strategy is chosen).
4. The same SQL fixtures under `READ_COMMITTED_SNAPSHOT ON`, and a SNAPSHOT-session writer rejected by `audit_unit_begin`.
5. `SqlAuditUnit` races: a queued command racing `CommitAsync`, `DisposeAsync` during an executing command, cancellation during a running command, and a commit failure surfaced as a distinct exception type.
6. Opposite-order two-root deadlock with an application retry (probe E), including that the victim's `SqlAuditUnit` is unusable afterwards.
7. Constructor attribution: `contact_insert` with an unknown actor must fail once the policy is applied; until then a test that documents the current fallback so it cannot regress silently into a released role grant.
8. Restore with values different from the last snapshot recorded as `restore` with those values, and, if adopted, NULL-restore using the last committed snapshot.

Probe code: `tests/review/email-reference-family/run_review_probes.py`. It creates and drops its own `OvermindAuditTest_<random>` databases, loads the same scripts as the reference runner plus the two application views, runs the two reference SQL fixtures as its baseline, and adds only probe-scoped objects inside those databases (two indexes and one procedure named `review_*`). It never touches an application database.
