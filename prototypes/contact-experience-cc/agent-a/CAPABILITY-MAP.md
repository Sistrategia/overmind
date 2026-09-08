# Capability map — Agent A prototypes

Reference checkpoint: completed iteration 6, `7212a4c`. The checkout used for this work is one commit ahead
(`24e4bd1`), which only adds the agent brief; no production code differs. Everything the prototypes call goes
through `src/core/adapter.ts`, which labels each simulated request as **implemented**, **proposed** or
**local**. The demo drawer's "API trace" shows those labels live.

## 1. Implemented API contracts (mirrored faithfully)

| Capability | Production contract | How the prototype mirrors it |
| --- | --- | --- |
| Read current contact | `GET /api/contacts/{key}` (ReadDetail) | `SimServer.getCurrent`: profile + four families, stable ordinals, saved `displayOrder`, `isPublic`, retained deleted children, revision token. 403 without `read_detail`. |
| Read a revision, compare, actions | `GET /api/contacts/{key}/revisions/{v}?compareEntityVersion=` (ReadDetail + ReadHistory) | `getRevision`: state reconstructed from stored per-revision snapshots, diff between two snapshots, ordered actions of that unit. 409/`history_unavailable` when demo coverage is switched off; values are never borrowed from the current state. |
| Directory projection | `GET /api/contacts/{key}/directory` (ReadDirectory) | `getDirectory`: public live children only, saved order kept with gaps, private/deleted roots → 404, no profile detail, no history. Used for the front-desk persona. |
| Atomic Save | `POST /api/contacts/{key}/save` with `expectedEntityVersion` and an ordered `commands` array | `save`: grant check (`edit`, plus `delete`/`restore` for root commands), unit-entry token check → 409/`conflict` with `currentEntityVersion`, up to 256 commands, ordered application with whole-unit rollback on the first failure (400 with `commandIndex`), identical replace = no-op, entirely ineffective Save = same revision and `auditDbrowVersion: null`. |
| Command kinds | `profile.replace`, `contact.delete/restore`, `{email,phone,web_link,address}.{insert,replace,delete,restore,move}` | Same discriminators and field shapes; `Replace` is a full replacement (omitted label clears, `isPublic` defaults false). `contact.create` exists only as internal creation evidence for revision 1. |
| Child identity and order | Stable ordinal; first saved position is primary; insert/restore append; delete closes the gap; move to 1 selects the principal | Enforced in `src/core/engine.ts`; unit tests in `tests/`. |
| Address values | Shared immutable value; correction replaces the association | Address catalog interned by exact fields; Norte Taller keeps the old value when Lina's postal code is corrected; inspector shows the value id and other users. |
| Phone input | `PhoneInput { number, defaultRegion?, areaCode? }`, explicit region for national/split input | Same wire shape. Parsing is **simulated** locally (see §2). |
| Int64 stamps | `dbrow_version` and other Int64 values are decimal strings | Unit ids start above 2^53 (`9007199254741001`) and stay strings end to end; the technical stamps panel shows them. |
| ProblemDetails | `code`, `traceId`, `automaticRetryAllowed: false`; 400/401/403/404/409/500 split, `commit_uncertain` distinct from `storage` | `Problem` objects with the same fields; no automatic retry anywhere; uncertain commit offers investigation ("check current revision") instead. |
| Provisioning evidence | Iteration 6 creates person + account in one unit; no secret in history | Seeded provisioning units for the five personas carry `loginName` and `initialRoleId` only. |

## 2. Locally simulated behaviour (honest stand-ins)

| Behaviour | Where | Notes |
| --- | --- | --- |
| Server, storage, clock | `src/core/server.ts` | `localStorage`, namespaced per variant and tenant. Demo clock starts Thu 10 Sep 2026 12:00 CST and advances in real time; recording times are monotonic. |
| Phone parser | `src/core/phone.ts` | Recognises +52/+1/+34/+44/+57/+54 with plan lengths, generic international otherwise, MX national/split input with explicit context. Production uses libphonenumber-csharp 9.0.38 inside command admission. The interpretation panel says so. |
| Personas as claims | `src/core/personas.ts` | Five personas stand in for issuer-signed `overmind_contact` grants. `activity` is not a real grant (see §3). Per tab; a second tab may hold a different persona. |
| Collaboration | `src/core/collab.ts` | `BroadcastChannel` (storage-event fallback) between tabs of one browser profile: presence (persona, contact, area, editing flag, draft count — never values), committed notifications, reset. Proves local prototype interaction only; not deployed infrastructure, not CRDT editing. |
| Conflict reconciliation | `src/core/draft.ts` | Field-level three-way merge of a stale draft against the concurrent revisions: combined when fields differ, explicit choice when the same field changed, drop/restore when the item was removed. Rebased draft is sent as a new Save against the current revision, only on click. |
| Sidekick | `src/core/sidekick.ts` | Deterministic intent matcher over live fixture state. No external model, no key. Answers carry "What I used". Write proposals are staged through the same draft/Save path; read/navigation actions are immediate. Refuses to invent facts and refuses writes for read-only personas. |
| Uncertain commit | `src/core/adapter.ts` | Two demo modes: acknowledgement lost after commit, request lost before commit. The client symptom is identical; "check current revision" reveals which. No retry, no rollback claim, no durable receipt. |
| Operational events | `SimServer.logOperational` | Rejected stale Saves, uncertain acknowledgements and sidekick actions are recorded in a separate category and shown with a distinct source; they are not business audit rows. |

## 3. Proposed backend work (no production endpoint today)

| Seam | Prototype path | What production would need |
| --- | --- | --- |
| Contact listing/search | `GET /api/contacts?search=` (`listContacts`) | The separately tracked discovery deliverable: paginated listing with tenant scope and visibility rules. |
| Tenant activity explorer | `GET /api/tenant/activity` with `actor`, `contact`, `family`, `from`, `to`, `q`, `source` | A read over the allocation ledger + per-family action tables joined to actor and root, with an explicit grant (`activity` here). Must keep operational/security events out of the business audit or clearly separate them. |
| Audit unit detail | `GET /api/tenant/activity/units/{dbrow_version}` | Actor, recording time, affected root(s), ordered actions, correlation id. Cross-contact batches would be separate administrative units, never the single-contact Save. |
| Presence | BroadcastChannel | A presence service (or SignalR hub) keyed by tenant/contact; awareness only. |
| Sidekick runtime | Local engine | A tool-calling assistant with read tools bound to the same grants and a write tool that can only stage commands for the person to Save. |
| Draft persistence | `sessionStorage` per tab | Optional server-side drafts if cross-device continuity is wanted; not required by the current contract. |

## 4. Trust and permission assumptions

- Grants come from the persona, standing in for signed claims; the SQL layer's independent actor/tenant checks are assumed, not re-implemented.
- `read_detail` shows private channels and deleted children to the authorized caller; `read_directory` alone shows the public projection only; history needs `read_detail` **and** `read_history`.
- Tenant is resolved by the host and only displayed; there is no tenant switcher or login flow.
- Presence never carries field values or drafts; only the area being edited and a count.
- A Save is admitted only with the exact unit-entry revision; a stale draft is reconciled by a person, never replayed.

## 5. Unsupported or out of scope

- Contact creation and root delete/restore have engine support but no everyday UI (the API allows them; the brief did not require screens).
- Multi-contact administrative batches are not modelled; the activity view only shows single-contact units and provisioning units.
- No account lifecycle, relationships, groups, geographic catalog search or customer data migration.
- Historical coverage gaps are simulated with one switch (before revision 2), not a real coverage model.
- Two-tab collaboration works within one browser profile; it is not a multi-user backend demonstration.
