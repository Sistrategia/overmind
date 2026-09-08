# Overmind · Agent B

Three independent runnable explorations through the **collaborative investigation** lens.
All implementation, fixtures, tests, and evidence are contained in this directory.
Neither agent A prototype directory was read or used. No production source, root package files,
SQL, authentication configuration, or existing guides were changed. Nothing was deployed or committed.

## Run

Requires Node.js 20 or newer. Tested with Node.js 24.14.1 on Windows.
There are **no dependencies to install**, no API keys, and no SQL Server requirement.

From the repository root in PowerShell:

```powershell
cd prototypes/contact-experience/agent-b
npm start
```

Or, without npm:

```powershell
node prototypes/contact-experience/agent-b/server.mjs
```

The server binds to `127.0.0.1:4318`. Keep that process running. `Ctrl+C` stops it.
For another port, set `$env:PORT = '4328'` before starting. Change the example URLs accordingly.

| Open | Route |
| --- | --- |
| Concept gallery | [localhost:4318](http://127.0.0.1:4318/) |
| **Relay** | [localhost:4318/relay](http://127.0.0.1:4318/relay) |
| **Atelier** | [localhost:4318/atelier](http://127.0.0.1:4318/atelier) |
| **Trace** | [localhost:4318/trace](http://127.0.0.1:4318/trace) |
| Captured views | [Screenshot gallery](http://127.0.0.1:4318/evidence/index.html) |

Each variant also supports `#contact/lina`, `#contact/norte`, `#history/lina/4`, and
`#activity/lina`. Revision links, browser Back, and in-product navigation update the visible view.
Filters remain in the tab when following an audit unit to its contact and returning to activity.
The three variants use separate simulated databases and separate theme/filter keys.

## Three design theses

**01 · Relay — A shared line of sight.** A Fluent-inspired, persistent team workspace: a record
editor, a compact decision trail, and a contextual sidekick occupy adjacent regions. History uses
a revision navigator beside a comparison document. Activity uses a ledger with an adjacent unit
inspector. Quick edits replace the current field section; combined edits use the same workspace.
Presence and evidence remain nearby while the user edits.

**02 · Atelier — Space to see the whole story.** An Apple-inspired contact folio, with generous
typography, a quiet sage palette, rounded groups, and translucent navigation controls. Editing opens
a focused sheet. History becomes a horizontal revision filmstrip; activity unfolds as a dated
timeline with inline unit expansion. The assistant is summoned from the floating dock. Its proposal
becomes an ordinary editing sheet with one explicit Apply & Save.

**03 · Trace — Follow the change. Find the why.** An editorial investigation board with numbered
regions, serif evidence cards, restrained paper texture, and a working-theory notebook. The current
record and decision trail share a canvas. History pairs a chronological evidence rail with the
comparison document; tenant activity groups cards into actor lanes. Audit units open a focused
evidence sheet. It is a deliberately bolder reading experience, still driven by semantic controls
and linear DOM order rather than an inaccessible draggable canvas.

These are independent web interpretations, not Fluent UI or Apple framework implementations.
Visual reference reading used [Fluent design principles](https://fluent2.microsoft.design/design-principles)
and [layout guidance](https://fluent2.microsoft.design/layout), plus Apple's official
[new software design introduction](https://www.apple.com/uk/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/).
They informed restraint, hierarchy, adaptable navigation, and the separation of navigation materials
from content. No claim is made that a specific 2026 trend is universally preferred.

## Five-minute comparison script

Use the same script in each variant. **Demo controls** is the small control at the bottom left;
on a narrow Atelier screen it is an icon. Start with **Reset this variant**, as Mariana.

1. **0:00–0:50 · Edit naturally.** Open Lina. Edit the Studio phone. Enter `312 3456`, keep
   Mexico (`MX`) and area `777`, set extension `25`, and change the label. The interpretation shows
   `+52 777 312 3456`. Cancel once to see draft separation; repeat and Save. Try an invalid email
   to see validation. Make Personal email primary and Save to see saved order change.
2. **0:50–1:30 · Save together.** Choose Edit contact / Edit folio. Change the full name, extension,
   and mailing address. Save once. Only one new revision appears. Open Norte Taller: its original
   shared mailing address is unchanged. It remains an organization with no invented employment link.
3. **1:30–2:20 · Ask history three questions.** Open history. Inspect revision 3 in **State at
   revision**. Compare revision 3 with 4. Then compare 4 with 5: **No final differences**. Switch to
   **Actions in Save**: `20 → 24`, then `24 → 20`. Revision 6 omits the deleted archive channel;
   revision 7 restores its same identity at position 3 with label Backup. Earlier snapshots still
   say Archive. Selecting history never restores old state.
4. **2:20–3:20 · Investigate with the sidekick.** Ask “What changed in Lina’s contact this week?”
   Follow an actual revision citation. Ask “Show Bruno’s phone changes”: the actor/contact/family/week
   filters select two seeded units. Open a unit and follow its revision link. Return to activity:
   filters remain. Ask “Change this extension to 25 and make the work email primary.” Inspect and
   adjust the visible proposal; **Apply & Save** commits once, or **Discard proposal** saves nothing.
5. **3:20–4:30 · Recover from conflict.** Demo controls → **Start conflict story at revision 3**.
   This resets only this concept to the conflict story and prepares Mariana's extension-25 draft.
   Use **Simulate Bruno’s update**, close controls, and Save Mariana's draft. Bruno's revision 4
   has extension 18 and label Direct line. Choose Keep mine or Keep latest explicitly, click
   **Reconcile draft**, then review and Save against revision 4. Keeping mine produces revision 5,
   extension 25, while retaining Bruno’s Direct line label. Discard is also available.
6. **4:30–5:00 · Check boundaries.** Select Rafael (read-only auditor) or Directory viewer.
   The sidekick cannot stage writes for either. The directory persona sees public current channels
   only and is refused history/activity. Select Isabel for the administrator’s tenant-wide view.
   Toggle dark mode. Use edge-state controls for loading, empty results, denial, unavailable history,
   and an uncertain next Save. Reset to restore the complete seven-revision story.

Keyboard: Tab/Shift+Tab traverse semantic controls; focus is outlined. Ctrl/Cmd+K opens the sidekick.
Ctrl/Cmd+S submits an admitted visible draft. Escape dismisses the sidekick or supporting overlay;
an unsaved edit is retained until Cancel/Discard. Editing and conflict sheets contain keyboard focus.

## Actual two-tab collaboration

1. In the first tab, use **Start conflict story at revision 3**. This sets Mariana and stages
   extension 25 without committing it.
2. Open **Open Bruno in a second tab** from Demo controls, or open
   `/relay?persona=Bruno#contact/lina` (substitute the variant). Keep the same browser and origin.
3. Bruno sees Mariana editing the phone. Edit the Office phone, set extension 18 and label
   Direct line, and Save. Bruno receives revision 4. Mariana's tab receives a refresh notice while
   keeping its revision-3 base and extension-25 draft.
4. Save in Mariana's tab. The shared local server rejects that stale version. Compare latest
   committed changes with the preserved draft, choose field values, reconcile, and Save explicitly.
5. Reset restores both tabs coherently and announces that the local draft was cleared by a demo reset.

Personas are per-tab session state; themes are explicit persistent preferences per variant. A URL
`?persona=Bruno` initializes that tab as Bruno. No browser storage contains a shared committed draft.
The Node process holds committed state. A synchronous compare-and-save step serializes writes against
the expected contact revision. BroadcastChannel carries only contact identifiers, persona names,
section/presence, timestamps, and change/reset notices. Receiving tabs fetch their own projection.
It never sends field values or private drafts. Presence expires and indicates awareness, not a lock.

This demonstrates local interaction and conflicts, **not** deployed realtime infrastructure, CRDTs,
offline collaboration, authenticated subscriptions, durable history storage, or multiple tenants.

## Comparison matrix

| Dimension | Relay | Atelier | Trace |
| --- | --- | --- | --- |
| Best fit | Editors and administrators alternating edits and investigations | Relationship teams and reviewers who prefer a focused document | Auditors and teams explaining multi-actor changes |
| Primary strength | Continuous record/evidence/assistant context | Calm hierarchy; focused edits; expressive yet restrained visuals | Decisions are visibly linked and grouped by actor |
| Tradeoff | Three-region desktop layout needs horizontal room | Sheets temporarily obscure surrounding context | Longer reading paths and less compact daily data entry |
| Everyday edit speed | Fast inline family editing | Quick edit sheet, then return to folio | Inline editing within the record lane |
| Audit readability | Compact ledger, revision list, adjacent unit detail | Dated narrative and chronological filmstrip | Actor lanes and editorial evidence cards |
| Sidekick integration | Persistent context rail | Floating assistant, proposals become sheets | Working-theory notebook alongside the evidence board |
| Collaboration clarity | Presence beside record; shared evidence remains visible | Presence above folio; explicit conflict sheet | Shared investigation context and visible decision trail |
| Narrow layout | Navigation condenses; fields stack; sidekick becomes a sheet | Folio summary condenses; dock persists; modal edit sheet | Board becomes a linear record/evidence sequence; actor lanes stack |
| Accessibility compromises | Compact metadata and a long tab order on dense screens | Glass-inspired navigation needs contrast discipline; sheets require focus management | Serif headlines and long evidence cards take more space; spatial meaning is also expressed in DOM order |

**Recommended direction: Relay as the main product workspace**, borrowing Atelier’s revision
filmstrip and focused mobile sheets, and Trace’s linked decision cards for a dedicated investigation
mode. Relay keeps source evidence near both the draft and sidekick with the fewest context changes.
Atelier is the strongest alternative when visual calm and contact review outweigh dense audit work.

## Capability map and integration seams

Reference checkpoint: completed iteration 6, `7212a4c`. Actual checkout at task start:
`24e4bd14175c3514b2f87895454817aaba868549`. The sole intervening commit adds the UI brief;
there is no material backend contract difference for these prototypes.

| Capability | Existing backend contract | What this prototype implements | Production integration work |
| --- | --- | --- | --- |
| Current contact detail | `GET /api/contacts/{publicKey}` | Fictional coherent contact snapshots | Map actual complete profile/channel DTOs and server grants |
| Quick and combined edits | `POST /api/contacts/{publicKey}/save`, expectedEntityVersion and ordered commands | One local expected-revision check, atomic draft admission, one revision, immutable old snapshots | Translate dirty fields to complete `profile.replace`, family insert/replace/move commands; retain omitted supported fields |
| Primary channel | `{family}.move` with stable ordinal and displayOrder 1 | Move the same association; dense live saved positions | Preserve server-provided ordinals and consume committed child identities |
| Address correction | `address.replace`, immutable complete value | New valueId on this association, same ordinal; no mutation of other contacts | Complete AddressInput/geographic mapping, Unicode and representation validation |
| Phone interpretation | Existing PhoneInput / PhoneParser | Small deterministic formatting/parser demonstration for full international, MX ten-digit, and MX seven-digit plus area | Use the backend parser and real numbering metadata; do not infer residence |
| Historical detail / diff / actions | `GET .../revisions/{revision}?compareEntityVersion={prior}` | Snapshots, state diff, ordered action evidence, unavailable-coverage state | Map full historical reader DTOs; keep old labels and explicit missing coverage |
| Restricted public detail | `GET .../directory` | Server-side public/live projection; no renumbering or hidden-principal promotion | Authenticate and authorize directory access; project before response |
| Listing, text search, tenant activity | No existing HTTP endpoints | Local fixed collection, filters, activity rows/timeline/actor lanes | Define authorized tenant activity and paginated contact discovery contracts |
| Audit unit detail across application activity | No tenant explorer HTTP route | One-contact committed units with actor, timestamp, actions and contact revision links | Define read-authorized audit-unit resource and historical contact navigation |
| Presence / update delivery | Not implemented by the existing API | Local BroadcastChannel awareness and refresh signals; actual Node shared state | Authenticated subscription transport, per-contact authorization, lifecycle and reconnect rules |
| Stale Save | `409/conflict`, no automatic retry | Preserved local draft, latest comparison, explicit field choice, new Save only after reconciliation | Re-read permitted current state and submit commands against its explicit revision |
| Uncertain Save | `500/commit_uncertain`, outcome unknown | Local server commits but withholds acknowledgement; UI preserves draft, blocks replay, offers evidence investigation and explicit closure | Define operational observability/recovery policy; no existing durable recovery receipt is assumed |
| Contextual assistant | No agent tool runtime | Three deterministic intents grounded in present fixture/history/filter/draft/persona | Design authorized read tools and visible write proposals; select model infrastructure separately |
| Provisioning/authentication | Existing iteration-6 provisioning and JWT boundaries | Not implemented; persona selector is a demo control | Real trusted issuer/tenant resolution and separate provisioning grants; never place credentials in these fixtures |

`/_demo/state`, `/_demo/save`, `/_demo/reset`, and `/_demo/bruno` are explicitly **local demonstration
routes**. They are not proposed names for production endpoints. The local Save accepts a constrained
demo snapshot and internally computes effective field actions. It does not claim wire compatibility
with the production command DTOs. A production mapper must send ordered complete commands, preserve
unrepresented fields, and avoid whole-list replacement. One contact is the scope of every demonstrated
Save; there is no implicit multi-contact batch.

The browser uses a single trusted fictional tenant. Editors have grants to both demo contacts;
Isabel is an administrator; Rafael can read private detail/history and tenant activity but cannot
write; Directory viewer receives public current channels without personal-name detail or audit data.
The local server enforces its demo projection and write policy. Persona query parameters are **not
authentication**. All fixture source is inspectable, including the fictional private values; this
prototype is not a security boundary. No secrets, accounts, passwords, emails to others, or external
model requests exist. Production access must derive actor/tenant from validated signed context.

Application evidence captures effective committed field changes, not rejected attempts, SQL
statements, keystrokes, or presence. UI errors and presence are deliberately outside business units.
Audit stamps stay decimal strings above JavaScript’s safe-integer range. Activity is sorted by its
recorded human timestamp; allocation stamps make no cross-contact commit-order claim.

## Verification and evidence

Run focused domain checks:

```powershell
cd prototypes/contact-experience/agent-b
npm test
```

The 12 database-free model tests cover coherent snapshots and ordered round-trip actions, retained
restored identity and labels, one-revision mixed Save, address isolation, stale writers, explicit
reconciliation, phone interpretation, whole-draft validation rejection, no-op Save, stable identities
and insertion, role projections, hidden primary positions, composed filters, and variant/reset isolation.

Browser interaction checks were executed in the Codex in-app Chromium browser through CUA's
accessibility controls and Playwright locators. The machine-readable assertion record is
[evidence/verification.json](evidence/verification.json). The browser review exercised all three
concepts’ edit/cancel/save, validation, primary moves, insertions, combined saves, snapshots/diffs/actions,
filtering, citations, unit navigation, assistant apply/discard, unsupported questions, real two-tab
conflicts, solo simulation, reconciliation/discard, personas, edge states, themes, resets, narrow
editing, keyboard focus, and responsive comparison. Browser error/warning logs were empty at review.

Visual review uses desktop 1440 × 1000 and narrow 390 × 844 viewports. The
[evidence gallery](evidence/index.html) links each contact, activity, dark history, and narrow capture.
Screenshots are actual running UI, not design renderings. The UI has CSS reduced-motion handling,
semantic controls, explicit old/new labels, visible focus, and modal focus containment. This is not
a screen-reader certification, full WCAG audit, cross-browser suite, mobile hardware test, or backend
integration test. Compact metadata is a deliberate density tradeoff to validate with users.

### Files

- `server.mjs`: loopback static server and isolated in-memory demo adapter.
- `model.js`: fixture chronology, projections, validation, changes, conflicts and filtering.
- `app.js`: three distinct compositions and shared interactive state.
- `styles.css`: three light/dark design systems, responsive layouts, focus and motion rules.
- `icons.js`: small local SVG line-icon vocabulary; no fetched assets or font dependency.
- `tests/model.test.mjs`: focused behavioral assertions.
- `evidence/`: running-UI captures, gallery, and browser verification record.

Unsupported scope includes real authentication, production network calls, account provisioning,
contact creation screens, whole-profile field coverage, live relationship edits, source geographic
catalog datasets, all international phone rules, root lifecycle operations, ongoing child deletion/
restoration commands in the editor, durable databases, arbitrary assistant requests, saved shared
investigation notes, offline mode, and remotely deployed collaboration. Deleted/restored child
**history** is fully demonstrated by the fixture. The server resets on restart, and reloading a
tab discards its unsaved in-memory draft. A deliberate demo reset clears drafts in other tabs of
that variant and announces the reset.
