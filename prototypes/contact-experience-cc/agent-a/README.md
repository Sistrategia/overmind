# Agent A — contact and audit UI prototypes (operational clarity lens)

Three runnable, interactive prototypes for Overmind's contact workspace, revision history and tenant activity,
built on one shared simulated server so the same story runs in each. Nothing here touches production code;
no backend, issuer or API key is needed. See [COMPARISON.md](COMPARISON.md) for the recommendation and
[CAPABILITY-MAP.md](CAPABILITY-MAP.md) for what is real, simulated or proposed.

## Run

```powershell
cd prototypes/contact-experience-cc/agent-a
npm install
npm run dev          # http://localhost:5181  (gallery at #/)
```

Other commands:

```powershell
npm run build        # typecheck + production bundle in dist/
npm run preview      # serve dist/ on http://localhost:5181
npm test             # vitest: history, Save/conflict, phone parser (state logic)
npm run e2e          # playwright: the three variants end to end, writes evidence/*.png
npm run verify       # build + test + e2e
```

Playwright needs its Chromium once: `npx playwright install chromium`. Requires Node 20+ (built with Node 24,
Vite 8, React 19, TypeScript 7, Playwright 1.63).

## The three variants

| Variant | Route | Thesis |
| --- | --- | --- |
| **Desk** | `http://localhost:5181/#/desk/contact/lina` | A focused record workspace: rows edit in place, pending changes gather in a tray and save together, and an evidence rail steps into any revision without leaving the record. |
| **Console** | `http://localhost:5181/#/console/contact/lina` | A keyboard-first command console: one line drives navigation, activity filters and edits staged as an explicit ordered command stack that mirrors the Save request. Typed sentences go to the sidekick from the same line. |
| **Strata** | `http://localhost:5181/#/strata/contact/lina` | A time-axis workspace: every revision is a point on an axis, two points compare as Then/Now with the actions between them, and the unsaved draft is a provisional next revision whose difference you preview before committing. |

Direct history and activity routes: `#/desk/history/lina?rev=4&compare=3`, `#/desk/activity`,
`#/console/history/lina?rev=4&compare=3`, `#/console/activity`, `#/strata/history/lina?rev=4&compare=3&mode=between`,
`#/strata/activity`. The gallery at `#/` links everything.

## Personas and demo controls

The **Demo controls** drawer (bottom-left) is simulation plumbing kept apart from the product UI. It switches
persona (standing in for signed claims), theme, latency, the next Save outcome (normal, slow, uncertain-committed,
uncertain-lost, storage failure), simulates Bruno's concurrent saves, toggles missing history coverage, resets the
story, and shows the simulated API trace with **proposed** endpoints marked.

| Persona | Role | Can |
| --- | --- | --- |
| Mariana Ruiz | Contact editor | Read detail and history, stage and save edits. No tenant activity. |
| Bruno Salas | Contact editor | Same as Mariana; used as the concurrent editor. |
| Rocío Herrera | Administrator | Everything, including tenant activity and provisioning context. |
| Tomás Vega | Auditor (read-only) | Read everything including tenant activity; cannot stage or save. |
| Paola Núñez | Front desk (directory only) | Public directory projection only; no private values, no history. |

Console also accepts `persona <key>` (`mariana`, `bruno`, `rocio`, `tomas`, `paola`) and `theme dark|light`.

## Two-tab collaboration

1. Open a variant's contact URL, keep the default persona (Mariana) and stage an edit (do not save).
2. Open the **same URL in a second tab** (the demo drawer has "Open a second tab"). In that tab choose **Bruno**.
   Both tabs show presence: who is viewing, who is editing and which part.
3. In Bruno's tab change the Office phone label and save: revision 8 commits.
4. Mariana's tab shows that revision 8 arrived under her draft. Her draft is preserved. Saving (or "Review and
   reconcile") opens the reconciliation: her draft beside Bruno's changes, combined field by field, with an
   explicit choice when the same field changed. "Save against revision 8" sends one new Save; nothing is retried
   blindly and nothing is overwritten silently.
5. Alone? Use "Bruno relabels the office phone" / "Bruno changes the extension" in the demo drawer instead of a
   second tab.

Tabs share one simulated server (this browser's storage) over `BroadcastChannel`, namespaced per variant. This
proves local prototype interaction, not deployed multi-user infrastructure or CRDT collaboration.

## Five-minute demo script (same in each variant)

1. **Small edit (60 s).** Open Lina Torres. Edit the Office phone: extension 12 → 25 and label → "Oficina"
   (Desk: hover the row, Edit; Console: `set phone 2 ext 25`, `set phone 2 label Oficina`; Strata: hover, Edit).
   Note the phone interpretation panel and the pending marker. Make the Work email primary (Desk/Strata: "Make
   primary"; Console: `primary email 1`). Save (Ctrl+S or the button): one revision 8, two actions. Open the
   evidence of revision 8.
2. **Combined edit (45 s).** Edit name and details → alias "Lina T."; relabel the Mobile phone; correct the
   Office address postal code to 62020. Save once: revision 9 with three ordered actions. Open Norte Taller: it
   still has postal code 62000 because the address value is shared and immutable.
3. **Explain history (60 s).** Select revision 4: the mixed Save (surname, new office phone, postal code
   62000 → 62010). Switch between *At* (state), *Between* (difference) and *During* (ordered actions). Select
   revision 5: no net difference but two actions (changed and changed back). Revision 6/7: the Work email was
   removed and restored with the same identity. Historical mode is read-only.
4. **Investigate activity (60 s).** Switch persona to Rocío (editors get a 403 page). Filter actor = Bruno,
   family = phone (Console: `actor bruno`, `family phone`). Open a unit: actor, time, affected records, ordered
   actions. Follow "Open revision" to the contact; return with "← Activity" and the filters are intact. Note
   the operational rows with a different source.
5. **Sidekick (45 s).** Ask "What changed in Lina's contact this week?" (click a revision reference). As Rocío
   ask "Show Bruno's phone changes" (filters change). As Mariana ask "Change this extension to 25 and make the
   work email primary": stage it to adjust, or save it as one revision. Ask something unsupported and see the
   bounded answer. As Tomás the sidekick refuses to stage.
6. **Conflict and failure modes (60 s).** Run the two-tab flow above (or simulate Bruno). Then set the next Save
   outcome to "Uncertain (did commit)", stage a change, save, and use "Check current revision" to learn what
   happened. Toggle dark mode (persists on reload), try a narrow window, and reset the demo.

## Layout

```
src/core        model, engine (apply/diff), fixtures, simulated server, adapter, drafts + reconciliation,
                sidekick, collab bus, workspace (React bindings)
src/shared      field editors, evidence blocks, reconcile panel, demo drawer, sidekick parts, hooks
src/variants    desk/  console/  strata/   (each: App + panes + stylesheet)
tests           vitest state tests      e2e   playwright journeys per variant     evidence   screenshots
```

Everything is confined to this directory (including `node_modules`, ignored by the repository `.gitignore`).
