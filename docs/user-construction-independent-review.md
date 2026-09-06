# Ordinary user construction — independent review

Date: 2026-09-05.
Status: independent review of the ADR 0007 user-construction changes and their integration with the email boundary. Findings and recommendations only; no production code or test was changed. Probe code lives under `tests/review/user-construction/`. The earlier email report (`docs/email-reference-family-independent-review.md`) is untouched.

## Baseline, target, scope and what was run

| Item | Value |
| --- | --- |
| Baseline | `a3b715ae1502a4faff3e59ef518bc9a3ca6eb2ff`, "Enhance Contact Email Management and Testing" (also HEAD at review time) |
| Target | the uncommitted working tree on top of that commit: 22 modified files, 7 new files (ADR 0007, this review's prompt, `create_entity_history_snapshot.sql`, `create_user_history_schema.sql`, `create_user_history_create.sql`, `user_construction_tests.sql`, `user_construction_regressions.py`, `UserConstructionCases.cs`) |
| Environment | Windows 11, SQL Server 2022 Developer 16.0.1190.2, .NET SDK 8.0.424, Python 3.13, sqlcmd (ODBC 17) |

Read in full: ADR 0007, ADR 0006, the email guide diff, the ADR 0003 sections on promotion, roles, actors and bootstrap; the rewritten `user_insert`; the new history schema, history writer and snapshot helper; the bootstrap, `entity_insert`, the company branch of `contact_insert`, the current root-lock, bump, actor and unit helpers; the reader change and its C# record; both schema builders, the permissions script, the seed and `SchemaCycle.cs`; the three new test files and the runner diff.

Commands run, with outcomes:

```powershell
dotnet build tests/EmailReference/EmailReference.csproj --nologo                 # 0 warnings, 0 errors
python tests/sql/run_dbrow_version_tests.py --server localhost                   # every PASS line printed; 3 disposable DBs removed
python tests/sql/run_dbrow_version_tests.py --server localhost --rcsi            # every PASS line printed; 3 disposable DBs removed
python tests/review/user-construction/run_user_construction_probes.py --server localhost   # probes P1–P9 below; 2 disposable DBs removed
```

Both reference profiles passed here exactly as the implementing agent reported. Execution limitations: no Azure SQL Database, no other provider, no fault injection beyond what the reference suite already does. Provider statements in §Q8 are unexecuted reasoning.

### Probe results (disposable `OvermindAuditTest_<random>` databases; same scripts and fixtures as the runner)

| Probe | What it did | Result |
| --- | --- | --- |
| P1 | Create two accounts with the same `login_name` in one tenant | Both accepted; two `security.user` rows share the login. |
| P2 | Promote an existing contact while supplying `full_name`, first name, job title, phone and `person_company` | All ignored without error: name unchanged, no name parts, no phone, no relationship, no company created. |
| P3 | Two concurrent new-user creations naming the same new company, database with `READ_COMMITTED_SNAPSHOT ON` | Two companies created; every later creation naming that company fails with 51313. |
| P3b | Same schedule under plain READ COMMITTED | One company; the second session blocked on the first's uncommitted row during the name scan. Incidental, not a guarantee. |
| P4 | Promote a company contact (`contact_type_id = 2`) to a user | Accepted; revision 2, user type. |
| P5 | Promotion followed by an email edit in the same unit | Revision 2 for both commands, one spine row, one root snapshot. Correct. |
| P6 | Administrative creation with `@created = 2007-06-15` | `entity.created`, `entity.modified` and `ledger.modified` = 2007; `ledger.recorded_at` and `event.created` = now. |
| P7 | Create a user with phone inputs | `security.user.phone_number` and `user_history.phone_number` NULL; one `contact_phone` row. |
| P8 | Privileged hypothetical soft delete using the shared snapshot helper, rolled back | History row labelled `dboperation_type_id = 2` with `deleted` stamped; the helper cannot express op 3. |
| P9 | Inspect the SQL-fixture System actor | Type 4 with `contacts.contact` and `security.user` rows present; the fixture is not hiding the type gap. |

---

## Findings, most severe first

Confirmed findings were reproduced by a probe or the reference suite, or are directly visible in the source. None is a defect in the mechanism ADR 0007 set out to fix; they are reachable regressions or policy gaps at this boundary.

### 1. The constructor accepts duplicate logins — confirmed (P1)

- **Where:** `src/Framework/Sistrategia.Data.SqlClient/Scripts/Security/User/create_security_user_insert.sql:194` inserts `login_name` with no uniqueness check; `Scripts/Security/User/create_security_user_schema.sql:45` keeps the unique constraint commented out.
- **Trigger:** two administrative creations with the same login in the same tenant; both commit.
- **Invariant at stake:** ADR 0003 recommends login uniqueness within a tenant with the database constraint matching the deployed policy. Nothing enforces any scope today.
- **Impact:** medium once any application path reaches the constructor; authentication by login becomes ambiguous and the second account is indistinguishable in history. Not reachable through `email_runtime`.
- **Smallest correction:** decide the scope now, because retrofitting after accounts exist needs a migration. Global uniqueness is one `UNIQUE (login_name)`. Per-tenant uniqueness needs `tenant_id` on `security.user` kept consistent with the owning entity (a composite FK to `uq_entity_tenant_identity`) plus `UNIQUE (tenant_id, login_name)`. Either way, the constructor should fail with a specific error rather than a raw constraint violation. This is the policy work ADR 0007 defers; the counterexample shows why it should be decided before the constructor is granted to any role.

### 2. Concurrent creations naming one new company create duplicates, then lock the name out — confirmed (P3, P3b)

- **Where:** `Scripts/Contacts/create_contact_insert.sql:376`–`380` (count-and-pick lookup, 51313 on more than one match) and `:382`–`408` (create when none found).
- **Trigger:** under `READ_COMMITTED_SNAPSHOT ON` (Azure SQL Database default), two sessions both miss the lookup and both create the company. From then on every creation naming that company fails 51313 until someone repairs the duplicates by hand. Under plain READ COMMITTED the second session happened to block on the first's uncommitted row because the lookup is a table scan; an index on `full_name` or a different plan removes that accidental serialization.
- **Invariant at stake:** ADR 0007 admits "concurrent missing-name creations may still create separate companies" and separately that "multiple matches fail". Together they turn a race into a persistent constructor failure for that name.
- **Impact:** medium for administrative onboarding of several employees of a new company at once, which is exactly the seed-style use.
- **Smallest correction:** on a miss, take a transaction-owned application lock keyed by the exact company name within the tenant (the ADR 0006 catalog pattern, `SHA2_256` of tenant id plus the UTF-16 bytes, `dbo` namespace, owner-executed), re-check, then create. Identical names serialize, different names do not, and this constructor stops producing the duplicates it later refuses. Keep 51313 for duplicates that already exist. The name remains a convenience, not identity, as the ADR says.

### 3. Promotion accepts and drops contact-detail inputs — confirmed (P2)

- **Where:** `create_security_user_insert.sql:136`–`184`: the new-root branch forwards `full_name`, names, job title, company, phone, address and card email to `contact_insert`; the promotion branch never reads them.
- **Trigger:** promote an existing contact with any of those parameters set; the call succeeds and the inputs vanish.
- **Invariant at stake:** the upstream spec's inherited-defect register (§8.1, `contact_update_summary` "silently ignoring parameters": fix or remove, never accept-and-drop). The current test asserts that the payload is *not* replaced, which codifies the silent drop rather than the caller's intent.
- **Impact:** medium-low; an administrator "correcting" a name during promotion gets a success with no change and no evidence.
- **Smallest correction:** in the promotion branch, `THROW` a specific error when any contact-detail parameter is non-NULL ("promotion does not modify contact details; use the contact APIs"), or add the dedicated `user_promote` procedure ADR 0007 anticipates and make `user_insert` reject an existing public key. `@email` is the one exception that legitimately applies to the account and should keep working.

### 4. A company contact can hold a user account — confirmed (P4)

- **Where:** `create_security_user_insert.sql:127`–`129` checks entity type `contact` and the presence of a `contacts.contact` row, not `contact_type_id`.
- **Trigger:** promote a company (`contact_type_id = 2`); accepted at revision 2 with user type.
- **Impact:** low, but it decides what "user" means for every later account feature (login recovery, delegation, role scope).
- **Smallest correction:** either add `AND c.contact_type_id = 1` to the check, or state in ADR 0007 that organizational accounts are permitted. Decide once before phone or address copies the constructor pattern.

### 5. The shared root snapshot helper can only label INSERT or UPDATE — confirmed (P8)

- **Where:** `Scripts/Entities/create_entity_history_snapshot.sql:16` derives the operation from the revision number.
- **Trigger:** a future soft delete or undelete that reuses the helper, which is the natural thing to do because it centralizes the growing column list, writes op 2 with `deleted` stamped.
- **Impact:** low today (no such API exists); the ADR is honest that lifecycle semantics are still to be declared. The helper's name and signature invite misuse.
- **Smallest correction:** add `@dboperation_type_id INT = NULL` that defaults to the current derivation and is required non-NULL when `deleted` or `locked` change, so a lifecycle writer must say what it is doing.

### 6. Three clocks in one administrative creation — confirmed (P6)

- **Where:** `create_security_user_insert.sql:100` (caller `@created`), `:135` (`@created` becomes ledger `modified`), `:209` (event uses `recorded_at`); `entity_insert` copies `@created` into `entity.created` and `entity.modified`.
- **Observation:** for a supplied `@created`, the entity and the ledger's `modified` say 2007 while the ledger's `recorded_at` and the event say now. ADR 0007 defines `modified` as occurrence metadata and `recorded_at` as recording time, which is coherent, but the event's `when_ocurred` picks the recording clock while the same unit's ledger `modified` picks the occurrence clock.
- **Smallest correction:** pass `@created` as the event's `when_ocurred` (occurrence, consistent with the ledger `modified` and the entity), and state in the guide that `@created` is an occurrence date meant for installation and import scenarios, never a commit or recording time.

### 7. Account phone is never populated — confirmed (P7)

- **Where:** `create_security_user_insert.sql:194`–`195` inserts login, hash, salt and email only; the `@phone_*` inputs feed the contact card in `contact_insert`.
- **Impact:** low. ADR 0007 says construction history "records account phone and confirmation flag"; it does, and the value is always NULL. Not wrong, but the claim is vacuous and the parameter names invite the assumption that they set the account phone.
- **Smallest correction:** document it in the guide, or add `@account_phone` if account phones are a real security field.

### 8. The seed assigns its role with raw DML instead of the constructor's option — confirmed by inspection

- **Where:** `src/Data/Sistrategia.Overmind.Data.SqlClient/Scripts/SampleData/Sistrategia/insert_ernesto_sample_data.sql:119`–`121`.
- **Observation:** the constructor now validates `@user_primary_role` and records `initial_role_id` in the event; the seed bypasses both with `INSERT INTO security.user_role`, so the installation user's Developer role has no creation evidence. Role history is deferred, but the evidence the constructor already offers is being skipped by the one real caller.
- **Smallest correction:** pass `@user_primary_role = 'Developer'` and delete the raw insert.

### 9. Lower-severity observations

- The existing-company branch holds a shared lock on the company's root row until the unit commits (`create_contact_insert.sql:412`–`414`). Creators do not block each other, but any edit of that company waits for all in-flight creations and vice versa. Acceptable for this boundary; note it for the hub-company workload in the measurement plan.
- `security.user_role` still cascades on user deletion; users are meant to be soft-deleted only. Prior finding, still deferred with the role lifecycle.
- `actor_resolve` still hard-codes the default tenant GUID. Prior finding, unchanged.
- `tests/sql/email_family_tests.sql:6` still promotes entity 1 to type 4 with raw DML. Since `dbrow_version_tests.sql` now creates that fixture entity with type 4, the line is a no-op and should go, so nobody later reads it as the way the fixture obtains an eligible actor.

---

## Responses to the eight questions

### Q1. New account at revision 1 with user type; existing contact keeps its type and gets one promotion revision

Yes, both hold. For a new root, `contact_insert` and `entity_insert` create the provisional row with contact type and the snapshot helper writes the op-1 history row in the same unit; `user_insert` then sets the user type, `entity_version_bump` returns without bumping because the root already carries the unit's version, and the helper replaces only the row whose `dbrow_version` equals the unit's version. The committed result is one spine row, one history row, user type, op 1 (reference test and P5). For an existing contact, the root is locked before allocation, bumped once, and the helper inserts a new op-2 row because no row for the unit exists; the earlier contact-type row is untouched (reference test; the C# reader returns contact type at revision 1 and user type at revision 2). The replacement is scoped by `dbrow_version = @dbrow_version` after `audit_unit_assert`, so it cannot reach committed history.

### Q2. Root locking, unit-entry tokens and allocation ordering under composition and contention

They hold. Promotion locks the root with the required entry token before the first allocation; a child edit earlier in the unit is handled by deriving the entry token from the spine, and a child edit afterwards in the same unit likewise uses the entry token and does not bump again (P5). A contact created in the same unit is promoted at entry version 0 and stays at revision 1. Two competing promotions serialize on the exclusive root lock and the loser fails 51206; the same-actor rule (51005) rejects switching attribution to the provisional user inside the creation unit. Failures anywhere after allocation, including the history writer's own preconditions, propagate under `XACT_ABORT` and the owner rolls back entity, contact, account, histories, role assignment and event together (reference tests). The only ordering deadlock is the documented multi-root case.

### Q3. Unknown-actor or System fallback, implicit self-registration, wrong tenant, inactive actor or root

None is reachable through `user_insert`. The actor is resolved strictly before anything else, so the `COALESCE(…, 1)` fallback in `contact_insert` and the self-rebinding branch in `entity_insert` are never taken on this path (they remain reachable only by direct privileged calls, which ADR 0007 scopes out). The tenant is normalized to the actor's resolved tenant before delegation, so tenant inference in the legacy constructor cannot diverge. Cross-tenant roots fail at the write lock (51202), deleted or locked roots fail (51203), a non-user or inactive actor fails (51201), an unknown tenant fails (51200), and `@created_by = @public_key` for a non-existent key fails (51201) rather than self-registering.

The seed's System attribution is honest: the installation process created the account, the ledger records System at recording time, and the 2022 value is kept as occurrence metadata. Finding 6 is about which clock the event should carry, not about the attribution. What SQL checks is eligibility shape: type, tenant, lifecycle. Who may create accounts, assign roles or supply a given actor GUID remains the backend's authentication and authorization, and the documentation says so.

### Q4. Account history without credentials; account email independence; EntityTypeId in the reader

The history records login, account email and confirmation, phone and confirmation, two-factor and lockout configuration, and excludes hash, salt, security and concurrency stamps, failed-login counter and last login (reference test checks the columns). That is sufficient for the construction claim, with the caveat in finding 7 that the phone fields are always NULL at construction. Account email is stored on `security.user` and starts unconfirmed; the email writer never touches `security.user`, so contact edits, moves and deletes leave login, account email and confirmation unchanged (reference test and schema-cycle check). `EntityTypeId` is added as the last column of the reader's first result set, read at ordinal 9, and appended to the record; the SQL, the C# reader and the ADR agree, and the C# case verifies contact type before and user type after promotion.

### Q5. Initial role and company reference scoping

Role: the lookup requires exactly one definition among the tenant's own and the shared (NULL-tenant) definitions, so unknown, other-tenant-only and global/local same-name ambiguity all fail with 51602, and the range lock held on the definition prevents it being removed mid-unit. This matches ADR 0003's "no implicit shadowing". Assignment evidence is the event's `initial_role_id`; role history remains deferred, and the seed does not use this path (finding 8).

Company: the lookup is now scoped to the tenant and to company contacts, ambiguity fails (51313), and an existing company's eligibility is retained with a shared lock without bumping it. Another tenant's same-named company is no longer a target (reference test). The cost is the shared lock in §9 and, more importantly, the race in finding 2: the constructor can still create the duplicates that its own ambiguity guard then refuses forever. The ADR is explicit that name idempotency and relationship lifecycle are unimplemented; my recommendation is that the constructor should at least not manufacture the ambiguous state itself.

### Q6. Preconditions and permissions of the shared snapshot and private account-history helpers

Both call `audit_unit_assert`, so they require an enrolled transaction that owns the version they are given. The snapshot helper additionally requires that the root already carries the unit's version and a matching spine row, which means the caller has bumped or created it under the root lock; its UPDATE is restricted to that unit's row. The account-history writer requires a user-typed root, its spine and the security row. Both are denied to `email_runtime` and the reference test proves the denial under a real non-owner user. The one claim stronger than the semantics is the helper's implicit operation derivation (finding 5): construction and promotion are covered; a delete or restore through the same helper would be mislabelled, and ADR 0007 correctly says those APIs still need their own semantics.

### Q7. Real create/drop/create, System ID 1, bootstrap history, role membership, seed usability

Verified here in both isolation profiles through the real `OvermindSqlDatabaseManager`: System ID 1 with user type and construction history, the seeded user typed as user with account history and installation attribution, `email_runtime` membership surviving the drop, and the seeded user performing email changes as the actor without any System substitute. The bootstrap now writes and validates `user_history` and the type on `entity_history`. The SQL fixtures do use privileged writes, but for negative cases only (locking a root, creating a non-contact entity), and the fixture System actor is a complete entity, contact and account (P9), so no privileged write conceals the original type gap. The one leftover raw promotion in the email fixture is a no-op (§9).

### Q8. Useful bounded fix, or misleading reference?

A useful bounded fix. The ordinary user constructor is now strict about actor, tenant, root type and lifecycle, commits the right type at the right revision, preserves earlier history, produces credential-free account history, and makes normally created users eligible actors for the email boundary without a System workaround. The combined email and user-construction reference is not misleading as long as the constructor stays where it is: reachable only by the seed and privileged callers, denied to `email_runtime`.

Immediate corrections worth making before the constructor is reused or exposed: finding 2 (do not create the duplicates the guard then refuses) and finding 3 (reject rather than drop contact details on promotion). Decide, without implementing more than the decision requires: finding 1 (login scope), finding 4 (who may hold an account). Everything else on the ADR's deferred list is genuinely separate: public self-registration and actor-ID reservation, authentication and login policy beyond the uniqueness decision, account update, delete and restore, credential and recovery workflows, role and relationship history, migration coverage, delivery, and other providers. On providers: nothing in this pass adds engine-specific machinery beyond what ADR 0006 already introduced; `FOR JSON` formats a small event payload and the rest is ordinary transactions, row locks and conditional writes.

---

## Verdict

**Sound bounded reference; proceed to the next family, with two small corrections queued for the constructor before it is reused.** The mechanism ADR 0007 claims is the mechanism the code implements, both reference profiles pass here, and the counterexamples found are policy gaps and one race at the edge of the boundary, not audit-history defects.

| Before reusing or exposing the constructor | Why |
| --- | --- |
| Finding 2: exact-value lock on the company-name miss path | The constructor currently creates the ambiguity that makes its own later calls fail permanently under the Azure default isolation setting. |
| Finding 3: reject contact-detail inputs on promotion | Accept-and-drop is the inherited defect class the spec forbids; a dedicated promotion API is the cleaner shape. |
| Decisions: login uniqueness scope (finding 1) and account eligibility by contact type (finding 4) | Cheap to decide now, expensive to retrofit after accounts exist. |

Subsequent work, in ADR 0007's own list: self-registration, authentication, account lifecycle, role and relationship history, migration and delivery.

## Highest-value missing tests

1. Duplicate login rejected once the scope is chosen (P1 inverted).
2. Promotion with any contact-detail input rejected; promotion with `@email` only succeeds (P2 inverted).
3. Concurrent new-company creations yield one company under both isolation profiles (P3 inverted), and a pre-existing ambiguity still fails 51313.
4. Company promotion rejected or explicitly accepted per the decision (P4).
5. Snapshot helper called with an explicit DELETE operation writes op 3 (P8, after finding 5).
6. Event `when_ocurred` equals the supplied `@created` for administrative creation (P6, after finding 6).
7. Seed's Developer role visible as `initial_role_id` in the creation event (finding 8).
8. Promotion followed by a child edit in the same unit as a permanent SQL test (P5 is only a probe today; the reference suite covers the reverse order).

Probe code: `tests/review/user-construction/run_user_construction_probes.py`. It creates and drops its own `OvermindAuditTest_<random>` databases, loads the runner's script list and the four SQL fixtures, and runs the probes above; probe writes are either rolled back or confined to those databases. It never touches an application database.
