# Comparison matrix — Casefile · Studio · Thread

All three support the same journeys (small edit, combined Save, history state/diff/actions, tenant activity with
filters and evidence navigation, sidekick with grounded answers and staged proposals, presence and a recoverable
conflict, persona restrictions, theme persistence, demo outcomes). They differ in information architecture,
navigation, editing flow, history presentation and sidekick interaction.

| | **Casefile** (Fluent 2) | **Studio** (macOS/iPadOS 26) | **Thread** (Material 3 Expressive) |
| --- | --- | --- | --- |
| Information architecture | One dossier per contact: record and history are tabs of one document; activity is a separate dense grid; sidekick is a persistent right pane | Three panes: source list · content sheet · inspector; history is a mode of the same sheet (Now / Timeline / Compare); activity is another source | One narrative stream per contact; revisions, notes, sidekick answers, queries and proposals are cards; a board pins the record and revision chips; tenant activity is its own thread with a persistent query card |
| Everyday-edit speed | **Fast**: inline row editors, pending tray with plain-word narration, Save always visible | **Fast for single fields**: click row → inspector form; slightly more travel for multi-row edits, but Save/Discard live in the toolbar | **Moderate**: edits happen in a side sheet with the whole form; excellent for combined edits, one extra step for a single field |
| Audit readability | **Strong**: State / Changes / Actions segmented explicitly, before/after table with markers and labels, ribbon shows actor and date | **Strongest for comparison**: two sheets side by side with row markers, field-level list in the inspector, scrubber makes time tangible | **Strong for narrative**: each revision unfolds in place with three tabs; the empty-diff-with-actions case reads naturally in the stream; less at-a-glance density |
| Sidekick integration | Copilot-style pane always in context; references open history with field highlight; proposals staged into the visible tray | ⌘K palette: fast to summon, results are answers/evidence/actions; proposals land in the inspector; palette closes and focus returns | Sidekick is a participant: answers are cards next to the human notes and the evidence they cite; proposals are cards anyone can watch being applied |
| Collaboration clarity | Presence stack in the record header; incoming-revision bar; conflict panel with both columns above the record | Presence in the sidebar and toolbar; conflict as a modal alert sheet with both columns | **Clearest**: shared notes, "people here", proposal and conflict cards in the same stream where the change will be recorded |
| Activity investigation | Dense grid, day groups, filter bar with chips, right drawer; best for scanning many units | Token search (`actor:Bruno`), popover menus, inspector detail; best for a focused hunt | Query card with inline unit cards; best for keeping a query beside its conclusions |
| Accessibility compromises | Row actions appear on hover (also on focus and in edit mode); dense 14px type | 13px type is small for long sessions; the scrubber is a custom slider (keyboard ← → Home End provided) | Large type and targets; the composer overlays the last card on short viewports; the side sheet is modal |
| Narrow screen | Bottom tab bar, pane becomes a full-screen sheet, single column | Sidebar drawer, inspector becomes a bottom sheet, compare stacks | Bottom rail, board drawer, sheet becomes bottom sheet |
| Best-fit users | Operations staff doing many small edits with occasional evidence checks | Analysts and admins who compare revisions and investigate visually | Teams who investigate together and want the reasoning kept with the record |
| Bolder choice | Pending tray that narrates the Save before it happens | Revision scrubber with pinned comparison; the record is the diff surface | Thread-first workspace; every artifact is a card in one narrative |
| Risks | Can drift into a generic record/table app if the tray and pane are not kept central | Custom widgets (scrubber, palette) need care to stay accessible; three panes are wide | Threads grow long; needs pinning/collapsing discipline; not the fastest for one-field edits |

## Recommendation

Choose **Studio** as the direction, and borrow two things:

1. From **Thread**, the shared per-contact thread of notes and sidekick evidence cards. Add it as a fourth mode or a
   collapsible panel next to the inspector so reasoning stays with the record; keep the sidekick's replies private to
   the asker and the notes shared. Thread's proposal card is the clearest model for "one visible Apply".
2. From **Casefile**, the plain-word pending list ("Change office phone — extension 22 → 25", "Make personal email
   primary") as the inspector's pending card, and the *State · Changes · Actions* naming for the three history questions.

Why Studio: its comparison view is the best answer to the brief's core distinction (state at a revision vs difference
between revisions vs actions in a Save), the scrubber makes "explain the change" spatial without inventing new concepts,
and its editing flow stays close to the record. It is also the easiest to keep honest: every write goes through the
inspector's pending card and the toolbar's single Save.

If the everyday-edit workload dominates over investigation, Casefile is the safer choice; if collaborative reasoning is
the product's identity, Thread is the boldest and most differentiated.
