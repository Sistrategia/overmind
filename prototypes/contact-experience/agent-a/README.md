# Agent A · Contact experience explorations

Three complete, independent UI concepts through the **operational clarity** lens. All authored files,
fixtures, verification and images stay in this directory. No production code, SQL, authentication,
root package configuration or other agent’s prototype was changed. Nothing was deployed or committed.

## Run

Requires Node.js 22 or newer. The app has **zero external runtime dependencies**; no install, SQL
Server, issuer, API key, internet connection or external model is needed.

```powershell
cd D:\Code\GitHub\Sistrategia\overmind\prototypes\contact-experience\agent-a
npm start
```

From another checkout, change to its `prototypes/contact-experience/agent-a` directory instead.
The process listens only on loopback, port 4317. Stop with Ctrl+C. To change the port in PowerShell,
set `$env:PORT='4318'` before starting. Committed demo data lives in the server process, so a restart
resets it. Light is the initial theme regardless of the OS; an explicit choice persists per variant.

- [Gallery](http://127.0.0.1:4317/)
- [01 · Dispatch](http://127.0.0.1:4317/dispatch)
- [02 · Ledger](http://127.0.0.1:4317/ledger)
- [03 · Relay](http://127.0.0.1:4317/relay)

### Three design theses

**Dispatch — A clear desk. A shorter day.** The record is home. A narrow navigation rail, compact
contact switcher, editable channel rows and contextual recent history support repeated small edits.
An anchored Save bar makes the pending unit obvious. History opens a revision rail with three separate
evidence modes. A right-side assistant prepares edits or finds evidence.

**Ledger — Every change has a place.** The record is a document, and history is a reading desk.
Horizontal navigation, serif evidence headings, numbered revision folios and quiet margin notes make
investigation a first-class mode. The live record becomes an editable sheet; historical state stays
visibly read-only. The assistant works as an evidence companion, with citations beside the reading task.

**Relay — One task. Fully resolved.** The bolder concept starts with intent. Choose an email update,
phone/address update or combined edit; work in a bounded form; inspect a before/after review sheet;
then Save. History uses a horizontal revision strip, while tenant activity is a separate feed. The
assistant is a dismissible task guide sheet, and its proposal joins the same review sequence.

## A five-minute comparison script

Use this same script in each route. **Demo → Reset story** restores that variant alone.

1. **0:00 — Understand the record.** Start as Mariana. Lina is a person; Norte Taller is a separate
   organization, with no invented employment link. See private/public email and phones, saved positions,
   extension 21 and the mailing address. Open Norte Taller and return to Lina.
2. **0:40 — Make a small change.** Dispatch: Edit contact or a row. Ledger: Edit this record. Relay:
   Make a combined edit. Change the full name, extension and mailing address. Enter `312-3456` with
   explicit Mexico / area 777, or `+52 777 312 3456`. Make the work email primary. Cancel once, then
   repeat and Save (Relay: Continue to review, then Save). One Save produces one revision; existing
   child ordinals remain stable. Norte Taller keeps its original address.
3. **1:40 — Follow the evidence.** Use View evidence. Compare revision 4 with 3; inspect State at
   revision and Actions during Save. Compare 5 with 4: no final difference, but two extension actions.
   Inspect 6 and 7 to see deletion and restoration of projects email identity 3, appended at position 3.
4. **2:30 — Investigate.** Open tenant activity; filter Bruno + Phone. Select a Save, open its affected
   contact revision, then Back to filtered activity. Try text search, contact and time filters. Open
   Technical details only when a correlation/stamp is useful. These are business changes, not SQL logs.
5. **3:10 — Work with the sidekick.** Ask “What changed in Lina’s contact this week?” and follow a
   revision citation. Ask “Show Bruno’s phone changes.” It changes the view and filters. Ask “Change
   this extension to 25 and make the work email primary.” Review the ordinary editable proposal,
   adjust it, Save once, or discard it. The assistant never commits by itself.
6. **4:00 — Recover a conflict.** Demo → Start conflict at revision 3. The local draft sets extension
   25. Simulate Bruno’s update, then attempt Save. Both drafts and latest changes are visible. Choose
   Keep mine or Keep latest for the overlapping extension, Reconcile draft with latest, inspect the
   merged result, then Save explicitly. The latest label is retained. There is no automatic retry.
7. **4:40 — Switch perspective.** Choose Rafael to see read-only audit access, or Sofía for public
   directory detail without private channels/history. Elena is the administrator. Try dark mode,
   narrow width, Ctrl/Cmd+K, Escape and Tab. Demo controls also expose loading, empty results, denied
   access, unavailable historical coverage and an uncertain next Save.

For the uncertain Save, the simulated server commits and drops the success acknowledgement. The UI
does not know this: it blocks resubmission, preserves the draft and offers investigation. Compare the
latest revision; explicitly discard the local draft when done. The investigation is not a durable
receipt or proof that another request would be safe to replay.

## Real two-tab collaboration

1. Open the same route in **two tabs on the same local server**. Persona selection is per-tab
   session storage. Variant + Vértice Demo isolates shared state.
2. In the first tab, select Mariana and use Demo → Start conflict at revision 3. Leave extension 25
   unsaved. (A reset clears old drafts in other open tabs to avoid mixing story generations.)
3. In the second tab, select Bruno. Edit extension to 44 and label to “Bruno office”; Save revision 4.
4. The first tab receives a metadata-only update notification and retains its revision-3 draft.
   Attempt Save, choose a resolution, Reconcile, then explicitly Save revision 5.
5. The second tab receives the new current revision. Repeat using Discard my draft to take the
   current record instead. Presence labels show viewing/editing area; they are not locks.

An in-memory Node server serializes each revision check and Save. Server-Sent Events carry refresh
notifications without field values. Each tab fetches its own permitted projection. Presence sends
only tab identity, demo persona, contact and coarse area, refreshes every 10 seconds, and expires after
45 seconds, with immediate removal when the tab’s event connection closes. Drafts stay in memory in
the originating tab and are never transmitted as presence.
This demonstrates local interaction, not production authentication, distributed concurrency, CRDTs,
deployed collaboration or persistence. All data is fictional and same-machine personas are selectable.

## Comparison matrix

| Dimension | Dispatch | Ledger | Relay |
|---|---|---|---|
| Best fit | Contact operators with many small edits | Auditors and editors investigating changes | Occasional editors who value an explicit review |
| Main strength | Short path from a value to Save and evidence | Comfortable historical reading and comparison | Clear intent, deliberate changes, visible completion |
| Tradeoff | More persistent chrome; long records scroll | Slower repetitive edits; less compact layout | Extra review step; less efficient for expert bulk work |
| Everyday edit speed | Fastest: row → edit → Save | Fast: record sheet → Save | Deliberate: task → edit → review → Save |
| Audit readability | Structured revision rail and dense evidence | Strongest: folios, document hierarchy, generous comparison | Approachable revision strip, best for short histories |
| Sidekick integration | Right-side contextual utility | Cited evidence tray below the reading desk | Task guide sheet and normal review proposal |
| Collaboration clarity | Presence near record; conflict above form | Latest change and draft read as parallel evidence | Reconcile before proceeding through the review sequence |
| Accessibility compromises | Small metadata; busy data surface | Serif reading hierarchy may need user font preference | Horizontal revision strip needs scrolling; extra steps |
| Narrow layout | Navigation becomes horizontal, context column omitted | Margin notes removed, evidence stacks | Queue rail becomes a top bar, task guide becomes a sheet |

**Recommendation: Dispatch as the everyday foundation.** It gives the fastest practical transition
from a channel edit to its evidence. Borrow Ledger’s evidence typography and roomier before/after
reading surface, and Relay’s explicit review sheet for assistant proposals and consequential combined
edits. This is a design judgment based on the implemented flows, not a measured user study.

## Capability and integration map

Reference baseline: iteration 6, `7212a4c`. Actual inspected HEAD: `24e4bd1`; the only difference from
that reference was the addition of `docs/ui-prototype-agent-brief.md`. Current ADRs 0014–0016 and the
contact HTTP/service/history/master-plan/phone/address documents informed the adapter. No backend
test suite was rerun or backend deployment exercised by this UI work.

| Capability | Current backend contract | This prototype / proposed integration |
|---|---|---|
| Current contact | GET `/api/contacts/{publicKey}`; coherent declared detail | Local per-persona snapshot in `/demo/{variant}/state`; replace with typed API reader |
| Atomic contact Save | POST `/api/contacts/{publicKey}/save`; original `expectedEntityVersion`, ordered commands | One contact, revision check, ordered actions, complete modeled replacements; local snapshot-shaped command values need a wire DTO translation |
| Profile / email / phone / address | Explicit replace/insert/move commands and retained ordinal | Supported for this bounded form; no whole-list replacement or category conversion |
| Historical read/diff | GET `/api/contacts/{publicKey}/revisions/{n}?compareEntityVersion={m}`; ReadDetail + ReadHistory | Immutable local revision snapshots, difference calculation and ordered action evidence; translate real reader DTOs into the same view model |
| Directory detail | GET `/api/contacts/{publicKey}/directory`; public live channels only | Server projects before sending to Sofía; hidden principal stays hidden and remaining positions are not renumbered |
| Phone parsing | Production parser is libphonenumber-csharp 9.0.38; explicit country/area context | Small simulated MX/local + structural international parser; no carrier, deliverability or general national-number validation. Preserve raw input separately; no residence inference |
| Mailing address | Shared immutable complete value, per-contact association | Independent cloned values and replacement identity; one multiline address association in UI. A real adapter must map lines + geography into the full AddressInput contract |
| Tenant activity/search | No existing listing or tenant-audit endpoint | Proposed authorized read model with paging, filters, source category and unit/contact links; current local adapter filters a small array |
| Presence / notifications | No real-time/presence endpoint | Proposed authenticated channel with scoped subscription and projected events; local SSE notifications + expiring presence only |
| AI sidekick | No agent runtime | Deterministic local rule set with cited navigation, permitted reads and visible draft proposals; future tools must use the same authorizer and explicit Save boundary |
| Conflicts | HTTP 409; no automatic replay | Local server checks revision plus reset generation. Explicit field resolution preserves disjoint latest fields and requires a new intentional Save |
| Uncertain commit | `commit_uncertain`; unknown outcome, no durable receipt | Same user-visible constraint. The demo deliberately commits then returns uncertainty; investigation reads current state, without assuming safe retry |
| Tenant / actor | Trusted signed claims; SQL independently validates | Fixed fictional tenant; selectable mock persona as a query parameter. These controls are not authentication and must never be used as a real trust boundary |
| Provisioning / credentials | Separate person-only provisioning, role grants, local password setup | No credential or provisioning screen; no secrets, login flow, role assignment, tokens or implicit account-channel changes |

### Permissions and scope

- Mariana and Bruno have internal detail, history and Edit on **both fictional demo contacts**. Their
  activity is therefore the union of those explicitly allowed contacts, not a new general tenant grant.
- Elena has that contact access and the simulated administrator activity scope. No schema-admin or
  provisioning rights follow automatically from the label “Administrator.”
- Rafael has internal detail/history/activity and no Edit. A direct local Save as Rafael rejects 403.
- Sofía receives the separate public directory projection; private/deleted channels, root notes,
  raw phone input, historical labels/actions and audit actors are omitted by the server. Shared refresh
  events never include them. Static fixture code is server-only, not a browser-served module.
- Production integration must derive the actor and tenant from validated claims, enforce per-contact
  grants before a transaction, and project data before it reaches a browser or assistant tool.

Unsupported: paginated datasets, real authentication, offline drafts, durable browser/server storage,
cross-device presence, multi-contact Save/batch operations, creation/provisioning flows, web-link editing,
root lifecycle editing, address catalog pickers, account history, outbound communications and deployment.
The seed demonstrates email deletion/restoration; this prototype does not offer lifecycle buttons.
Multiple address additions are deliberately disabled; editing the existing mailing association works.
Reset/theme/persona/demo controls are prototype infrastructure, outside the intended product flow.

## Verification and captured views

```powershell
npm run build
npm test
```

`build` checks all runtime JavaScript modules. No bundler is needed; the served ES modules are the
runnable artifact. `npm test` uses Node’s built-in runner for focused state invariants.

Final local verification, **2026-09-07 America/Mexico_City**: build passed; **11/11 state tests passed**;
the primary journey suite and additional controls suite both passed on **all three variants**, with
zero unexpected script errors. Two-tab stale Save/reconciliation was exercised with separate browser
pages. Desktop, narrow, explicit light/dark choice, keyboard focus and the exceptional demo states were
checked. **27 PNG captures** accompany the two browser verification reports. No production tests were run.

Browser verification is optional development tooling. With a local Playwright installation and Chrome:

```powershell
# In another terminal, leave npm start running.
npm install --no-save --package-lock=false playwright
npm run test:browser
```

Alternatively use an existing Playwright package without installing anything here:

```powershell
$env:PLAYWRIGHT_MODULE='C:/absolute/path/to/node_modules/playwright/index.mjs'
npm run test:browser
```

`BROWSER_CHANNEL` defaults to `chrome`; `BASE_URL` defaults to `http://127.0.0.1:4317`. The verification
script changes only local demo data and writes to `evidence/`. It resets all three stories before its
final narrow captures. The browser report is [evidence/verification.json](evidence/verification.json).
Expected HTTP 409/500 diagnostics from deliberate conflict/uncertain cases are recorded separately from
unexpected browser/script errors. See the report for the actual execution results.

`npm run test:controls` exercises additional visible controls: email/phone insertion, email validation,
visibility, phone primary selection, explicit country/area interpretation, keyboard Save, technical
disclosures, freeform assistant input, preservation of an earlier draft when discarding a proposal,
and narrow dark forms. Its report is [evidence/control-verification.json](evidence/control-verification.json).

| Variant | Contact / light | Audit / light | Dark | Narrow |
|---|---|---|---|---|
| Dispatch | [Capture](evidence/dispatch-contact-light.png) | [Capture](evidence/dispatch-audit-light.png) | [Capture](evidence/dispatch-dark.png) | [Contact](evidence/dispatch-narrow.png) · [Audit](evidence/dispatch-narrow-audit.png) |
| Ledger | [Capture](evidence/ledger-contact-light.png) | [Capture](evidence/ledger-audit-light.png) | [Capture](evidence/ledger-dark.png) | [Contact](evidence/ledger-narrow.png) · [Audit](evidence/ledger-narrow-audit.png) |
| Relay | [Capture](evidence/relay-contact-light.png) | [Capture](evidence/relay-audit-light.png) | [Capture](evidence/relay-dark.png) | [Contact](evidence/relay-narrow.png) · [Audit](evidence/relay-narrow-audit.png) |

Screenshots are captured from running Chrome at 1440×1050 and 390×844; they complement the interactive
routes. Keyboard focus is checked for sidekick open/Escape return; semantic controls, visible focus,
labelled inputs, a skip link, text-labelled before/after values and reduced-motion support are included.
No screen-reader audit, broad browser matrix or formal accessibility certification is claimed.

Additional evidence: [Dispatch history](evidence/dispatch-history-light.png),
[Ledger reading desk](evidence/ledger-history-light.png), [Relay history](evidence/relay-history-light.png).
Dark assistant/form captures are also included in `evidence/` for each variant.

## Files

- `server.mjs`: loopback server, shared local state, projected reads, SSE and presence.
- `model.mjs`: server-only fixture story, permission projection, atomic revision admission.
- `shared.mjs`: pure draft/diff/command/validation utilities; no private fixtures.
- `app.js`, `styles.css`, `index.html`: three layouts, forms, history, activity and sidekick.
- `model.test.mjs`, `verify.mjs`: focused invariants and reproducible browser journeys.
- `evidence/`: captured views and actual verification record.
