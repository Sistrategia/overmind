# 5. History as final state

Previous: [4. Locking and order](04-locking-and-order.md) · [Index](README.md) · Next: [6. Children: identity and order](06-children-identity-and-order.md)

## What a history row means now

A history row is **the state of one row at the end of one unit**, tagged with the row-level operation. That is your post-write snapshot convention from v2 onwards, made precise: one row per unit per touched row, no matter how many times the unit touched it.

In the old code, a second change to the same child in the same transaction inserted a second history row with the same key and failed on the primary key. The new writers *upsert*: the first change inserts the history row for this unit, later changes in the same unit update it. The update is restricted to rows whose `dbrow_version` equals the unit's own number, and Chapter 2 guarantees that number belongs to this transaction, so committed history is never touched.

## The net-transition table

Because a unit records net effect, the operation code on the history row describes the transition from the committed state before the unit to the committed state after it:

| Before the unit | Inside the unit | History row at this unit |
| --- | --- | --- |
| absent | insert, then any updates | INSERT with final values |
| present | one or more updates | UPDATE with final values |
| present | delete (possibly after updates) | DELETE with the values just before removal |
| absent | insert then delete | **no row** at all; the identity and the actions remain |
| present | delete then restore the same child | UPDATE with final values |
| absent | insert, delete, then restore | INSERT with final values |

A change that returns a row to its entry values inside one unit may leave a redundant UPDATE row; that is accepted. An update whose values equal the current ones is a no-op: it allocates nothing and writes nothing.

## Where intermediate values live

If final state is all history keeps, what about a value that mattered for a moment, such as the email a message was actually sent to before the user corrected it? That is what `contacts.contact_email_action` is for. Every effective command writes one action row with the exact value, location, visibility and positions it used, ordered by a per-unit counter on the ledger row (`last_action_ordinal`, advanced by `data.audit_action_next`). The counter is shared by all families in the unit, so phone and email actions will interleave in the order they happened.

So: **history is state; actions are commands.** The fraud scenario that motivated the original design (change a value, act, change it back) leaves three units, three spine rows and three history rows when it spans three transactions, exactly as before. If someone did the same inside one unit, the history shows the final state and the actions show all three steps.

`entities.event` remains the human-readable timeline entry. The email constructor suppresses its own timeline entry (the contact creation event covers it) but still writes the action row, so machine-readable evidence is never dropped for presentation reasons.

## Root payload history

`entities.entity_history` holds the root's own columns, now including `entity_type_id`. All creation writers, including the System bootstrap, go through `entities.entity_history_snapshot`, which requires that the root already carries this unit's number and has its spine row, copies the live row's values, and upserts only this unit's history row. Revision 1 is labelled INSERT; later ones UPDATE. It is a construction and promotion helper today; a future delete or restore API must state its own operation rather than reuse this derivation (the second review shows what happens otherwise).

A contact promoted to a user therefore has two root history rows: the creation with the contact type, and the promotion with the user type. Reading revision 1 shows a contact; reading revision 2 shows a user. Nothing rewrites the earlier row.

## Account history

`security.user_history` records the non-secret account payload at construction: login, account email and its confirmation flag, account phone and flag, two-factor and lockout settings. Password hashes, salts and security or concurrency stamps are deliberately absent. Later account mutations will need their own writer before the framework claims full account lifecycle history.

## Where your old code differs

- History used to be inserted, once, and a second touch failed. Now it is upserted within the unit.
- The "echo" snapshot problem you named (seeing a history row where nothing changed) is handled by the statement-level no-op rule and by not writing root payload history for child-only changes.
- v4 snapshotted from views. Every snapshot here reads base tables.

Next: [6. Children: identity and order](06-children-identity-and-order.md)
