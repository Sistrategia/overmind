# Audit transaction foundation — proposed design

Date: 2026-09-04
Status: proposal for review, not executable migration SQL.

Companions: [analysis v2](dbrow_version-allocation-analysis_v2.md) and [optional chained-history design](dbrow_version-allocation-design-immutable-chained-history.md).

## 1. Design decision

Retain the relational history model and global BIGINT `dbrow_version` sequence with gaps. Define this value as a **database-local audit transaction allocation ID**, not a commit clock or portable identifier. Retain `entity_version` as the sequential revision of an aggregate's locally accepted state.

Add portable transaction and revision identities, explicit parent relationships, and a durable source commit index. SQL Server remains the first implementation. Other databases integrate through a versioned evidence envelope and adapter capability contract.

Default deployment allows concurrent writes to independent aggregates. Whole-tenant reconstruction uses captured commit boundaries, and therefore has an explicit freshness watermark. No tenant counter is required. A tenant counter remains an alternative deployment architecture if synchronous committed prefixes are necessary and measured throughput permits it; it is not a runtime switch to mix arbitrarily among writers.

## 2. Scope and guarantees

The foundation supports:

- Atomic local business mutations, actor/operation attribution, and complete committed history.
- Exact local aggregate revision reconstruction, including child associations and deletion.
- Local tenant state at a certified source commit boundary.
- Portable evidence, deduplicated delivery, provenance-preserving import, and explicit conflict resolution.
- Future cryptographic verification without replacing relational keys.

It does not promise a universal global transaction order, distributed ACID across offline nodes, automatic conflict-free merging of arbitrary business records, or proof of privileged non-tampering without the companion assurance layer. A commit-order index records visibility order; it does not upgrade application isolation to serializability or prevent write skew across inadequately protected invariants.

## 3. Identity and time vocabulary

| Field/concept | Scope and meaning |
| --- | --- |
| `tenant_id`, `entity_id`, actor `*_by` | Existing local INT keys; actor remains an entity |
| Tenant/entity public key | Portable identity; existing GUIDs can serve after uniqueness and migration rules are verified |
| `dbrow_version` | Local BIGINT from the existing global sequence; gaps allowed |
| `transaction_uid` | Random UUID allocated once per accepted local transaction; unique constraint; collision rejected, never silently overwritten |
| `origin_uid` | Identity of a writing database incarnation; changes when an independently writable fork is created |
| `revision_uid` | Portable identity of an aggregate revision; independent of local version number |
| `entity_version` | Local accepted revision counter; increases once per changed aggregate per transaction |
| Parent revision IDs | Causal predecessors, including every input to an explicit merge |
| `recorded_at` | Server UTC time when the local operation is recorded; not commit time |
| `effective_at` | Optional business-effective time supplied under domain rules; may be earlier/later |
| Source commit position | Adapter-defined ordered token, scoped to origin/incarnation; SQL Server uses captured commit LSN |
| `request_uid` | Idempotency scope for a submitted command; distinct from transaction identity |

Portable UUID indexes should normally be nonclustered so that random identity does not replace compact local clustering everywhere. UUID uniqueness is enforced locally and collisions across imports cause quarantine. Avoid trusting a source solely because its IDs look valid.

A normal failover continuing the same fenced database lineage preserves origin identity. A restored copy allowed to diverge obtains a new origin before accepting writes. An in-place recovery that loses acknowledged history also opens a new incarnation and records the recovery boundary. Previously recorded transaction and revision IDs never change.

## 4. Logical schema additions

These are logical tables/fields, to be translated into migrations after reviewing actual schemas and existing data. Keep the current ledger PK `(tenant_id, dbrow_version)` and layer dependency order **data → entities → contacts → security**.

### 4.1 Local ledger and operation context

Extend `data.dbrow_version` with `transaction_uid`, `origin_uid`, server-recorded time, optional effective time, request/correlation identity, and operation schema version. Preserve existing actor and operation references. Treat legacy `modified` as legacy recorded metadata; do not relabel historical values as commit time.

Keep rich authentication/delegation context in a companion record keyed by transaction. The data layer can carry scalar actor IDs as today; avoid adding a circular DDL dependency on security tables. Validate actor/tenant relationships in the controlled write path and reconciliation jobs.

Define one ledger entry per successful tenant-scoped business unit of work per outer local transaction. Nested mutators share its context. Cross-tenant business work is rejected by this default contract; use explicitly linked tenant transactions with a saga, or a separately designed coordinator. Cross-database operations never pretend to be one local commit.

### 4.2 Aggregate revision graph

Extend the version spine with `revision_uid` and add a parent relation `(revision_uid, parent_revision_uid)`. Each local accepted revision has a unique `(entity_id, entity_version)` and `(entity_id, dbrow_version)`. A revision registry records portable aggregate identity and envelope/schema version; remote-only revisions can exist in the registry without being assigned a local accepted `entity_version`.

For a normal change, the parent is the previously accepted revision. For a merge, parents include the current accepted revision and incoming revision(s). Validate tenant/aggregate compatibility, no self-parenting or cycles, and required-parent availability. Local application of an imported state is a new local revision linked to its source; do not falsely assign the source's version number to the local spine.

### 4.3 Durable commit index

Companion `data.audit_commit` maps local ledger identity to `(origin_uid, source_commit_position)` and observed commit-time metadata. The mapping is write-once through the controlled capture service. A separate capture checkpoint stores the fully processed source position, adapter version, coverage start, and lineage.

The same physical commit position may group several captured records. Never require that LSN be unique per row. The default one-unit-of-work contract normally yields one ledger insert; the adapter still processes complete source transactions and complete capture batches.

### 4.4 Distribution records

An inbox stores unique source transaction identity, original evidence bytes or an immutable reference, validation status, and conflict/dependency status. An application mapping links a source transaction to its receiving local transaction and transformation policy version. An outbox stores durable publication work in the same transaction as the local changes. Delivery leases/attempts belong to mutable operational records, not immutable source evidence.

History tables continue to use local compact keys. Export maps local catalog, actor, entity, and child identities to portable representations. Add stable child public IDs where children currently have only local ordinals; do not equate ordinal 3 created independently at two nodes. Preserve original local identity mappings for forensic navigation.

## 5. Canonical local write protocol

1. Resolve and authorize tenant, authenticated actor, effective actor, and business operation. Reject invalid identities; allow System User only through an explicit authorized system/bootstrap path.
2. Begin or join a controlled outer transaction. Establish command idempotency using a tenant/request unique key and request-content fingerprint. A duplicate identical committed request returns the original result; differing content under the same key fails.
3. Determine the complete affected aggregate set. Acquire root protection in deterministic order, retaining it until outer completion. New aggregates require protection of applicable unique business keys; a nonexistent root cannot be locked as an existing row.
4. Under that protection, validate expected `entity_version`/revision and domain invariants. Revalidate any preliminary reads. Protect cross-aggregate invariants explicitly.
5. Allocate one sequence value and transaction UUID, and insert the ledger/context. Only then distribute the context to nested mutators.
6. Apply mutations and write post-change history; deletion records carry the deleted identity/state. Once per changed aggregate, increment `entity_version`, create its revision/parents, and write the spine. Preserve the existing rule that stamp-only root changes need no duplicate payload history.
7. Persist event metadata and outbox work atomically. Freeze the portable evidence manifest or make it reproducible exclusively from immutable history and pinned schema/catalog versions.
8. Commit the outer transaction. Publish nothing externally before successful commit. Capture later attaches commit metadata.

The context carries tenant, ledger ID, transaction UID, actor, and protected aggregate set. Merely accepting a caller's BIGINT is not enough. Trusted composition must reject adding an unprotected aggregate after allocation; discover it first or restart the entire unit of work. This restriction preserves the existing numeric-bound reconstruction algorithm.

For SQL Server, evaluate explicit `UPDLOCK, HOLDLOCK` root acquisition with deterministic ordering and supporting indexes. The exact stored procedure pattern, ambient-transaction behavior, deadlock retries, savepoints, and error propagation require implementation review. A failed unit of work must never let a caller commit partially written business/history data. Set a documented owner-aborts-on-failure contract; do not swallow errors.

Multiple changes to the same row inside one unit of work produce one final state snapshot under the current history key. If intermediate actions themselves matter, record ordered operation steps in an additional action log. They are not separately committed entity versions. No-op commands need not bump the aggregate; significant no-op/security actions can be recorded separately.

## 6. Source commit capture and completeness

For SQL Server, capture ledger inserts through CDC. Its `__$start_lsn` identifies the source commit and supplies transaction order. CDC has finite retention and asynchronous capture; preserve required mappings independently. [Microsoft CDC semantics](https://learn.microsoft.com/en-us/sql/relational-databases/track-changes/about-change-data-capture-sql-server)

Protocol:

1. Establish an explicit coverage start while enabling capture; use a controlled write pause or validated baseline procedure. Do not infer commit positions for older rows from their sequence numbers.
2. Read a complete bounded CDC interval, validate that its lower endpoint is still retained, and identify all ledger transactions in it.
3. In one worker transaction, idempotently insert commit mappings and advance the durable checkpoint only after the entire interval is processed. Empty intervals can also advance after complete scanning.
4. Ordered exports join the ledger to captured mappings and use only positions at or below this checkpoint. If several records share a position, paginate with a complete tie-breaker or buffer the entire group before advancing.
5. On a retention gap, lineage mismatch, or reconciliation failure, stop certifying completeness. Recover from retained source evidence/backups where possible; otherwise record a coverage discontinuity and establish a new baseline. Never silently skip forward.

Return capture boundary and lag in APIs. Requests newer than that boundary wait, return an explicit incomplete result, or fail according to the API contract. Do not substitute `MAX(dbrow_version)`. Availability of CDC on the customer's exact SQL Server version/edition/deployment is a release prerequisite for this profile, not assumed from the SQL Server 2016 minimum alone.

For an unordered outbox dispatcher, scan durable pending work regardless of allocation ID; use leases, retries, and receiver deduplication. A single `> last_id` cursor is unsafe. For ordered distribution, use the certified commit index. Capturing only ledger inserts provides membership/order, not proof that all table writes have history; that remains a separate control.

Legacy data has explicitly limited guarantees: aggregate reconstruction may be supported after validation, but exact historical commit order before coverage cannot be manufactured. Do not label an estimated ordering as captured fact.

## 7. Reconstruction contracts

### Aggregate version

Within one consistent database snapshot, resolve the local spine row for `(entity_id, entity_version)`. Retrieve latest root/child history at or below its `dbrow_version`, excluding children whose latest operation is DELETE. This is valid because every accepted change to that aggregate obeys the ordering protocol. Use one snapshot transaction across multiple queries; statement-level consistency alone is insufficient for a multi-query reconstruction.

Remote branches are reconstructed by revision ancestry and their portable evidence, not by comparing their source BIGINTs. Never apply the local numeric-bound algorithm to a union of foreign histories.

### Tenant committed boundary

For a certified position P, identify ledger transactions whose captured commit position is at or before P. Choose each row's latest applicable history within that membership, ordered by source commit position. Resolve deletions and reference data under the same snapshot and coverage rules. Do not first reduce P to a maximum local sequence number.

An as-of-time API maps source commit-time metadata to a boundary and reports timestamp precision/ambiguity; the ordered position is authoritative. Business-effective time is a separate query dimension. General bitemporal interval semantics should be defined by domains needing them, not inferred from one `effective_at` field.

### Distributed boundary

A multi-origin snapshot uses a manifest of per-origin certified boundaries and included revisions. Verify dependency closure: every included revision's required parents are present or explicitly covered by a trusted baseline. Independent source boundaries do not automatically form a causally consistent cut. Report incomplete/conflicted state rather than inventing one universal historical clock.

## 8. Portable envelope and merge

Envelope version 1 should include:

- Source transaction/origin identity, portable tenant and actor identities, operation/schema versions, recorded/effective times, and optional captured commit metadata.
- Changed aggregate revision IDs and parents, portable child IDs, deletion markers, and typed post-change evidence.
- Referenced immutable values or resolvable content references; local integer catalog IDs alone are insufficient.
- Correlation, causation, import provenance, transformation version, and attachment integrity metadata where relevant.

Use explicit type encodings for decimals, large integers, dates, binary data, nulls, and missing fields. Preserve original received bytes and the decoded schema version; transformations create derivative records. A SQL-to-document adapter may reshape projections without changing original evidence. An adapter that cannot supply source transaction atomicity or commit order must declare reduced capabilities. Per-document revisions cannot masquerade as a cross-document transaction.

Receive protocol: authenticate source and tenant mapping → deduplicate transaction → validate envelope and dependencies → quarantine unresolved parents/conflicts → apply authorized whole transaction atomically → record local transaction/revision links → acknowledge durably. Retransmission must not create new business versions. Prevent loops using original source identities and application mappings, not just last-hop identifiers.

Default concurrency policy is single authority per aggregate, with fenced ownership transfer for online authoritative writes. Offline changes can be submitted as proposals against parent revisions. Modules may explicitly allow multiple writers; then concurrent branches are retained and reviewed or merged by a versioned domain policy. An offline writer cannot safely self-grant exclusive authority during a network partition.

Example: both nodes edit contact revision R4. One changes phone, another changes address. A domain policy may merge these disjoint changes into a revision with both parents after validating invariants. Concurrent invoice amount changes or permission grants are conflicts by default. Never use last-wall-clock-wins as the framework-wide policy. CRDT-like merging is opt-in only for fields with defined algebra and domain semantics.

If a source transaction touches several aggregates and one conflicts, stage the transaction as a whole. Splitting its application requires an explicit compensating workflow, with provenance, rather than silently weakening source atomicity. Distributed workflows record saga steps and compensations as new transactions, never erase prior steps.

## 9. Security, retention, and operational evidence

Application principals receive controlled procedure access, not direct history/ledger DML. Tenant ownership must be validated on every related identity, including revision parents and imports. Keep administrative repair paths explicit and separately audited. Existing composite ledger FKs prove ledger existence; they do not alone prove an entity belongs to that ledger's tenant.

Reconcile ledger, revision spine, and changed-row manifests. Use generated write patterns and integration checks for mutation coverage; string searches alone cannot prove it. Record failed logins, denied actions, and rolled-back command attempts through an independent durable security sink with request correlation and explicit delivery-failure policy.

Corrections and reversals create new transactions. Approved erasure is an explicit exception with a redaction record, policy version, actor, and affected scope. Do not promise both unconditional historical payload availability and irreversible payload erasure. Shared immutable catalogs require review of residual identifying information; removing one association does not itself prove erasure across replicas, archives, and backups.

Retain decoding schemas, transformation versions, portable identity maps, and referenced values alongside history. Test recovery of the database plus evidence/archive manifests. Evidence exports include boundary, coverage, schema, provenance, and known limitations; jurisdiction-specific compliance acceptance is a separate review.

## 10. Performance and rollout

Keep BIGINT joins and existing history storage. Evaluate entity-leading reconstruction indexes and child-key/version indexes against write amplification. Store wide provenance and portable envelopes once per operation or changed revision where practical. Benchmark outbox payload duplication versus reproducible immutable manifests. Use retention-aware archives/checkpoints to accelerate reads only with verified links back to authoritative history; checkpoints do not replace evidence.

Measure representative small and largest deployments, including a hot tenant, independent tenants, one hot aggregate, multi-aggregate batches, rollback storms, and disconnected import backlog. Record p50/p95/p99 write latency, lock waits, deadlocks, log bytes/op, storage growth, reconstruction latency, and capture/verification lag. Set numerical budgets from measured customer workloads before selecting cache/index/archive policies.

Phases:

1. Confirm this vocabulary and threat model. Review actual mutation procedures and ambient transaction composition.
2. Fix unsafe allocation and enforce root ordering; add meaningful concurrency tests. Preserve existing schemas until migration is reviewed.
3. Add portable IDs, revision parents, request idempotency, and controlled transaction context. Backfill legacy identity deterministically within recorded migration lineage; mark provenance as migrated, not original.
4. Deploy commit capture and coverage-aware reconstruction/export, with restore and retention-gap drills.
5. Add envelopes, inbox/outbox, identity mapping, and single-authority transfer; pilot two-database imports before enabling offline branches.
6. Add domain-specific merge policies. Optionally enable the companion cryptographic layer.

## 11. Acceptance cases

| Scenario | Required outcome |
| --- | --- |
| A allocates first, B commits first | Commit-boundary reads/export include B without prematurely including A |
| Two child updates on one root | Serialized revisions or explicit stale failure; reconstructed children match each revision |
| Nested caller introduces a new aggregate late | Rejected/restarted before violating allocation order |
| Error after business update before history write | Entire business unit rolls back; no partial commit permitted |
| Repeated updates in one unit | One final accepted revision; optional ordered action evidence |
| Retry after ambiguous commit response | Same request yields original result; no duplicate mutation |
| CDC worker crash/checkpoint retry | No missing mapping; duplicates safely absorbed |
| CDC retention gap | Completeness disabled and discontinuity surfaced |
| Duplicate/out-of-order remote delivery | No duplicate effect; missing parents staged |
| Remote transaction has one conflicting aggregate | Whole source transaction staged unless explicit workflow authorizes decomposition |
| Two writable restore branches | Distinct origins, preserved inherited IDs, divergent revisions detected |
| SQL export into document projection | Original typed evidence and provenance survive transformation |
| Historical schema/catalog evolution | Old revision reconstructs with pinned interpretation |
| Redaction and recovery | Approved exception visible; replicas/backups handled under recorded policy |

These tests are an implementation acceptance plan, not tests executed for this documentation change.
