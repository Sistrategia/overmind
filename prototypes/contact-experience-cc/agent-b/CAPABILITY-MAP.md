# Capability map — implemented contract vs local simulation vs proposed backend work

The prototypes run against a local adapter (`src/core/server.ts`) that preserves the implemented API semantics and
labels everything else. Nothing here implies the backend already implements the proposed capabilities.

## Implemented API contracts (mirrored by the local adapter)

| Capability | Contract source | How the prototype uses it |
| --- | --- | --- |
| Save: one contact, unit-entry `expectedEntityVersion`, ordered commands (`profile.replace`, `{family}.insert/replace/delete/restore/move`, `contact.delete/restore`), one revision per effective Save | ADR 0014, ADR 0015, docs/contact-http-api.md | Drafts derive an ordered command list; the adapter applies commands sequentially, allocates ordinals, appends restores, moves by 1-based position, produces globally ordered effective actions, and returns `entityVersion`, `dbrowVersion` (decimal string), `childIdentities` by command index. An ineffective Save returns the same revision and a null stamp. |
| Stale token → 409 `conflict`; missing grant → 403; validation → 400 (whole Save rejected); missing coverage → 409 `history_unavailable`; commit uncertain → 500 `commit_uncertain` (no stamp, no automatic retry); storage → 500 | ADR 0015 | Rendered as distinct outcomes in every variant. Uncertain commit keeps the draft and offers "check the current revision"; it never claims rollback or a receipt. |
| Current detail (ReadDetail), historical revision + `compareEntityVersion` (ReadDetail + ReadHistory), directory projection (ReadDirectory: public live channels only, gaps preserved, private/deleted roots 404) | ADR 0014/0015 | `readCurrent`, `readRevision`, directory fallback for personas without ReadDetail. Historical labels/values come from the stored revision, never from today's record. |
| Grants `permission:*` / `permission:<contact>` for create, edit, delete, restore, read_detail, read_history, read_directory; every required permission checked before the unit opens | ADR 0015 | Persona grants drive visible controls and the adapter's checks. Diego holds detail/history only for Lina and directory access elsewhere. |
| Immutable shared address values; correcting an association selects/creates another value; other contacts keep theirs | ADR 0012 | Address value ids are content-derived; Lina's revision 4 correction leaves Rodrigo's association on the old value. |
| Stable child ordinal + saved display order; insert/restore append; delete closes gaps; move to 1 selects the principal; new identities are not referenceable before the Save returns | ADR 0006/0014 | Drafts refuse to reorder unsaved new entries and explain why. |
| Int64 stamps as strings | ADR 0015 | All `dbrowVersion`/unit stamps are strings; shown in technical details only. |
| Provisioning evidence (login, initial role id; no secrets) | ADR 0016 | Rodrigo's promotion is an audit unit with account actions; no password/hash anywhere. |

## Locally simulated behavior (clearly labelled in the UI)

| Behavior | Where | Honest label |
| --- | --- | --- |
| Backend persistence | `localStorage` per variant (`omb:v1:<variant>:server`) | "Simulated server"; reset per variant |
| Phone interpretation (international numbers; MX/US/… local numbers with explicit country/area) | `src/core/phone.ts` | "Simulated parser — the real parser (libphonenumber, ADR 0009) runs in command admission" |
| Sidekick | `src/core/sidekick.ts`, deterministic intent matching over fixture state, grants, filters and draft | "Simulated · local · no API key"; bounded replies for unsupported questions |
| Two-tab presence and change notification | `BroadcastChannel` + `localStorage` storage events | "Presence is awareness, not a lock"; "proves prototype interaction, not deployed infrastructure" |
| Operational, agent and presence activity entries | seeded with `source` ≠ `business` | "Not part of the business audit" |
| Administrative batch touching several contacts | one single-contact Save per contact grouped by a simulated batch id | "The current API has no multi-contact Save" |
| Shared investigation notes (Thread) | stored in the simulated server, broadcast by id | "shared · prototype-local" |

## Proposed backend work (not implemented today)

| Proposal | Suggested seam |
| --- | --- |
| Tenant activity explorer: list/search audit units with filters (actor, contact, family, source, time range, text), unit detail with actions, batch grouping | New read endpoint over the ledger + action tables with a `read_activity:*` grant (proposed); source column distinguishing business units from any operational/security log; paginated. |
| Contact listing/search | Listing endpoint (the brief notes none exists); the prototypes ship a fixed contact list. |
| Presence | Lightweight presence service (who is viewing/editing which contact/section), explicitly non-authoritative. |
| Change notifications | Server push (SSE/WebSocket) of "revision committed" with contact id and revision only; clients re-read under their own grants. |
| Shared notes / threads | Separate collaboration store keyed by tenant + contact; not part of the contact audit ledger. |
| Sidekick runtime | Tool-using assistant with read tools (current, revision compare, activity query) and a single write tool that only stages a command list for human Apply; must respect the caller's grants and never see hidden fields. |
| Durable uncertain-commit receipts | Required before any automatic replay; the prototypes only offer investigation. |

## Trust and permission assumptions

- The tenant is fixed (Vértice Demo) and shown, never chosen per request; no tenant switching or authentication flow is
  invented.
- Persona selection is a demo control standing in for the issuer's signed `overmind_actor` / `overmind_tenant` and
  grants. Real deployments must map identity to database public keys through the trusted issuer (ADR 0015).
- Broadcast messages carry ids, revision numbers and awareness only; each tab reads committed state under its own
  persona's grants. In this prototype the shared `localStorage` is readable by any tab in the browser profile, so the
  isolation is a UI contract, not a security boundary.
- The sidekick's proposals are local drafts until a person applies them as one Save; read/navigation actions execute
  immediately.

## Unsupported scenarios

- Root deletion/restoration, category conversion, relationships, groups and account lifecycle are not editable here
  (the sidekick declines to stage root deletions).
- No real-time CRDT co-editing; concurrent edits are resolved by unit-entry revision tokens and explicit reconciliation.
- No pagination in the activity explorer (fixture scale).
- The demo clock for "this week" is the fixture's today (2026-09-07) so the seeded story stays coherent; new Saves use
  the real clock.
