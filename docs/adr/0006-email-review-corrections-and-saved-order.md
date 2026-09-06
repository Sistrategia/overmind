# ADR 0006: Email review corrections and saved order

Date: 2026-09-05.
Status: implemented for fresh schemas; verification results are maintained in the [email guide](../email-reference-family.md).

Follow-up: [ADR 0007](0007-ordinary-user-construction-and-type-history.md) now resolves the ordinary user constructor/type-history prerequisite described as deferred below. This document preserves the email correction pass's decisions at its checkpoint.

This refines [ADR 0005](0005-email-reference-family.md) after the [independent implementation review](../email-reference-family-independent-review.md) and the user's clarification of what “primary email” means. The independent report and its probes remain unchanged as the review record. Broader audit, migration and delivery contracts remain in ADRs 0002–0004.

## Product decision: a saved ordered list

Keep the user's model: the first email in the saved list is the principal/default email shown on the contact card and in quick information. A contact with emails has exactly one first item; an empty list has no principal. There is no independent stored is_primary flag to reconcile with position.

The data model separates stable identity from presentation:

| Property | Meaning |
| --- | --- |
| contact_id + ordinal | Stable local child identity, including across deletion/restoration |
| display_order | Current saved position, dense and one-based within the contact |
| email_id | Shared immutable exact value; several associations may reference it |
| entity_version | Contact revision containing this change |
| dbrow_version | Local audit unit containing this and possibly other changes |

Insertion appends. Restoration appends too: recovering an old email must not silently displace the user's current principal. Updating an address keeps its position. Deleting an email closes the gap and, if needed, promotes the next item. Moving an email shifts the intervening items. “Make principal” is a convenience for moving to position 1. Moving an item to its existing position is a validated no-op and allocates no new audit evidence.

For example, stable identities [1, 2, 3] moved to saved order [3, 1, 2] are still those same three children. Deleting identity 1 leaves [3, 2], not a missing contact-card email. Restoring identity 1 produces [3, 2, 1]. This is why ordinal = 1 cannot continue to mean principal.

A UI should make this rule visible through a Principal label and an explicit move/Make principal action. Temporary sorting, filtering or a search result must not persist a new order. This pass supplies SQL/C# operations, reader properties and actual view selection; it does not build that UI.

The default is suitable as a preselected ordinary contact destination. It does not confer consent, verification, deliverability, or permission to send sensitive information. A future workflow with a different purpose, such as billing, can add an explicit destination policy when required. Do not introduce all those selectors into today's simple contact list. When a communication is actually sent, its audit evidence must retain the destination used; future order reconstruction alone cannot prove where a message went.

Login, account email, confirmation and recovery remain a separate security workflow. The email writer never updates security.user.email or login_name. Even editing the value of the principal contact association must not change credentials implicitly. The actual schema-cycle regression checks this separation and both contact_view.email_address and entity_view.modified_by_email. The latter is a current actor-display field, not a historical claim about the actor's email at the time of an old action.

## Ordered state and ordered evidence

The existing exclusive root lock protects the entire list, expected-version validation and bump-once behavior. Positions have a positive CHECK and a root-leading order index. The writer verifies dense, unique live positions before returning. Direct association writes remain denied to email_runtime.

There is deliberately no unique database constraint on (contact_id, display_order). Set-based shifts can encounter transient duplicate positions within a statement on engines with immediate uniqueness checking. Avoiding that would require extra temporary-position writes or another permutation protocol. The controlled writer, root lock and final invariant check enforce this particular rule at the API boundary. This trades a raw-table invariant for simpler, cheaper moves; privileged direct DML must honor the same contract. Do not copy the design while granting arbitrary association DML.

Every shifted live row receives the current unit stamp and a final snapshot. A private contact_email_history_sync helper maintains the final touched live rows, while deletion retains the existing entry-state/tombstone logic. It never updates an earlier committed unit. Insert/delete cancellation, delete/restore, repeated moves and a change returning to its entry state retain the existing net-history rules.

Action payload version 2 adds previous_display_order and display_order and the move operation. Each effective user command has one action with its actual values and positions. Automatically shifted siblings receive snapshots, not invented independent user move commands. Inserts/restores have no immediately preceding live position; deletes have no resulting live position. A restore followed by Make principal has two truthful actions and one aggregate revision when composed in the same unit.

Revision differences include old/new positions. A pure position difference is reported as move; a payload change is update and may also carry a position difference. Diff describes net state, whereas Actions describes the commands. A five-command reorder/delete/restore sequence can finish with an empty net diff and five actions. IsPrincipal on a returned email state is derived from DisplayOrder == 1.

Dense positions make a move proportional to the affected portion of this contact's list, including history writes. That is a good starting point for contact mechanisms with short lists, even when the database contains millions of contacts. It is not the proposed representation for an enormous ordered aggregate. Measure long-list workloads before choosing sparse ranks or a different ordering structure.

## Reader locality requires the access path as well as the index

The review correctly identified missing (entity_id, dbrow_version DESC) and (contact_id, dbrow_version DESC) indexes on the sparse root-payload histories. Both are added. The global-clock clustered keys remain useful for transaction-oriented access.

An additional regression found that the indexes alone were insufficient in its fixture: TOP(1) still chose backward scans of the global-clock clustered indexes, retaining 201 RangeS-S key locks in each history table while seeking one old root's payload. The locking reader now requires seeks through the two root-leading indexes for both availability checks and payload retrieval. This is a narrow SQL Server execution-profile choice because here the access path affects the promised scope of blocking, not just query speed. It also creates an explicit dependency on those index names; change the reader when changing the indexes. [SQL Server table hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table)

The regression observes the real reader's locks immediately before its COMMIT by inserting a test-only observation into its definition in the disposable database, then restores the exact definition. It allows lookup and boundary locks instead of insisting on exactly one key lock, and rejects broad history-table locks. This is a locality regression amid 200 unrelated roots, not a capacity benchmark or a universal maximum lock count.

The short SERIALIZABLE reader and exclusive writer root barrier remain. Actor validation also stays inside the reader transaction: although an ID is stable, actor eligibility (deleted/locked/type/tenant) is not necessarily stable. Moving that validation outside the transaction silently chooses different authorization timing. The review's actor-row coupling is real; keep reads short and measure it before changing that policy. A snapshot reader is still a possible separately tested profile.

## Exact catalog misses

Keep read-first access for existing immutable values. On a miss, take an exclusive transaction-owned application lock for that exact value, perform a plain recheck, then insert if absent. Distinct email and location namespaces use SHA-256 of the exact UTF-16 bytes only to form bounded lock names. The hash is not persisted identity or a replacement for the exact (bytes, byte length) unique key. A hypothetical lock-hash collision causes extra serialization, not incorrect deduplication.

The private helper executes as owner to acquire dbo-namespace locks when reached through the restricted public API; it remains denied to direct runtime calls. Negative acquisition results fail the unit, and the lock timeout follows the caller's LOCK_TIMEOUT setting. Transaction lifetime releases locks on completion. [Application lock contract](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql)

This removes the deliberate miss-path key-range lock that serialized different values in the same index gap. It does not promise that different values can never block: engine locks, page contention, escalation and multi-resource acquisition can still matter. Tests use the real email_runtime role, new email and location values in the same gaps, and an open competing unit. Identical values must still deduplicate safely.

Exact spelling, business normalization and identity remain separate. Keep the existing binary-plus-length key rather than also changing collation/storage during this correction pass. Its storage cost deserves measurement, but a collation substitution needs equivalent trailing-space/zero-code-unit tests. Other providers implement safe exact-value interning with their own conflict/locking primitives; they need not imitate sp_getapplock. MySQL session-owned GET_LOCK is not a drop-in transaction lock. See [ADR 0004](0004-portable-delivery-and-provider-profiles.md).

## Remove the redundant child counter

Retain contact_email_identity, including committed insert/delete cancellations. Its root-leading primary key already supplies the child's high-water mark. Allocate MAX(retained ordinal) + 1 while holding the owning root's exclusive lock. Never use MAX(live association ordinal) + 1. Rolled-back children remain provisional and can reuse a number; a committed identity cannot.

Fresh DDL no longer creates entity_child_sequence. DropSchema retains a conditional cleanup for an older development schema containing that table. This simplification does not weaken the rule that global dbrow_version is allocated exclusively by its database sequence. The two allocators have different concurrency scopes and retained evidence.

## Explicit native profile and business-batch boundary

Writers support READ COMMITTED with or without READ_COMMITTED_SNAPSHOT. Enrollment rejects all other isolation levels, and every ownership assertion rechecks the level so an ambient caller cannot enroll and then switch to SNAPSHOT/REPEATABLE READ. A private helper encapsulates SQL Server's session inspection. C# begins an explicit READ COMMITTED transaction. The historical reader's own SERIALIZABLE transaction is a separate, read-only boundary.

SqlDatabase.RunLocalStoredAuditCommands is the named business-seed/import-batch runner. It owns one READ COMMITTED transaction, unconditionally enrolls before the batch, and commits or rolls back. A missing enrollment helper is an installation error. RunLocalStoredCommands remains the ordinary DDL/resource runner, since early schema resources create enrollment itself. Both dispose owned connections/commands/transactions and preserve the original error if rollback also fails.

The Overmind business seed uses the audited runner and no longer embeds an ad hoc enrollment preamble. Future resource call sites must select the audited runner for business writes. Do not add IF OBJECT_ID fallbacks that silently weaken the contract. The regression tests a preamble-free successful batch, a failing batch with no partial entity left, missing-helper failure, and the real create/drop/create application cycle.

This runner is not yet a distributed source-transaction importer. Later migration code must still preserve source boundaries, completeness and provenance; grouping an arbitrary resource into one transaction does not by itself reconstruct its source history.

## C# cancellation, disposal and commit admission

The semaphore still serializes commands, disposal and commit on the owned connection. A queued cancellation now marks the unit for abortion immediately, before waiting to acquire the semaphore for rollback. This closes the ordering window in which commit could otherwise get the semaphore before that rollback waiter. A command also rechecks cancellation and unit validity after SQL returns, so a disposal request received during execution cannot leave the caller with a success result and a committable context.

Commit has an explicit admission boundary protected against cancellation/disposal requests. Before admission, cancellation invalidates the unit and prevents commit. After admission, the coordinator calls provider commit without a cancellation token: a later request cannot undo an issued commit. A command queued behind a completed commit fails without undoing the committed work. Do not describe this as “every cancellation always rolls back” without the boundary qualification.

Any exception from the issued provider commit invalidates the context and is wrapped in AuditUnitCommitUncertainException. It preserves the original error and the provisional DbrowVersion as a correlation hint. The classification is conservative: some server errors make the outcome knowable, but callers must not treat this exception as guaranteed rollback. There is no automatic retry, durable request receipt or lost-acknowledgment recovery mechanism yet. DbrowVersion alone is not a complete retry protocol.

One review premise needed correction: in the installed Microsoft.Data.SqlClient 6.0.2 / .NET 8 build, reflection showed CommitAsync is inherited from DbTransaction. That implementation checks cancellation before invoking synchronous Commit; it does not implement token-driven interruption of an already issued SQL commit. The stronger admission/exception contract remains useful and should survive provider changes. [Runtime implementation](https://github.com/dotnet/runtime/blob/v8.0.0/src/libraries/System.Data.Common/src/System/Data/Common/DbTransaction.cs), [SqlClient implementation](https://github.com/dotnet/SqlClient/blob/v6.0.2/src/Microsoft.Data.SqlClient/netcore/src/Microsoft/Data/SqlClient/SqlTransaction.cs)

New tests exercise queued cancellation versus commit, cancellation and disposal during a genuinely blocked SQL command, provider commit failure after terminating the unit's own disposable-database session, and commit preceding a later queued command. Private-field reflection in the test harness is only deterministic scheduling/fault setup; production does not expose transaction handles. An initial doomed-transaction fixture was unsuitable because SQL Server rolled it back and reported error 3998 at the preceding batch boundary. Terminating the owned test session exercises the actual provider-commit failure path; it is still not a lost acknowledgment simulation.

## Other review decisions and deferred work

| Review observation | Decision and reason |
| --- | --- |
| Duplicated modified/recorded_at clocks | Retain distinct meanings: legacy occurrence/source metadata versus server allocation time. recorded_at is neither commit time nor proof of the source occurrence time. Reuse must not overwrite either meaning. Ordinary email paths need no additional occurrence-time UI. A later schema rename can clarify the legacy name without throwing away evidence now. |
| Constructor actor fallback/tenant omission differ from new email paths | Confirmed legacy boundary; settle with general user lifecycle/self-registration before granting constructors to an application role. The expanded actual-seed test also confirmed that legacy user_insert leaves the new user's entity typed as contact: using that seeded user as the strict email API's actor fails with 51201. The corrected email test uses the explicitly bootstrapped System actor, without weakening validation or silently promoting the seed. Ordinary user creation/type handling must be fixed before application adoption of these actor-bound APIs. email_runtime continues to deny legacy constructors. |
| tenant_insert silently defaults actor to System | Removed that default; administrative callers must supply a resolved actor_entity_id. System reservation/bootstrap remains explicit. |
| email_runtime survives DropSchema | Intentional deployment-owned role; preserve memberships across schema rebuilds and reapply object grants on creation. Removing a deployed capability and its memberships is a separate administrative operation. Tested across the real cycle. |
| entity_history lacks entity_type_id | Still a required decision before exposing contact-to-user promotion/type-changing lifecycle. Adding a column alone would not settle subtype/root payload history or fill every writer consistently. Keep that bounded lifecycle work separate; this email reader does not claim historical type reconstruction. |
| Filtered allocation-transaction index | Retained as the cost of native discovery; essentially every new ledger row participates. Do not describe it as a tiny subset merely because its definition is filtered. Measure its storage/write cost with the ledger's other indexes. |
| Mandatory enrollment adds a guard | Keep it: explicit enrollment distinguishes approved transaction composition from a raw ambient transaction. A named business runner makes correct use easier without removing native enforcement. |
| Extra restore convenience or arbitrary list replacement API | Defer. Explicit restore-with-values plus move covers this reference boundary; adding command modes increases histories and conflict cases to validate. |

## Delivery and next boundary

The fresh schema, registered objects, actual email views, C# API and disposable regression runner move together. This is not an ALTER/backfill migration for an existing populated schema. Such an upgrade must define historical ordering coverage and action payload decoding; it cannot manufacture old saved order from today's list. Rebuild/restart the application to load changed embedded SQL before recreating a development schema.

Run the full suite in both READ COMMITTED profiles as described in the guide. Keep multi-root deadlocks, contention, log/storage growth and large-history latency on the measurement plan. No universal millisecond SLA or millions-of-rows throughput is established by these regression fixtures. No other provider, production migration, distribution adapter, credentials lifecycle or phone/address ordering is claimed implemented here.

The pattern is now ready for a bounded follow-up review or the next family after the correction suite passes. Preserve these decisions when copying it: root-leading history access, stable identity separate from saved order, exact-value miss coordination, final snapshots plus command evidence, explicit transaction ownership and lifecycle failure semantics.
