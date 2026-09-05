# Audit foundation — session handoff

Updated: 2026-09-04. Purpose: resume the discussion after closing the session.

## Read next

1. This handoff, especially the user clarification below.
2. [Analysis v2](dbrow_version-allocation-analysis_v2.md).
3. [Primary proposed design](dbrow_version-allocation-design.md).
4. [Optional chained-history alternative](dbrow_version-allocation-design-immutable-chained-history.md) if stronger tamper evidence is relevant.

The original [allocation analysis](dbrow_version-allocation-analysis.md) is retained as historical context. Its claim that allocation ordering suffices for general as-of reconstruction is qualified by v2.

## User priorities and expressed preference

- This framework's audit/history capabilities are a proven product advantage, used to resolve customer mistakes and security incidents. Aim for another ten or more years of useful life.
- Audit quality matters more than performance, but databases can contain millions of records and many gigabytes. Do not dismiss write contention or history growth.
- Keep user-friendly aggregate `entity_version`: version 3 of a contact/invoice is meaningful to users independently of the database's transaction number.
- The user read the new documents and explicitly preferred the primary design's balance of value and complexity over the chained-history alternative. This is a direction preference, not blanket approval of every proposed mechanism or authorization to implement schema changes.
- Most deployments have one database, often one tenant. Distributed machinery should not burden every installation unnecessarily.

## Latest user clarification: real distribution and migration needs

Connectivity problems in Mexico affect branches, cloud connections, and local clients. Some deployments must keep working while disconnected. Local stores may include SQLite, Electron clients, or disconnected browsers.

The user does not require hash-based identities, perfect global ordering, blockchain, or a general distributed consensus system. It is sufficient to reproduce operations in a useful order at another database, with an audit trail that makes conflicts and corrections understandable.

Another real workflow is complete logical migration from an old schema to an improved one, preserving history and audit in the destination. Sources/destinations can differ in provider: SQL Server, MySQL, PostgreSQL, SQLite, etc. This is not the dominant use case, but it is relevant to the foundation.

The primary design predates this clarification. Do not assume its full revision graph, ownership transfer, or distributed snapshot proposal is immediately required.

## Latest assistant recommendation — proposed, not yet separately accepted

Distinguish two reproduction workflows:

| Workflow | Semantics |
|---|---|
| Synchronize disconnected work | Validate incoming operations against current destination state; accept, reject, or reconcile explicitly |
| Migrate historical data | Preserve recorded source outcomes, actors, chronology, and relationships through a versioned schema transformation |

Do not replay historical business commands through current rules blindly: changed tax/default/validation logic could rewrite their meaning. Imported history should integrate into reconstruction while retaining its source/import provenance, rather than pretending it originated in the destination.

Start with a stable origin identity and source-local transaction number as practical source identity: `(origin_uid, source_transaction_number)`. Writable restore forks get a new origin; inherited historical identities remain unchanged. No cryptographic identity is required for this purpose.

Allocate a destination-local `dbrow_version` on acceptance and retain a mapping to the source operation. Preserve both source chronology and destination acceptance order. Idempotent import prevents retries from duplicating business changes. Late imports must not be silently inserted into old destination transaction numbering.

Keep local integer entity/catalog/child keys and map source references to destination identities; use existing portable entity public keys where appropriate. Child ordinals alone are not portable identities.

An incoming operation identifies its base revision or equivalent expected state. Apply when assumptions hold; merge only under explicit domain rules; otherwise stage for review. Record reconciliation/correction as a new linked operation. General revision DAG machinery can wait until repeated multi-branch workflows justify it.

Use a versioned, typed evidence envelope rather than raw SQL or current stored-procedure calls. Preserve source transaction groups and recorded outcomes; record transformation versions and original evidence where practical. Mark missing/approximate legacy chronology honestly.

Proposed next priority: origin identity, source/destination mappings, idempotent import, and provenance; then one concrete disconnected-client workflow and one historical migration workflow. Defer generalized distributed snapshots and merge machinery pending evidence of need.

## Core technical conclusions to preserve

- Prefer global BIGINT sequence allocation with gaps plus `entity_version`; unlocked `MAX()+1` remains unsafe.
- Allocation order is not commit order. A late lower-numbered commit breaks naive `> last_id` export and whole-tenant `<= version` reconstruction.
- Existing numeric-bound aggregate reconstruction requires root protection and expected-version validation before allocation, including nested/multi-aggregate writers.
- Application `modified`/`created` values are not commit timestamps. The inspected insertion procedure can use caller-supplied `@created` for ledger time.
- A transactional tenant counter is a valid stronger-ordering alternative, with tenant serialization from allocation to outer commit. It is not needed merely for attractive numbering.
- The full primary proposal uses a durable captured commit index for certified tenant-wide historical boundaries. Whether every deployment needs that profile remains a scope decision. A serialized local client writer has a simpler ordering problem than a concurrent server.
- Audit completeness, transaction grouping, aggregate revision, commit ordering, portable identity, causal provenance, and tamper evidence are separate guarantees.

## Overall architecture discussion

Assistant favored shared transaction ledger, separation of aggregate version, changed-row snapshots, child-level history with a thin version spine, and coherent entity/contact/user identity.

Main concern: too much correctness depends on every writer following a complex procedure pattern. Prioritize enforceable transaction context, generated structure where useful, constraints, and meaningful concurrency/rollback/reconstruction tests.

Potential overengineering discussed: universal permanent value interning, making incidental records aggregate roots, and implementing generalized distribution before concrete workflows. These were tradeoffs raised for discussion, not user-approved changes. Do not dismantle catalogs or the entity model on that basis.

## Work state and next session

Three design documents were created during this discussion. No SQL/code changes were made for it. Existing pending fixes in AGENTS.md remain pending; re-read actual schemas and worktree before any implementation.

Suggested continuation: discuss one real disconnected workflow and one migration example, then refine the primary design around their required transaction/evidence semantics. Updating the design documents to reflect this clarification is still outstanding; it was not requested as part of the final clarification exchange.

The user's latest request was to preserve enough project memory to exit and resume. This handoff and the AGENTS.md pointer satisfy that request. Resume as a design partner and wait for the user's next direction rather than automatically implementing the proposal.
