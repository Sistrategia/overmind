# dbrow_version allocation — independent analysis v2

Date: 2026-09-04
Status: design review; not an implementation decision.

Follow-up (2026-09-05): this analysis is preserved as historical reasoning. The [revised primary design](dbrow_version-allocation-design.md) and ADRs 0002–0004 narrow distribution to practical disconnected delivery/migration, make commit capture optional, and define provider-neutral audit contracts. Its newer scope takes precedence over the broader implementation proposals below.

This document revisits [the original analysis](dbrow_version-allocation-analysis.md). It preserves that record rather than silently replacing its conclusions. The proposed implementation direction is in [the primary design](dbrow_version-allocation-design.md); the stronger integrity alternative is in [chained history](dbrow_version-allocation-design-immutable-chained-history.md).

## 1. Recommendation

Keep a database-local BIGINT sequence with gaps for `dbrow_version`, and keep `entity_version` for the user-facing aggregate revision. Strengthen the contracts around both. Add portable identity and explicit causal provenance at transaction/revision boundaries. Provide a durable commit-order index when advertising tenant-wide historical reconstruction or ordered export.

Do not add a tenant counter merely to make numbers consecutive. A transactional tenant counter is nevertheless a legitimate alternative when synchronous tenant ordering is worth its serialization cost. Do not confuse rejecting contiguity as a default with rejecting stronger audit semantics.

For decentralized distribution, introduce immutable identities and explicit branch/merge semantics before considering cryptographic chains. Hashes can help verify evidence; they do not determine which conflicting invoice or permission change should win.

## 2. Evidence and scope

Reviewed repository artifacts:

- `Scripts/Data/create_data_schema.sql`: global BIGINT sequence, ledger PK `(tenant_id, dbrow_version)`.
- `Scripts/Entities/create_entities_schema.sql`: entity version spine, history-to-ledger FKs, history clustered by transaction version first.
- `Scripts/Entities/create_entity_insert.sql`: optional caller-supplied transaction version; ledger timestamp derived from `@created`; history and entity creation in the same transaction.
- Original analysis and external `SistrategiaDataAnalysis/schema-analysis/05-design-recommendations.md`, especially sections 2 and 6.2.

The paths above are relative to `src/Framework/Sistrategia.Data.SqlClient`. This is a focused review, not proof that every procedure satisfies the proposed contract. No production workload measurements were available. Performance numbers below are illustrations, not benchmark results.

The new brief expands the earlier trusted-DBA, single-database scope to future multidatabase merge and decentralized distribution. The companion proposals deliberately explore that expansion; they do not claim it was already agreed in the original specification.

## 3. Separate the guarantees

| Guarantee | Required mechanism | Consecutive numbering sufficient? |
| --- | --- | --- |
| Every committed business mutation has evidence | Atomic history plus enforced write coverage | No |
| Changes belong to one atomic local operation | Shared transaction ledger identity | No |
| Contact version 4 is reproducible | Serialized aggregate revisions and complete snapshots | No |
| Entire tenant state at a committed boundary is reproducible | Commit membership/order and consistent reconstruction | No |
| Incremental export never skips a late commit | Safe committed cursor or durable work queue | No |
| Merge does not collide across databases | Portable identity and source provenance | No |
| Concurrent remote revisions remain distinguishable | Parent revision relationships and conflict policy | No |
| Privileged rewriting is detectable | Independently retained cryptographic commitments | No |

Audit completeness, order, causality, identity, and tamper evidence are separate properties. A single numeric column should not implicitly promise all of them.

## 4. Corrections to the original analysis

### 4.1 Allocation order is not committed history order

Example, within one tenant and on independent aggregates:

1. A allocates 100 and pauses.
2. B allocates 101 and commits.
3. A commits.

Between steps 2 and 3 the database contains B but not A. After both commit, no predicate `dbrow_version <= N` describes that earlier state. The predicate at 101 also acquires A after A commits. A consumer which advances its cursor to 101 can permanently skip A.

Thus the original statement that this is simply fine for as-of queries is too broad. A numeric prefix has a deterministic mathematical order, but does not necessarily correspond to a past committed database state. Reading only committed rows does not repair that distinction.

### 4.2 Aggregate order needs protection too

If A reserves 100 before locking an aggregate and B reserves 101 and changes it first, A cannot later successfully change that aggregate using 100. Either A fails the stale-version check, or a fresh attempt obtains protection and allocates a fresh version. Otherwise the version spine and `<= bound` child reconstruction disagree.

The canonical pattern must protect the root and validate expected revision before allocating, including when callers pass versions into nested procedures. A check followed by a later unprotected update is insufficient. Changes to different children of one aggregate participate in the same root protocol.

### 4.3 Application timestamps are not commit timestamps

The inspected insertion procedure stamps the ledger with `@created`, possibly supplied by the caller. Even a server timestamp immediately before `COMMIT` would not establish actual commit order. Distinguish business-effective time, server-recorded time, and source commit metadata.

Native temporal tables are not an automatic replacement: SQL Server documents their system period timestamps in terms of transaction begin time. [Microsoft temporal table semantics](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal-tables)

### 4.4 Sequences are efficient, not contention-free without limit

SQL Server allocates sequence values outside the transaction. Rollbacks can consume values and cache loss can create gaps. Caching reduces persistence work; it does not establish unlimited allocation capacity. `NO CACHE` does not turn a sequence into a transactional, gapless clock. [Microsoft sequence semantics](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-sequence-transact-sql)

### 4.5 A tenant counter offers more than attractive numbering

If every participating transaction updates one tenant counter and holds the resulting protection until outer commit, another transaction cannot pass that allocation point first. This can yield a stable committed prefix as well as contiguous ledger numbers, assuming increments and ledger rows are atomic, retained, and never administratively bypassed.

The lock lasts from allocation until the outer transaction ends, not necessarily the entire transaction. Late allocation can reduce this interval but complicates stamping and lock ordering. An independently committed allocator restores gaps and loses this ordering guarantee. A separately created SQL sequence per tenant also retains rollback gaps and is not an equivalent transactional counter.

The original unlocked `MAX()+1` is unsafe. Proper serialization can make maximum-based allocation safe, but a dedicated counter expresses that serialization more directly. An ordinary unlocked maximum read does not itself serialize writers.

## 5. The actual alternatives

| Choice | Local uniqueness | Stable tenant commit prefix | Write cost | Distributed identity |
| --- | --- | --- | --- | --- |
| Global sequence | Yes under controlled allocation | No | Small allocation cost; no business-duration counter lock | Requires portable ID |
| Per-tenant SQL sequences | Within each tenant | No | Extra objects/operations; same gap semantics | Requires portable ID |
| Transactional tenant counter | Within each tenant | Yes under universal participation | Tenant serialization from allocation to commit | Requires portable ID |
| Global sequence plus commit index | Yes | Yes through a certified captured boundary | Capture/storage/operations; async lag | Requires portable ID |
| Global sequence plus cryptographic evidence | Yes | Only if ordering is separately supplied | Hashing, storage, anchoring, verification | Portable ID still useful |

Two independently allocated counters do not solve commit order. A hash does not solve it either. The strongest practical default is a cheap local identifier plus explicit metadata for the guarantees actually needed.

## 6. Performance at the stated scale

Millions of rows and many gigabytes make query access paths, history growth, and restore duration material. They do not alone establish that a tenant counter would bottleneck. Measure peak concurrent writes for the largest tenant and time spent holding its counter.

If the mean serialized interval is 20 ms, an idealized upper bound is about 50 operations/s; at 200 ms it is about five. Variability and queueing make tail latency worse before reaching those ceilings. Batch size and transaction duration matter as much as transaction count.

For the recommended architecture, measure transaction log bytes, history rows per business operation, index maintenance, capture lag, export lag, and reconstruction latency. Entity-leading and child-key-leading history indexes should be evaluated against the existing transaction-leading clustered keys. Do not duplicate every payload into several archives without measuring the amplification.

The entity version spine remains valuable: it avoids copying every unchanged child for every revision. Immutable catalog references remain reconstructible only while their values and historical interpretation remain available, including after migrations and exports.

## 7. Distribution changes the meaning of version

Two disconnected databases can both produce local version 5 of the same contact. Neither local integer identifies the other revision or establishes which should prevail. Sorting by wall time or GUID makes an arbitrary order, not a justified resolution.

Use stable tenant/entity identities, transaction IDs, revision IDs, and parent revision links. An aggregate revision can have multiple parents after an explicit merge. Keep source evidence separate from the receiving database's application of that evidence. Local `entity_version` can remain a convenient linear revision number for the local accepted state.

Distributed causality is naturally a partial order; a total display order does not imply causal precedence. [Lamport, Time, Clocks, and the Ordering of Events in a Distributed System](https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/)

Different storage paradigms need a versioned exchange contract, not identical internal schemas. Full-row relational snapshots provide evidence and reconstruction; they do not automatically provide enough business intent to replay arbitrary commands against another model.

## 8. Audit and compliance boundaries

Consecutive values can help operational reconciliation under a gapless contract, but they cannot prove that all writes were captured or prevent an administrator rewriting the history and counter together. The normal design protects against application bypass and accidental corruption under a stated trust model. The alternative adds detectable alteration after independent anchoring.

Failed attempts and rolled-back transactions need separate durable security/operational recording; committed business history cannot record its own rollback. Actor attribution must distinguish authenticated identity, delegated/effective actor, and importing service. Unknown identities must not silently become the System User.

Retention, erasure, access, legal hold, and evidence export policies must be defined for each deployment. The schema enables controls; it does not establish compliance with an unspecified legal regime. Ten-year reconstruction additionally requires schema evolution rules and tested recovery, not simply retained rows.

## 9. Decision proposed for review

1. Keep global `dbrow_version` allocation with gaps and a per-aggregate `entity_version`.
2. Make aggregate serialization and transaction ownership explicit before changing callers mechanically.
3. Introduce portable transaction/revision identity and provenance as the extension boundary.
4. Make durable commit indexing required for the advertised whole-tenant committed-history feature; keep its asynchronous completeness visible.
5. Preserve concurrent remote revisions and require domain-aware merge decisions.
6. Evaluate cryptographic checkpointing as a separate assurance tier, sharing the same evidence envelope.

The primary design supplies a phased path and acceptance cases. No sequence replacement, CDC deployment, schema migration, or cryptographic feature is implemented by these documents.
