# The Overmind audit foundation, explained for its author

A short book for moving from the audit design you built over the years to the one now taking shape in this repository. It is written for someone who already knows why `dbrow_version` exists and what a `contact_email_history` row is for, and who now needs the new pieces to fit into that mental model without reading every ADR and review.

Everything here describes the code in the working tree on 2026-09-05. Where a chapter says "the code does X", it is describing a procedure or class you can open. Where something is still a design, the chapter says so.

## How to read this

Read the first three chapters in order. They carry the new mental model. After that, pick chapters as you need them. Every chapter ends with a link to the next one, and the glossary is there when a word is unfamiliar.

| Chapter | What you will know afterwards | Time |
| --- | --- | --- |
| [1. From your design to this one](01-from-old-to-new.md) | What stayed, what changed, and the words that changed meaning | 10 min |
| [2. The audit unit](02-the-audit-unit.md) | Why one business transaction is now one *unit*, how it starts, joins and ends, and why raw `BEGIN TRANSACTION` is no longer enough | 15 min |
| [3. Clocks and versions](03-clocks-and-versions.md) | `dbrow_version`, `entity_version`, `recorded_at`, `modified`, and why gaps and out-of-order numbers are fine | 10 min |
| [4. Locking and order](04-locking-and-order.md) | The one rule that keeps reconstruction correct, and the errors you will see when it is broken | 10 min |
| [5. History as final state](05-history-as-final-state.md) | What a history row means now, how repeated changes collapse, and where intermediate values live | 15 min |
| [6. Children: identity and order](06-children-identity-and-order.md) | Why `ordinal` is an identity, why position 1 is the principal, and how the views changed | 10 min |
| [7. Shared values](07-shared-values.md) | The dictionaries, exact spelling, and how concurrent inserts are serialized | 8 min |
| [8. Actors, tenants and users](08-actors-tenants-and-users.md) | Who may act, how a user is created or promoted, and what System is for | 12 min |
| [9. Reading history](09-reading-history.md) | The reader, the as-of algorithm, diffs and actions | 8 min |
| [10. Porting a family](10-porting-a-family.md) | The recipe for phone, address and everything after | 15 min |
| [11. Errors and troubleshooting](11-errors-and-troubleshooting.md) | Every custom error number, what it means and what to do | reference |
| [12. Status and map](12-status-and-map.md) | What is implemented, what is designed, what is deferred, and where the deep documents are | 5 min |
| [Glossary](glossary.md) | Old word, new word, one-line meaning | reference |

## The whole book in one paragraph

Your audit design had the right shape: a per-tenant transaction clock stamped on every changed row, a history table beside every live table, an aggregate version the user can see, and events that explain what happened. The remake keeps all of that. What it adds is discipline around the edges where the old code trusted convention: a transaction must *enroll* as an audit unit before it may allocate a clock value, and a supplied number is only accepted if this very transaction allocated it; the root row of an aggregate is locked before allocation so that the numbers on one aggregate's history are always in commit order; history rows record the *final* state of each touched row per unit, with a separate action table for the intermediate values a business step used; child ordinals are permanent identities, and display order is a separate saved list; shared values are matched byte for byte; actors must be real, active users in the target tenant, never System by accident; and a user is created or promoted with its type and account payload recorded in history. The email family is the fully worked reference for all of this, and ordinary user construction is the second. Phone comes next by copying the pattern.

## Where this guide sits

This guide is the easy entry. The precise contracts live in the ADRs under `docs/adr/`, the reasoning in the analysis and design documents under `docs/`, and the verification in the two independent reviews and the test suite. [Chapter 12](12-status-and-map.md) maps each subject to its authoritative document.

For the current .NET test commands and migration verification evidence, start with the [testing handoff](../testing-handoff.md), updated 2026-09-06. It also contains the pending verification checklist for the returning implementation session.

Start with [Chapter 1](01-from-old-to-new.md).
