# AGENTS.md — Overmind project memory

Working area: `src/Framework/Sistrategia.Data.SqlClient` — a 4-layer DB framework.
Layer order (build/drop dependency): **data → entities → contacts → security**.
`*_by` columns are `INT` = `entity_id` of the actor; a user is an entity (type 4) that is also a contact (type 1).
System User = id 1, public key `71F092F4-3A35-463D-9589-E5EE1373F7D5`. Default tenant `908E5A8C-0372-4EDC-ADDF-011E059091ED`.

## Active design thread (RESUME HERE)

**Iteration 5a implemented; final gate running — 2026-09-07:** authorized over committed iteration 4
(`c421d3a`); local/uncommitted. Read [docs/contact-service.md](docs/contact-service.md) and
[ADR 0014](docs/adr/0014-integrated-contact-service-and-access-boundary.md). IContactService/SqlContactService
and scoped AddSqlContactService compose the declared person/organization profile and all four families.
Requests have no actor/tenant inputs: required host IContactContextAccessor supplies explicit trusted
context and IContactAuthorizer grants per-contact Create/Edit/Delete/Restore/ReadDetail/ReadHistory/ReadDirectory.
There is no production allow-all policy or HTTP wiring. Required command permissions are all checked
before the unit; policies must not infer write access from an unlocked mutable profile snapshot.
One ordered Save uses one unit/original expected token and returns committed final revision, nullable
unit stamp and command-indexed retained child identities. Omitted commands preserve state; Replace
supplies all declared fields, with NULL clearing. No whole-list replacement, intra-request references
to newly allocated child ordinals, automatic retry or idempotency receipt is implemented.
Current detail returns state only; historical detail additionally requires history access. Directory
detail is a separate current public-channel projection and hides private/deleted roots, personal profile
and history/actions. Current revision selection is inside the full reader's existing root barrier;
the 16-set full reader and earlier specified-revision reader shapes remain intact. ContactServiceException
classifies known errors; SQL attention on cancelled requests becomes OperationCanceledException;
AuditUnitCommitUncertainException passes through unchanged. SQL runtime capability remains contact_runtime.
Focused tests passed 13/13 including actual schema/DI/normal actor; final Release build/discovery passed
with zero warnings/errors. The 101-test full gate (47 per RCSI profile plus seven database-free) is running.
Resume by checking its TRX and reconciling journals before marking complete. Evidence:
artifacts/test-results/iteration-5a/ (ignored). All 117 copied SQL files match source. Historical probes
and original fixtures are unchanged. Next after verification is iteration 5b HTTP integration; login
uniqueness remains deferred until provisioning. Fresh schemas only; no customer upgrade or deployment.
Do not commit on the author's behalf.

**Iteration 4 complete — 2026-09-07:** authorized over committed iteration 3 (`4f4fd78`),
local/uncommitted. Read [docs/contact-profile-and-lifecycle.md](docs/contact-profile-and-lifecycle.md)
and [ADR 0013](docs/adr/0013-contact-profiles-names-and-root-lifecycle.md). Strict contact_change and
SqlAuditUnit profile commands create/edit persons and organizations with explicit tenant/actor context,
exact immutable structured names, complete relational profile snapshots and ordered action evidence.
Profile input replaces declared fields; FullName is explicit, NULL optional values clear, category is fixed.
Profile and all four child families compose in one unit/revision, including initial revision 1.
Protected soft deletion rejects accounts and relationship dependencies; restoration retains child
identities/order. These lifecycle protections and deferral of relationship/category editing were stated
assumptions after optional questions received no reply, not explicit author answers. Legacy company and
birthplace references remain preserved/readable. Lock/validation transitions and account lifecycle are deferred.
entity_history_snapshot now requires explicit operation intent (1/2/3/5); constructors/bootstrap/promotion
are wired accordingly. New contact_read/SqlContactReader returns 16 sets including profile/diffs/actions;
the four-family channel reader retains its 13 sets. contact_runtime is a new opt-in capability inheriting
contact_channels_runtime; private helpers and privileged compatibility constructors remain denied.
Final build/discovery passed with zero warnings/errors; focused 15/15 and full 90/90 passed (42 per
RCSI profile plus six database-free), 11 min 13 sec, zero failures/skips. All 128 disposable databases
across seven runs have matching intent/create/identity/removal evidence and post-DROP absence checks.
All 117 copied production SQL files match source. Evidence and corrected early failures are recorded in
[testing handoff](docs/testing-handoff.md#iteration-4-contact-profiles-and-lifecycle--2026-09-07),
artifacts/test-results/iteration-4/ (ignored). Historical probes/fixtures are unchanged. Both guides,
master plan and handoffs are updated. Next at that checkpoint was iteration 5a, implemented above.
Login uniqueness remains deferred until provisioning. Fresh schemas only; no customer migration,
service/HTTP, deployment or independent review execution is claimed. Do not commit on the author's behalf.

**Iteration 3 complete — 2026-09-07:** authorized over committed iteration 2 (`06d177d`),
local/uncommitted. Read [docs/address-family.md](docs/address-family.md) and
[ADR 0012](docs/adr/0012-immutable-address-values-and-geographic-catalogs.md).
Complete immutable address values include all seven text fields and five geographic IDs; associations
contain references, stable ordinal, saved display_order, label reference, visibility and audit/tenant
metadata. Exact NULL/empty/case/space distinctions, full-key recheck after hash lookup and transaction
miss locks prevent partial matching. Country/state/county/city/colony and address/label rows are
immutable; corrections select/create replacements, preserving old labels and other contacts.
Names require parent scope, valid child IDs infer ancestors, contradictions reject. City/county may
have a country-only scope; they are parallel catalogs, not a county-to-city hierarchy. Lines or
structured street/number fields are supported, one representation per value. This was the stated
implementation assumption after an optional question received no reply, not an explicit author answer.
AddressInput validates inside unit admission; native adapters use PrepareForDatabase or equivalent
Unicode validation. SQL guards JSON structure, widths, representation and geographic consistency.
Full lifecycle/history/order/diff/actions, constructor revision 1, promotion rejection, domain state
and current saved-order view selection are implemented. The composed reader returns 13 sets under
one root barrier across email/phone/web_link/address; previous standalone shapes remain unchanged.
contact_channels_runtime adds addresses; email_runtime remains email-only. No official catalog
dataset, source-mapping workflow or automatic organization-office propagation is introduced.
Final verification and resource reconciliation are recorded in the
[testing handoff](docs/testing-handoff.md#iteration-3-immutable-addresses--2026-09-07).
Focused tests passed 17/17; full gate passed 77/77 (36 per RCSI profile plus five database-free),
8 min 58 sec, zero failures/skips or build warnings/errors. All 110 disposable databases across five
runs have matching intent/create/identity/removal evidence. All 107 copied production SQL files match
source. Evidence: artifacts/test-results/iteration-3/ (ignored), including verification.json.
Both guides, plan and handoffs are updated. Next at that checkpoint was iteration 4, now delivered
above. Login uniqueness remains deferred until provisioning. Fresh schemas
only; no customer migration, service/HTTP or independent review execution is claimed. Historical
probes are unchanged; the phone-construction fixture now supplies explicit parent country for its city.

**Iteration 2 complete — 2026-09-07:** authorized over `00c72f2`, local/uncommitted.
The author explicitly retained ordinal identity and display_order position. Read
[docs/web-link-family.md](docs/web-link-family.md) and [ADR 0011](docs/adr/0011-web-link-values-and-contact-associations.md).
Web links use exact immutable HTTP/HTTPS URL values (2048 UTF-16 units), hash candidates plus full
binary/length equality and transaction miss locks. Type (50 lowercase ASCII token), display text (256),
label reference (100) and restrictive visibility belong to the contact association. No URL rewriting.
WebLinkInput validates inside SqlAuditUnit admission; native adapters must use equivalent complete URI
validation before SQL structural guards. Full lifecycle/order/history/diff/actions, constructor/promotion
integration and checked FKs are implemented. The composed reader now returns ten sets across email,
phone and web links under one root barrier. Standalone email/phone shapes remain unchanged; a standalone
web-link SQL/C# reader is added. contact_channels_runtime adds web links; email_runtime stays email-only.
Domain WebLink tracks order/visibility and exact values; collection insertion no longer allocates ordinal.
Final build/discovery and full gate passed 64/64 (30 per RCSI profile plus four database-free), zero
failures/skips or build warnings/errors, 6 min 38 sec. All 74 created databases have verified removal;
two initial sandbox encryption-failure intent names separately verified absent. Evidence:
artifacts/test-results/iteration-2/ (ignored), including verification.json and absence-verification.json
under schema/. All 81 copied production SQL scripts match source. Both guides, plan and handoffs updated.
Next at that checkpoint was iteration 3, now delivered above. Login uniqueness remains deferred to provisioning.
Fresh schemas only; no customer migration, HTTP, independent review execution or sibling-project change.

**Iteration 1 complete — 2026-09-07:** authorized after the author's phone discussion,
over committed iteration 0 (`78e2d9e`). Read [docs/phone-family.md](docs/phone-family.md),
[ADR 0009](docs/adr/0009-phone-values-parsing-and-numbering-geography.md) and
[ADR 0010](docs/adr/0010-composed-contact-family-reader.md). Phone identity is immutable E.164 with typed
calling-code/national strings; exact immutable phone_input JSON preserves raw input, optional split,
numbering geography and parser metadata. PhoneParser uses libphonenumber-csharp 9.0.38, explicit region
for national/split inputs and no address inference. Qualified geography is not contact residence; optional
versioned prefix/place catalog starts empty pending a sourced dataset. Full phone lifecycle/history/order,
SqlAuditUnit phone commands, private family components and a coordinator-owned email/phone reader are in
place. contact_channels_runtime opts into phone; existing email_runtime stays email-only. Constructors
append prepared phone_data, reject ambiguous legacy phone arguments and route initial phone through the
writer with expected version 0/revision 1. Phone label/extension inputs no longer truncate before validation.
Actual seed uses prepared phone data. Both guides/master plan/testing handoff are updated; no sibling
project or customer database changed. Final build/discovery: zero warnings/errors, 53 tests (25 per RCSI
profile plus 3 database-free). Full gate passed 53/53, zero failures/skips, 5 min 30 sec. All 142 distinct
owned databases across seven runs have verified removal evidence; final owns 52 (26 per profile).
Evidence: artifacts/test-results/iteration-1/final/ and verification.json (ignored). All 22 changed/new
framework SQL scripts match final test copies. The root-footprint test now instruments the shared
coordinator through both wrappers and retains its prior lock-count/table-lock assertions.
Historical independent reports/probes remain unchanged. Iteration 2 web links has not started.

**Iteration 0 complete — 2026-09-07:** authorized implementation over `4a30dc0`, saved locally.
Read [docs/adr/0008-constructor-corrections.md](docs/adr/0008-constructor-corrections.md) and the updated
[master plan](docs/contact-api-master-plan.md). Ordinary accounts require person contacts on new construction
and promotion (51605); ignored promotion detail inputs now reject before defaults (51606), with whole-unit
rollback coverage. Private company lookup protects misses with a tenant/database-collation-compatible CHECKSUM
applock bucket and rechecks full-name equality; collisions serialize only, never define identity. A filtered
company-name index and required actor public-key seek prevent unrelated lookup scans. Existing 51604 is
reserved by user_history_create. Creation occurrence passes through event_create.@when_ocurred into the actual
entities.event.created column; there is no event.when_ocurred column. Ledger recorded_at remains server time.
The actual seed now uses user_insert's initial Developer role evidence. The author explicitly deferred login
uniqueness until provisioning; no login constraint or account tenant column added. SQL follows the requested
audit-unit style for new/substantively changed scripts. Final build/discovery/full gate: 42/42, both RCSI
profiles, zero failures/skips or build warnings/errors, 5 min 14 sec. All 149 distinct disposable databases
across seven runs have verified removal evidence in artifacts/test-results/iteration-0/ (ignored); final-2 is
the authoritative final run. Tests cover 35 promotion inputs, organization/group rejection, company equality,
collision/distinct-name concurrency and actual seed evidence. Historical reviews/probes are unchanged.
Next is iteration 1 phone, beginning with identity/visibility and reader composition decisions; it has not
started. Older statements below that constructor corrections are pending describe their dated checkpoints.

**Master-plan feedback incorporated — 2026-09-07:** revision 2 of
[docs/contact-api-master-plan.md](docs/contact-api-master-plan.md) is ready for iterative work; all implementation
iterations remain planned. It adds reader composition during phone, concrete phone/address/name fidelity tests,
separate service (5a) and HTTP (5b) gates, explicit service tenant context, and a visibility-policy checkpoint.
Login scope is an iteration 0 discussion, still undecided and not a phone blocker. Company-name lookup/lock
equality must agree; no range-lock strategy is preselected. Listing/search is separately tracked. The author
requests SQL style matching `Scripts/Data/create_audit_unit_begin.sql`: readable blocks and named arguments,
consistent indentation/header/comments, with accurate metadata; preserve each procedure's behavioral/security
contract. Apply to new/substantively touched SQL, not unrelated mass formatting. This revision is documentation
only; implementation begins with the next authorized iteration, starting with iteration 0.

**Contact/API master plan — 2026-09-07:** start with
[docs/contact-api-master-plan.md](docs/contact-api-master-plan.md). The author requested an iterative plan:
bounded constructor corrections, phone, web links, addresses, person/organization profile and lifecycle,
integrated contact API, then administrative user provisioning. Iterations are planned, not implemented;
this request authorized planning/documentation only. Address ownership is decided: shared immutable complete
values, geographic catalog FKs and optional text on the value; `contact_address` contains references/order
and required association metadata, not address text. Separate catalogs for address lines remain optional.
Focus persons/organizations first. Groups remain parties/holders of organizations or people that may carry
contact information; dedicated group work is deferred. Favor unobtrusive tenant resolution for current
single-tenant or non-shared-user applications; shared-user tenant switching is future discussion, and login
uniqueness/normalization remains undecided. Source review checkpoint `bb2b2c2`; no SQL tests rerun by planning.

**User-account eligibility clarified by the author — 2026-09-06:** ordinary user accounts belong to human
person contacts. Companies/organizations and groups may be business parties, owners or represented by people,
but must not themselves receive ordinary login accounts or become the identity attributed with database writes.
Apply this rule to both new-user construction and existing-contact promotion; current SQL does not enforce it yet.
P4 is now a decided policy with pending implementation/tests, not an open choice. Preserve the reserved System
bootstrap identity as an existing technical exception; future agent/bot/application identities need an explicit
separate contract and are not company accounts. This discussion records policy only; no production fix was requested.

**Historical review probes — 2026-09-06:** test-only coverage integration over `d660dd4` is described in
[docs/testing-handoff.md#historical-review-probe-coverage](docs/testing-handoff.md#historical-review-probe-coverage).
The inventory classifies email A–G and user P1–P9/P3b against current code, with precise unresolved recipes.
Three new scenarios run under both RCSI profiles (38 tests total): savepoint allocation rejection, actual C#
opposite-root deadlock/whole rollback/fresh-unit retry, and promotion-before-email composition. Positive promotion
fixtures use NULL contact-name input; staged System fixture checks no longer silently repair its type.
Production SQL and archived probe contents are unchanged. Constructor defects/policies, event occurrence time,
account phone, explicit root-lifecycle operations and seed-role evidence remain separate work, not accepted behavior.
[src/tests/review/README.md](src/tests/review/README.md) records provenance. Codex's independent follow-up is complete:
no blocking integration issue; restore/build/discovery, all 6 focused cases and the full 38-test gate passed,
zero failures/skips or build warnings/errors. Full run: 3 min 34 sec. All 44 focused/full databases reconcile
through creation, identity and verified removal. Evidence: `artifacts/test-results/review-probes-return-20260906-01/`
(ignored). Both possible deadlock victims occurred across runs; rollback/history/invalidation/fresh retry passed.
No production or test changes were needed by this review; unresolved production recipes remain unexecuted here.
The migration's earlier completed verification below remains a dated completed checkpoint.
The integration author's final local restore/build/discovery and full gate passed: 38/38, zero failures/skips or build warnings/errors,
3 min 24 sec. All 38 final-run databases (19 per profile) removed; all 92 databases across this task's executions
have matching intent/create/identity/removal evidence in `artifacts/test-results/review-probes/` (ignored).

**Backend testing migration — 2026-09-06:** current commands, coverage map, execution evidence and the completed
return-session verification checklist are in [docs/testing-handoff.md](docs/testing-handoff.md). Codex independently
reviewed `efacebb..d660dd4`: no blocking local-workflow migration defect; restore/build/discovery passed, followed by
the focused test and all 32 tests (15 per RCSI profile plus 2 parser tests), zero failures/skips and build warnings/errors.
Empty selection and missing SQL configuration both correctly returned exit 1. All 33 focused/full-run databases have
matching creation/identity/removal records and successful post-DROP absence checks. Evidence:
`artifacts/test-results/return-session-20260906-01/` (ignored). Remote CI/Kudu and SQL-auth validation remain unexecuted.
Use
`dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger "trx;LogFileName=audit.trx" --results-directory artifacts/test-results`
after its documented configuration/restore/build. MSTest/VSTest tests replace maintained Python/sqlcmd orchestration
and the console harness; old commands below are historical. Production mechanisms and independent review probes
are unchanged. No pending constructor fix, phone port or deployment is authorized by this testing handoff.
The test tree is now `src/tests`, matching the lowercase `tests` solution folder beside the other source directories.
Older dated paths below describe their original checkpoints; historical probes moved without content changes.

**Codex session close — 2026-09-05 (latest authoring context):** the user wants time to absorb the redesign;
the latest completed task was an approachable guide, not another implementation pass. Start human discussion with
`docs/guide-co/README.md`: eight linked chapters, one contact-edit example, glossary, code/status map; chapters 1–3
are the first reading path. `docs/guide-cc/README.md` is the other agent's complementary guide; preserve both.
Guide links/navigation and the C# example signatures were checked; no SQL suite was rerun for documentation.
Observed clean HEAD before this memory update: `1e0da91`; ordinary construction/review is committed in `c575325`,
both guides in `fb0fa88`. This memory update itself is saved locally, not committed by Codex.
The user-construction review was read while writing guide-co, and its open findings were documented, not fixed or
accepted wholesale. Resume with the user's guide questions or a bounded response to that review before broader
family work; do not infer authorization to port phone or settled account policies from a resume checklist alone.
See `docs/dbrow_version-design-session-handoff.md` for the current review boundary and remaining decisions.

**Session close 2026-09-05 — resume checklist.** Everything below is committed. Implemented and green in both isolation
profiles: audit-unit guards, email family with saved order (ADR 0005/0006), ordinary user construction (ADR 0007).
Independent reviews delivered: email (`docs/email-reference-family-independent-review.md`, its four fixes are applied)
and user construction (`docs/user-construction-independent-review.md`, findings still pending builder response).
Reader-friendly entry point for the author: `docs/guide-cc/README.md`. To resume: (1) `git log a3b715a..HEAD` for
overnight builder changes; (2) decide the four user-construction items (company-name applock, reject contact details on
promotion, login uniqueness scope, company accounts) and give `entity_history_snapshot` an explicit operation parameter;
(3) port phone by `docs/guide-cc/10-porting-a-family.md`, then request its independent review; (4) update guide-cc
chapters touched by any mechanism change.

**Entry-level guide for the author (2026-09-05):** `docs/guide-cc/README.md` is a short book that bridges the legacy
audit design to the new one (unit, clocks, locking, final-state history, child identity/order, dictionaries, actors and
users, reader, porting recipe, error glossary, status map). Keep it in sync when mechanisms change; it describes the
working tree as of this date and says where designs are not yet implemented.

**User-construction independent review (2026-09-05):** `docs/user-construction-independent-review.md`, target = working
tree over `a3b715a`. Verdict: sound bounded reference; proceed to the next family. Both suite profiles pass. Before reusing
or exposing `user_insert`: exact-value lock on the company-name miss path (under RCSI two concurrent creations made
duplicates, then every creation naming that company fails 51313; probe-confirmed), reject contact-detail inputs on
promotion instead of dropping them (probe-confirmed). Decide login uniqueness scope (duplicates accepted today) and
whether company contacts may hold accounts (accepted today). Probes: `tests/review/user-construction/`.

**Latest implementation — ordinary user construction (2026-09-05):** read
`docs/adr/0007-ordinary-user-construction-and-type-history.md`. user_insert now validates an existing active
user actor/default or explicit tenant, creates a user-typed revision 1, or locks/promotes an ordinary contact
using a required unit-entry expected_entity_version and one bump. Optional INOUT dbrow_version remains;
user_id/entity_version OUTPUT were appended. No System/MAX-tenant fallback or implicit self-registration in
this constructor. The installation seed explicitly uses System to create its account, which then acts for itself.
entity_history now carries required entity_type_id; entity creation/promotion/System bootstrap share the private
entity_history_snapshot helper. user_history records non-secret construction payload via a private helper;
hashes, salts, security tokens and login telemetry are excluded. Account email is initialized unconfirmed and
remains separate from contact email. The reader exposes historical EntityTypeId. Initial role names require
exactly one eligible tenant/global definition and its ID is retained in creation event_args. Optional company
lookup is scoped to tenant/company category, rejects inactive/ambiguous matches, and writes new company contact
history. Public self-registration, login uniqueness/authentication policy, full user/role/relationship lifecycle,
broader legacy constructor hardening and migration remain separate work. email_runtime still denies constructors.
The email correction checkpoint is a3b715a. The user-construction pass and its independent review are now committed in c575325.
Follow-up review prompt: `docs/user-construction-independent-review-prompt.md` (baseline a3b715a/current worktree).
Final user-construction validation: full SQL/C# suite passed READ COMMITTED with RCSI off and on, including
company-reference fixes, competing promotions, historical type and actual seed-user schema-cycle operations.
Both builds had zero warnings/errors; all six final-profile disposable databases were removed.

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
The concrete 51201 prerequisite found here is now resolved by ADR 0007 above. Schema-cycle tests now use the
normally constructed seed user for email changes, without raw-DML promotion or a System-actor substitute.
Final validation: full SQL/C# runner passed READ COMMITTED with RCSI off and on, zero build warnings/errors;
all six final-run disposable DBs removed. Actual schema cycle, role membership, reader locks, order/history/actions,
queued/executing cancellation/disposal and terminated-owned-session commit failure are covered. git diff --check
and documentation links passed. The email correction pass is checkpoint a3b715a; independent review files are unchanged.

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
- Match solution-folder casing to its physical directory (for example, lowercase `tests`), and preserve the lowercase `overmind.sln` name. Use the single `src/overmind.sln`; target a test `.csproj` directly when a narrower build scope is useful.
- Discuss design as a partner; when multiple valid designs exist, map the trade-space honestly rather than citing "best practice".
- Do NOT modify code during exploration/context-gathering phases unless asked.
- Verify SQL proc changes against the actual table schemas before editing.
