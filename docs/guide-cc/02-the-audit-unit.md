# 2. The audit unit

Previous: [1. From your design to this one](01-from-old-to-new.md) · [Index](README.md) · Next: [3. Clocks and versions](03-clocks-and-versions.md)

## The idea in one sentence

One business transaction is one **audit unit**: one SQL transaction, enrolled once, with at most one ledger row, one actor, one tenant, and everything it touched stamped with that ledger row's number.

That is exactly what your `@dbrow_version` INOUT parameter was trying to express when a procedure created a contact and its emails together. The difference is that the database now enforces the boundaries instead of trusting each procedure to pass the number correctly.

## The three steps of a unit

```
BEGIN TRANSACTION                 -- the SQL transaction, owned by whoever opened it
EXEC data.audit_unit_begin        -- 1. enroll: "this transaction is an audit unit"
... first write needs a number ...
EXEC data.dbrow_version_ensure    -- 2. allocate: one ledger row, one number, once
... more writes join the same number ...
COMMIT                            -- 3. the owner completes; nothing else may
```

**Enrollment** (`data.audit_unit_begin`) takes a lock named after the current engine transaction, in a private namespace only owner-executed procedures can use. It allocates nothing. It says "this transaction has opted in". A raw `BEGIN TRANSACTION` followed by a call to an audited procedure now fails with error 51102, because the transaction never enrolled. This was the cause of the one integration incident during the remake: the application seed ran inside the resource runner's transaction and had not enrolled.

**Allocation** (`data.dbrow_version_ensure`) is your old helper, hardened. With a NULL number it first *discovers* whether this transaction already allocated (see below) and joins that; otherwise it takes the next sequence value, takes a second private lock named after that number, inserts the ledger row, and returns the number and the server time. With a non-NULL number it *asserts* that this transaction owns that very allocation; it never accepts an old committed number. The ledger row records the business operation, the actor, the caller's `modified` time and the server's `recorded_at`.

**Completion** belongs to whoever began the transaction. Helpers never commit or roll back. On any error the unit is invalid as a whole; the owner rolls back everything.

## How ownership is proven

This is the part that replaces "the ledger row exists" as the check. Two facts about SQL Server application locks make it work: a lock with `@LockOwner = 'Transaction'` disappears exactly when the transaction ends, and `APPLOCK_MODE` reports only what the *current* transaction holds. So:

- Allocation takes an exclusive lock on `overmind:version:<number>`.
- `data.audit_unit_assert` looks for a ledger row whose `allocation_transaction_id` equals the current engine transaction id **and** whose version lock is held by this transaction. The id is only an indexed hint; the lock is the proof.
- A supplied number that does not match that discovery fails with 51103. A number from a committed transaction has no lock any more. A number forged with matching hints in another database has no lock in *this* database. Session context, which any user can set, is not consulted at all.

The application principal cannot take these locks itself (the namespace requires `dbo`), cannot execute the internal helpers directly, and cannot write the ledger. The reviews probed savepoints, restarts, restores, cross-database calls and forged hints; the mechanism held in every case.

## Joining: the NULL rule

Inside an enrolled unit, a NULL `@dbrow_version` means "join what this transaction already allocated, or allocate the first one". That is why a chain such as `user_insert → contact_insert → entity_insert → contact_email_write` produces exactly one ledger row even though each procedure calls the helper. You can still pass the number explicitly through INOUT parameters, and the public procedures still return it, but the correctness no longer depends on every layer plumbing it perfectly.

One unit, one actor: a nested call whose actor differs from the ledger row's actor fails with 51005. If you need two different actors, you need two units.

## From C#

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, actorPublicKey, tenantPublicKey);
var added  = await unit.InsertEmailAsync(contactPublicKey, expectedEntityVersion, "a@example.test", "Home");
var moved  = await unit.MakeEmailPrincipalAsync(contactPublicKey, expectedEntityVersion, added.Ordinal);
await unit.CommitAsync();
```

`SqlAuditUnit` owns a private connection and a READ COMMITTED transaction, enrolls on `BeginAsync`, fixes the actor and tenant for its lifetime, serializes its calls, and invalidates itself on the first failure or cancellation. Disposing without `CommitAsync` rolls back. Results are provisional until commit. If the commit itself fails, you get `AuditUnitCommitUncertainException` with the provisional number as a correlation hint: it means "unknown outcome, do not blindly retry", not "rolled back".

## From SQL

```sql
SET XACT_ABORT ON;
DECLARE @v BIGINT = NULL, @ordinal INT = NULL, @revision INT = NULL;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC data.audit_unit_begin;
    EXEC contacts.contact_email_insert @contact_public_key=@contact, @created_by=@actor, @tenant=@tenant,
         @expected_entity_version=@expected, @email_address=N'a@example.test',
         @ordinal=@ordinal OUTPUT, @dbrow_version=@v OUTPUT, @entity_version=@revision OUTPUT;
    EXEC contacts.email_update @contact_public_key=@contact, @modified_by=@actor, @tenant=@tenant,
         @expected_entity_version=@expected, @ordinal=@ordinal, @email_address=N'b@example.test',
         @dbrow_version=@v OUTPUT;
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
```

A standalone call (no ambient transaction) opens, enrolls and commits its own transaction, so a single command still works the way your old procedures did.

## Seeds and batches

Embedded business batches such as the installation seed run through `SqlDatabase.RunLocalStoredAuditCommands`, which opens one READ COMMITTED transaction, enrolls it, runs the batch and commits or rolls back. The ordinary `RunLocalStoredCommands` remains for DDL, which must not enroll because early scripts create the helpers themselves. If a future seed calls a constructor through the ordinary runner, it will fail with 51102; that is the guard doing its job, and the fix is to use the audited runner.

## Isolation profile

Writers run under READ COMMITTED, with or without the database option `READ_COMMITTED_SNAPSHOT` (the Azure SQL Database default). Enrollment and every ownership assertion check the session's isolation level and reject anything else with 51106, so a caller cannot enroll and then switch to SNAPSHOT. The reference suite runs in both profiles.

## What to unlearn

- "If the ledger row exists I can reuse the number." No: only the transaction that allocated it can.
- "A raw transaction plus my INOUT parameter is enough." No: enroll first.
- "The helper will fall back to System if the actor is unknown." No: the actor is resolved before the unit allocates, and unknown actors fail. Chapter 8.

Next: [3. Clocks and versions](03-clocks-and-versions.md)
