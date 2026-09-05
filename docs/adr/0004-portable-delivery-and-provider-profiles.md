# ADR 0004: Portable delivery, historical import, and database provider profiles

Date: 2026-09-05.
Status: recommended design; provider mappings are researched candidates, not implemented or cross-provider-tested adapters.

The local SQL Server email reference family is implemented in [ADR 0005](0005-email-reference-family.md). That does not activate the migration/distribution capabilities described here.

Companions: [primary design](../dbrow_version-allocation-design.md), [audit units](0002-portable-audit-unit-and-history.md), [ownership policy](0003-tenant-actor-and-catalog-policy.md), and [independent answers](../dbrow_version-independent-review-v3-answers.md).

## Decision and scope

Separate the business audit contract from the engine's SQL, transaction-state inspection, allocation, and change-feed APIs. SQL Server/Azure is the first implementation. The core requires transactional business/history writes, root protection, uniqueness, complete rollback by the owner, consistent reconstruction reads, and portable typed evidence. It does not require SQL Server Change Tracking, CDC, SESSION_CONTEXT, LSNs, hashes, or stored procedures on every provider.

Support three deployment profiles:

| Profile | Added mechanism | Promise |
| --- | --- | --- |
| Local audit | Ledger, spine, row history, action evidence | Atomic local audit and exact local aggregate reconstruction |
| Portable disconnected delivery | Transactional publication work, durable receiver inbox, identity/dependency checks | Eventual idempotent delivery and explicit conflict/missing-dependency handling |
| Captured commit order | Provider change-feed adapter, cursor/lineage validation; optional retained journal | Certified source commit order within declared coverage |

The second profile does not depend on the third. A single-tenant installation needing only local audit does not run a publication worker or replication system. Origin identity on new ledger rows is still recommended now because it is cheap to assign when the record is first created and avoids inventing provenance later.

## Portable identities and local acceptance

Each ledger row has a unique local dbrow_version and an original identity (origin_uid, origin_dbrow_version). A local change uses the current local origin and its local version. Exact acceptance of an imported source outcome allocates a new local version but retains the source pair. Its local entity_version increments according to accepted local history, not the sender's numbering.

One origin identifies one writable database incarnation. Previously recorded origin pairs never change. A deliberate fork or recovery losing previously acknowledged work creates a new writable incarnation before new work is accepted. Normal restart without lost/divergent history preserves it. Rotate the current-origin reference atomically; a uniqueness constraint alone establishes at most one current origin, not that one exists. A fork boundary is a recorded baseline/manifest; a maximum allocation number alone is not a certified historical cut.

Use a separate application/receipt record for source attribution, local accepting service, original recorded time, last-hop sender, transformation version, status, and local result. Staged or rejected receipts have no applied local ledger version yet. Durable inbound evidence is available before business application; failed applications cannot be the only place their receipt is recorded.

The same original pair arriving through another hop is a duplicate, not another business change. Compare its evidence identity/content under the envelope contract; different contents under one identity are a conflict or an explicit authorized redaction, not a silent overwrite. Freeze emitted envelopes for retries. Retained bytes are subject to the declared redaction policy rather than being promised immortal unconditionally.

Applying a source outcome unchanged is distinct from reconciling it. A merge/correction creates a new locally originated transaction and links the incoming operation and chosen base/current state in the receipt/action evidence. Do not label altered content with the incoming transaction's original identity: later base comparisons would falsely treat different states as identical. Subsequent source changes may need further reconciliation after such a merge; a single parent reference does not solve arbitrary branch convergence.

## Minimum distributed schema responsibilities

Logical names are illustrative, not migration DDL:

- origin: known origin identities and lineage; a controlled current-origin reference.
- Ledger additions: original origin pair, server recorded_at, optional source/business-time references and envelope/schema version.
- inbound_transaction: original pair, durable evidence, source/tenant mapping, receipt status; unique original identity within its supported source namespace.
- import_application: links accepted or reconciled local units to inbound originals and transformation/policy versions; no non-NULL local version required for a staged item.
- publication/delivery state: durable work identity, recipient or stream, pending/leased/acknowledged state and attempts, separate from immutable audit evidence.
- Optional commit journal and capture checkpoint: provider cursor, coverage, recovery incarnation, adapter version.
- Child/legacy identity maps where source keys are local or reused.

Legacy sources with tenant-local transaction numbers include the source tenant in their source namespace or use an adapter-generated stable source transaction key. The two-part origin/local-number identity assumes the number was globally unique within that origin. Never assert that assumption for old MAX()+1-per-tenant databases without checking.

## Baseline portable delivery: transactional outbox plus dependencies

When delivery is enabled, persist publication work in the business transaction alongside its ledger, history, and action records. It names the completed transaction evidence. It is not dispatched before commit. Payload can be materialized after commit from that transaction's history with a pinned encoder, then frozen for retries; do not serialize live rows that may already be at another version.

Workers scan indexed pending work regardless of its allocation number. Lease/claim operations are short transactions; delivery is at least once and receivers deduplicate. A single worker is the initial implementation. More workers may use provider-specific skip-locked/claim techniques after testing; those are throughput choices, not correctness requirements.

Never implement the pending scan as dbrow_version > last_sent. A lower allocation may become committed later. A delivery sequence assigned by the dispatcher is delivery order, not original commit order. Receivers use declared base/dependency references so out-of-order transport does not turn a missing predecessor into an overwrite. Record the historical revisions/values used by consequential cross-aggregate actions; write-base pointers alone do not capture every read dependency.

Enable a new subscription/profile using a consistent baseline plus complete subsequent publication coverage. A bounded write pause during initial registration is acceptable for the first implementation. An online overlap protocol is an optimization requiring its own no-gap test. Do not invent a safe baseline boundary from MAX(dbrow_version).

Pending work must not be discarded just because a recipient is offline. Retention/archival can use acknowledged progress or an explicitly declared reinitialization boundary. Reconstruction of old payloads requires retained history, values, decoder versions, and redaction metadata.

## Receive, stage, apply, acknowledge

Transport may receive several envelopes in one durable inbox transaction and advance a receipt cursor there. Business application then uses one local audit unit per originating transaction:

```text
receive batch -> persist inbox and receipt progress
for each dependency-ready source transaction:
    begin local audit unit
    validate source/tenant/actor mapping and every affected root's base
    apply the whole source transaction or record an explicit reconciliation
    write local history + source application mapping + applied status
    commit
acknowledge receipt/application according to the negotiated protocol
```

Receipt progress and application progress are different. Receiving/staging a conflict is durable receipt, not successful business application. They need not be represented by a single scalar applied cursor if independent transactions can advance while another is staged. Uncertain commit is recovered by the unique application record. Never allocate a second business version for a successful duplicate.

An incoming change names each affected aggregate's base original transaction identity (or an explicit absent baseline for creation). Compare it with the receiver's current original identity for that aggregate. Equal permits fast-forward subject to authorization and domain invariants; a known older base is a conflict; an unknown base is a missing dependency. Stage the whole source transaction if any required aggregate conflicts. Automatic domain merges are opt-in and recorded as new local transactions.

Tenant/entity public keys are useful portable references but must pass source/tenant mapping and collision checks. The common seeded default tenant and System keys do not authorize cross-installation identity merging.

Child ordinal is only a local stable identity. For unmodified forks sharing an established baseline it can be mapped directly. Otherwise map (source namespace, root, family, source child identity) to the local child. A creation-origin pair plus source ordinal can disambiguate independently born children without giving every row a UUID. Detect root conflicts before remapping; never assume ordinal 3 created independently on two branches is the same child. Retain maps for subsequent updates, deletes, and migrations.

## Historical migrations are a separate application mode

Historical import transforms recorded outcomes, identities, and relationships using a named schema transformation. It does not execute old business commands through today's tax, validation, defaulting, or authorization rules. Preserve original actors and source timestamps; record the importer, local acceptance time, source ordering quality, and transformation version separately.

Target-local dbrow_versions are new allocations in the import's chosen order. Mark approximate source chronology honestly. An import can preserve all source aggregate states without claiming exact historical cross-aggregate commit order that the source never recorded. Preserve original evidence or a controlled archive reference when transformations are not lossless. Validate the transformed histories and their reconstruction before cutover.

### Historical coverage and staged corrections

The [focused legacy inspection](../dbrow_version-legacy-implementation-findings.md) found real child history in CFUS-TOP-React and a LaSalle email extractor joining current children to historical root entries. The latter cannot establish previous child values. This makes coverage a required migration contract, not just an explanatory note in the audit viewer.

A migration manifest records source/schema identity, a consistent extraction boundary, included families, transformation version, and the quality of source ordering and transaction grouping. Describe complete history intervals, snapshot-only baselines and unknown periods at the coarsest truthful source/tenant/family scope, with aggregate exceptions as needed. This is migration metadata, not another version counter or mandatory column on every business row. A tenant-wide epoch is sufficient only when it describes every included family's coverage truthfully.

Do not backdate current children to old root versions. A snapshot baseline records what was observed at its declared boundary; it does not prove prior absence, values or creation dates. Reconstruction distinguishes known empty state from unavailable history. New complete history does not retroactively repair missing source history. Historical-state coverage and commit-feed coverage are separate capabilities.

One extracted transaction header may have several affected roots; separate header identity from member rows and extraction load IDs. A ledger row alone is not proof that its entire payload was recovered. Validate membership within declared coverage and account for missing/unsupported pieces and extraction errors. Apply a known complete source unit atomically. An incomplete unit remains staged, or is accepted explicitly as a partial/baseline import with a new local identity and source links; it must not masquerade as unchanged acceptance of the full original transaction.

Preserve source evidence or a controlled archive reference before steward edits. Record each correction's author, time, reason, changed fields and policy/transformation version separately. Lossless schema translation may preserve the original semantic identity under its declared mapping; changed business outcomes use new local correction/reconciliation identities. Retained source and correction evidence follow the applicable redaction policy.

Build each local aggregate spine from distinct validated accepted units, not a sum of root/child history-row counts. Keep trustworthy original entity versions as source provenance; mark synthetic baseline revisions. Use source transaction time/actor where known, with explicit uncertainty where not. The authenticated importing service and local acceptance time remain separately recorded. Event-message suppression is not suppression of required transaction evidence.

Historical application should reuse protected catalog, identity, root-bump and history primitives without re-executing ordinary command defaults or external notifications. Bulk extraction/staging and fewer network round trips are compatible with one local business transaction per source unit. A transport page or processing phase is not a source transaction boundary.

## Optional captured commit-order profile

SQL Server/Azure: prefer Change Tracking on the append-only transaction ledger for the first evaluated adapter. PostgreSQL: a logical-decoding adapter can read WAL-derived transactions. MySQL: a row-based binlog adapter can read complete transactional groups. These are alternative implementations of a declared capability, not interchangeable APIs or a promise that each managed service exposes identical privileges and retention controls. [PostgreSQL logical decoding](https://www.postgresql.org/docs/current/logicaldecoding-explanation.html), [MySQL binary-log controls](https://dev.mysql.com/doc/refman/8.4/en/replication-options-binary-log.html)

Treat source positions as opaque provider tokens scoped to producer recovery incarnation and stream scope. LSNs, Change Tracking versions, GTIDs, local sequence values, and delivery sequence numbers are not interchangeable. A GTID is not a general scalar order across independent origins. Decode transaction boundaries with a tested adapter; do not hand-merge row events by wall clock.

For the SQL Server Change Tracking adapter:

1. Require a producer identity, recovery/capture generation, and authorized tenant scope matching the cursor. A new scope needs a baseline; changing a filter while keeping its old cursor can skip required data.
2. In one SNAPSHOT transaction, validate the minimum valid version, obtain the current upper bound, and read the ledger and its associated history/actions under that same snapshot.
3. Enforce the tenant filter on ledger and payload reads. A cross-tenant export worker must route only authorized scopes; removing tenant filtering is not an optimization for tenant endpoints.
4. Process complete change-version groups. Fetch the rest of an oversized group or stage it before advancing; trimming a group to an empty page must not create an infinite loop. Cursor advancement is after durable inbox receipt, or after application when using that stricter acknowledgment mode.
5. Handle re-delivery idempotently. Do not exclude a consumer's own-origin transactions unconditionally: a recovering node may need its lost work back from peers. Optimize echo suppression only under a protocol that establishes the consumer already retains that identity.
6. Keep captured commit mappings in a separate untracked table. Updating the tracked ledger's commit field would generate new changes. Ordinary ledger entries remain unchanged after commit; redaction travels as a new instruction.
7. On retention gap, capture reset, scope mismatch, or recovery-lineage mismatch, stop incremental claims and reinitialize. Preserve pending disconnected work and its base evidence before replacing any projection. A baseline does not discard unsent local transactions.

Microsoft specifies the snapshot/cursor sequence and documents that retention validation alone cannot detect all restores with lost data. The producer must rotate its recovery generation or provide equivalent durable recovery detection; merely checking last_cursor <= current_cursor is insufficient after the restored stream advances again. [Change Tracking synchronization and restore](https://learn.microsoft.com/en-us/sql/relational-databases/track-changes/work-with-change-tracking-sql-server)

Change Tracking retention does not preserve indefinite historical commit order. A worker can retain mappings in an optional commit journal while coverage is available. A worker outage exceeding that coverage produces an explicit discontinuity. Existing histories may still support aggregate reconstruction and dependency-aware delivery, but their numbers must not be relabeled as measured commit order.

Exact whole-tenant reconstruction from a captured boundary is deferred. Backup/PITR and interactive audit queries remain different capabilities. Neither a local allocation number nor recorded_at is a tenant-wide commit boundary.

## Provider implementation matrix

The table describes the first implementation candidates, not a requirement for identical SQL:

| Contract | SQL Server / Azure SQL | PostgreSQL | MySQL / InnoDB | SQLite local client |
| --- | --- | --- | --- | --- |
| Local audit allocation | NEXT VALUE FOR existing BIGINT sequence | Logged BIGINT sequence, CACHE 1 | AUTO_INCREMENT on ledger with global uniqueness | Retained ledger with generated integer key, no reuse of committed IDs |
| Root protection | UPDLOCK/HOLDLOCK in active transaction | SELECT FOR UPDATE | SELECT FOR UPDATE in explicit transaction | One writer, BEGIN IMMEDIATE where appropriate |
| Consistent multi-query reconstruction | Explicit SNAPSHOT | Read-only REPEATABLE READ | REPEATABLE READ consistent snapshot | One read transaction |
| Optional INOUT/result | OUTPUT parameters | INOUT/returned result | INOUT/returned generated key | Coordinator result object |
| Unit enrollment/ownership | Trusted coordinator; optional tested native guard | Trusted coordinator; native composition only if separately proven | Trusted coordinator; do not substitute GET_LOCK lifetime | Trusted coordinator for the active local transaction |
| Existing catalog hit | Ordinary immutable lookup | Ordinary immutable lookup | Ordinary immutable lookup | Ordinary lookup |
| Missing catalog value | Indexed locking recheck before insert | Unique INSERT ON CONFLICT DO NOTHING then re-read/retry | Unique insert with narrowly handled duplicate then re-read/retry | Unique insert/conflict handling under writer transaction |
| Portable delivery | Transactional publication table | Same contract | Same contract, transactional tables only | Same contract within local transaction |
| Optional commit feed | Ledger Change Tracking, CDC if separately justified | Logical decoding adapter | Transactional row-binlog adapter | Usually unnecessary for serialized local writing |

### Allocation is not just a syntax translation

PostgreSQL CACHE greater than 1 reserves values per session: one session can return 11 before another later returns 2. Use CACHE 1 for the audit allocator and preserve the root monotonicity check. Do not apply this restriction blindly to unrelated entity/catalog IDs. Never use an unlogged or cycling audit sequence. [PostgreSQL CREATE SEQUENCE](https://www.postgresql.org/docs/current/sql-createsequence.html)

MySQL can use a single-row AUTO_INCREMENT ledger insert and return its generated key immediately on the same connection. Make dbrow_version the first column of an appropriate index, including a global unique index if the primary key remains tenant-leading. Nested catalog inserts must not overwrite the captured result. Generated values can have gaps; a tenant counter or custom global MAX query is unnecessary. [InnoDB allocation](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html), [generated-key retrieval](https://dev.mysql.com/doc/refman/8.4/en/example-auto-increment.html)

If entity IDs must be reserved before ledger creation on MySQL, an internal AUTO_INCREMENT key-reservation table can supply them; retain a key-only registry row or use a tested durable high-water strategy. Do not use a normal counter-row UPDATE that holds one global entity-allocation lock through every business commit. Reservation gaps and the additional storage/write are measured provider costs. No allocated ID is exported as a committed entity before its creating unit succeeds.

### Locking and transaction lifetime differ

PostgreSQL offers transaction-scoped advisory locks. MySQL GET_LOCK is session-scoped and is not released by transaction commit/rollback; it cannot replace SQL Server's transaction-owned guard by name alone. The portable coordinator does not depend on either mechanism. [PostgreSQL locks](https://www.postgresql.org/docs/current/explicit-locking.html), [MySQL named locks](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html)

Write adapters explicitly choose and test isolation rather than inherit server defaults. Recommend READ COMMITTED plus root/constraint protection for server mutators, with additional domain locks where required. Read-only reconstruction uses the stronger multi-query snapshot in the matrix. MySQL locking reads require an explicit transaction and differ from consistent nonlocking reads; SQLite permits only one simultaneous writer. [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html)

Each adapter establishes and restores transaction/session settings correctly and forbids DDL/implicit-commit statements in a business unit. Do not transplant SQL Server's nested transaction counter behavior into another provider. The owner-aborts-on-error policy remains uniform even though PostgreSQL generally aborts a transaction after an unhandled error and InnoDB may roll back only the failing statement. [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [InnoDB error handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)

### Catalog conflict handling differs

The SQL Server miss path avoids relying on recovering a duplicate-key exception inside XACT_ABORT. PostgreSQL can use ON CONFLICT DO NOTHING followed by a new read in the writer's supported isolation; retry the whole unit where visibility/serialization requires it. InnoDB may handle the specific duplicate-key race without dooming the transaction, but unrelated errors must propagate. Do not use broad INSERT IGNORE or no-op UPDATE as a universal substitute: they can mask other errors or invoke mutation/trigger semantics. [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html), [InnoDB error handling](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html)

### Time and wire types differ

Capture local recording time at the allocation point. PostgreSQL clock_timestamp() measures that point; CURRENT_TIMESTAMP means transaction start, which can precede waits. Store/export the instant in UTC. SQL Server uses SYSUTCDATETIME(); MySQL uses an explicit UTC timestamp expression with declared precision. Precision and clock accuracy are metadata, not ordering guarantees. [PostgreSQL time functions](https://www.postgresql.org/docs/current/functions-datetime.html)

The envelope is versioned typed JSON or another declared codec. Encode signed 64-bit IDs and exact decimals without JavaScript Number precision loss, for example decimal strings with explicit types. Specify UTC/time precision, UUID text, binary encoding, null versus missing, operation codes, schema/transform versions, original/base identities, tenant/actor mappings, and redaction state. SQL Server FOR JSON is one encoder option, not the wire contract. No canonical hashing scheme is required until an assurance feature needs it.

## Validation and rollout

First implement and prove the SQL Server local reference family and its public/ambient transaction boundaries. Keep the SQL Server-specific pieces in the SqlClient implementation, with provider-neutral acceptance cases and envelope/schema contracts. Do not introduce a generic SQL string-rewriting framework.

Before claiming PostgreSQL or MySQL support, run the same behavior suite there: rollback atomicity, generated-key capture, root ordering, stale tokens, repeated child changes, tenant isolation, exact catalog identity, and consistent reconstruction. Add provider cases for cached sequence disorder, duplicate visibility, implicit commits, named-lock lifetime, and generated-key state. Research is not a substitute for those tests.

Then implement one disconnected workflow with the portable delivery profile: late lower-numbered commit, duplicate transport, out-of-order predecessor, one conflicting root in a multi-root source transaction, retained offline edits during rebaseline, restored producer cursor, and source identity forwarded through two hops. Add one schema/provider historical migration with reconstruction comparison. Test actual commit feeds only when enabling that optional profile.

Migration fixtures must include real child history and snapshot-only legacy children, family-specific coverage, a missing parent after a successful lookup, a source transaction affecting multiple roots/families, incomplete source membership, and a steward correction. A current child must never appear as an established historical value merely because its root has an older history row. Recovery after an uncertain commit must find the atomic application receipt; a business-key duplicate or matching error message alone does not establish prior acceptance.

This ADR does not deploy Change Tracking, replication, a journal, or another provider. It records how they fit the same foundation without becoming release prerequisites for every customer.
