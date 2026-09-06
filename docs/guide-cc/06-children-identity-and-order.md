# 6. Children: identity and order

Previous: [5. History as final state](05-history-as-final-state.md) · [Index](README.md) · Next: [7. Shared values](07-shared-values.md)

## Ordinal is an identity

In the old code `contact_email.ordinal` was both the child's number and its position. The insert used `MAX(ordinal) + 1` over the live rows, so when the last email was deleted its number was free for the next one. History keyed by `(contact_id, ordinal)` then told two different emails' stories under one number.

Now an ordinal is issued once and kept forever in `contacts.contact_email_identity`:

```
contact_id  ordinal  tenant_id  created_version
   4711        1        1          1030
   4711        2        1          1187      -- deleted later; the row stays
   4711        3        1          1402
```

The next ordinal is `MAX(ordinal) + 1` over the *identity* table, under the root lock, so a committed identity is never reused. A rolled-back unit takes its provisional identity with it, and that number may be reused; a committed one may not. Live rows, history rows and action rows all reference the identity table, so a history row can never name a child that never existed.

Retained identity is also what makes **restore** possible: `email_restore` re-creates a currently absent identity with the values you supply, appends it to the list and records a `restore` action. A committed insert followed by a delete leaves an identity with actions but no history row; restoring it later works and is recorded as new presence.

## Position is a saved list

The product rule you confirmed is simple: the first email in the saved list is the principal, shown on the card and preselected as the default. There is no separate flag. `contact_email.display_order` holds the position, dense and one-based within the contact:

- insert and restore **append**;
- update keeps the position;
- delete closes the gap;
- `email_move` moves a child to a position and shifts the ones in between; `MakeEmailPrincipalAsync` is move to position 1;
- moving to the current position is a no-op.

Every shifted sibling receives this unit's stamp and a final history snapshot (through `contacts.contact_email_history_sync`), so a revision can be reconstructed with its order. The writer verifies after each change that positions are still a dense unique list (51311). There is deliberately no unique constraint on `(contact_id, display_order)` because set-based shifts pass through transient duplicates inside one statement; the root lock and the final check enforce the rule at the API boundary.

Action payload version 2 records `previous_display_order` and `display_order`, and the reader's diff reports a pure position change as `move`.

## What the views do now

`contacts.contact_view` and `entities.entity_view` no longer join on `ordinal = 1`. They pick the first live email by `display_order`:

```sql
OUTER APPLY (SELECT TOP(1) * FROM contacts.contact_email ce
             WHERE ce.contact_id = c.contact_id ORDER BY ce.display_order, ce.ordinal) AS ce
```

This was a review finding: with permanent identities, deleting the first email left the card empty. Phone and address will need the same treatment when they are ported; their views still say `ordinal = 1` today.

## Visibility

`is_public` stays on the association as an audited attribute with a restrictive default. Contact creation writes the first email as private and hides its own timeline entry; the action row still records it.

## Where your old code differs

- One column did two jobs; now identity and position are separate columns with separate rules.
- Delete used to be able to recycle a number; now it never does.
- "Primary" was implied by the number 1; now it is explicitly position 1 of a saved list.

Next: [7. Shared values](07-shared-values.md)
