# 9. Reading history

Previous: [8. Actors, tenants and users](08-actors-tenants-and-users.md) · [Index](README.md) · Next: [10. Porting a family](10-porting-a-family.md)

## One call, one revision

```csharp
var history  = new SqlContactEmailReader(connectionString);
var revision = await history.ReadAsync(contactPublicKey, actorPublicKey,
                   entityVersion: 3, tenant: tenantPublicKey, compareEntityVersion: 2);
```

`ContactEmailRevision` gives you, for revision 3 of that contact:

- the root as it was: `DisplayName`, `FullName`, `Summary`, `IsPrivate`, `Deleted`, `EntityTypeId`, and the unit's `RecordedAtUtc` and `ActorEntityId`;
- `Emails`: the list at that revision, each with `Ordinal`, `Email`, `Location`, `IsPublic`, `DisplayOrder` and the unit that last changed it;
- `Differences` from revision 2 to 3: `insert`, `update`, `delete` or `move`, with old and new values and positions;
- `Actions`: the effective commands recorded *in* revision 3's unit, with the exact values, positions, actor and time.

A revision that does not exist throws 51401; a revision whose root payload is missing throws 51402. Nothing is returned as a misleading empty collection.

## The algorithm underneath

`contacts.contact_email_read` owns a short SERIALIZABLE transaction:

1. Resolve the actor and the contact in the tenant.
2. Take the shared barrier on the root row (Chapter 4).
3. Resolve the bound: `entity_version_history` gives the `dbrow_version` for `(contact, version)`.
4. Root payload: the latest `entity_history` and `contact_history` rows at or below the bound, through root-leading index seeks.
5. Children: `contacts.contact_emails_as_of(contact, bound)` walks the retained identities and, for each, takes the latest history row at or below the bound, excluding tombstones. An identity with no history row at or below the bound is simply absent, which is exactly right for an insert that was cancelled in the same unit.
6. The diff is the same function at two bounds, joined on ordinal.
7. Actions are the rows of `contact_email_action` for that contact at that unit.

Reading the same thing from a legacy view was the L2 finding in the source intake: the old extractor joined *current* emails onto old root rows, so a current value appeared under versions that never had it. The new reader never substitutes current names, types or children.

## What it does and does not reconstruct

It reconstructs the email family and the root's own payload, with the historical type. It does not yet reconstruct phones, addresses, names or roles, because those families have no history writers yet. It reconstructs one aggregate at one revision, not the whole tenant at a point in time; Chapter 3 explains why the ledger cannot promise the latter.

For migrated data, absence of history may mean "unknown" rather than "empty". The migration design (ADR 0004) carries coverage information; the reader itself does not yet expose it.

## Cost

The read holds a shared lock on the root for its duration and blocks writers of that same contact for a few milliseconds. With the root-leading indexes in place it touches only this contact's history rows. A snapshot-isolation reader that blocks nothing is a possible later profile.

Next: [10. Porting a family](10-porting-a-family.md)
