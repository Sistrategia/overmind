# 2. Follow one Save

[← The design you already know](01-the-design-you-already-know.md) · [Contents](README.md) · [Next: Ask history a question →](03-ask-history-a-question.md)

Mariana is an authenticated operator allowed to edit Lina's contact in the Norte tenant. Lina is at revision 3. Mariana corrects Lina's work email and puts it first in the saved list, then presses Save.

The frontend interaction is illustrative; this repository implements the email operations and their saved-order behavior, not that complete editing screen.

Before Save, the list is:

| Stable child ordinal | Saved position | Address | Location |
| --- | --- | --- | --- |
| 1 | 1 | `lina@home.example` | Home |
| 7 | 2 | `lina@old-office.example` | Office |

Ordinal 7 does not mean seventh on screen. It identifies that particular child association within Lina's email family. Earlier children may have been deleted. The separate `display_order` controls the current list.

## One owner gathers the work

The backend opens a `SqlAuditUnit`, fixing Mariana and Norte as its context. That object owns the SQL connection and transaction. The database transaction is also enrolled in the audit protocol.

The backend asks for two changes: update email child 7, then move child 7 to position 1. Both calls carry the expected aggregate version **3**, which is what Mariana edited.

Using the same expected version twice is intentional. The token describes the state at entry to the unit. The second call must not be rejected because the first call already advanced the root inside their shared transaction.

Here is the corresponding C# call shape. The connection string and public keys come from the application's authorized context; this snippet assumes the example contact and children already exist.

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(
    connectionString, marianaPublicKey, norteTenantPublicKey);

await unit.UpdateEmailAsync(
    linaPublicKey, expectedEntityVersion: 3, ordinal: 7,
    email: "lina@new-office.example", location: "Office", isPublic: false);

await unit.MakeEmailPrincipalAsync(
    linaPublicKey, expectedEntityVersion: 3, ordinal: 7);

await unit.CommitAsync();
```

The update API replaces the address, location and visibility fields. Supplying a null location clears it; it does not mean “leave location unchanged.” We give Office explicitly here.

## Inside the first change

The writer validates the actor and tenant, then takes the owning entity's write lock. Under that protection it checks that Lina exists in this tenant, is editable, and is still at the expected entry revision.

It resolves the address and location through the shared immutable dictionaries. The association stores references to those accepted values. Changing Lina's address changes her association; it does not rewrite a shared string that other contacts might use.

When actual business mutation is needed, the shared allocator provides one `dbrow_version`. Suppose it returns 1052. Its ledger row records Norte, Mariana and the server recording time. The writer changes child 7, preserves its final payload in email history, advances Lina to revision 4 and records the update action.

All of this is still inside an uncommitted transaction.

## Inside the second change

The move joins the same audit unit, using 1052 again. It validates the expected entry revision 3 even though Lina's provisional current revision is now 4.

Child 7 moves to position 1; child 1 shifts to position 2. Both rows changed, so both need final history reflecting their new positions. Child 7's history for **this unit** is updated to its final address and position. Lina remains at revision 4. A second ordered action records the move.

When the owner commits, the final list becomes:

| Stable child ordinal | Saved position | Address | Location |
| --- | --- | --- | --- |
| 7 | 1 | `lina@new-office.example` | Office |
| 1 | 2 | `lina@home.example` | Home |

The first saved item is now the principal/default email displayed on the contact card. Its identity remains ordinal 7. No separate primary flag needs synchronizing with the order. Login or account email does not change as a side effect.

## What was committed?

The table below is a logical inventory for this example, not a promise about physical SQL statement or log-record counts.

| Evidence | Result for this Save |
| --- | --- |
| `data.dbrow_version` | One ledger row: unit 1052, Norte, Mariana, recording time. |
| Current entity root | Lina is now revision 4, stamped 1052. |
| `entities.entity_version_history` | One entry connecting Lina's revision 4 to 1052. |
| Current email list | Corrected address and the two final positions. |
| `contacts.contact_email_history` | Final snapshots for the two changed associations at 1052. |
| `contacts.contact_email_action` | Update and move evidence in their unit-local order. |
| Root/contact payload histories | No new payload copy is required solely because child emails changed. Earlier unchanged payload remains applicable. |

New immutable values may also have been inserted into dictionaries. Existing values can be reused.

Notice the distinction between root **revision** history and root **payload** history. Lina received a new aggregate revision because her email list changed. Her unchanged name does not need another copy merely to make that revision reconstructable.

## If something fails

If the second command fails, the C# unit is invalidated and the first command rolls back with it. There is no committed half-save with the corrected address but the old order. The ledger, spine, child snapshots and actions roll back together.

The sequence may have consumed 1052 anyway. That is one legitimate source of gaps. Returned versions and ordinals were provisional until successful commit; callers must discard them after failure.

A transaction whose commit outcome becomes uncertain is a different case from a known rollback. We discuss that boundary in chapter 4. Neither the UI nor a retry loop should assume every exception means that nothing committed.

For the user, the successful outcome remains simple: one Save produced revision 4 of Lina's contact. The additional records let us explain it later.

[← Chapter 1](01-the-design-you-already-know.md) · [Next: Ask history a question →](03-ask-history-a-question.md)
