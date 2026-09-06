# Glossary

[Index](README.md)

Old word first where one existed; the chapter that explains it last.

| Term | Meaning | Chapter |
| --- | --- | --- |
| **Action** | One row in `contact_email_action` per effective command, with the exact values and positions used, ordered within the unit. Machine-readable evidence; distinct from the timeline event. | 5 |
| **Allocation** | Taking the next `dbrow_version` from the sequence and inserting the ledger row. Done lazily, once per unit, by `data.dbrow_version_ensure`. | 2 |
| **Allocation id** | What `dbrow_version` is: the number naming the unit that changed a row. Not a clock, not a commit order. | 3 |
| **Audit unit** (old: "the transaction") | One enrolled SQL transaction with at most one ledger row, one actor and one tenant. | 2 |
| **Bump** | Advancing `entity_version` by one and inserting the spine row. At most once per unit per aggregate. | 3 |
| **Dictionary** (old: catalog, shared value table) | Global immutable table of exact values referenced by id: `email`, `email_location`, `person_name`. | 7 |
| **Display order** | Saved position of a child within its root, dense and one-based. Position 1 is the principal. | 6 |
| **Enrollment** | `EXEC data.audit_unit_begin` inside an open transaction: opting the transaction in as a unit. Required before any audited write. | 2 |
| **Entry version** | The `entity_version` an aggregate had when the unit first touched it. Optimistic tokens always refer to it, even after the unit's own bump. | 4 |
| **Expected entity version** | The optimistic token a caller supplies for an existing root; the version the user saw. | 4 |
| **Final state** | What a history row records: the row's values at the end of the unit. | 5 |
| **Identity** (old: ordinal) | The permanent `(contact_id, ordinal)` of a child, retained in `contact_email_identity` even after deletion. | 6 |
| **Join** | A NULL `@dbrow_version` inside an enrolled unit that already allocated: reuse the unit's number. | 2 |
| **Late root** | An existing aggregate discovered after the unit allocated. Allowed unless the root already carries a newer number (51204). | 4 |
| **Ledger** | `data.dbrow_version`: one row per unit with operation, actor, occurrence time, server time and the discovery hint. | 2, 3 |
| **Owner** | Whoever began the SQL transaction. Only the owner commits or rolls back. | 2 |
| **Ownership proof** | The transaction-owned application lock named after the unit's number; the only thing that makes a supplied number acceptable. | 2 |
| **Principal** (old: primary) | The first email in the saved list. No separate flag. | 6 |
| **Promotion** | Giving an existing contact a user account and the user type, as one new revision, keeping earlier history. | 8 |
| **Recorded at** | Server UTC time of allocation, on the ledger. Not commit time. | 3 |
| **Restore** | Re-creating a deleted child under its retained identity with supplied values. | 6 |
| **Root** | The `entities.entity` row of an aggregate; the thing that is locked and versioned. | 4 |
| **Root payload history** (old: `entity_history` as spine) | `entities.entity_history`: the root's own column values per unit, including its type. | 5 |
| **Spine** (old: `entity_history` in CFUS) | `entities.entity_version_history`: maps `(entity, entity_version)` to `dbrow_version`. | 3 |
| **System** | Entity 1, the platform actor for named processes such as installation. Never a fallback for an unknown actor. | 8 |
| **Tombstone** | A history row with the DELETE operation; excluded by the as-of function. | 5, 9 |
| **Unit-entry token** | Same as entry version. | 4 |

[Index](README.md)
