# Audit transaction foundation — recommended design

Originally written: 2026-09-04. Revised: 2026-09-05 after independent review and the user's portability/tenant clarifications.
Status: design recommendation, not executable migration SQL. ADR 0005 describes the implemented SQL Server email reference family and its audit-unit prerequisites; other capabilities remain recommendations.

This revision is the current design entry point. It replaces this document's earlier requirement for a general revision graph, mandatory CDC/commit index, and strict advance declaration of every aggregate. The earlier reasoning remains in [analysis v2](dbrow_version-allocation-analysis_v2.md), the [independent review](dbrow_version-independent-review-v3.md), and its [answers](dbrow_version-independent-review-v3-answers.md). The [chained-history alternative](dbrow_version-allocation-design-immutable-chained-history.md) remains optional future assurance work.

## 1. Decision

Keep the relational audit model, the database-local BIGINT dbrow_version with gaps, and user-friendly entity_version. Strengthen attribution, tenant ownership, controlled transaction composition, aggregate ordering, final row histories, and reconstruction before migrating the rest of the framework.

SQL Server and Azure remain the first implementation. PostgreSQL, MySQL/InnoDB, and local SQLite stores implement the same behavioral contract through provider-specific allocation, locking, and snapshot primitives. A matching SQL syntax or a common engine transaction-ID function is not required.

Most installations need only local audit. Disconnected installations add durable publication/inbox work and explicit reconciliation. A provider commit feed is an optional stronger ordering capability, not the only way to synchronize and not a prerequisite for the audit product.

## 2. Decision records and implementation status

| Record | Purpose | Status |
| --- | --- | --- |
| [ADR 0001](adr/0001-dbrow-version-allocation-helper.md) | Existing helper, optional INOUT, owner/ambient behavior and tested limits | Implemented focused change |
| [ADR 0002](adr/0002-portable-audit-unit-and-history.md) | Controlled audit unit, ownership boundary, aggregate ordering, history state transitions | Recommended next contract |
| [ADR 0003](adr/0003-tenant-actor-and-catalog-policy.md) | Default/shared tenancy, actor authorization boundary, roles, bootstrap, dictionaries | Recommended next contract |
| [ADR 0004](adr/0004-portable-delivery-and-provider-profiles.md) | Portable delivery, source identity, historical imports, provider-specific implementations | Recommended capability design |
| [ADR 0005](adr/0005-email-reference-family.md) | Email lifecycle/history/action reader, native ownership guards, C# unit, permissions and bootstrap prerequisites | Implemented fresh-schema reference family |

The user subsequently authorized the email implementation. dbrow_version_ensure now requires explicit enrollment and proves native ownership with private transaction-owned guards, using an engine transaction ID only for indexed allocation discovery. Optional INOUT is preserved. The email family implements the root/history protocol; shared-actor delegation, general first-user preallocation, other child/role lifecycles, migration and delivery remain separate work. ADR 0005 records the precise scope and tested limits.

## 3. Guarantees and boundaries

The intended local foundation guarantees atomic business/history/action writes, exact reconstruction of a local aggregate revision, preserved transaction attribution, tenant ownership, and explicit deletion/restoration behavior. It preserves the identity of an entity as it gains contact/user subtypes.

It does not promise a gapless tenant transaction count, allocation order equal to commit order, wall-clock causality, distributed ACID, automatic reconciliation of arbitrary business conflicts, or protection against administrators who control all evidence. Atomicity does not by itself protect cross-aggregate business invariants; the write operation must lock/check those invariants.

Whole-tenant historical querying is deferred, not dismissed as equivalent to backup/PITR. A meaningful business record should preserve the values/revisions it used, so an invoice or payment remains explainable without requiring a full tenant snapshot at its timestamp.

## 4. Identity, time, and scope

| Concept | Meaning |
| --- | --- |
| tenant_id / entity_id / *_by | Local keys; actors remain entities |
| Default tenant | A real configured business tenant for single-tenant installations; never an unknown-tenant fallback |
| Shared definition/value | Explicit global storage; tenant-owned associations and authorization still apply |
| dbrow_version | Local transaction allocation identity; globally unique within the local ledger, gaps allowed |
| entity_version | Local accepted aggregate revision; increases at most once per audit unit |
| (origin_uid, origin_dbrow_version) | Original transaction identity retained through exact imports and forwarding |
| Base transaction reference per affected aggregate | Identifies the state an incoming change was based on; local version numbers are not compared across databases |
| recorded_at | Server UTC instant recorded by the allocator; not commit time |
| Business-effective / source-recorded time | Separate domain/provenance metadata; never fabricated from the local clock |
| Provider commit cursor | Opaque, scoped position with capture coverage and recovery lineage |
| Delivery/receipt progress | Progress through durable transport; not automatically business application or original commit order |

No random transaction_uid or revision_uid is required in addition to the origin pair. Keep API request idempotency distinct and add it where retry/uncertain-commit behavior needs it. Imported source-local IDs are mapped to destination keys. Shared seed GUIDs, including the default tenant, are not proof that unrelated databases have the same ownership.

A fork or recovery losing acknowledged history opens a new writable incarnation before accepting new work. Existing original identities remain unchanged. A normal restart without lost/divergent history does not create new identities for old work.

## 5. Canonical local write protocol

1. Resolve the configured/explicit tenant and authenticated actor context. Authorize the target tenant, operation, aggregate, and tenant-owned references. Unknown actors do not become System User.
2. Begin or join a controlled audit unit. The owner holds the real connection/transaction lifetime; raw client BIGINTs and session variables do not establish enrollment. Check command idempotency where used.
3. Resolve immutable catalog values through the provider's tested interning path. Lock known existing roots in deterministic order; revalidate expected entry versions and relevant domain invariants under protection.
4. Allocate the unit's ledger row lazily. Nested calls share that allocation, actor, target database/tenant and operation metadata. A source import is one business unit, not an arbitrary transport batch.
5. Before mutating each late-discovered root, reject if its current dbrow_version is greater than the unit's version. Hold its root lock through completion. Reassert monotonicity in the bump helper.
6. Mutate and maintain final history for touched rows. Bump each changed aggregate once and insert one spine row. Repeated nested calls validate against the unit-entry optimistic token, not the bump they themselves caused.
7. Record meaningful business actions, including intermediate values or revisions they used. When delivery is enabled, persist publication work atomically. External side effects occur only after commit through an idempotent dispatcher.
8. The owner commits. On any failure, roll back the whole unit and discard its context; recover uncertain commits through recorded idempotency/application state.

ADR 0002 defines the permitted late-root case, history transition table, root/child lifecycle, and ownership enforcement choices. An ordinary application transaction coordinator is the portable baseline. SQL Server may additionally use a tested private, transaction-owned lock to support guarded native composition. SESSION_CONTEXT is only a hint, not the authority. There is no requirement to emulate that SQL Server API in every provider.

## 6. History, reconstruction, and shared values

A history row is the final state for a touched row in one audit unit. The implementation may update/delete that unit's own uncommitted history after validating its ownership. Committed history is protected except for explicit audited redaction. Statement no-ops can be skipped; a series of real writes returning to its entry value may leave a redundant snapshot. A meaningful action remains recorded even if its final state delta is empty.

Use a consistent multi-query read snapshot to resolve (entity_id, entity_version) to its local spine boundary and retrieve the latest applicable root/child snapshots at or below that boundary. This works because the root protocol preserves strictly increasing local dbrow_version across that aggregate's revisions. It does not establish tenant-wide commit order or order independent source histories.

The first email reader supplies consistency through a short, owned SERIALIZABLE read transaction with the root read first, avoiding a required database snapshot option. ADR 0005 documents the blocking tradeoff; a snapshot reader remains an optimization to evaluate.

For migrated data, exact reconstruction is limited to declared coverage. Track complete intervals, snapshot-only baselines and unknown periods by source/tenant/family, with aggregate exceptions where necessary. Unknown historical children are not a known empty collection. The [legacy inspection](dbrow_version-legacy-implementation-findings.md) shows why joining current children onto old root history would fabricate certainty; ADR 0004 defines the migration manifest and correction provenance.

Child IDs used by history are stable local identities. Allocate their ordinals from a per-root/per-family high-water mark; separate display ordering and never reuse a committed deleted child's ID for a new child. Cross-origin child changes use identity mappings. A relationship belongs to its declared owner; a company's unchanged version does not by itself reconstruct historical reverse membership from all employee-owned relationships.

Keep shared immutable dictionaries where useful. Preserve exact accepted values separately from normalized matching forms. Audit changes to associations, and audit mutable global security definitions whose meaning affects users. Sentinel repointing and physical payload removal are distinct outcomes; history, exported evidence, replicas, and backups follow a declared redaction/retention policy. ADR 0003 records the details and bootstrap changes.

## 7. Distribution without mandatory engine change capture

The portable delivery profile uses a transactional outbox/publication table and durable receiver inbox. Scan pending work, not versions greater than the last sent allocation. Late lower-numbered commits must still be delivered. Base/dependency references make out-of-order delivery explicit and distinguish missing predecessors from actual conflicts.

Receive a batch durably if useful, but apply each source business transaction in its own local audit unit. Preserve original source identity and actor, local accepting-service provenance, and whole-source atomicity. Stage a transaction if any required aggregate conflicts. A domain reconciliation creates a new local original identity and links its inputs; it must not pretend changed content is the unmodified source transaction.

Historical migration is a distinct mode: transform recorded outcomes using versioned mappings, preserve source evidence and actors, and mark approximate chronology. Do not execute old commands through today's business rules. The evidence codec is typed and versioned; large integers/decimals, timestamps, UUIDs, binary values, null/missing fields, and redaction are explicit. SQL Server FOR JSON is an implementation option, not a wire protocol requirement.

## 8. Optional source commit order

Prefer SQL Server Change Tracking on the committed transaction ledger when an installation enables the captured-order profile. Use a snapshot-bound cursor protocol, explicit authorized tenant scope, durable receipt, complete version-group pagination, and recovery-generation checks. Retention validation alone does not detect every restored producer. Persist any long-term commit mappings in a separate untracked journal.

PostgreSQL logical decoding and MySQL transactional binlog readers are possible provider adapters. No raw engine token becomes a portable business identity. A deployment relying on exact captured order must monitor coverage and detect resets/retention gaps; a generous retention setting is not a permanent history archive.

A portable outbox can continue to provide dependency-aware delivery without certifying original cross-aggregate commit order. A retained dispatcher order is named delivery order. Exact tenant-wide historical queries would require their own certified membership/boundary contract later.

## 9. Provider choices that require explicit testing

| Contract | SQL Server first | Other provider candidates |
| --- | --- | --- |
| Audit allocator | Existing BIGINT sequence, gaps | PostgreSQL sequence CACHE 1; MySQL ledger AUTO_INCREMENT |
| Existing-root protection | XLOCK/HOLDLOCK on the clustered root key in ADR 0005, paired with its serializable reader | PostgreSQL/MySQL SELECT FOR UPDATE; SQLite serialized writer; reader consistency also needs the provider's read profile |
| Multi-query historical read | SNAPSHOT | PostgreSQL/MySQL explicit repeatable snapshot; SQLite read transaction |
| Unit lifetime | Explicit owner plus optional native guard | Trusted transaction coordinator; native composition only when proven |
| Catalog miss race | Locking recheck before insert | Provider-specific unique conflict handling, with correct error/visibility rules |
| Delivery | Transactional pending work | Same relational/transactional contract |

The [provider ADR](adr/0004-portable-delivery-and-provider-profiles.md) includes primary documentation and test gates. In particular, PostgreSQL per-session sequence caching can produce out-of-order values, MySQL GET_LOCK does not end with the transaction, and PostgreSQL CURRENT_TIMESTAMP is transaction-start time. Portability means preserving the guarantees while accommodating these differences, not translating function names mechanically.

## 10. Implementation sequence

1. Prove the controlled SQL Server unit/reuse boundary, including forged session hints, wrong database, optional INOUT, owner rollback, and uncertain-commit handling. Keep the existing API transition explicit.
2. Fix actor/default-tenant handling, target/reference ownership, System/first-user bootstrap, entity-ID reservation, type promotion, and the two remaining direct ledger writers. Preserve known System ID 1 references deliberately.
3. Complete one reference family: entity/contact plus email lifecycle, final history, aggregate bump/order, role changes, and contact_as_of/diff. Adapt the existing CFUS email behavior to the new contracts, then implement phone through the same mechanism before expanding further. Verify child schema widths, visibility attributes where required, enabled FKs, exact catalog identity, and reconstruction indexes.
4. Test concurrency, rollback, repeated nested changes, stale entry tokens, late-root restart, self-registration, cross-tenant attempts, and fraud/action reconstruction. CI structure checks complement these tests, not replace them.
5. Implement one disconnected workflow with durable delivery and one historical migration. Enable/test Change Tracking separately when captured commit order earns its operational cost.
6. Run the same behavioral suite before claiming another write provider is supported. Keep a read/import-only adapter's lower capabilities explicit.

Do not estimate performance from a fixed number of history rows. Measure a hot aggregate with long history, independent contacts sharing common catalog values, concurrent new catalog values, hub relationships, large multi-root units, and publication backlog. Track retries, lock waits, log bytes, index size, reconstruction latency, and retention/capture lag. Partitioning, compression, changed clustering, and a general merge graph require workload evidence.

## 11. What remains optional

Transactional tenant counters, generic revision DAGs, random revision UUIDs, blockchain/hash chains, mandatory commit capture, distributed snapshot manifests, and wholesale provider reimplementation are not prerequisites. The optional chained-history proposal is retained for a named tamper-evidence requirement. The first release earns confidence through complete, tested audit behavior on the small reference family.
