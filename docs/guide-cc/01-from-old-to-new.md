# 1. From your design to this one

[Index](README.md) · Next: [2. The audit unit](02-the-audit-unit.md)

## What you built, in your own terms

Across four generations of the framework the audit layer had a stable shape:

- A **transaction clock** called `dbrow_version`, one value per business write, stamped on every live and history row the write touched, recorded in a ledger table with the operation, the time and the actor.
- A **history table beside every live table** (`contact_history`, `contact_email_history`, and so on), written in the same transaction as the change.
- An **aggregate version** on the entity row (`entity_version`) that a user could see: "this is version 3 of the contact".
- **Events** that explain what happened in human terms, linked to the clock value.
- **Shared value tables** for names, emails, phones and locations, so a value is stored once and referenced by id.
- **Soft delete** vocabulary (`deleted`, `deleted_by`, operation codes for delete, undelete, erase) that no generation fully implemented.

Customers loved the result because they could see who changed what and when, compare versions, and recover mistakes. That is the differentiator, and nothing in the remake removes it.

## What the reviews found in the old mechanics

The design was right; some of the mechanics under it trusted convention where they needed enforcement. These are the specific things the analysis, the source intake and the reviews identified in the earlier code, each of which the remake now closes:

| Old mechanic | Problem | New mechanic |
| --- | --- | --- |
| `COALESCE(MAX(dbrow_version) + 1, 1)` per tenant | Two concurrent writers read the same maximum and collide, or one waits on the other for the whole transaction | One global `SEQUENCE`, gaps accepted ([Chapter 3](03-clocks-and-versions.md)) |
| Passing `@dbrow_version` between procedures with only "the ledger row exists" as the check | A number from a committed transaction could be reused later and make two commits look like one | Enrollment and per-unit ownership proven by transaction-owned locks ([Chapter 2](02-the-audit-unit.md)) |
| Writing children, then checking the root's version afterwards | A slower transaction could stamp an older number onto a root that a newer one had already changed | Root lock before allocation, and a check that rejects a root already stamped with a newer number ([Chapter 4](04-locking-and-order.md)) |
| One history row per child per unit, inserted | A second change to the same child in the same transaction hit the primary key | History rows are *upserted* within the current unit and record the final state ([Chapter 5](05-history-as-final-state.md)) |
| `MAX(live ordinal) + 1` for a new child | Deleting the last child let its number be reused by a different child, so history keyed by ordinal lied | Retained identities: an ordinal is issued once and never reused after commit ([Chapter 6](06-children-identity-and-order.md)) |
| `ordinal = 1` means the primary email | Once ordinals are permanent identities, the first one can be deleted and position no longer follows the number | A separate saved `display_order`; position 1 is the principal ([Chapter 6](06-children-identity-and-order.md)) |
| Shared values compared with the database collation | Case and accents merged or not depending on the server; trailing spaces were invisible | Exact identity on the UTF-16 bytes plus their length ([Chapter 7](07-shared-values.md)) |
| Unknown actor falls back to System User (`COALESCE(…, 1)`) | A bug or a bad GUID produced a legitimate-looking ledger row attributed to System | Strict actor resolution; unknown actors fail ([Chapter 8](08-actors-tenants-and-users.md)) |
| A user created through the contact constructor stayed typed as a contact | The strict resolver then refused that user as an actor | Construction and promotion set the user type and record it in history ([Chapter 8](08-actors-tenants-and-users.md)) |
| History rows snapshotted from views | A view can compute or coalesce values; history must record physical state | Snapshots read the base tables through one helper |
| Foreign keys created `WITH NOCHECK` | Orphans possible | Enforced constraints everywhere the remake touches |

None of these is a criticism of the idea. They are the places where the old code said "callers will do the right thing" and the new code makes the database check.

## Words that changed meaning

The vocabulary is the hardest part when your mind has years of the old one. Keep this table nearby; the [glossary](glossary.md) has the full list.

| You used to say | Now say | Because |
| --- | --- | --- |
| "the transaction" (a `dbrow_version`) | **audit unit** | The unit is the whole controlled thing: the SQL transaction, its enrollment, its one ledger row, its actor and tenant. `dbrow_version` is just the number that names it. |
| "the clock" | **allocation id** | The number says which unit a row belongs to. It is not a timestamp and not a commit order. Chapter 3 explains why that is fine. |
| "entity_history" | **root payload history** | In CFUS, `entity_history` was the spine (entity, version, clock). Here the spine is `entity_version_history`, and `entity_history` holds the root's own column values, now including the entity type. |
| "history row" | **final state of a touched row in a unit** | One row per unit per touched row, holding the values as they were when the unit committed. |
| "the event" | **action** (for machine-readable evidence) and **event** (for the timeline) | `contact_email_action` records every effective command with the exact values used; `entities.event` remains the renderable timeline entry. |
| "ordinal" | **child identity** | Permanent id of a child within its root. Position is `display_order`. |
| "primary" | **principal** = position 1 of the saved list | No separate flag to keep in sync. |
| "created_by = System" | **explicit System attribution** or an error | System only when a named process really did it, such as installation. |

## What did not change

You should recognise these immediately, because they are yours:

- `data.dbrow_version` is still the ledger, with the primary key `(tenant_id, dbrow_version)`.
- Every live and history row still carries `dbrow_version`.
- `entities.entity` still carries `entity_version`, and `entity_version_history` still maps a version to the unit that produced it.
- History tables still sit beside live tables with the same columns plus the row operation.
- Shared values are still interned and referenced by id.
- Events still exist and still link to the unit.
- The four layers are still `data → entities → contacts → security`, in that build order.

## How the rest of the book is organised

Chapters 2 to 4 are about the *transaction*: how a unit starts, how it is numbered, and how it is ordered. Chapters 5 to 7 are about the *rows*: history, children and shared values. Chapter 8 is about *people*: actors, tenants and users. Chapter 9 is about *reading it back*. Chapter 10 is the recipe you will follow for phone and address. Chapters 11 and 12 are references.

Next: [2. The audit unit](02-the-audit-unit.md)
