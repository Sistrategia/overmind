# Audit foundation — session handoff

Updated: 2026-09-05. Purpose: resume with current recommendations and distinguish them from implemented code.

## Resume here

**Latest authorized implementation:** the email reference family is implemented. Start with [ADR 0005](adr/0005-email-reference-family.md) and the [usage/test/review guide](email-reference-family.md) before making more changes. The broader design remains below; do not describe every capability in it as implemented. No customer database or sibling project was changed.

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

SqlAuditUnit owns/serializes the connection and transaction, fixes actor/tenant, invalidates on error/cancellation and rolls back on uncommitted disposal. Email insert/update/delete/restore use one root lock/bump, unit-entry optimistic tokens, current-unit final history and typed ordered actions. Contact construction delegates its initial email to the same writer without an extra root revision. The retained child identity and root/family counter prevent committed ordinal reuse. Exact dictionaries use binary value AND byte length.

SqlContactEmailReader returns historical root context, email state, optional revision diff and that revision's actions with actor/UTC time. Its SQL procedure owns a short SERIALIZABLE read transaction and takes a shared barrier on the clustered root key; writers take that key exclusively before child mutation. A concurrent regression verifies this interval, preventing a reader/writer lock-upgrade cycle. It is not a full contact reconstruction across unimplemented families. email_runtime grants only the new public capability and denies direct helpers/table access. New public email paths require an active user-type actor in the target tenant; broader shared-actor delegation and contact-level application authorization are separate.

The two old bootstrap allocation bypasses are removed. A protected System bootstrap preserves ID 1/public key/type 4, resolves the actual tenant ID and writes available histories/spine atomically; the C# builder invokes it. Administrative tenant_insert takes a resolved actor ID and uses the helper. General entity IDENTITY allocation, legacy first-user actor rebinding, legacy constructor fallback and existing-contact promotion behavior still need the later user-lifecycle work. They are not exposed by the email runtime role.

The expanded SQL/C# suite covers lifecycle, reconstruction, permissions, concurrent writers/catalogs, late-root rejection, cross-database forged reuse, actual C# System bootstrap with tenant ID 2, and the previous allocation tests. Build/test commands and exclusions are in the guide. It creates/removes only generated disposable databases. No capacity benchmark, another provider, live upgrade, general migration/coverage adapter, synchronization or uncertain-commit recovery receipt is claimed.

Follow-up fix: the user reported CreateSchema error 51102 because the application business seed ran inside RunLocalStoredCommands' unenrolled transaction. insert_ernesto_sample_data.sql now explicitly enrolls an ambient seed transaction; the generic DDL/resource runner retains transaction ownership. The new SchemaCycle.cs regression reproduced the exact failure before the fix, then passed actual OvermindSqlDatabaseManager CreateSchema → DropSchema → CreateSchema with tenant/System/user/email history checks. The full suite passed and all three disposable databases were removed. The SQL is embedded in the application data assembly, so a running application needs a rebuild/restart to load it.

Correction preserved: procedure-scoped SET XACT_ABORT is restored on return. Earlier notes claiming a session leak were wrong. Both derived insert procedures already used sequences before helper extraction; old pending MAX()+1 notes about those two procedures were stale.

## Overall recommended contracts — implemented subset is defined in ADR 0005

- One controlled local business audit unit owns one database/tenant/actor/allocation and outer transaction. Trusted coordinator enrollment is the portable authority. Optional INOUT stays; NULL auto-joins only an enrolled unit. Raw session state is not proof.
- SQL Server native composition now uses tested private transaction-owned guards plus indexed engine-ID discovery. Other providers need equivalent behavior, not this SQL-specific hint/lock API. No writable session marker is authority.
- Lock known roots first. Late roots are allowed only when their current stamp is not greater than the unit's version; reassert monotonicity at bump and retry the entire unit on failure. Keep one bump per aggregate and validate expected tokens against unit-entry state.
- History holds final touched-row state, maintained through current-unit-only upserts. Redundant final snapshots after change/revert are allowed. Significant intermediate actions carry their actual values/references in ordered action evidence.
- Child ordinals used as identity never reuse a committed deleted child's number; maintain a root/family high-water mark. Cross-origin child references require mapping.
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

The agreed next checkpoint is an independent review of the implemented email family and its tests, before copying the pattern to phone. ADR 0005 and the usage guide provide the review map. User-role/general user lifecycle, shared-actor delegation, migration/coverage adapters and delivery remain subsequent work. Do not silently broaden this reference implementation into all of them.

The user authorized a local commit checkpoint before that review. The [independent review prompt](email-reference-family-independent-review-prompt.md) identifies its Git baseline/target, provides ten focused question groups and requests the report in docs/email-reference-family-independent-review.md. The review will be relayed by the user; no independent verdict has been received yet.

Keep layer order data → entities → contacts → security. Verify actual DDL before editing SQL. Preserve independent reviewer documents as their own record. Do not mark recommended contracts as already implemented.

## Focused source intake, 2026-09-05

The user supplied sibling paths for SistrategiaDataAnalysis, CFUS-TOP-React and LaSalle-egresados and asked to avoid losing focus through excessive reading. The bounded review followed CFUS email lifecycle/DDL/DAC, LaSalle worker → selected orchestrator methods → ledger/email extractors → child range processor, and the relevant earlier analysis/specification. Sibling projects remained read-only; no migration or application test was run. Findings and precise source links are in the legacy report above. Do not reread entire applications to resume.

- CFUS has real child-email history and aggregate entity_version. Its entity_history is the thin spine, while entity_data_history holds root payload; Overmind uses entity_version_history/entity_history respectively. Adapt behavior, do not copy names mechanically. Its MAX()+1, unguarded reuse, repeated-history inserts and live-ordinal allocation are legacy behavior, not the selected mechanism.
- The inspected LaSalle email family has no child history; entity_version advancement is only a commented line in its insert, and its inspected entity DDL lacks that column. Its active extractor projects current emails onto historical root entries. A complete ledger extraction cannot recover absent child payload history.
- Concrete unresolved source issue: create_process_child_records_range.sql lines 299–309 do not reset parent variables before a SELECT lookup. A successful parent followed by a missing parent can reuse the previous contact/actor/time. Recorded for a focused future fix; no claim that customer data was affected and no code changed here.
- The normal load path processes parents and child/domain phases separately, commits individual child calls, and then updates staging status. Same-version event suppression does not reproduce source transaction atomicity. Duplicate-error text is not a reliable source application receipt.
- New recommended detail in ADRs 0002/0004 and the primary design: family-scoped historical coverage; known empty versus unknown; snapshot baselines; preserve source evidence before steward correction; validate source headers/member completeness; no synthetic entity_version from summed history counts. These refine migration/reconstruction without changing allocation or requiring a generic replay framework.
- Next migration fixtures: CFUS-style historical children and LaSalle-style current-only children, plus missing-parent iteration, multi-root source grouping, correction provenance and uncertain-commit recovery. Additional contacts/users source reads should follow the next specific implementation boundary.
