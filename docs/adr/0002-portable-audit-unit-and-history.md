# ADR 0002: Portable audit units, aggregate ordering, and committed history

Date: 2026-09-05.
Status: recommended overall contract; the SQL Server email subset is implemented and tested as described in [ADR 0005](0005-email-reference-family.md). Other families/providers remain separate work.

Companions: [primary design](../dbrow_version-allocation-design.md), [tenant and actor policy](0003-tenant-actor-and-catalog-policy.md), [delivery and provider profiles](0004-portable-delivery-and-provider-profiles.md), and [review answers](../dbrow_version-independent-review-v3-answers.md).

## Context

The remake must preserve the audit mechanisms that already distinguish the product, across small installations and databases with millions of records. SQL Server and Azure are the first targets. PostgreSQL, MySQL/InnoDB, and disconnected local stores must be able to implement the same business guarantees without reproducing SQL Server syntax or internal transaction identifiers.

The independent answers improve two mechanisms: final snapshots can be maintained inside an open transaction, and a monotonicity check permits late-discovered aggregates. Their caller-writable session marker does not independently prove transaction ownership. Their automatic joining also conflicts with applying several original transactions inside one receiving transaction. This ADR resolves those contracts separately.

## Decision: one controlled audit unit

An ordinary audit unit has one target database, one tenant, one attributed actor, one local ledger entry, and one outer database transaction. Nested calls join it. The transaction may touch several aggregates. A platform maintenance unit has an explicit platform scope instead; it must not silently switch tenants. Cross-tenant or cross-database atomic work is outside this default interface.

One receiving business transaction applies at most one originating transaction. Batch transport and durable inbox receipt can group several envelopes, but their business application cannot silently share an allocation. See ADR 0004.

The transaction owner alone commits or rolls back. Helpers never commit, begin an independent allocation transaction, or turn a nested call into an independent audit unit. Every failure invalidates the whole unit; the owner must roll it back even on engines where the error only rolled back one statement. No savepoint-based partial-success API is promised. Retry the whole unit using a fresh context. An uncertain commit is resolved through command/import idempotency, not by blindly issuing the command again.

## Explicit context is the portable authority

Logical context:

```text
AuditUnit {
    target database and active connection/transaction handle,
    tenant or explicit platform scope,
    attributed actor and authenticated initiator where different,
    optional local dbrow_version until first allocation,
    server recorded_at once allocated,
    local-command or import identity and mode,
    active / failed / completed state
}
```

This is a trusted runtime handle, not a serialized client request or a new durable identity on every row. It can be held by the application transaction coordinator or by an engine-specific public procedure and its internal call chain. It is never reconstructed from an arbitrary BIGINT supplied by a client. Closing, committing, or failing the underlying transaction invalidates the handle. A coordinator rejects switching connection, database, tenant, actor, or original import identity within it.

Preserve optional INOUT version parameters at supported public interfaces:

| Input and context | Meaning |
| --- | --- |
| NULL, standalone public call | Create a controlled unit, allocate lazily when needed, return its version |
| NULL, already enrolled in a controlled unit | Join that unit; return its existing allocation or allocate its first one |
| Non-NULL, matching active unit | Assert and reuse that unit's allocation |
| Non-NULL with no enrolled unit, wrong unit, or completed unit | Reject; ledger existence is insufficient |

Automatic joining is a property of explicit enrollment, not ambient SQL session state alone. A raw external SQL transaction is not automatically enrolled merely because it exists. Providers may support native SQL composition through a guarded interface; otherwise composition goes through the trusted transaction coordinator or a public compound procedure. Existing SQL Server callers need a documented transition before this stronger contract replaces ADR 0001 behavior.

Only controlled public entry points receive application EXECUTE grants. Internal primitives accepting resolved actors, reserved entity IDs, or reuse capabilities remain inaccessible directly. Direct ledger/history DML is denied. This is protection against application mistakes and unauthorized entry paths; the implementation of permitted procedures remains trusted code.

### SQL Server session state and optional native composition

SESSION_CONTEXT may cache an allocation hint. It is not the authority: any user can set their session's context. A stored CURRENT_TRANSACTION_ID alone is also not a portable identity across restored instances. In an isolated SQL check on 2026-09-05, manually seeded context satisfied the proposed reuse predicates for a previously committed temporary ledger row. The marker and current transaction also survived USE into another database. [Session-context permissions](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-set-session-context-transact-sql)

For a future SQL Server native composition adapter, the selected candidate for additional database enforcement is a transaction-owned application lock in a private database-principal namespace. On allocation, the protected helper acquires a resource naming the new version. Reuse checks that the current transaction already owns that resource; it must never acquire the resource for an old supplied version. A public wrapper supplies any hint, but cannot manufacture ownership. The application principal must not be a member of the private principal or be able to impersonate it. Resource acquisition and validation execute through the narrowly privileged helper.

ADR 0005 implements/tests this guard for the SQL Server email path, with an indexed engine-ID hint for allocation discovery. SQL Server scopes these locks by database, principal, and resource and releases transaction-owned locks on completion. Check every acquisition return code; a failed acquisition must fail the unit. [Application lock behavior](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql), [ownership inspection](https://learn.microsoft.com/en-us/sql/t-sql/functions/applock-mode-transact-sql)

Allocation discovery and ownership validation remain separate. Clearing or corrupting a session hint must not cause a second allocation inside an enrolled unit: consult the coordinator's registered allocation, or reject the inconsistent native context. Do not claim that per-version locks alone discover the unit's allocation. Writers do not use MARS, change databases, or issue raw COMMIT/ROLLBACK underneath an enrolled coordinator.

The portable design does not require other engines to reproduce this private lock API. Their transaction coordinator supplies the same enrollment/lifetime contract. Native composition is an additional adapter capability, never silently approximated with a session variable or a lock of the wrong lifetime.

## Allocation and time

Keep a database-local positive signed BIGINT allocation key with gaps, unique across local ledger entries. Never recycle a committed identity, cycle the generator, use unlocked MAX()+1, or insert imported source numbers as destination-local numbers. Numeric allocator values are not commit positions.

SQL Server uses its current sequence; PostgreSQL uses a logged ascending sequence with CACHE 1 for this audit allocator; MySQL/InnoDB can generate the ledger ID through AUTO_INCREMENT. Entity identity allocation is separate from ledger ordering. Provider-specific allocation details and tests are in ADR 0004.

Capture recorded_at once inside the allocation boundary using server UTC time. It is the time of local recording, not of commit. Reuse returns the stored value. Business-effective time and imported source-recorded time have separate meanings and fields. Legacy caller-supplied modified values retain their original interpretation; migration must not relabel them as measured commit time.

## Aggregate locking and monotonicity

For an existing root, obtain a write-intent/exclusive row lock for the owning tenant and retain it until outer completion. Revalidate preliminary reads and domain invariants under the relevant protection. Process known roots in ascending local entity_id to reduce deadlocks. Locking one root does not protect a shared catalog, an unlocked related aggregate, or a cross-aggregate invariant.

Before any mutation of a late-discovered existing root, compare its current dbrow_version with the unit's allocated version v:

| Current root stamp | Action |
| --- | --- |
| Less than v | Permit first change; increment entity_version once and add its spine row |
| Equal to v | Permit another change only after verifying it is this active unit's earlier touch |
| Greater than v | Fail with ordering conflict; roll back and retry the entire unit |

The bump helper reasserts this condition with a conditional write. The resulting spine has strictly increasing dbrow_version as local entity_version increases. This is the invariant used by numeric-bound aggregate reconstruction. A lower-numbered unit may join a late root if no higher-numbered unit has already committed a change to it. Requiring the complete affected set before allocation is therefore unnecessary.

New roots start at entity_version 1 under the unit's version. They require enforcement of applicable unique business keys, not a lock on a root row that does not yet exist. Concurrent same-name company creation is not inherently a duplicate unless the domain makes that name unique.

### Optimistic concurrency during repeated nested calls

Externally submitted edits to existing roots supply an expected_entity_version. Trusted maintenance operations may explicitly opt out; omission by an ordinary client must not silently disable checking.

The expected token refers to the committed root version at entry to the audit unit. On first touch, compare against the locked current version. After this unit has bumped it, derive the entry version from the previous spine row, or cache it in the trusted unit context; do not reject a repeated call merely because the unit itself incremented the root. Do not accept a new expected token opportunistically after observing another transaction's change. New roots have no prior committed token.

Late-root conflicts, deadlocks, and provider serialization failures retry the whole operation with bounded retries. Repeated contention is measured, not hidden by an unbounded retry loop. Errors invalidate context even if an OUTPUT variable still contains a value.

## History is final state for touched rows

Within the active unit, upsert only history belonging to that unit's validated version and row identity. After commit it is protected history, except for explicit redaction. No outer finalization pass or generic touched-row registry is required merely to produce final snapshots.

For physically inserted/deleted child rows:

| State before unit | Operations inside unit | Final history |
| --- | --- | --- |
| Absent | insert, then zero or more updates | INSERT with final values |
| Present | one or more updates | UPDATE with final values |
| Present | delete, optionally after updates | DELETE with last values before removal |
| Absent | insert then delete | No child history row; unit/spine/action evidence may remain |
| Present | delete then restore the same logical child | UPDATE with final values, not a new child identity |
| Absent | insert, delete, recreate inside the unit | INSERT with final values |

The existing current-unit history operation distinguishes whether a row existed before the unit. Preserve INSERT through subsequent updates; change a current-unit DELETE to UPDATE when restoring a pre-existing child. Do not implement only the update/delete examples and omit the complementary insertion path.

Skip statement-level changes whose values are equal under the column's defined value-identity contract. If a sequence of real writes returns to the entry values, a redundant final UPDATE snapshot is permitted. This is not a promise of minimal net-delta history. Do not undo a previously allocated aggregate version when the final delta becomes empty.

Root soft-delete and undelete retain the root and its identity, snapshot lifecycle fields, and record operations 3 and 5 respectively. Children need not be physically removed merely because their root is soft-deleted. An undelete revalidates current uniqueness and domain restrictions. Explicit erasure is a separate, recorded exception and is not an ordinary undoable delete.

Changes to child associations bump only their defined owner. A contact_relationship is owned by from_contact_id; reading a company's employees at an earlier point cannot be inferred solely from that company's entity_version. That reverse historical query needs the relationship histories and an explicit boundary. This prevents falsely promising full historical membership from an unchanged hub revision.

Child ordinals used in history are stable local child IDs, not display positions. Allocate from a per-root/per-family high-water mark under the root lock; retain it after deletion. The retained identity table itself supplies MAX(ordinal)+1 safely under that lock; a separate counter table is unnecessary for the email implementation ([ADR 0006](0006-email-review-corrections-and-saved-order.md)). Do not use MAX(current live ordinal)+1. Reordering uses a separate display-order value. Explicit restoration reuses the same logical child; a new child never takes a committed deleted child's identity. Remote child identities require mapping as specified in ADR 0004.

### State and business action evidence

If a payment uses an account value that changes again before commit, record the value or immutable historical reference used by that payment. Final contact snapshots cannot recover an intermediate value. Events/action rows have a transaction-local action ordinal when their order matters, typed payloads, and a decoder/schema version. The order of SQL statements alone is not a durable action record.

Do not perform external payments, publish messages, or return irreversible success before commit. Persist the intent/outbox atomically and execute external work afterward with idempotency. Failed or rolled-back attempts that need security evidence use a separate durable security log with an explicit outcome; they cannot survive solely in the rolled-back business ledger.

## Reconstruction and constraints

Resolve (entity_id, entity_version) to a local spine boundary, then read latest applicable root and child history at or below that local dbrow_version in one consistent read snapshot. Interpret child tombstones and root soft-deletion separately. Never combine independent source number ranges and apply this algorithm to their union.

Exact reconstruction is bounded by retained, declared historical coverage. For imported legacy families, absence of a history row may mean unknown state rather than an empty child set. Return coverage information or an explicit unavailable result for such a boundary; do not substitute today's children or current root labels as historical facts. ADR 0004 defines snapshot baselines, coverage intervals and migration provenance. Given a complete starting state, ordinary new writes under this protocol preserve complete history from that boundary onward; subsequent writes alone do not repair an incomplete baseline.

Preserve unique spine keys (entity_id, entity_version) and (entity_id, dbrow_version), composite ledger references, and tenant/root consistency. Audit mutable type changes during contact-to-user promotion. Do not copy password hashes into ordinary history; record credential-change facts without retaining credential secrets. Metadata checks need explicit exceptions for ledger, spine, action records, immutable values, and operational queues rather than requiring every versioned table to have an identically named history sibling.

Use root-leading history indexes for aggregate reconstruction and retain useful transaction-leading access paths for transaction export. Exact clustering and include columns are provider choices tested on representative workloads.

## Verification gates before implementing the template

- Same-unit reuse succeeds; committed, wrong-database, wrong-tenant, wrong-actor and wrong-import reuse fails. Test context corruption, cleared hints, connection pooling, rollback, and uncertain commit.
- For native SQL composition, a permitted public procedure cannot be tricked by forged session values; an ordinary principal cannot acquire/release the private guard or execute internal primitives. Lock inspection must fail after commit/rollback and in another database/session.
- Repeated nested updates, delete/restore, insert/delete, and changes returning to the entry state produce the declared history and exactly one root bump.
- Expected-version validation works before and after this unit's own bump; stale external edits fail.
- Two-session late-root and opposite-lock-order schedules preserve spine order after full retry, with no partial writes.
- Missing lookups cannot reuse stale OUTPUT values. Initialize result variables or use assignments that produce NULL on no row. A 2026-09-05 SQL probe confirmed that SELECT assignment without a result leaves the previous value intact. [SQL Server assignment semantics](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/select-local-variable-transact-sql)
- Reconstruct every reference lifecycle revision and the change/act/revert fraud scenario, including action evidence inside one unit.

These remain acceptance gates when porting the pattern. ADR 0005 records the implemented SQL Server email mechanisms, tests and limitations; do not extrapolate that coverage to every family, provider or delivery/migration capability. The first reader uses an owned serializable read transaction as documented there, with snapshot reading still available as a future measured optimization.
