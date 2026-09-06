# AGENTS.md — Overmind project memory

Working area: `src/Framework/Sistrategia.Data.SqlClient` — a 4-layer DB framework.
Layer order (build/drop dependency): **data → entities → contacts → security**.
`*_by` columns are `INT` = `entity_id` of the actor; a user is an entity (type 4) that is also a contact (type 1).
System User = id 1, public key `71F092F4-3A35-463D-9589-E5EE1373F7D5`. Default tenant `908E5A8C-0372-4EDC-ADDF-011E059091ED`.

## Active design thread (RESUME HERE)

**Latest implementation — email review corrections (2026-09-05):** explicitly authorized and implemented.
Read `docs/adr/0006-email-review-corrections-and-saved-order.md` and `docs/email-reference-family.md` first;
ADR 0005 preserves the initial checkpoint. Stable email ordinal is separate from dense display_order;
first saved position is principal/default, insertion/restoration append, deletion closes the gap, and
MoveEmailAsync/MakeEmailPrincipalAsync preserve history/actions (payload v2). Actual contact/actor email views
follow saved order; login/account email is independent. No frontend ordering UI is implemented yet.
Root payload histories have root-leading indexes AND the locking reader requires seeks: index presence alone
still produced 201 range locks per history table in the new regression. Exact-value transaction applocks replace
catalog miss range locks. Retained child identities supply MAX(ordinal)+1 under the root lock; the separate child
counter is removed from fresh DDL, with old-table drop cleanup retained. This does not change sequence-only
global dbrow_version allocation. Native writers enforce READ COMMITTED (RCSI allowed), rechecked on each assertion.
The C# unit marks queued cancellation before commit admission; issued commit is uncancellable and provider
failure surfaces as AuditUnitCommitUncertainException with the original error/provisional version. Receipt-based
retry remains unimplemented. The named RunLocalStoredAuditCommands owns/enrolls business batches, and DDL keeps
the ordinary runner. email_runtime/memberships intentionally survive schema drop/recreate. tenant_insert requires
an explicit actor. Constructor actor/tenant fallback, historical type promotion and shared-user lifecycle remain
separate work. The independent report/probes are preserved unchanged. Run the full suite both normally and --rcsi.
Concrete integration prerequisite found by the expanded schema-cycle test: legacy user_insert leaves the actual
seeded user's entity typed as contact, so actor_resolve rejects it with 51201. Tests use the explicitly bootstrapped
System actor; they do not promote the seed with raw DML. Fix ordinary user construction/type policy before adopting
the new actor-bound API for application users. This correction pass does not claim to fix that lifecycle.
Final validation: full SQL/C# runner passed READ COMMITTED with RCSI off and on, zero build warnings/errors;
all six final-run disposable DBs removed. Actual schema cycle, role membership, reader locks, order/history/actions,
queued/executing cancellation/disposal and terminated-owned-session commit failure are covered. git diff --check
and documentation links passed. This correction pass is uncommitted; review checkpoint files are unchanged.

**Initial email reference family (2026-09-05):** Email lifecycle,
stable child identities, final history, ordered action evidence, historical reader/diff and C# SqlAuditUnit
are in place for fresh schemas. Native enrollment + private transaction-owned guards prove reuse;
allocation_transaction_id is an indexed hint, not durable identity. Ambient SQL callers must enroll explicitly.
Contact construction delegates its initial email to the same writer. Exact value keys use bytes AND length
(SQL VARBINARY equality also pads trailing zero bytes). New email paths reject invalid actor/tenant/root context.
The email_runtime role isolates the public capability. System bootstrap and tenant creation now use the helper;
System ID 1 is reserved explicitly and the actual tenant ID is used. General first-user preallocation, legacy
constructor fallback/type-promotion policy, role history, migrations and distribution remain separate work.
Runner: `python tests/sql/run_dbrow_version_tests.py --server localhost` (SQL + C# + disposable DBs).
The independent implementation review has been received and its correction pass is ADR 0006; phone is not ported yet.
Review request and targeted questions: `docs/email-reference-family-independent-review-prompt.md`.
**Independent review delivered (2026-09-05):** `docs/email-reference-family-independent-review.md`, reviewed commit
`48f2cd9` against baseline `f320fa1`. Verdict: ready after named fixes. Its four copy-blocking findings are handled
by ADR 0006 above. The review's assertion that the installed CommitAsync token interrupts an issued commit was
incorrect: the tested SqlClient 6.0.2/.NET 8 build inherits DbTransaction's precheck + synchronous Commit.
The explicit commit-admission/uncertain-outcome API is retained on its own merits. Probes:
`tests/review/email-reference-family/run_review_probes.py` (historical review record; disposable DBs only).

**Schema-cycle follow-up:** the original seed-level fix for 51102 is superseded by the named audited runner
in ADR 0006; insert_ernesto_sample_data.sql no longer needs an enrollment preamble. Generic DDL execution
does not auto-enroll. tests/EmailReference/SchemaCycle.cs exercises the actual Overmind manager's
CreateSchema → DropSchema → CreateSchema path and seed/email history; the expanded suite passed. Rebuild/restart
the application to load changed embedded SQL. Do not infer full application creation coverage from selected SQL fixtures alone.

**Current recommended design (2026-09-05):** start with `docs/dbrow_version-allocation-design.md` and
`docs/dbrow_version-design-session-handoff.md`. The user asked to continue without another review round and
avoid excessive MSSQL dependency while keeping SQL Server/Azure first. New ADRs 0002–0004 define the portable
audit unit/history, tenant/actor/catalog policy, and delivery/provider profiles. ADR 0005 defines the implemented
subset; ADR 0001 is the historical helper-extraction record, not the current ownership contract.

Key refinements: trusted transaction enrollment, optional INOUT, current-unit history upserts, validated late
roots, explicit default tenant and legitimate shared data, no automatic cross-tenant privilege from is_system,
separate public self-registration/internal bootstrap, stable local child ordinals with source mappings, and
one source transaction per receiving business transaction. Portable outbox/inbox delivery is the baseline;
Change Tracking and a retained commit journal are optional ordering capabilities. PostgreSQL/MySQL mappings
are researched but unimplemented. General DAG/crypto remains deferred.

**Focused source intake (2026-09-05):** read `docs/dbrow_version-legacy-implementation-findings.md` before
porting more contacts/users code. CFUS email lifecycle confirms child history plus aggregate version; its
entity_history is a spine, not Overmind's root payload history. LaSalle's inspected email extractor projects
current values onto historical root entries, and its child import has an unresolved stale-parent lookup risk
(details/source lines in the report). Sibling projects were read-only. Coverage/baseline/correction contracts
were added to the recommendations during that read-only intake. The later email implementation is ADR 0005;
phone follows its review. Keep further source reading bounded to the family/adapter being implemented.

**Independent review v3 (2026-09-05):** `docs/dbrow_version-independent-review-v3.md` reviews the whole thread
against the actual code. Verdict: allocation is settled; settle the canonical write mechanism on one reference
family before the bulk migration (root-lock-before-allocation, fail-fast actor/tenant, server-stamped time,
update / soft-delete / undelete template, child history shape); use Change Tracking instead of CDC for sync;
defer DAG/crypto. §10 covers the self-registration bootstrap: recommend pre-allocating `entity_id` from a
sequence, a single `actor_resolve`, explicit `@self_registration` confined to `user_insert`, no ledger UPDATE.
§11 has canonical-template idioms (bump-once, root lock subsumes child races, interning under XACT_ABORT).
Those were recommendations at review time. ADR 0005 now identifies the implemented email subset;
the broader bootstrap/user-lifecycle proposals remain partially deferred.

**Independent answers (2026-09-05):** `docs/dbrow_version-independent-review-v3-answers.md` remains reviewer input,
not the current authority where the newer ADRs differ. Accepted directions include final touched-row history,
late-root monotonicity checks, original transaction pairs, and read-first catalog interning. Its SESSION_CONTEXT
marker does NOT independently prove ownership: callers can set it and it survives database context changes.
Other corrections: receiving a batch is distinct from applying its source transactions; BIN2 alone does not
distinguish trailing spaces; no-row SELECT can preserve a stale OUTPUT value. The new ADRs/handoff preserve the
probe evidence and remaining implementation gates. Do not describe these proposals as deployed mechanisms.

**Repository scope (user clarification, 2026-09-05):** this is a **remake**. It intentionally holds only the
bare-minimum partial schemas and inserts needed for a first user insertion, as the place to work out the
mechanisms that will be applied across all code still to be migrated. Missing update/delete/child-history
procedures are expected scope, not defects. Do not report them as neglect; report mechanism issues that the
migration would copy.

**Earlier implementation (2026-09-05):** allocation helper extracted with user authorization.
Read `docs/adr/0001-dbrow-version-allocation-helper.md` for the decision, contracts, tests, and limitations.
`data.dbrow_version_ensure` centralizes sequence allocation/ledger creation and tenant/actor reuse checks.
Entity/contact/user inserts retain optional INOUT versions; only the transaction owner commits/rolls back.
That version's ownership limitation is superseded by the guarded enrollment in ADR 0005. SQL integration runner:
`python tests/sql/run_dbrow_version_tests.py --server localhost`.

**Design session handoff (2026-09-04):** read `docs/dbrow_version-design-session-handoff.md` for broader context.
The user prefers the balance of `docs/dbrow_version-allocation-design.md` over the optional
chained-history alternative. Subsequent clarification narrows distribution to practical disconnected
branch/client synchronization and history-preserving migrations across schemas/database providers.
That clarification and the later tenant/portability discussion are now incorporated into the revised primary
design and ADRs 0002–0004. The later email implementation is recorded separately in ADR 0005.

**`dbrow_version` allocation.** Full analysis + resume checklist:
→ `docs/dbrow_version-allocation-analysis.md`

Decision: allocate `dbrow_version` with `NEXT VALUE FOR [data].[dbrow_version_seq]`, never `MAX()+1`.
- Entity/contact/user inserts now delegate to `data.dbrow_version_ensure`.
- The previous MAX()+1 pending note was stale: both derived procs already used the sequence before extraction.

Spec reference: `D:\Code\GitHub\Sistrategia\SistrategiaDataAnalysis\schema-analysis\05-design-recommendations.md` §2.

## Fixes already applied this session
- `create_contact_insert.sql`: location tables use `location_id` (upsert into `*_location`) not old `location_name`;
  added required `dbrow_version` to `contact_email`; named-param `entity_insert` calls; new `event_create` signature.
- `create_security_user_insert.sql`: new `event_create` signature.
- Overmind `Scripts/insert_minimal_data.sql`: role_localized `language_id` fixed (`0→1` en, `1→2` es) to match `data.language`.
- Event-type seeds added: `Scripts/Contacts/insert_minimal_data.sql` (`contacts.contact.new`) + new
  `Scripts/Security/insert_minimal_data.sql` (`security.user.new`), wired into `SecurityDatabaseSchemaBuilder.InsertMinimalData()`.

## Open items from `entity_insert` review (not yet acted on)
- Helper now rejects missing tenants; user_insert's legacy tenant fallback still needs policy review.
- Entity/contact/user CATCH now uses bare THROW; other procedures have not been standardized.
- Reuse now proves active native ownership through enrollment/guards; the scalar ID alone remains insufficient.
- Corrected: procedure-scoped SET XACT_ABORT is restored on return (verified). It is now enabled for ambient calls too.
- Legacy unknown-actor fallback and self-creation bootstrap authorization remain separate review items.
- Separate bootstrap allocation bypasses were removed in the email implementation; actual C# System bootstrap
  and subsequent tenant/email creation are covered by the expanded tests. General first-user creation remains legacy.

## Working style with this user
- Discuss design as a partner; when multiple valid designs exist, map the trade-space honestly rather than citing "best practice".
- Do NOT modify code during exploration/context-gathering phases unless asked.
- Verify SQL proc changes against the actual table schemas before editing.
