# Contact and audit UI exploration — agent brief

Use this brief in **at least two independent sessions**, preferably with different models. Each agent
builds **three complete design variants of the same bounded experience**: at least six variants total.
These are interactive prototypes for choosing product direction, not a request to implement the entire
application or change the backend.

## Launch instructions

Give the first session this message:

```text
Read docs/ui-prototype-agent-brief.md and execute its build brief as agent A.
Create three distinct runnable UI variants under prototypes/contact-experience/agent-a/.
Use the operational clarity exploration lens. Build and verify the prototypes, not just a design proposal.
```

Give the second session this message:

```text
Read docs/ui-prototype-agent-brief.md and execute its build brief as agent B.
Create three distinct runnable UI variants under prototypes/contact-experience/agent-b/.
Use the collaborative investigation exploration lens. Build and verify the prototypes, not just a design proposal.
```

Agents C and onward can use another unique folder and an independently chosen lens. Separate worktrees
are suitable; if sessions share a checkout, keep all authored files and dependencies inside your own
output directory. Do not inspect or copy another agent's variants before delivering your own.

The remainder of this document is the build prompt. You can also paste it directly into a session,
specifying its agent ID and output directory first.

---

## Your assignment

Act as a product designer and frontend engineer. Build **three genuinely different, polished,
interactive UI prototypes** for Overmind's contact management and audit capabilities. We want to use
them, compare them and decide how the application should feel. Deliver working screens and interactions,
not only wireframes, screenshots, mood boards or a written recommendation.

The desired character is a modern **2026 professional application**: light by default, excellent dark
mode, crisp typography, thoughtful density, fast navigation, contextual assistance and collaboration
built into the experience. Interpret this creatively rather than claiming a particular trend is mandatory.
Aim for a product people could comfortably use all day, including when investigating difficult changes.

Do not build the entire application. Concentrate on three connected areas in **each** variant:

1. A contact workspace for quick email/phone edits and a small multi-field Save.
2. Contact history with revision inspection, before/after comparison and action evidence.
3. An administrator's tenant activity view with an audit-unit detail and navigation back to the contact.

Integrate a contextual AI sidekick and a working collaboration demonstration into these areas. Shared
mock data and state logic are welcome; the three variants must differ substantially in information
architecture, navigation, editing flow, history presentation and sidekick interaction. Three color
palettes, or one contact screen plus one history screen plus one log screen, do **not** count as three
variants. Each variant must support the same core journeys so we can compare them fairly.

## Read enough context to design accurately

Start with these repository documents; favor current ADRs over old pending notes in historical sections:

- [Contact HTTP API](contact-http-api.md): supported routes, commands, permissions, visibility and errors.
- [Integrated service](contact-service.md): atomic Save, stable child identity, ordering and coherent reads.
- [History explanation](guide-co/03-ask-history-a-question.md): snapshots, diffs and actions answer different questions.
- [Master plan](contact-api-master-plan.md): completed scope and deferred capabilities.
- [Provisioning API](user-provisioning-api.md) and [ADR 0016](adr/0016-tenant-logins-and-administrative-provisioning.md): context for person accounts, tenant identity and secrets. Provisioning screens are optional, not required.

Use [ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md) and
[ADR 0015](adr/0015-contact-http-authentication-and-wire-contract.md) for ambiguity about access or the wire contract.
Read phone/address family documents only if their details affect your design. Do not spend the task
auditing the entire backend. The reference checkpoint is completed iteration 6, `7212a4c`; check the
actual checkout and note material differences in your delivery.

The existing HTTP API provides contact creation/Save, current detail, revision comparison and a
restricted directory-detail projection. It does **not** currently provide paginated search, a tenant-wide
audit explorer, real-time presence, collaborative editing, or an agent tool runtime. Prototype those
capabilities with a coherent local adapter and document the proposed integration seams. Do not invent
working production endpoints or imply that the backend already implements these features.

## Creative independence

Choose and name your own three concepts. Write a short design thesis for each, then implement it without
waiting for approval. Different models should bring different ideas, not converge on a prescribed layout.

Your assigned lens is a starting emphasis, not a license to omit other scenarios:

- **Agent A — operational clarity:** prioritize fast everyday work, legible information density,
  keyboard flow and moving smoothly from a small edit to its evidence.
- **Agent B — collaborative investigation:** prioritize shared context, explaining change, spatial or
  narrative investigation, and a sidekick that helps people reason and act together.

Possible inspirations include a focused record workspace, an evidence workbench, a timeline-centered
experience, a command-oriented interface or a shared investigation canvas. These are examples, not
three mandatory templates. At least one of your concepts should make a bolder interaction choice while
remaining practical. Avoid three near-identical sidebar/table/detail-panel applications.

## Shared demo story and data

Use fictional Mexican business data and a consistent scenario across your three variants:

- Tenant: **Vértice Demo**. Person: **Lina Torres**, with several email addresses and Mexican phones.
- Organization: **Norte Taller**, included to demonstrate a different contact category; do not invent
  a persisted employment relationship merely because both records appear in the demo.
- Collaborators: **Mariana**, a contact editor, and **Bruno**, another editor. Include an administrator
  and a read-only auditor persona, with distinct allowed actions.
- A work email, a personal email, a phone such as `+52 777 312 3456`, labels, an extension, saved order,
  private/public channels, and an immutable address represented naturally as a mailing address.
- Seed several meaningful revisions: initial creation, corrected phone, changed primary email, a mixed
  profile/phone/address Save, and an example where a value changed and changed back within one committed
  unit. Include a deleted/restored child somewhere in the history.

Use realistic timestamps, named actors and explainable changes. Display time zones where useful.
Keep fixture values, old/new snapshots, action order and grouped audit-unit details internally consistent.
If you show a unit touching multiple contacts, model that as a separate simulated administrative batch;
the current single-contact Save endpoint must not silently become a multi-contact API.

An English interface with realistic Spanish names/addresses is a reasonable default. Keep copy and
formatting consistent and localization-friendly. Never use real customer data or real credentials.

## Required interactive journeys

### 1. A small edit that feels effortless

Open Lina's contact, add or edit an email or phone, change its label/extension and save. Show helpful
validation, pending changes, cancel and a clear saved result. Make an email or phone primary and let
the user understand its saved order. Preserve the identity of an existing child through edits and moves.

For phone input, show a credible interpretation of a full international number and of a Mexican local
number entered with country/area context. Do not infer where the person lives from their phone's area
code. A local parser may be simulated, but label its implementation honestly in the prototype notes.

Also support a small combined edit—name, phone and address—with **one Save and one new contact revision**.
An address correction creates a replacement value for that contact association; it must not alter
another contact that happened to share the old address. Technical catalog/FK details belong in an
optional inspector, not in the everyday form.

### 2. Explain the contact's history

Move from the saved contact directly to its history. Select an earlier revision, inspect what the
contact looked like then, compare two revisions and find who changed which fields. Show understandable
old/new values and ordered actions with the associated audit unit.

Make **state at a revision**, **difference between revisions** and **actions during a Save** recognizably
different. The change-and-change-back example should have an empty final diff but retain both actions.
Historical labels and values must come from historical fixture data rather than today's contact.
Historical mode must be visibly read-only; do not imply that selecting an old revision undoes it.

### 3. Investigate tenant activity

Provide a usable activity stream, table, timeline or another well-reasoned design. Support a small
working set of filters: actor, contact, action/family and time range, plus an ordinary text search.
Open an audit unit to see its actor, time, affected records and actions; follow a contact reference to
the relevant revision/diff. Preserve investigation context when moving back and forth.

Treat this as an **application activity/audit view**, not the SQL Server transaction log. Do not imply
that every keystroke, rejected attempt or SQL statement is in the existing business audit. Simulated
operational errors or agent/presence activity must have a distinct source/category from committed
business changes. An increasing dbrow_version is not proof of cross-contact commit order or a universal
database snapshot. Show human-readable summaries first; put correlation IDs and technical stamps in
expandable details. Keep Int64 stamps as strings in JavaScript data.

### 4. A sidekick that works with the view

Build a contextual sidekick, not a decorative chat box. It should understand the current contact,
selected revision, active filters, user persona and unsaved draft. Demonstrate these interactions:

- “What changed in Lina's contact this week?” Produce a grounded summary with clickable references
  that open/highlight the actual fixture revision and changed fields.
- “Show Bruno's phone changes.” Change the relevant activity filters and navigate to matching evidence.
- “Change this extension to 25 and make the work email primary.” Stage a visible edit proposal using
  normal form/state logic; allow the user to adjust it, apply it as one Save, or discard it.

Read/navigation actions can happen immediately. Proposed writes must be visible and intentional;
one clear Apply/Save action should be enough. Show what the sidekick is using and what it changed.
Respect persona permissions and private-data visibility. Unsupported questions should receive an honest
bounded response, not fabricated evidence. Do not send data to an external model or require API keys.
A deterministic local assistant is fine; identify it as simulated in the demo controls and README.
Its factual claims must agree with the current fixture state after edits, resets and filters change.

### 5. Collaboration and a recoverable conflict

Show meaningful presence: who is viewing/editing this contact and which part is involved. Presence is
awareness, not proof of a database lock or permission to overwrite another person's work.

Include a reproducible two-user flow: Mariana starts editing revision 3; Bruno saves revision 4;
Mariana's stale Save conflicts. Preserve Mariana's draft, show the latest changes beside it and let her
explicitly reconcile or discard before saving against the current revision. Never silently overwrite
Bruno's edit or blindly retry a stale request.

Implement a **working local two-tab demo** using BroadcastChannel or an equivalent local mechanism,
with persona selection per tab and a shared simulated server/revision check. Also provide a simple
“simulate Bruno's update” control so one reviewer can demonstrate it alone. Keep local drafts separate
from committed shared state and isolate state by variant/tenant. Do not broadcast passwords or hidden
fields to a persona that should not receive them. Explain that this proves local prototype interaction,
not deployed multi-user backend infrastructure or CRDT collaboration.

## Visual and interaction quality

- Light mode is the initial default regardless of operating-system theme. Dark mode must be designed
  throughout, including forms, history diffs, sidekick, overlays and error states. Persist explicit choice.
- Prioritize typography, hierarchy, alignment and thoughtful density. Avoid a generic KPI dashboard,
  giant empty hero section, excessive nested cards, or gradients/glass used as substitutes for design.
- Support desktop investigation and a usable narrow-screen layout. The sidekick and comparisons must
  adapt rather than squeeze the main task into an unusable column.
- Use clear labels, keyboard navigation, visible focus, adequate contrast and semantic controls.
  Diff meaning must not depend on red/green alone. Respect reduced-motion preferences.
- Use restrained motion to explain opening context, staged edits and arriving updates. Avoid distracting
  fake typing or permanent pulsing activity. Support sidekick dismissal and predictable focus return.
- Keep everyday copy understandable: “Saved together”, “Revision”, “Primary”, “Changed by”. Avoid
  exposing table names, raw JSON or catalog IDs unless the reviewer opens technical details.
- Show tenant identity without making ordinary single-tenant users repeatedly choose it. Do not invent
  an implemented shared-user tenant-switching or authentication flow.

Alongside the happy path, make loading, empty results, permission denial, unavailable historical coverage
and an uncertain Save outcome reviewable through demo controls. For uncertain commit, show that the
outcome is unknown and offer investigation; do not claim rollback, automatic safe retry or a durable
recovery receipt. Keep demo controls separate from the intended product interface.

## Build boundaries

Use an existing suitable frontend stack if present; otherwise choose a small self-contained stack you
can run and verify locally. A lightweight React/TypeScript implementation or dependency-free web app
is acceptable. There is no need to add a frontend framework to the production solution.

Keep implementation, package files, lockfiles, assets, fixtures and README under your assigned directory.
Use local mock data by default; no running SQL Server, issuer, API key or production backend should be
required. Do not change production SQL/C#/authentication, root package configuration, existing guides or
another agent's files. Do not deploy, publish or commit unless the user separately requests it.
Follow applicable repository and tool/skill instructions. Do not launch other sessions or delegate merely
because this brief is being used by multiple agents; deliver your assigned three variants independently.

The frontend adapter should preserve current API semantics and clearly identify proposed capabilities.
Use shared behavior/state where it helps keep the variants consistent, but do not reduce their design
differences to CSS skins. Decide routine implementation details yourself and continue without asking for
approval of each layout. If a tool limitation prevents verification, state it specifically and provide
the best runnable artifact possible without claiming unperformed checks.

## Deliverables and verification

Deliver within your assigned directory:

1. **Three runnable variants**, each with all three connected areas and the sidekick/collaboration
   demonstrations above. Include a gallery or simple switcher with names, short theses and direct links.
2. A **README** with exact install/run commands, three direct variant routes, two-tab collaboration
   instructions and a five-minute demo script covering the same scenarios in each variant.
3. A concise **comparison matrix**: each concept's strengths, tradeoffs, best-fit users, everyday-edit
   speed, audit readability, sidekick integration, collaboration clarity and accessibility compromises.
   Recommend a direction and explain what you would borrow from the other concepts.
4. A **capability map** distinguishing implemented API contracts, locally simulated behavior and proposed
   backend work. Include the trust/permission assumptions and any unsupported scenarios.
5. **Visual evidence** captured from the running prototypes: contact workspace and audit investigation
   for every variant in light mode, plus one representative dark-mode screen for each variant. Include
   a narrow-screen capture for each variant if the available tooling permits it. Screenshots complement
   the interactive deliverable; they do not replace it.

Run the application and exercise every primary visible control. Verify edits/cancel/save, revision
comparison, working filters, evidence navigation, assistant staging/apply/discard, two-tab conflicts,
persona restrictions, theme persistence and demo reset. Check desktop and narrow layouts, keyboard
focus and browser console errors. A reset must restore a coherent initial story without mixing variants.
Use focused state/interaction tests where they add confidence, especially for revision conflicts and
history consistency; an exhaustive production test suite is not required for this design exploration.

In your final response, give the run command, links to the three variants and captured views, your
recommendation, checks actually performed and the most important prototype limitations. Keep it concise.
