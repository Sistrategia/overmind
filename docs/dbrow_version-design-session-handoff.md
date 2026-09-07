# Audit foundation — session handoff

Updated: 2026-09-07. Purpose: resume with current recommendations and distinguish them from implemented code.

## Resume here

**Iteration 5a complete, 2026-09-07:** authorized over committed iteration 4
(`c421d3a`); implementation now committed in `7d99164`, final verification/handoff updates local.
[ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md) and
the [service guide](contact-service.md) define IContactService/SqlContactService, scoped registration,
required trusted context and per-contact capabilities. Ordered saves compose profile and all four
families in one unit and return committed final revision/child identities. Omitted commands preserve
state; Replace clears omitted optional fields. No automatic retry, receipt or whole-list replacement.
Current detail excludes history/actions; historical detail requires an additional grant. Directory
detail uses a separate filtered projection, hiding private/deleted roots and private channels. The
full reader selects the current version inside its root barrier and keeps its 16 result sets.
SQL actor/tenant checks still apply; no permissive host policy or HTTP registration is installed.
Known errors map to service outcomes; cancellation and uncertain commit remain distinct.
Focused tests passed 13/13; final build/discovery passed with zero warnings/errors. Full gate passed
101/101 (47 per profile plus seven database-free) in 12 min 17 sec, zero failures/skips. All 118 databases
across three runs have verified removal; see the [testing record](testing-handoff.md#iteration-5a-integrated-contact-service--2026-09-07).
Next is 5b HTTP integration, not started; login uniqueness remains deferred until provisioning.

**Iteration 4 complete, 2026-09-07:** authorized over committed iteration 3 (`4f4fd78`),
local/uncommitted. Read [ADR 0013](adr/0013-contact-profiles-names-and-root-lifecycle.md) and the
[profile/lifecycle guide](contact-profile-and-lifecycle.md). Strict person/organization creation and
profile replacement now capture exact immutable structured names and complete relational snapshots.
Profile and all four child families share one unit/revision; root history receives explicit operation
intent and effective commands retain globally ordered action evidence. Protected soft delete/restore
retains child identities/order; deletion rejects accounts and relationship dependencies. Relationship
editing, category conversion and lock/validation transitions remain deferred. The lifecycle protections
and deferrals were stated assumptions after optional questions received no reply, not explicit author answers.
The full contact_read/SqlContactReader adds profile state/diffs/actions for 16 result sets; the existing
channel reader remains at 13. The new contact_runtime capability inherits channel access without exposing
private helpers or legacy constructors. Existing constructors/bootstrap capture complete name/profile history.
Final focused tests passed 15/15; full gate passed 90/90 in 11 min 13 sec, both RCSI profiles, zero
failures/skips or build warnings/errors. All 128 databases across seven executions have verified removal;
see the [testing record](testing-handoff.md#iteration-4-contact-profiles-and-lifecycle--2026-09-07).
Next at that checkpoint was iteration 5a, now implemented above. Login uniqueness remains deferred until
provisioning. Fresh schemas only; customer upgrades, service/HTTP and independent review remain separate.

**Iteration 3 complete, 2026-09-07:** authorized over `06d177d`; local/uncommitted. Read
[ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md) and the
[address guide](address-family.md). Complete shared immutable addresses and scoped immutable
geographic catalogs now have lifecycle, saved order, history/diffs/actions, constructor integration
and coherent four-family reads/saves. Associations store references, with stable identity and audit
metadata. Every value field participates in exact matching; changing a catalog label requires a
replacement value, preserving old revisions. Partial addresses use explicit scopes; conflicting
IDs/names reject. The implementation supports lines or structured street fields, one per value,
using the stated assumption after the optional representation question received no reply.
The composed reader appends addresses for 13 result sets; all standalone shapes remain intact.
See the [testing record](testing-handoff.md#iteration-3-immutable-addresses--2026-09-07) for final
verification and database reconciliation. Next at that checkpoint was iteration 4, now delivered
above. Login uniqueness remains deferred until provisioning. Fresh schemas only;
official catalog datasets, source mappings, service/HTTP and customer migrations remain separate.
Focused tests passed 17/17; full gate passed 77/77 in 8 min 58 sec, both RCSI profiles, zero
failures/skips or build warnings/errors. All 110 databases across five runs have verified removal.

**Iteration 2 complete, 2026-09-07:** authorized over `00c72f2`. The author retained ordinal identity
and display_order position. [ADR 0011](adr/0011-web-link-values-and-contact-associations.md) and the
[web-link guide](web-link-family.md) describe exact immutable URLs, association metadata, full lifecycle,
constructor integration and ten-set composed reads across email/phone/web links. Final build/discovery
and full gate passed 64/64, both RCSI profiles, zero failures/skips or build warnings/errors, 6 min 38 sec.
All 74 created databases have verified removal; two initial connection-failure intent names were
separately verified absent. See the [testing record](testing-handoff.md#iteration-2-web-links--2026-09-07).
Next at that checkpoint was iteration 3, now delivered above. Login scope remains deferred until provisioning.
The earlier checkpoint below retains its original verification evidence.

**Iteration 1 implementation, 2026-09-07:** the author approved canonical international phone identity,
preserved input, optional LADA decomposition and qualified numbering geography, then authorized iteration 1.
[ADR 0009](adr/0009-phone-values-parsing-and-numbering-geography.md),
[ADR 0010](adr/0010-composed-contact-family-reader.md) and the [phone guide](phone-family.md) describe the
implemented family, parsing boundary and composed reader. Iteration 1 is complete locally over `78e2d9e`:
final build/discovery and full gate passed 53/53, zero failures/skips or build warnings/errors, 5 min 30 sec.
All 142 distinct disposable databases across seven runs have verified removal records; see the
[testing handoff](testing-handoff.md#iteration-1-phone-and-composed-reader--2026-09-07).
No phone-derived geography is copied into contact addresses. Optional geographic-ID mapping tables are empty
pending a sourced dataset. The new opt-in contact_channels_runtime role preserves email-only capability.
Next at that checkpoint was web links, now delivered in iteration 2 above.

**Iteration 0 complete, 2026-09-07:** the author authorized the bounded corrections in the
[master plan](contact-api-master-plan.md); [ADR 0008](adr/0008-constructor-corrections.md) is the current
constructor contract. Person-only construction/promotion, explicit rejection of ignored promotion inputs,
collation-compatible company miss protection, a targeted actor seek, occurrence metadata and actual seed
initial-role evidence are implemented. Login uniqueness is explicitly deferred by the author until provisioning.
Final Release build/discovery and full gate passed 42/42 in both RCSI profiles, zero failures/skips or build
warnings/errors, 5 min 14 sec. All 149 distinct test databases across this task's seven runs have verified
removal records. See the [testing handoff](testing-handoff.md#iteration-0-constructor-corrections--2026-09-07).
Changes are local over `4a30dc0`. Next is iteration 1 (phone identity/visibility, composed reader and family);
it has not started. Older planning and review-boundary notes below retain their historical scope.

**Plan revision 2, 2026-09-07:** [master plan](contact-api-master-plan.md) incorporates the independent feedback:
early reader composition, concrete family fidelity regressions, service/HTTP split (5a/5b), explicit tenant
context and decision checkpoints. Iteration 0 is next; implementation has not started. The plan also records
the author's SQL formatting reference, `create_audit_unit_begin.sql`. No new database verification is claimed.

**Current planning entry point, 2026-09-07:** [Contact and user provisioning master plan](contact-api-master-plan.md)
records the author's shared immutable address decision, persons/organizations-first scope and proposed
iterations through a complete contact API and administrative provisioning. The plan is not implementation
evidence. Person-only ordinary account eligibility was settled on 2026-09-06; older sections that call it
an open organizational-account policy are historical. Login uniqueness remains undecided. The testing
return-session verification referenced below is completed in the newer testing handoff. This planning pass
changed documentation only and did not rerun SQL tests.

**Testing infrastructure, 2026-09-06:** use [testing-handoff.md](testing-handoff.md) for current .NET/MSTest commands,
configuration, coverage continuity, migration execution evidence and the pending return-session verification checklist.
The maintained Python/sqlcmd runner and console entry point have been replaced by `src/overmind.sln` and
`src/tests/AuditTests`. Commands in older dated sections are historical. Production design and open review findings are
unchanged; this migration does not authorize a phone port, constructor corrections or live deployment.

**Session close, 2026-09-05:** the user's latest priority is understanding the accumulated design and code through an approachable reading path. Codex completed [guide-co](guide-co/README.md): eight linked chapters following Mariana editing Lina's contact, plus a glossary and a code/status map. Start with chapters 1–3; source/ADR reading is optional on the first pass. The other agent's [guide-cc](guide-cc/README.md) is complementary and remains preserved. Keep both guides' implementation/status claims current when mechanisms change.

At close, the working tree was clean at `1e0da91` before this memory edit. Ordinary construction and its independent review are in `c575325`; both guides are in `fb0fa88`. The guide describes the implementation at `c575325`. Codex checked its links, navigation, Markdown fences/whitespace and C# example signatures; the documentation task did not rerun SQL tests. This closing memory edit is saved on disk without a new commit.

The [user-construction review](user-construction-independent-review.md) has been delivered and read. Its findings are reflected in guide-co; no follow-up production fixes were made during guide writing or session close. Next, follow the user's questions about the guide or evaluate a bounded correction pass against that review. The user has not selected login uniqueness scope or organizational-account policy, and the resume checklist alone is not an instruction to start the phone implementation.

**Latest authorized implementation:** ordinary user construction/promotion and type history, following the email corrections. Start with [ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md) and the [usage/test/review guide](email-reference-family.md); [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) is the email correction checkpoint. The broader design remains below; do not describe every capability in it as implemented. No customer database or sibling project was changed.

user_insert now uses an existing validated user actor and the established default/explicit tenant. A new account commits with user type at revision 1; promotion locks the existing contact, requires its unit-entry expected token and bumps once. Required entity_type_id in root history, a shared private root snapshot helper and non-secret account creation history preserve the transition. Account email is initialized separately and stays independent of contact changes. The actual installation seed is created by System, then acts through the email API itself. Initial role selection rejects wrong-scope/ambiguous names; optional company lookup is tenant-scoped and new companies receive contact payload history. Public self-registration and the broader login/account/role lifecycle remain separate work.

The user approved the ordered-list model: stable ordinal is identity, separate display_order sets the saved list, and its first item is principal/default. Insert and restore append; delete closes gaps; Make principal means move to 1. No independent stored primary flag and no implicit change to login/account email. Reorder actions and shifted-row final snapshots are implemented, with action payload version 2. Temporary UI sorting must not persist an order change; no frontend interaction is built in this pass.

The correction pass adds root-leading history indexes and required seeks for the locking reader (the new regression found the optimizer could still scan the global clock and retain 201 range locks per history table with indexes alone). Exact-value transaction locks replace catalog miss range locks. Retained child identities replace the redundant counter table as the high-water mark. Native writes require READ COMMITTED with/without RCSI, rechecked after enrollment. The named audited business-batch runner supersedes ad hoc seed enrollment. Queued cancellation is recorded before commit admission; issued commit is uncancellable and errors become AuditUnitCommitUncertainException. Deployment role memberships survive schema rebuild; administrative tenant creation requires an actor. ADR 0006 records reasoning, reviewer corrections, tradeoffs and deferred user-lifecycle findings.

The actual-seed email test originally exposed 51201 because legacy user_insert left the root typed as contact. ADR 0007 resolves it; the current test uses the normally constructed seed user without weakening actor validation, raw-DML promotion or an actor substitute. The email reader also returns historical EntityTypeId across promotion.

The email correction checkpoint passed both normal and --rcsi runs on local SQL Server 2022, with zero build warnings/errors and all six generated databases removed. It is committed as a3b715a. User construction and its independent review are now committed in c575325; the focused source map/questions remain in the [follow-up review prompt](user-construction-independent-review-prompt.md). Independent reports/probes are preserved as their own records.

The final ordinary-user-construction suite also passed both profiles after the company-reference changes: zero build warnings/errors and all six final-profile disposable databases removed. Coverage includes competing promotions, current-unit composition/rollback, historical type, private helper permissions, scoped role/company selection, and the real schema cycle using the ordinary seed user as actor. No application database was rebuilt or migrated by these tests.

The user asked to continue without depending on another review round and to avoid excessive SQL Server dependencies. The resulting [revised primary design](dbrow_version-allocation-design.md) is now the current recommendation. SQL Server/Azure remains first; other providers implement equivalent behavioral contracts rather than identical SQL or engine internals.

Read:

1. [Primary design](dbrow_version-allocation-design.md).
2. [ADR 0002: portable audit unit and history](adr/0002-portable-audit-unit-and-history.md).
3. [ADR 0003: tenants, actors, bootstrap, catalogs](adr/0003-tenant-actor-and-catalog-policy.md).
4. [ADR 0004: delivery and provider profiles](adr/0004-portable-delivery-and-provider-profiles.md).
5. [ADR 0001](adr/0001-dbrow-version-allocation-helper.md) for the historical helper extraction, superseded where noted by ADR 0005.
6. [Focused legacy implementation findings](dbrow_version-legacy-implementation-findings.md) for the supplied CFUS, LaSalle and SistrategiaDataAnalysis evidence; it is the intake map for the next family, not a full application audit.

The [independent review v3](dbrow_version-independent-review-v3.md), [follow-up questions](dbrow_version-independent-review-v3-follow-up-questions.md), and [answers](dbrow_version-independent-review-v3-answers.md) remain preserved as independent input. Their recommendations are not all adopted; the revised design/ADRs explain the differences. The later email implementation was explicitly authorized after the documentation and source-inspection phases.

## User priorities

- Auditing and historical reconstruction have resolved actual customer mistakes and security incidents. Preserve that product advantage for another ten or more years.
- Audit quality comes first, but some databases have millions of rows and many gigabytes. Measure contention, indexes, write amplification, and history growth.
- Keep user-friendly entity_version for a contact/invoice independently of database transaction numbering.
- Most installations have one database, often one tenant. Use a real default tenant internally; make tenant selection unobtrusive in these installations.
- Some data is genuinely shared: global role definitions, System/platform identities, immutable labels and name/value dictionaries. Do not force tenant ownership onto every table or dismantle interning based on style preference.
- Disconnected branches/clients in Mexico, including SQLite/Electron/browser stores, must continue useful work and later reproduce or reconcile it. Perfect distributed convergence, hashes, and a blockchain are not required.
- Historical migration across schemas and providers must preserve recorded outcomes, actors, and history. It is different from replaying commands under current rules.
- MSSQL and Azure are primary, but avoid excessive provider dependency. Equivalent PostgreSQL/MySQL mechanisms and provider-neutral contracts are acceptable; not every provider needs an identical stored-procedure API.

## Implemented state — email reference family

data.dbrow_version_ensure remains the shared allocator. Native transactions now explicitly enroll through data.audit_unit_begin. Private dbo-namespace transaction locks prove enrollment and per-version ownership; allocation_transaction_id is only an indexed discovery hint. NULL auto-joins without SESSION_CONTEXT. A global ledger unique key reinforces the assumption that one number identifies one local unit. Entity/contact/user standalone constructors enroll automatically; raw ambient callers must enroll explicitly.

SqlAuditUnit owns/serializes the connection and transaction, fixes actor/tenant, invalidates on command error/cancellation before commit admission and rolls back on uncommitted disposal. Email insert/update/delete/restore/move use one root lock/bump, unit-entry optimistic tokens, current-unit final history and typed ordered actions. Contact construction delegates its initial email to the same writer without an extra root revision. Retained child identity supplies MAX(ordinal)+1 under the root lock and prevents committed ordinal reuse; there is no separate counter table. Exact dictionaries use binary value AND byte length.

SqlContactEmailReader returns historical root context, email state, optional revision diff and that revision's actions with actor/UTC time. Its SQL procedure owns a short SERIALIZABLE read transaction and takes a shared barrier on the clustered root key; writers take that key exclusively before child mutation. A concurrent regression verifies this interval, preventing a reader/writer lock-upgrade cycle. It is not a full contact reconstruction across unimplemented families. email_runtime grants only the new public capability and denies direct helpers/table access. New public email paths require an active user-type actor in the target tenant; broader shared-actor delegation and contact-level application authorization are separate.

The two old bootstrap allocation bypasses are removed. A protected System bootstrap preserves ID 1/public key/type 4, resolves the actual tenant ID and writes available histories/spine atomically; the C# builder invokes it. Administrative tenant_insert takes a resolved actor ID and uses the helper. ADR 0007 implements ordinary creation/promotion and adds account/type history to bootstrap. Entity IDENTITY, direct legacy entity/contact self-rebinding and broader constructor fallback remain privileged compatibility boundaries outside email_runtime; public self-registration/reservation remains separate work.

The expanded SQL/C# suite covers lifecycle, reconstruction, permissions, concurrent writers/catalogs, late-root rejection, cross-database forged reuse, actual C# System bootstrap with tenant ID 2, and the previous allocation tests. Build/test commands and exclusions are in the guide. It creates/removes only generated disposable databases. No capacity benchmark, another provider, live upgrade, general migration/coverage adapter, synchronization or uncertain-commit recovery receipt is claimed.

Follow-up history: the user reported CreateSchema error 51102 because the application business seed ran inside RunLocalStoredCommands' unenrolled transaction. A seed-level preamble fixed it initially. ADR 0006 supersedes that preamble with RunLocalStoredAuditCommands, selected by the business-seed call site; the generic DDL/resource runner retains its separate boundary. SchemaCycle.cs reproduced the original failure and now also tests explicit batch success/rollback/missing-helper failure, contact/actor card selection with independent login email, role membership persistence and old counter cleanup through the actual Overmind manager. The SQL is embedded in the application data assembly, so a running application needs a rebuild/restart to load it.

Correction preserved: procedure-scoped SET XACT_ABORT is restored on return. Earlier notes claiming a session leak were wrong. Both derived insert procedures already used sequences before helper extraction; old pending MAX()+1 notes about those two procedures were stale.

## Overall recommended contracts — implemented subset is defined in ADR 0005

- One controlled local business audit unit owns one database/tenant/actor/allocation and outer transaction. Trusted coordinator enrollment is the portable authority. Optional INOUT stays; NULL auto-joins only an enrolled unit. Raw session state is not proof.
- SQL Server native composition now uses tested private transaction-owned guards plus indexed engine-ID discovery. Other providers need equivalent behavior, not this SQL-specific hint/lock API. No writable session marker is authority.
- Lock known roots first. Late roots are allowed only when their current stamp is not greater than the unit's version; reassert monotonicity at bump and retry the entire unit on failure. Keep one bump per aggregate and validate expected tokens against unit-entry state.
- History holds final touched-row state, maintained through current-unit-only upserts. Redundant final snapshots after change/revert are allowed. Significant intermediate actions carry their actual values/references in ordered action evidence.
- Child ordinals used as identity never reuse a committed deleted child's number; retained identities supply the root/family high-water mark under the root lock. Saved order is separate and auditable. Cross-origin child references require mapping.
- Ordinary business data has a real tenant. Explicit invalid tenants fail. Global definitions and identities do not imply unrestricted access. is_system alone is neither user eligibility nor cross-tenant authorization.
- Self-registration reserves its own new entity ID. Trusted bootstrap supplies a reserved ID to an internal primitive, not the public self-registration path. Preserve System ID 1 and its known public key intentionally.
- Shared immutable dictionaries are retained where useful. Exact accepted spelling and normalized matching are separate. Sentinel repointing does not itself remove the old stored value.
- Portable delivery uses transactional pending work plus durable inbox and base/dependency checks. Never scan only dbrow_version > last_sent. Apply one source transaction per local business transaction; transport receipt can batch.
- Original transaction identity is (origin_uid, origin_dbrow_version), preserved through exact replay/forwarding. Reconciliation creates a new local identity with source links. Legacy tenant-local numbering needs a richer source namespace.
- Change Tracking is an optional SQL Server commit-feed adapter. Recovery generation, tenant scope, retention, complete page groups, and receipt/application progress are explicit. Durable captured commit order is an optional journal, not a prerequisite for local audit or dependency-aware delivery.
- General revision DAGs, per-revision UUIDs, hash chains and distributed snapshots remain deferred. The optional chained-history document is a future assurance exploration.

## Concrete findings from the answer review

Isolated local SQL probes on 2026-09-05 used temporary tables/session state only:

- SELECT assignment with no matching row preserved a prior OUTPUT value (777). Result variables must be initialized appropriately in catalog/root helpers.
- Manually set SESSION_CONTEXT values satisfied the answer's reuse predicates for an already committed temporary ledger row. The marker and current transaction survived USE into another database.
- N'Juan' compared equal to N'Juan ' under Latin1_General_100_BIN2 despite differing byte lengths. BIN2 alone is not an exact spelling/whitespace uniqueness contract.
- The answer's entity-version assignment returned the actual incremented value correctly in the probe; no defect was inferred there.

The email implementation added another probe: binary UTF-16 for N'A' compared equal to binary UTF-16 for N'A'+NCHAR(0). Email/location keys therefore combine binary bytes with their length; a regression covers this. Do not simplify them to BIN2 or VARBINARY alone when porting the pattern.

The answers' batch application also contradicted one-allocation-per-transaction auto-join; a shared System flag still overgeneralized authorization; and the bootstrap path simultaneously required internal preallocation and public self-allocation. ADRs 0002–0004 resolve the contracts. ADR 0005 implements native auto-join, ordinary email actor restrictions and reserved System bootstrap; distributed application, shared delegation and general self-registration remain separate work.

Portability research found PostgreSQL CACHE > 1 may return audit sequence values out of order across sessions, MySQL GET_LOCK survives transaction completion, and PostgreSQL CURRENT_TIMESTAMP means transaction start. The provider ADR records equivalent implementations and required tests; PostgreSQL/MySQL adapters have not been executed or claimed complete.

## Next implementation boundary

The email corrections are checkpoint a3b715a, followed by ADR 0007's ordinary-user prerequisite fix and the delivered [independent review](user-construction-independent-review.md), committed in c575325. The review confirms the bounded constructor/type-history and email integration behavior; its reference runs passed both profiles. A builder response and follow-up corrections remain open. Before broader constructor reuse, evaluate concurrent company-name creation and silently ignored promotion inputs; decide login uniqueness scope and whether company contacts may hold accounts. Also assess explicit root-lifecycle operation semantics, occurrence/event-time consistency, account-phone documentation and the seed's direct role-assignment bypass.

Evaluate the proposed corrections against the actual API: a company-name lock must match the lookup's equality semantics, and rejecting promotion inputs must account for existing required/defaulted constructor parameters. These are implementation considerations, not decisions already approved by the user. Phone, public self-registration, broader user lifecycle, shared-actor delegation, migration/coverage adapters and delivery remain subsequent work.

The earlier local implementation checkpoint is 48f2cd9; the [independent review prompt](email-reference-family-independent-review-prompt.md) identifies its baseline and questions. The received [report](email-reference-family-independent-review.md) and probes were added in 3df70f5 and remain unchanged. The verdict was ready after named fixes. ADR 0006 records those corrections; the later user-construction review independently covers its stated constructor/email integration scope. Preserve the distinct review targets rather than rewriting the earlier report.

Keep layer order data → entities → contacts → security. Verify actual DDL before editing SQL. Preserve independent reviewer documents as their own record. Do not mark recommended contracts as already implemented.

## Focused source intake, 2026-09-05

The user supplied sibling paths for SistrategiaDataAnalysis, CFUS-TOP-React and LaSalle-egresados and asked to avoid losing focus through excessive reading. The bounded review followed CFUS email lifecycle/DDL/DAC, LaSalle worker → selected orchestrator methods → ledger/email extractors → child range processor, and the relevant earlier analysis/specification. Sibling projects remained read-only; no migration or application test was run. Findings and precise source links are in the legacy report above. Do not reread entire applications to resume.

- CFUS has real child-email history and aggregate entity_version. Its entity_history is the thin spine, while entity_data_history holds root payload; Overmind uses entity_version_history/entity_history respectively. Adapt behavior, do not copy names mechanically. Its MAX()+1, unguarded reuse, repeated-history inserts and live-ordinal allocation are legacy behavior, not the selected mechanism.
- The inspected LaSalle email family has no child history; entity_version advancement is only a commented line in its insert, and its inspected entity DDL lacks that column. Its active extractor projects current emails onto historical root entries. A complete ledger extraction cannot recover absent child payload history.
- Concrete unresolved source issue: create_process_child_records_range.sql lines 299–309 do not reset parent variables before a SELECT lookup. A successful parent followed by a missing parent can reuse the previous contact/actor/time. Recorded for a focused future fix; no claim that customer data was affected and no code changed here.
- The normal load path processes parents and child/domain phases separately, commits individual child calls, and then updates staging status. Same-version event suppression does not reproduce source transaction atomicity. Duplicate-error text is not a reliable source application receipt.
- New recommended detail in ADRs 0002/0004 and the primary design: family-scoped historical coverage; known empty versus unknown; snapshot baselines; preserve source evidence before steward correction; validate source headers/member completeness; no synthetic entity_version from summed history counts. These refine migration/reconstruction without changing allocation or requiring a generic replay framework.
- Next migration fixtures: CFUS-style historical children and LaSalle-style current-only children, plus missing-parent iteration, multi-root source grouping, correction provenance and uncertain-commit recovery. Additional contacts/users source reads should follow the next specific implementation boundary.
