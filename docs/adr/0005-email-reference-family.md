# ADR 0005: Implemented email reference family and SQL Server audit units

Date: 2026-09-05.
Status: initial fresh-schema implementation record. The independent review was delivered; [ADR 0006](0006-email-review-corrections-and-saved-order.md) supersedes the counter, catalog miss locking, saved-order, root-history access, seed enrollment and C# commit details below. Read that ADR and the current guide before copying the pattern. No existing customer database was upgraded.

Companions: [primary design](../dbrow_version-allocation-design.md), [audit-unit design](0002-portable-audit-unit-and-history.md), [actor/catalog policy](0003-tenant-actor-and-catalog-policy.md), [delivery design](0004-portable-delivery-and-provider-profiles.md), [legacy findings](../dbrow_version-legacy-implementation-findings.md), [usage and test guide](../email-reference-family.md).

## Decision and scope

Implement email as the first complete child family: creation, replacement update, physical association deletion, explicit restoration of an existing identity, final state history, ordered action evidence, aggregate revision advancement, historical reading and revision comparison. Keep shared email/location dictionaries and a real tenant on every association/history/action. A contact created with its first email uses this same internal writer and keeps entity_version 1.

This implements a bounded portion of ADRs 0002–0004. It does not implement every contact family, generic root update/delete/undelete endpoints, role-assignment history, legacy migration, origin identities, outbox/inbox delivery, redaction or another write provider. Historical root rename/deletion in tests is a fixture for the email reader, not a newly implemented general root-lifecycle API.

## A concrete native ownership boundary

The SQL Server adapter uses explicit enrollment plus transaction-owned application locks. The C# SqlAuditUnit owns a real connection/transaction, fixed tenant and actor, serializes its calls, and invalidates itself on failure/cancellation/completion. Its connection and transaction are not exposed for arbitrary raw commands or database switching. MARS is rejected.

Native SQL composition is:

1. Caller begins a transaction and calls data.audit_unit_begin. A standalone public writer does both only when it owns the transaction.
2. Enrollment acquires a private lock named for CURRENT_TRANSACTION_ID in this database's dbo namespace. It neither allocates nor commits. This lock is per transaction, not a global writer mutex.
3. Allocation acquires another private transaction-owned lock naming the **new** dbrow_version. A reuse path never acquires a lock for a supplied old number.
4. Ledger allocation_transaction_id is an indexed discovery hint. audit_unit_assert finds a row for this engine transaction only if its per-version lock is currently owned here. A NULL INOUT parameter therefore discovers the active allocation without trusting session hints.
5. Ledger dbrow_version now has a database-wide unique constraint in addition to its tenant-qualified PK. The active allocation then establishes tenant/actor consistency through the ledger. Committed or foreign versions cannot be joined merely because their rows exist.

The guard helpers execute as owner; the application cannot acquire/release dbo-namespace resources, execute the internal writer or mutate the ledger to manufacture evidence. SESSION_CONTEXT is unused. A reused engine transaction ID after recovery cannot revive a released version lock. Discovery is not based on an assumption that engine IDs are globally durable or unique forever. The hint stays in the ledger and is not exported as business identity or a commit position.

These mechanisms were tested under a non-owner database user and across two databases in one SQL transaction with deliberately matching number/transaction hints. The [Microsoft lock documentation](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql) describes the database/principal scope and transaction lifetime; [APPLOCK_MODE](https://learn.microsoft.com/en-us/sql/t-sql/functions/applock-mode-transact-sql) supplies ownership inspection, and [CURRENT_TRANSACTION_ID](https://learn.microsoft.com/en-us/sql/t-sql/functions/current-transaction-id-transact-sql) supplies the local lookup hint.

This is a SQL Server implementation of the unit contract, not a requirement that PostgreSQL/MySQL imitate these internals. Other adapters need equivalent lifetime, enrollment and reuse tests. The native guard protects against unauthorized entry paths; permitted stored-procedure implementations and privileged database owners remain trusted.

## Transaction and API transition

Entity/contact/user standalone constructors now enroll their own transactions. Ambient SQL callers must explicitly enroll before calling them; a raw BEGIN TRANSACTION is no longer sufficient. NULL auto-joins an already allocated unit. A non-NULL version is an assertion of that unit, not permission to join any existing ledger row. The focused allocation tests were updated for this intentional contract change.

The application's insert_ernesto_sample_data.sql business seed explicitly enrolls when RunLocalStoredCommands supplies its enclosing transaction. Direct execution without an ambient transaction still lets user_insert own/enroll its transaction. Enrollment belongs at this business-batch boundary: the generic resource runner also creates schemas and helpers before enrollment is available, and does not automatically turn arbitrary DDL/catalog resources into audit units. Commit/rollback ownership stays with the runner.

Only the outer owner commits/rolls back. Public email commands use XACT_ABORT and bare THROW. SqlAuditUnit rolls back the whole transaction on command errors, including cancellation before a queued command runs, and refuses subsequent commands/commit. Dispose without commit rolls back. No savepoint partial-success mode or automatic retry is provided. Results are provisional until commit; discard them after failure.

Commit failure may be uncertain. The coordinator invalidates its context and propagates the failure; it does not blindly repeat the operation. A durable request/application receipt for resolving uncertain commits is still a later capability, so this API does not promise exactly-once command retries. Connection-loss/uncertain-commit fault injection is not claimed as tested.

Ordinary email command timestamps are server recorded_at captured once by allocation and reused. Legacy constructor modified/created timestamps remain distinct compatibility metadata. The general self-registration path still has its older actor-rebinding behavior; this ADR does not claim that ADR 0003's general entity-ID preallocation and first-user API have been implemented. The email runtime role cannot directly invoke those legacy constructors.

## Actor and tenant boundary

The trusted service supplies authenticated actor and authorized tenant/contact context. SQL validates an existing user-type actor in that tenant, excluding deleted/locked actors; it validates the contact's tenant, type and writable lifecycle before changing a child. Unknown actors never become System User on the new public email paths. is_system does not substitute for user eligibility or authorize another tenant.

Omitted tenant resolves the existing seeded default GUID, not the actor's maximum/current tenant or arbitrary last tenant. Explicit unknown tenants fail. Installations using another tenant pass it explicitly. A configurable default registry and shared-actor cross-tenant delegation remain separate work. This version deliberately has no permissive platform bypass flag.

The email_runtime database role grants the public commands, historical reader and enrollment only. It denies raw table access and direct execution of internal helpers, administrative constructors and legacy public constructors. The role is a reference capability for a trusted backend, not authentication for end users or a complete permission profile for every existing application. Contact-level/privacy authorization still belongs to the application/security boundary before invoking it. Do not combine the role with module modification, ownership or impersonation privileges.

## State, identity and action semantics

Existing-root writes take an exclusive root lock before first allocation and retain it through completion. Late roots reject a larger current dbrow_version before child mutation. The bump helper reasserts ordering and creates one spine row. Repeated calls validate expected_entity_version against the unit-entry revision, including entry version 0 for a newly constructed contact.

The serializable reader takes a shared lock on that same clustered root key before history. Both barriers name the clustered index because lock hints can otherwise protect a covering index's keys ([SQL Server table hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table)). Starting the writer with only UPDLOCK admitted the reader before child mutation in a regression, allowing a later lock-upgrade deadlock. XLOCK closes that interval; the test now verifies blocking before mutation and successful reading after release. This deliberately blocks same-root historical reads for the write unit's duration, including no-op validation. A snapshot-based provider/read profile could reduce that cost later. It does not eliminate all possible multi-root or catalog deadlocks.

History changes only within the guarded current unit. State at entry is derived from the preceding child snapshot, allowing UPDATE→DELETE→restore to finish as UPDATE, or absent→insert→updates to finish as INSERT. Insert/delete leaves no fictitious committed child snapshot, while its action evidence remains. Restore after a previously committed deletion records new presence with an INSERT snapshot and a distinct restore action. A real change/revert can leave a redundant UPDATE snapshot; a simple equal-value update allocates nothing.

The entity_child_sequence counter is scoped to root/family and protected by the root lock. contact_email_identity retains each issued committed child identity and its creation version, even when creation/deletion cancel in one unit. This supports explicit restoration, prevents committed deleted IDs from being recycled, and provides a small identity set for reconstruction seeks. It costs one retained row per issued child, plus a root/family counter; it is not a revision UUID or a generic touched-row finalization registry. Rolled-back identities are provisional and may be reused.

Typed contact_email_action rows preserve the value/location/visibility used by every effective email command, ordered through a per-unit ledger action counter. The history table stores final touched-row state; the action table preserves meaningful intermediate states. payload_version is 1. show_in_timeline records the old suppression intent without deleting audit evidence. The current reader exposes these actions directly; this implementation does not synthesize duplicate entities.event rows for each action or integrate an external legacy UI event feed.

An email value may belong to multiple associations, including different locations on one contact. Dictionary deduplication is not child identity or request idempotency. Explicit business rules restricting duplicate associations can be layered on later. Updating a contact email does not automatically change security.user.email, email confirmation, login or recovery credentials; those have a separate security workflow.

## Exact catalog identity and widths

Email supports 256 UTF-16 code units and location 100. Public parameters accept NVARCHAR(MAX) so validation rejects excess length rather than silently truncating it at the procedure boundary. Contact/user construction forwards those widths to the common writer. NULL location explicitly clears it on replacement; is_public is supplied explicitly and defaults to false on insertion. Syntax validation/normalization beyond these storage contracts is a product policy, not silently imposed by the dictionary.

Exact uniqueness is (binary UTF-16 value, byte length), with matching predicates on both. Besides the earlier BIN2 trailing-space finding, a local probe in this implementation found CONVERT(VARBINARY(512),N'A') equal to the binary representation of N'A'+NCHAR(0). Binary comparison alone was therefore insufficient. The regression suite distinguishes case, trailing spaces and trailing zero code units for both value families.

Read existing immutable values without update locks; on a miss, perform a locking recheck and insert under the unique constraint. Tests demonstrate concurrent miss deduplication and an existing-value hit committing on another root while the first root's unit remains open. Distinct misses can still contend on index ranges; no universal no-deadlock or zero-contention claim is made.

## Reconstruction and performance boundary

contact_emails_as_of enumerates retained child identities and seeks each latest applicable snapshot through the (contact_id, ordinal, dbrow_version DESC) index. It does not need to scan every revision of each child to choose its final state. The public reader returns historical root labels, email state, an optional email diff and action evidence **for that revision**, including actor/time. It does not substitute current names or load the entire action timeline on each read.

The first SQL reader uses an owned, short SERIALIZABLE transaction and reads the root first. This avoids requiring ALLOW_SNAPSHOT_ISOLATION configuration and supplies a consistent multi-result read, at the cost of potentially blocking writers. Ambient read transactions are rejected. A snapshot adapter remains a reasonable measured optimization; this is an explicit implementation refinement to ADR 0002's recommended snapshot read. The C# reader consumes command completion after all result sets so a late error is not mistaken for success.

This fresh-schema implementation has native history from creation. Legacy unknown periods are not automatically backfilled or certified; the migration coverage manifest in ADR 0004 remains required before accepting those sources. The email reader is not a complete contact reconstruction across unimplemented phone/address/role histories.

Indexes, retained identities and typed actions add writes/storage. Tests cover concurrency behavior and reconstruction correctness, not a millions-of-rows capacity benchmark. No partitioning, compression policy, generic SQL translator, hash chain or distributed worker was added.

## Bootstrap prerequisites included here

The old tenant constructor hard-coded ledger 1, and the C# System bootstrap mixed NEXT VALUE FOR, MAX()+1 and hard-coded history references. Leaving those writers unchanged would undermine the new global uniqueness/ownership assumptions on a fresh installation.

They now use the shared allocator. data.tenant_insert is a trusted administrative constructor taking a resolved actor_entity_id; its former unused logical_key and GUID created_by interface is removed, avoiding a reverse data→entities actor lookup. It returns tenant_id/dbrow_version and requires a separate unit for the new tenant. No repository call sites used the removed parameters.

SecurityDatabaseSchemaBuilder calls security.system_user_bootstrap. That protected operation serializes bootstrap attempts, preserves System ID 1/public key and user type 4, uses the actual tenant ID, and creates the root, contact, user, spine and available payload history atomically. Repeated bootstrap validates the existing identity/history instead of inserting another unit or silently repairing a conflict. Explicit IDENTITY_INSERT reservation is confined to this System constructor; general entity allocation remains IDENTITY for now.

Tests exercised the real C# builder with another tenant already occupying local ID 1, repeated bootstrap, subsequent tenant creation and the first ordinary contact/email. This is not an assertion that every unrelated schema-builder path or future user lifecycle is complete.

## Verification and next review

Run instructions and executable scope are in the [test guide](../email-reference-family.md). The suite loads actual schema/procedure files into uniquely named disposable databases, invokes the C# adapter and actual System builder, and removes the databases afterward. No customer database or sibling project is changed.

The initial suite missed the application seed transaction: the user subsequently reported error 51102 during CreateSchema. A new regression reproduced that exact exception through OvermindSqlDatabaseManager before the seed fix. It now runs the actual CreateSchema → DropSchema → CreateSchema path, checking the default tenant/System identity, seeded user and email history/spine/action evidence after each creation. The full suite passed after explicit seed enrollment. This covers the application's registered resources and minimal seeds; it is not an atomic schema deployment or an upgrade of an existing schema.

The next independent review should focus on private guard grants/lifetimes, native allocation discovery and recovery assumptions, history state transitions, child identity retention, actor/tenant boundaries, constructor integration, reconstruction isolation and test omissions. Review the concrete implementation before copying it to phone. Preserve the broader open questions in ADRs 0002–0004 rather than treating this reference family as completion of the whole foundation.
