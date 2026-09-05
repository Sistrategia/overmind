# ADR 0001: Centralize audit allocation while preserving optional INOUT parameters

Date: 2026-09-05. Status: accepted for this focused implementation by the user.

## Context and motivation

The same sequence-allocation and `data.dbrow_version` ledger INSERT logic existed in `entities.entity_insert`, `contacts.contact_insert`, and `security.user_insert`. Historically the copies diverged: some used unlocked tenant `MAX()+1`, while another used the global sequence. The user proposed reusing the already implemented entity insertion logic to prevent that class of drift.

By the time of this implementation, **all three active blocks already used `NEXT VALUE FOR`**. The security procedure still contained a commented maximum expression. Earlier AGENTS.md and design resume checklists were stale. This change removes duplicated mechanics; it does not claim to fix an active maximum-allocation race in the checked-in versions reviewed on this date.

The allocation decision remains a database-local global BIGINT sequence with gaps. It is not a commit clock. See [analysis v2](../dbrow_version-allocation-analysis_v2.md), [primary design](../dbrow_version-allocation-design.md), and [distribution/migration handoff](../dbrow_version-design-session-handoff.md).

## Review of the proposed INOUT delegation

GitHub Copilot correctly identified that `entity_insert` already has `@dbrow_version BIGINT = NULL OUTPUT`. A SQL Server output parameter can receive an initial value; a caller specifies OUTPUT to receive the resulting value. The mechanism can propagate through user → contact → entity without duplicating allocation SQL. [Microsoft output parameter documentation](https://learn.microsoft.com/en-us/sql/relational-databases/stored-procedures/return-data-from-a-stored-procedure)

However, the proposed deletion of both derived allocation blocks missed an existing branch:

```text
New user with no contact: user_insert → contact_insert → entity_insert
New user for existing contact: user_insert → INSERT security.user
```

The second branch never reaches `entity_insert`. With NULL input it still needs an audit entry. Updates, deletes, and association changes likewise need allocation without creating an entity. That is a present requirement, independent of future disconnected operation.

The review also treated a helper as requiring `entity_insert` to reject NULL. That is a false tradeoff: a helper can centralize mechanics while public procedures retain convenient lazy allocation.

## Decision

Introduce **`data.dbrow_version_ensure`** and invoke it from all three public insertion procedures. The name describes its two behaviors: create when NULL, validate when supplied. This refines the conversational placeholder `dbrow_version_create` so reuse checks also have one implementation.

All three public procedures retain optional `@dbrow_version BIGINT = NULL OUTPUT`. Entity insertion remains usable directly without an external allocator call. Contact and user signatures gain OUTPUT; existing callers can still omit OUTPUT when they do not need the returned value.

Each public operation establishes its audit entry before its business writes, inside its owned or ambient transaction. Nested calls pass the same variable with OUTPUT. The existing-company creation path also passes that variable. Receiving OUTPUT on a later call is not technically necessary once allocation is established, but uniform propagation makes the call-chain contract visible.

The short shared-helper call is repeated. The sequence expression, ledger INSERT, and reuse validation are not. Repeating an invocation is acceptable; repeating the implementation of its rules is the drift risk being removed.

## Helper contract

Logical signature:

```sql
EXEC data.dbrow_version_ensure
     @tenant_id = @tenant_id
    ,@actor_entity_id = @actor_id
    ,@dboperation_type_id = @operation_id
    ,@modified = @audit_time
    ,@dbrow_version = @dbrow_version OUTPUT;
```

- Requires `XACT_STATE() = 1`: an active, committable caller transaction.
- Never begins, commits, or rolls back a transaction. Errors propagate to the caller.
- Requires an existing tenant and non-NULL actor ID. Actor resolution remains in higher layers; the data layer does not acquire a dependency on entity/security tables.
- NULL input: validate operation type and timestamp, allocate through the existing sequence, insert the ledger, then assign OUTPUT. A failed INSERT does not assign the newly allocated value to OUTPUT, although the sequence value may be consumed.
- Non-NULL input: require a matching ledger row for tenant/version and matching ledger actor. Preserve the original operation type and timestamp. A nested row operation may differ from the enclosing business operation and must not redefine it.
- Allocation order is not commit order; neither contiguity nor a stable committed-history cursor is promised.

The helper is registered in `DataDatabaseSchemaBuilder.CreateSchemaFunctions()` and dropped in `DropSchemaFunctions()`. The existing SQL resource wildcard embeds its script. Layer order remains data → entities → contacts → security.

Error numbers: 51001 requires a committable transaction; 51002 invalid tenant; 51003 missing actor;
51004 missing tenant/version ledger row; 51005 conflicting actor; 51006 missing allocation timestamp;
51007 invalid allocation operation; 51008 supplied version without an ambient transaction at a public entry point.

## Transaction ownership and composition

Each public procedure:

1. Enables XACT_ABORT for its procedure scope.
2. Rejects a supplied version if no ambient transaction exists on entry.
3. Starts a transaction only when `@@TRANCOUNT = 0`, recording ownership in `@TranStarted`.
4. Calls the helper and performs its writes.
5. Commits only if it owns the transaction. The ownership flag is cleared **after** successful COMMIT, so commit failure does not prematurely lose ownership information.
6. In CATCH, rolls back only its owned transaction if one remains active, clears its local output version, and uses bare THROW to preserve original SQL error metadata.

For ambient transactions, the caller must catch failure, roll back the entire unit of work, and discard allocation context. There are no savepoints and no partial-success promise. With XACT_ABORT ON, the tested FK failure leaves an ambient transaction uncommittable until its owner rolls it back. Not every possible SQL error has identical transaction-state behavior; callers must follow the rollback contract regardless.

Replacing the old `RAISERROR(@Message,16,1)` wrappers is intentional: those wrappers lost the original number/state/procedure/line and did not honor XACT_ABORT like THROW. Clients matching error 50000 or relying on continuing after failure must be reviewed. [Microsoft XACT_ABORT behavior](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-xact-abort-transact-sql)

Example of supported composition:

```sql
DECLARE @version BIGINT = NULL;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC contacts.contact_insert
         @full_name = N'Example'
        ,@created_by = @actor_public_key
        ,@dbrow_version = @version OUTPUT;
    -- Related work receives @version while THIS transaction remains active.
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    SET @version = NULL;
    THROW;
END CATCH;
```

The example assumes an authorized, resolved actor and appropriate tenant context. It illustrates ownership, not a general multi-aggregate locking implementation.

### A supplied number is not proof of transaction ownership

Ledger existence was the original undocumented contract. It was insufficient: creating a contact under 500, committing, and later passing 500 to another operation misrepresents separate commits as one atomic operation.

This implementation rejects reuse **without any ambient transaction**, and validates tenant and actor. It does **not** detect taking an old committed version into a newly opened transaction with the same tenant and actor. Such use is prohibited by the trusted composition contract. A future transaction-bound capability/context can enforce more; no session token or engine transaction-ID machinery is introduced here.

Public callers must not expose arbitrary version reuse to untrusted application inputs. FKs prove ledger existence, not ownership. A returned version is not a commit receipt, and output variable state after an exception is not a retry protocol. Callers must explicitly reset/discard it on failure; a later rollback does not undo ordinary variable assignments.

## Metadata and bootstrap

The enclosing operation owns ledger metadata. All three current operations supply operation type 1 and preserve the existing use of `@created` for ledger `modified`. This patch does not reinterpret that value as server-recorded or commit time. Separating those clocks remains a larger design task.

Actor resolution retains the legacy fallback to entity ID 1 where unresolved. This is compatibility behavior, not endorsement of silently attributing unknown actors to System User. The helper only checks non-NULL actor IDs and consistency on reuse; it does not validate actor existence, authentication, or authorization.

Entity self-creation bootstrap still starts with System User attribution and updates ledger actor to the newly created self-actor within the same transaction. Nested ordinary writes do not update ledger metadata. The bootstrap exception remains keyed by the existing equality of actor and new entity public keys. Stronger bootstrap authorization and proof that it owns the ledger entry are deferred; the scalar version cannot establish that proof. The dedicated tests cover self-creation at IDs other than 1 as well as initial System User creation.

The existing `user_insert` fallback to the maximum tenant when resolution fails is not removed here. Tenant authorization, existing-contact tenant matching, unknown-actor fail-fast behavior, and bootstrap authorization require a separate focused review. Helper validation verifies the resolved tenant, not whether that resolution policy was authorized.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Keep three sequence/INSERT copies | Already demonstrated drift; adds repeated policy maintenance |
| Delegate exclusively to entity_insert | Existing-contact user creation bypasses it; non-insert operations also need allocation |
| Helper, with all public procedures requiring non-NULL | Unnecessary compatibility break and friction for standalone calls |
| Creation-only helper with separate repeated validation | Feasible, but ensure centralizes the reuse rule too |
| Independent committed allocator | Breaks business/ledger atomicity; reuse no longer describes one atomic operation |
| Tenant counter or hash-based replacement | Different ordering/integrity decision, unnecessary for this extraction |
| Full portable transaction context now | Larger change than required; document the enforcement gap rather than imply it is solved |

## Performance and future evolution

The helper adds a local stored-procedure call and small indexed validation reads. Reuse avoids a second allocation/ledger insert. No tenant-wide counter lock, extra ledger column, or distributed subsystem is added. The tests establish behavior, not a customer workload performance benchmark.

Centralization gives future transaction identity/provenance work a clear allocation boundary. It does **not** make distributed synchronization a one-file change: import mapping, schema transformation, deduplication, history, and source/destination ordering still need their own contracts.

For aggregate updates, existing numeric-bound reconstruction still requires protection and expected-version validation before allocation. This insertion-focused extraction is not a generic aggregate-locking implementation. Passing one version through arbitrary operations does not automatically make their ordering sound.

## Verification and scope limits

`dotnet build src/Framework/Sistrategia.Data.SqlClient/Sistrategia.Data.SqlClient.csproj --no-restore` verifies compilation/resource integration.

`python tests/sql/run_dbrow_version_tests.py --server localhost` creates a uniquely named disposable database, loads actual repository DDL and procedures, runs behavioral SQL assertions and concurrent connections, and drops only that test database. Requires sqlcmd and integrated-auth CREATE DATABASE privileges. No application database is modified.

Coverage: no-transaction rejection; allocation/reuse metadata; rollback; standalone entity; System User and non-System bootstrap; existing-contact and new-contact user creation; optional OUTPUT omission; shared company/employee allocation; wrong-tenant/actor/missing-ledger rejection; late contact/user failures; original error metadata; ambient versus owned rollback; XACT_ABORT restoration; 80 allocations over four concurrent connections.

The test fixture loads real schemas but minimal seeds. Optional phone/address/role paths, complete audit coverage of all mutable tables, caller SDK parameter configuration, migration deployment orchestration, and customer load performance are not covered by these tests. In particular, the existing-contact user path now has reliable allocation but this extraction does not add missing security history or aggregate-version bumps elsewhere.

Repository-wide search also found two distinct legacy bootstrap writers outside the three-procedure extraction:
`Scripts/Data/create_tenant_insert.sql` writes ledger version 1 directly; `SecurityDatabaseSchemaBuilder.InsertSystemUser`
contains an active maximum-based ledger INSERT and hard-coded version references despite reserving a sequence value.
Their initialization assumptions and callers require separate review. Do not claim this extraction eliminates every
direct ledger writer or every maximum expression in the repository. Fresh-database bootstrap is not validated by the
minimal-seed integration fixture, and these paths must be reconciled before claiming universal helper participation.

Executed on 2026-09-05: framework build passed with zero warnings/errors; the focused SQL suite passed on local
SQL Server 2022 Developer Edition (16.0.1190.2), including four concurrent connections. Disposable databases were
removed after each run. The initial harness run required enabling QUOTED_IDENTIFIER for repository indexes; the
runner now supplies sqlcmd `-I`. No customer database was used.

For existing databases deploy the helper first, then the three CREATE OR ALTER procedure scripts. The schema builder installs it for fresh builds; this commit does not connect to or upgrade a customer database. No new higher SQL Server floor is introduced relative to the existing CREATE OR ALTER use in entity_insert.

### Correction to earlier session notes

The earlier statement that SET XACT_ABORT inside these stored procedures leaks into the session was incorrect. Procedure-scoped SET changes are restored on return; the integration test checks this with caller XACT_ABORT OFF. The material change here is enabling it for ambient calls too, together with THROW and explicit owner rollback. [Microsoft SET statement scope](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-statements-transact-sql)

## Outcome

One allocation/reuse implementation, optional INOUT interfaces at every layer, no accidental dependency on creating a new entity, and explicit transaction ownership. Stronger provenance and ownership enforcement remain visible design work rather than hidden guarantees of a BIGINT parameter.
