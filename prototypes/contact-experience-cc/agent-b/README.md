# Contact experience prototypes — agent B (collaborative investigation)

Three runnable, interactive UI variants for Overmind's contact workspace, contact history and tenant activity, built
from [docs/ui-prototype-agent-brief.md](../../../docs/ui-prototype-agent-brief.md). Same fixture story in all three,
same simulated local backend, three genuinely different information architectures and visual languages.

| Variant | Route | Visual language | Thesis |
| --- | --- | --- | --- |
| **Casefile** | `#/casefile` | Fluent 2 (Microsoft) | Investigation as a shared dossier: record + revision ribbon in one document, Copilot-style side pane, pending-changes tray, dense activity grid with a detail drawer. |
| **Studio** | `#/studio` | macOS / iPadOS 26 direction | Native three-pane studio: source list, content sheet, inspector. History is a revision **scrubber** that morphs the record; Compare shows two sheets with linked markers. Sidekick is a ⌘K palette. |
| **Thread** | `#/thread` | Material 3 Expressive direction | Investigation as a shared **narrative thread** per contact: notes, sidekick evidence cards, unfolding revision cards, activity query cards and edit-proposal cards in one stream, with a pinned board. |

Gallery with theses and links: `http://localhost:5178/#/`.

## Install and run

```bash
cd prototypes/contact-experience-cc/agent-b
npm install
npm run dev          # http://localhost:5178
```

Everything (dependencies, lockfile, fixtures, tests, evidence) lives under this folder. No SQL Server, issuer, API key
or backend is needed; the "server" is a local adapter persisted in `localStorage`. Google Fonts (Inter, Roboto Flex,
JetBrains Mono) are loaded for the Studio and Thread typography; without internet the system fallbacks apply.

Direct routes:

- Casefile: `http://localhost:5178/#/casefile` · history `#/casefile/contact/<id>?tab=history&rev=4&compare=3` · activity `#/casefile/activity?actor=bruno&family=phone`
- Studio: `http://localhost:5178/#/studio` · compare `#/studio/contact/<id>?mode=compare&rev=4&pin=3` · activity `#/studio/activity`
- Thread: `http://localhost:5178/#/thread` · revision card `#/thread/case/<id>?card=rev:5` · activity `#/thread/activity`

Lina Torres's id is `c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e01`.

## Verification commands

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest: fixture consistency, diff/engine, server contract (409/403/uncertain), draft derivation, sidekick intents
npm run e2e          # Playwright: 34 interaction journeys across the three variants (dev server auto-starts)
npm run evidence     # Playwright: writes the screenshots in ./evidence
```

The Playwright project runs with `colorScheme: 'dark'` on purpose: the prototypes must still start in light mode.

## Demo controls (not product UI)

Each variant has a clearly separated demo panel (dashed orange border): Casefile bottom-left "Demo controls", Studio the
persona row at the bottom of the sidebar, Thread the avatar at the bottom of the rail. It offers:

- **Persona for this tab**: Mariana and Bruno (contact editors), Sofía (administrator), Diego (read-only auditor with
  detail/history only for Lina and directory access elsewhere). Persona is per tab; committed state is shared per variant.
- **Collaboration**: *Rewind: Mariana edits revision 3* (truncates the story to revision 3 and opens Mariana's draft),
  *Simulate Bruno's update* (commits a Bruno revision from this tab), *Second tab* link.
- **Next Save outcome**: normal · 403 permission denied · 500 storage (nothing committed) · 500 commit uncertain (the
  commit happens, the acknowledgement is lost) · slow Save.
- **Reads**: loading skeletons; historical coverage unavailable before revision 4 or 6 (409 `history_unavailable`).
- **Reset demo**: restores the seven-revision story for this variant only (variants are isolated by storage key).

## Two-tab collaboration

1. Open a variant, e.g. `#/casefile`. Tab A is Mariana by default.
2. Open the same URL in a second tab (demo panel → *Second tab*). In tab B choose **Bruno** in the demo panel.
3. In tab A start an edit (e.g. change the office extension) and leave it unsaved.
4. In tab B make a different or overlapping edit and Save. Tab A shows Bruno's presence and a "Bruno saved revision N
   while you are editing revision N−1" notice; the draft is kept.
5. Save in tab A: the stale Save is rejected (409). Reconcile ("Keep my draft on revision N") or discard, then Save.

Tabs share the simulated server through `localStorage` and talk over `BroadcastChannel`; messages carry identifiers and
awareness only, never field values. This proves local prototype interaction, not deployed multi-user infrastructure or
CRDT collaboration. Alone, use *Rewind* + *Simulate Bruno's update* for the exact brief scenario (Mariana edits revision
3, Bruno saves revision 4, Mariana's stale Save conflicts).

## Five-minute demo script (same scenarios in each variant)

**0:00 Open Lina Torres.** Casefile: record card with revision line and presence. Studio: content sheet; toolbar shows
revision and *Now · Timeline · Compare*. Thread: hero + the seven "saved revision" lines.

**0:30 Small edit.** Change the office extension 22 → 25 and make the personal email primary; then Save once.
Casefile: *Edit record* → row *Edit* → extension → *Apply to draft*; *Make primary*; pending tray narrates both; *Save*.
Studio: *Edit* → click the phone row → inspector form → *Apply to draft*; click the email row → *Make primary*; *Save*.
Thread: *Edit contact* → side sheet → pencil on the phone → *Apply to draft*; star on the email; *Save as one revision*.
Each shows "Saved together as revision 8" and the identity of the moved email is preserved (same ordinal, new position).
Try an invalid email or a local number without area code to see validation; try making a *new* entry primary to see the
honest "save first" limit.

**1:30 Combined edit.** Display name + mobile number + home address → one Save, one revision with three actions. The
address correction creates a new shared value for Lina only (Rodrigo keeps the old value; technical details show ids).

**2:00 History.** Casefile: *History* tab → ribbon → *State · Changes · Actions*. Studio: *Timeline* → drag the
scrubber (← → keys work) → *Compare with 3*. Thread: board chip *R5* or *Open* on a revision line → *As it was · What
changed · Actions*. Revision 5 shows an empty diff with two retained actions; revision 2 shows the old email domain;
revision 7 shows the web link restored with the same identity. Enable *coverage unavailable before 4* to see 409.

**3:00 Tenant activity** (switch to Sofía). Filter actor = Bruno, family = phone, search "warehouse", source =
operational; open a unit; follow *Open revision N* to the contact; go back — filters and the open unit are kept.
Mariana gets a 403 on this view.

**3:45 Sidekick.** Ask *"What changed in Lina's contact this week?"* (references open the revisions), *"Show Bruno's
phone changes"* (as Sofía it filters activity; as Mariana it answers within Lina's history and says why), *"Change this
extension to 25 and make the work email primary"* (stages visible pending changes; Apply as one Save / Adjust / Discard),
and something unsupported to see the bounded reply. The panel lists what the sidekick used.

**4:30 Conflict.** Demo panel → *Rewind* → *Simulate Bruno's update* → Save → 409 with both sides and overlaps →
*Keep my draft on revision 4* → Save → revision 5. Then *Reset demo*. Also try *Next Save outcome = commit uncertain*
and *Check the current revision*.

## What is real, simulated, or proposed

See [CAPABILITY-MAP.md](CAPABILITY-MAP.md). In short: create/Save/current/revision-compare/directory follow the
implemented HTTP semantics (ADR 0014/0015) against a local adapter; the activity explorer, presence, shared notes and
the sidekick are simulated proposals; the phone parser is a labelled simulation of the ADR 0009 parser.

Checkout note: the reference checkpoint is iteration 6 `7212a4c`; the checkout used here is one commit later
(`24e4bd1`, which only adds the brief). No production SQL/C#/authentication or root files were changed.

## Layout

```
src/core/        shared model, fixtures, engine (commands → state + actions), diff, simulated server, collab channel,
                 sidekick, draft derivation, editing hooks, workspace provider
src/variants/    casefile/ · studio/ · thread/ (each: app shell, screens, css)
tests/core/      vitest
tests/e2e/       playwright journeys + evidence captures
evidence/        screenshots (light contact + activity per variant, one dark, one narrow)
COMPARISON.md    comparison matrix and recommendation
CAPABILITY-MAP.md implemented vs simulated vs proposed, trust assumptions
```
