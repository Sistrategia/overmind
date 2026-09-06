# 4. Locking and order

Previous: [3. Clocks and versions](03-clocks-and-versions.md) · [Index](README.md) · Next: [5. History as final state](05-history-as-final-state.md)

## The one rule

**Lock the root before you allocate.** Every write to an existing aggregate takes an exclusive lock on its `entities.entity` row first, and only then asks for or joins a unit number. The lock stays until the transaction ends.

Why this matters: a slower unit could otherwise allocate 100, be overtaken by a unit that allocates 101 and commits a change to the same contact, and then stamp 100 onto a later state. The spine would show version 5 at 101 and version 6 at 100, and "latest at or below the bound" would return the wrong rows. With the lock, a unit that wants the contact must wait for the one holding it, so the numbers stamped on one aggregate's history always increase with its revisions.

The helper is `entities.entity_write_lock`:

```sql
EXEC entities.entity_write_lock @entity_id, @tenant_id, @expected_entity_version,
     @dbrow_version OUTPUT, @entity_version OUTPUT;
```

It takes `XLOCK, HOLDLOCK` on the clustered key, confirms the entity exists in the tenant and is neither deleted nor locked, and validates the caller's expected version. If a unit number is already known, it also checks the root's stamp against it.

## Late roots

The rule above assumes you know the root before allocating. Sometimes a nested procedure discovers a second aggregate after the unit already has a number. The design does not forbid that. It checks instead: if the newly locked root already carries a number *greater* than the unit's, another unit has committed a change to it in between, and continuing would break the ordering. The write fails with 51204 and the caller retries the whole unit. If the root's number is lower, the unit may proceed. `entity_version_bump` re-asserts the same condition with a conditional update, so the invariant is checked where the spine row is written, not only where the lock is taken.

Two units that lock two roots in opposite order can deadlock. SQL Server picks a victim (error 1205) and the application retries that unit. The review reproduced it: one unit committed, the other was the victim, both roots advanced exactly once. Lock known roots in ascending `entity_id` to avoid the common case; accept the retry as the safety net.

## Expected versions come from unit entry

Optimistic concurrency uses `entity_version` as the token, exactly as your v1 design intended. The token is required for existing roots (NULL fails with 51206), and it refers to the version *as the unit found it*. If the same unit has already bumped the root, the helper derives the entry version from the spine, so repeated calls inside one unit keep passing the same token they started with. A newly created root is at entry version 0 within its creation unit, which is how a constructor can add the first email with `@expected_entity_version = 0` and still finish at revision 1.

Two sessions editing the same contact with the same token: the first takes the lock and commits; the second, released from the lock, sees the version has moved and fails with 51206. Nothing is overwritten.

## The reader takes the same barrier

`contacts.contact_email_read` runs its own short SERIALIZABLE transaction and reads the root row first, with a shared lock on the same clustered key the writer locks exclusively. A reader arriving while a unit holds the root waits until that unit commits, then reads a consistent revision. A writer arriving while a reader holds the barrier waits for the short read. The review confirmed the exclusive lock at the *first* writer statement is what prevents a lock-upgrade deadlock between the two.

The reader's own history lookups use root-leading indexes with forced seeks, so it locks only the one aggregate's history, not its neighbours'. This was the most important performance finding of the first review, and the correction is in place.

## Isolation

Writers require READ COMMITTED (with or without `READ_COMMITTED_SNAPSHOT`); anything else is rejected at enrollment and on every assertion (51106). The reader chooses SERIALIZABLE for itself. A snapshot-isolation reader is a possible later profile once the database option is a deliberate deployment choice.

## Where your old code differs

- CFUS's email update changed the child first and checked the root afterwards. Here the root is locked first, always.
- The old optimistic guard compared clocks (`@dbrow_version <= @old_dbrow_version`). Here it compares the user-facing revision, which is the thing the client actually saw.

Next: [5. History as final state](05-history-as-final-state.md)
