# Comparison and recommendation — Agent A (operational clarity)

All three variants run the same story on the same simulated server and pass the same journeys (see `e2e/`).
They differ in information architecture, navigation, editing flow, history presentation and how the
sidekick is woven in; they are not skins of one layout.

## Matrix

| Dimension | Desk — record workspace | Console — command workbench | Strata — time axis |
| --- | --- | --- | --- |
| Information architecture | Contact list · record · evidence rail; history is a read-only mode of the record | Scope list · detail · transcript; the command line is the primary control | Axis over everything; contact, history and draft are points on it; activity is swimlanes by actor |
| Navigation | Tabs, breadcrumbs, rail; Alt+←/→ for revisions | Typed commands (`rev 4`, `compare 3 7`, `actor bruno`), j/k lists, ladder scrubbing | Click/Shift+click points, ←/→ on the axis, At/Between/During switch |
| Editing flow | Inline row forms → pending tray → Save together | Commands staged as an explicit ordered stack mirroring the request; form only for complex values | Inline card forms → draft becomes provisional `r+1` on the axis; preview Then/Now before commit |
| History presentation | Rail list; inline old→new annotations on the record; At / Between / During as a segmented control | Ladder plus three answers side by side (state table, property diff, action list) | Then/Now columns aligned by identity; actions as a horizontal strip of steps |
| Sidekick integration | Docked panel with a context strip; references highlight fields in the record | Same input as commands; replies in a transcript; proposals land in the stack | "Lens" panel; references move the axis; proposals become the draft point |
| Collaboration clarity | Presence in the record header; stale banner + reconcile dialog | Presence in the header; stale banner; `reconcile` command; conflict inline in the detail | Presence in the top bar; the concurrent revision appears as a new point under the draft; reconcile inline |
| Everyday-edit speed | Fast with a mouse; keyboard shortcuts on rows (Enter, p, Alt+↑↓, Ctrl+S) | Fastest for repeat users who know identities (`set phone 2 ext 25`); slower for first-timers | Comparable to Desk; one extra concept (the draft point) but a clear commit moment |
| Audit readability | Best "small edit → its evidence" path; rail keeps the record in view | Best for dense investigation; three answers visible at once; wire request visible | Best for explaining *when* and *what changed between*; the strongest visual for change-and-back |
| Best-fit users | Contact editors doing all-day maintenance | Auditors, administrators and power users investigating tenant activity | Reviewers, supervisors and anyone explaining a history to someone else |
| Strengths | Familiar, dense, low training; inline diff on the record is immediately legible | Precise, scriptable, honest about the wire contract; typed filters keep investigation context in the URL | Bold but practical; makes revisions, comparison base and unsaved draft one mental model |
| Tradeoffs | Three panes get tight below 1100px; rail becomes a drawer | Discoverability depends on the autocomplete menu; sentence vs command ambiguity must be handled (it is, with `?` to force) | Horizontal axis needs scrolling with many revisions; more vertical space per screen; the draft-point idea needs a sentence of explanation |
| Accessibility compromises | Row actions appear on hover/focus (kept visible on narrow); dialogs trap focus | Command line is keyboard-native; lists use roving selection with j/k; the menu is a listbox but relies on visual grouping | Axis points are buttons with labels and arrow keys; Shift+click has a keyboard alternative (`b`); colour never carries meaning alone |
| Narrow screens | Usable: nav and rail become drawers, actions always visible | Usable: list becomes a drawer; the command line stays | Usable: cards stack, actions sit under values, the axis scrolls inside its strip |

## Recommendation

**Build on Desk as the everyday product, and take two things from the others.**

Desk wins the lens this agent was given: operational clarity. The record stays in view while the person
edits, the pending tray makes "saved together as one revision" visible before the click, and the evidence
rail turns "what did I just do?" into one click without a screen change. It is the variant a contact editor
can use all day with the least explanation, and it degrades most gracefully to a narrow window.

Borrow from Console:

- The **explicit command stack with the wire preview** should exist in Desk as an optional inspector under
  the pending tray. It is the most honest representation of the Save contract and it helps support staff.
- **Typed activity filters in the URL** (`actor`, `family`, `from`, `q`) are already shared; Console's
  command line proves that an administrator can move faster with them. Add a command palette to Desk's
  search box rather than a second product.
- The **three answers side by side** layout is better than a segmented control when the screen is wide;
  Desk should use it in the rail when width allows.

Borrow from Strata:

- The **draft as a provisional next revision** and its Then/Now preview is the best moment of the three
  prototypes. Desk's pending tray should offer "Preview as revision N+1" with the same Then/Now shape.
- The **Then/Now columns aligned by identity** explain change-and-change-back and delete/restore more
  clearly than a field list; use them for the Between view everywhere.
- Presenting an arriving concurrent revision **as a new point under the draft** is a clearer mental model
  than a banner alone.

Console remains the right shape for a dedicated audit/investigation tool if that becomes a separate
surface for administrators and auditors; it should not be the entry point for editors.

## What was verified

Per variant, end to end in Chromium (see `npm run e2e`): small edit with validation, cancel and one-revision
Save; combined name/phone/address Save with the shared address value left untouched on Norte Taller;
state/difference/actions at revisions 1, 4, 5 and 7 including the empty diff with retained actions and the
deleted/restored identity; tenant activity permission denial, filters, unit detail, evidence navigation and
return with filters intact; sidekick summary with clickable references, filter navigation, staged proposal,
one-Save apply, bounded answers and refusal for a read-only persona; two-tab presence and stale-Save
reconciliation (combined fields, then an explicit same-field choice); persona restrictions; uncertain commit
investigation; storage failure; theme persistence across reload; demo reset; narrow layout without horizontal
page scroll; zero console errors. State logic is covered by `npm test`.

## Known limitations

- The sidekick is a deterministic matcher; phrasing outside its grammar gets a bounded answer.
- The phone parser is a small simulation; production parsing lives in libphonenumber-csharp on the server.
- Two-tab collaboration is local to one browser profile; it demonstrates the interaction, not infrastructure.
- No contact creation, root delete/restore or provisioning screens; the engine supports the commands.
- Screenshots were captured at 1440×900 and 414×860 in headless Chromium; other browsers were not exercised.
