# Contact and user provisioning master plan

Updated: 2026-09-07, revision 2 after independent feedback. Status: ready for iterative work; implementation iterations have not started.
Production source checkpoint reviewed: `bb2b2c2`; original plan committed in `52a0e1c`. This document tracks the next work; ADRs 0005–0007 describe the implemented foundation.

The goal is to grow the email reference into a coherent contact API for persons and organizations, then build administrative user provisioning on that API. Deliver one bounded iteration at a time, with usable SQL/C# behavior, historical evidence and verification before moving on. The author's current request authorizes this plan and recording the decisions below; it does not start a production implementation pass.

## Decisions already made

| Subject | Decision and consequence |
| --- | --- |
| Audit foundation | Keep one owned audit unit, one actor/tenant and one aggregate bump per unit, unit-entry optimistic tokens, final touched-row history and ordered effective actions. Email is the implemented reference. |
| Initial contact scope | Focus on persons and organizations. A group remains a valid conceptual party that can collect organizations or people and have its own contact information. Dedicated group/membership work is deferred; do not redefine a group as merely a UI list or remove existing group support. |
| Ordinary accounts | Only human person contacts receive ordinary accounts, on both new construction and promotion. Organizations and groups can be parties, but do not become ordinary login identities or write actors. Reserved System bootstrap is the existing technical exception. Enforcement/tests are pending. |
| Address ownership | Complete address values are shared and immutable. `contact_address` holds references and ordering, with required identity/audit metadata; it does not contain address text. Editing one association selects or creates another address value and leaves other contacts and earlier history unchanged. |
| Address catalogs | An address may reference `country_id`, `state_id`, city and other geographic catalogs. Address lines may be NVARCHAR columns on the immutable address value. Interning the lines into additional catalogs is optional and undecided. |
| Tenant experience | Optimize for existing single-tenant applications and multitenant applications without shared users. The application may resolve tenant context without asking the user to type it at login. Shared-user membership, default-tenant selection and tenant switching are future possibilities, not an implemented contract. |
| Service tenant context | The service resolves and passes an explicit tenant to database operations, from trusted application/host or authenticated context. The SQL resolver's existing default GUID is a compatibility behavior, not the service's tenant-selection contract. |
| Account contact channels | Contact email and phone are distinct from account email and recovery/verification phone. A contact edit must not silently modify security channels or confirmation state. |
| Delivery scope | Build on fresh-schema SQL Server support first. Customer upgrades, synchronization and additional providers remain separate deliverables. Preserve the portable behavioral contracts. |

Email's existing stable ordinal plus separate saved order is the proposed convention for the new child lists: first saved item is default, insert/restore append, and delete closes gaps. Family-specific deviations, if needed, must be explicit. Labels and visibility are association metadata, not part of the shared address's identity; confirm their precise address representation in iteration 3.

## Starting position

| Area | Actual state at the reviewed checkpoint |
| --- | --- |
| Audit ownership and email | Implemented SQL/C# ownership, concurrency, lifecycle, ordering, final history, action evidence, as-of reader/diff and restricted database capability. |
| Phone | Legacy catalog/association, unused history skeleton and constructor insertion. No complete audited family. Live extension permits 25 characters but history permits 10; some association FKs are disabled. |
| Address | Geographic catalogs, address value, association and constructor insertion. No complete address history/lifecycle. Existing association FKs need review and enforcement. |
| Web link | Domain classes exist; the SQL family is absent and builder entries are commented out. |
| Contact root/profile | Construction, partial contact payload history and a summary view exist. Direct construction retains privileged legacy behavior. No complete public profile editing, root lifecycle or historical contact reconstruction. Name components and relationships need their own history coverage. |
| User | Administrative construction/promotion and non-secret construction history exist. Outstanding review findings and login policy remain; no complete provisioning service or HTTP endpoint. |
| Application | `SqlAuditUnit` currently exposes email commands. WebAPI contains development schema operations, not contact/provisioning endpoints. |

The migration gate at `d660dd4` passed 32 tests. The subsequent review-probe integration, committed in `b395bb3`, raised the documented full gate to 38 tests, zero failures/skips, in both READ COMMITTED profiles (RCSI off/on). Later commits refactor four audit procedures. Planning has not rerun tests at HEAD; establish current evidence when implementation starts. See the [testing handoff](testing-handoff.md) for commands, database ownership/cleanup and the distinction between maintained tests and archived probes.

## Iterations and completion criteria

The order below is a proposal. Contact integration begins with the second family and grows throughout; it is not postponed until every table is built. Open decisions are resolved at the iteration that needs them, rather than turning all future security work into prerequisites for phone.

| Iteration | Deliverable | Completion criterion | Status |
| --- | --- | --- | --- |
| 0 | Bounded correction pass and current baseline | Constructor findings in scope have atomic rejection/concurrency regressions; existing full gate passes. | Planned |
| 1 | Complete phone family and shared reader boundary | As-of/diff/actions and C# reads prove email/phone state at the same revision; mixed saves have one revision, global action order and whole rollback. | Planned |
| 2 | Complete web-link family | SQL/C# lifecycle, ordering, visibility, history and mixed-family composition work. | Planned |
| 3 | Immutable address family and catalog contract | Shared-value reuse is safe, one contact's edit leaves others unchanged, and old revisions reconstruct old addresses. | Planned |
| 4 | Person/organization profile and contact lifecycle | Supported profile/name/root changes are audited; lifecycle and relationship boundaries are explicit. | Planned |
| 5a | Integrated contact service | Current/historical detail and atomic saves cover the declared fields/families using one read/write boundary respectively, with explicit trusted actor/tenant context. | Planned |
| 5b | Contact HTTP API | Endpoints apply authentication-derived context, authorization, visibility, validation and tested conflict/error responses to the completed service. | Planned |
| 6 | Administrative user provisioning | New-person/account and existing-person promotion use the contact API contracts, chosen login policy and explicit authorization. | Planned |

Paginated listing/search is a separately tracked contact-discovery deliverable after the service contracts stabilize. It remains part of the broader contact roadmap but does not block coherent detail/history, atomic Save or administrative provisioning. Do not describe the broader contact surface as complete while discovery is still pending.

## Decision checkpoints

| When | Decision to resolve | Current position |
| --- | --- | --- |
| Iteration 0 discussion | Login uniqueness scope and its tenant-resolution assumptions | Per-tenant uniqueness is a recommendation, not a settled consequence of single-tenant UX. Record the author's choice or an explicit deferral; this discussion does not block phone. Implement matching schema/constraints together with provisioning, unless the chosen correction scope requires them earlier. |
| Before the iteration 0 company fix | Company-name equality and serialization | Lookup, recheck and lock must agree for case, accents and trailing spaces. Compare a compatible application-lock scheme with indexed range locking; neither contention cost nor exact-name semantics is pre-approved. |
| Before iteration 1 reader implementation | Shared consistent read boundary | Use a coordinator with internal composable reader components and standalone public wrappers, reusing existing as-of functions. Validate transaction, locking and permission contracts as described below. |
| Before iteration 1 phone DDL | Complete phone value identity and derived matching | Explicitly define number/country/area-code fields and whether geographic FKs belong at all. Derive matching data from accepted inputs; do not inherit address geography. |
| Before iteration 1 public contracts | Meaning of `is_public` | Define whether and where it permits directory/public display, interaction with root privacy, and authorized internal access. Preserve the restrictive default; a child flag alone is not authorization to disclose a private contact. HTTP enforcement is completed in 5b. |
| Before iteration 3 | Address fields, catalog hierarchy and historical labels | Immutable complete values are settled; exact field identity, partial-address rules and catalog correction behavior still need definition. |
| Before iterations 4 and 6 | Profile/lifecycle/relationship scope; provisioning/activation scope | Keep the existing bounded decisions in those iterations. Dedicated group work and shared-user membership remain deferred. |

### 0. Corrections before expanding the public constructor boundary

Review the latest source and establish a fresh build/test baseline. Keep this pass bounded to the existing construction reference:

- Enforce person-only ordinary accounts on construction and promotion; retain working System bootstrap and normal person paths.
- Reject supplied unsupported contact-detail inputs during promotion, before defaults conceal whether inputs were supplied. Preserve the distinct account-email input. A dedicated promotion API follows in iteration 6.
- Correct the company-name miss race if the legacy convenience is retained. Choose matching/serialization semantics first: an exact-byte hash lock does not serialize case variants that a case-insensitive lookup considers equal. Recheck under the selected tenant/name protection and preserve rejection of pre-existing ambiguity. Test equal names and relevant case/accent/trailing-space variants under both profiles; measure unrelated-name contention. Indexed range locking is a candidate, not an assumption that its gap contention is acceptable.
- Correct creation-event occurrence metadata while preserving server recording time, and make the actual seed use the constructor's existing initial-role evidence.

Bring login scope into the iteration 0 discussion. Record the decision or explicit deferral separately from implementation; do not add `tenant_id` to `security.user` solely because this pass touches the constructor. A per-tenant implementation must maintain consistency with the owning entity and apply the chosen normalized uniqueness contract. Scope and normalization must be settled and enforced before provisioning exposure, but do not block unrelated child-family work.

Do not turn historical acceptance probes into desired behavior. [Testing handoff: unresolved recipes](testing-handoff.md#unresolved-recipes-and-future-assertions--not-executed-in-this-integration) supplies the counterexamples. General contact-constructor hardening belongs to iteration 4; explicit root operation semantics must precede its lifecycle writers.

### 1. Phones: prove the second family

Define the accepted number, normalized matching representation, country context, area code, extension, label and visibility contract. Preserve entered data; do not assume the existing Mexico-oriented domain formatting functions define international identity. Decide duplicate-association behavior and distinguish omitted fields from explicit clearing in the eventual API.

Make these current constructor counterexamples explicit in the new tests: lookup uses only `phone_number` while the value also carries area code, matching digits and geographic IDs; a new number without `numbers_only` fails its NOT NULL column; and phone geography comes from the preceding address block. Enumerate the complete value key, derive matching digits from validated number/context inputs, and remove the address coupling. Keep extension on the association. Detailed presentation formatting can evolve later, but country/context semantics needed for identity cannot be deferred with it.

Rebuild the fresh-schema `contact_phone` definition with tenant, stable ordinal, value/label references, extension, visibility, saved order and audit version. Add retained identity, final history and action tables with consistent widths and checked FKs. This is a family schema replacement, not just repairing the existing history width; it does not supply a populated-database upgrade.

Implement public wrappers/private writer, as-of function, SQL reader with diff/actions, C# commands and reader, schema registration/drop and restricted permissions. Route initial constructor phones through the same writer so creation remains revision 1. Current summary views must select saved order rather than `ordinal = 1`.

Establish reader composition now. `contact_email_read` currently owns a SERIALIZABLE transaction and rejects ambient transactions with 51400. Retain that safe standalone public contract while extracting/reusing internal read components for a trusted coordinator. The coordinator owns one read transaction, resolves actor/tenant/root and revision bounds, and holds the existing shared root-key barrier before reading any family's state, diff or actions. Internal components must neither begin/commit independently nor accept arbitrary application transactions as proof of a valid read boundary. Keep them private, document their preconditions, and preserve root-leading seeks and current reader permission behavior. Reuse `contact_emails_as_of` rather than duplicating its reconstruction logic. Decide how the C# reader consumes combined result sets without exposing raw transaction ownership to ordinary callers.

Deliver a composed email/phone read at the same revision in this iteration, including a concurrent writer regression that proves consistent before/after results and the retained root barrier. A database SNAPSHOT reader profile remains optional future work. Apply this reader structure when adding web links and addresses.

The key integration example is one Save that changes an email and phone. Require one allocation/revision, ordered actions across families, complete historical states and full rollback after either command fails. Reuse existing unit/locking primitives. Let this second family expose useful common abstractions before inventing a generic configurable family engine.

### 2. Web links

Define URL, link type, label, display text, visibility and accepted length/normalization behavior. Preserve meaningful URL differences; choosing a normalized search representation does not authorize rewriting the stored value. Decide which fields belong to the shared value and which to the association.

Build the full family using the mechanism proved by email and phone. Align the existing C# domain objects with stable identity and saved order. Include creation, editing, delete/restore, move/default, historical state/diff/actions and combined saves with the preceding families.

### 3. Addresses and geographic catalogs

Ownership is settled: the address value is immutable and the contact association contains no address text. The value may contain geographic FKs and remaining textual fields directly. Additional catalogs for address lines are not a prerequisite.

Resolve these field-level choices before DDL:

- Supported fields: lines 1/2, structured street and exterior/interior numbers, colony, county, postal code, city, state, country and references. Choose one source of truth or explicit precedence if lines and structured components coexist.
- Geographic lookup scope and consistency: names need their parent context where appropriate; do not copy global state/county-name uniqueness blindly. Define treatment of missing parents and partial/international addresses.
- Exact-value reuse: enumerate all participating fields, NULL versus empty semantics, widths, accepted text and concurrent miss handling. Reuse is a storage choice, not an inference that differently written addresses identify one physical place.
- Catalog corrections: a historical address must not silently acquire a new historical city/state label through a mutable catalog join. Choose immutable catalog values, versioned resolution or captured historical labels as appropriate.
- Association metadata: label reference, ordering and visibility policy. The author's references-only address-content decision remains intact; identity, tenancy/version fields and any agreed visibility flag serve the association rather than storing address content.

Turn these source-visible counterexamples into named regression cases for this iteration:

- `contact_insert` reuses an address by lines, postal code and city/state/country only, ignoring `street_name`, `ext_number`, `int_number`, `colony_id`, `county_id` and `references`. An existing row differing in an omitted field must not be silently adopted as the requested complete value.
- The same lookup conflates NULL and empty text through COALESCE. Test the selected explicit policy and preserve accepted distinctions instead of inheriting this behavior accidentally.
- `ensure_address_location_upsert` picks the first matching state/city when parent context is missing. Resolve only an unambiguous consistent hierarchy or return a defined unresolved/rejection result; never guess. Reject invalid explicit IDs and contradictory supplied parent/child IDs rather than silently falling back or mixing hierarchies.
- Catalog misses are not serialized, and state/county names are globally unique. Replace those assumptions with scoped value identity, checked hierarchy and transaction-owned miss protection. Prefer the established read-first application-lock/recheck pattern with keys consistent with lookup equality; verify same-name different-parent cases and concurrent same-value creation under both profiles.

Implement the same complete lifecycle and constructor integration as the other families. Prove that two contacts can reference one address, editing one repoints only that association, and historical reads retain the old value and correct catalog interpretation. Test partial addresses, concurrent value creation and mixed-family rollback. A relationship to an organization's live office location is separate work; shared immutable values do not imply automatic propagation to employees.

### 4. Persons, organizations and contact-level operations

Declare the supported Contact v1 profile fields and history coverage. Cover both entity presentation fields and contact payload; full name alone does not reconstruct editable structured person-name components. Define name/display-name derivation and explicit clearing behavior. Keep organization fields distinct from person fields. Contact-category conversion remains undecided; account promotion changes entity type and is not permission to convert an organization into a person.

Preserve exact accepted person-name spelling through dictionary resolution as well as history. The current `person_name` UNIQUE and lookups use database collation; under case-insensitive collation, `Ernesto` and `ERNESTO` can reuse the first spelling. Use exact-value interning consistent with the email bytes-and-length pattern, with normalized search kept separate. Regress case, accents and trailing-space distinctions under the declared accepted-input policy, current views and earlier revisions; historical name references must not acquire another contact's spelling.

Harden the contact construction boundary with strict actor/tenant resolution and required context, removing reliance on privileged legacy fallbacks for public calls. Compose initial child collections through family writers in one unit. Expose revisions and stable child identifiers through C# contracts.

Define soft delete/restore semantics and give root snapshots explicit validated operation semantics before implementing those writers. Address child visibility/editability while a root is inactive, restoration behavior, and what happens when the contact is also an account or is a referenced organization. Do not silently cascade account disablement, role changes or relationship removal. If lock/unlock or validation transitions are included, give them similarly explicit contracts; otherwise mark them unsupported in v1.

For organization relationships, prefer explicit contact identity over names. Decide whether employment/representation belongs in v1. If included, specify cardinality, owning aggregate, locking, history and historical display of the referenced party. Dedicated group membership/hierarchy remains deferred. Preserve legacy behavior outside the new capability without claiming it has acquired these guarantees.

### 5a. Integrated contact service and coherent reader

Create service contracts for person/organization creation, supported profile changes, child operations, current detail, historical revision/diff and lifecycle operations. Align domain models and response DTOs with saved order, visibility and revision tokens. The service takes trusted authenticated actor context and always passes its explicitly resolved tenant to the database. Define and test contact-level authorization and visibility decisions here; HTTP authentication supplies this context in 5b, not from request-body actor identifiers.

A logical Save may contain profile and several child commands. It must preserve the established one-unit contract and return final committed revisions/identities. Distinguish updates from whole-list replacement and define omitted versus cleared values. Define consistent ordering of actions across families.

Extend the reader coordination implemented with phone to the complete declared fields/families at one aggregate revision and one consistent read boundary. Calling independent public family readers sequentially is not proof of a coherent current contact snapshot. Preserve historical root/profile/name and catalog context. Return the supported scope honestly; do not fabricate history for unported relationships.

Define service-level validation, conflict and uncertain-commit outcomes. If automatic request retries are promised, add durable idempotency/recovery receipts before making that promise.

Acceptance example: create a person with all four child families, then change their name, phone and address in one Save. Read both revisions, inspect the combined diff/actions, demonstrate stale-token rejection and prove that a failing final command rolls back the entire Save. Repeat relevant operations for an organization, verify the reader against a concurrent writer, and exercise allowed/denied service access. This iteration can complete without HTTP.

### 5b. Contact HTTP boundary

Expose the completed service operations through HTTP with authentication-derived actor context and explicitly resolved tenant, authorization, the chosen visibility semantics, request validation and intentional status/error responses. Client-supplied actor GUIDs are not authentication; user-facing tenant omission must not silently route requests to the SQL default tenant. Wire the trusted context and authorization contracts from 5a to the selected authentication integration.

Verify unauthenticated and unauthorized requests, cross-tenant attempts, private/public child exposure, successful person/organization operations, stale revisions and uncertain-commit response behavior. Confirm that HTTP orchestration preserves the service's atomic Save; it must not split a logical operation into independently committed requests behind the scenes. This is the completion gate for the declared contact detail/edit/history HTTP surface.

Track paginated listing and search separately: define filters, stable pagination, tenant/visibility filtering and indexes after service DTOs stabilize. They remain pending contact capabilities, not requirements for passing 5a's audit-mechanism gate or beginning provisioning.

### 6. Administrative user provisioning

Provide two clear operations: create a new person with an account, and promote an existing person using its expected revision. Promotion accepts account inputs; callers can compose explicit contact edits in the same unit when authorized. Preserve previous contact history and the existing one-revision promotion behavior.

Implement the login scope selected through the iteration 0 discussion, settling any explicitly deferred policy and its normalization before exposure. Apply the matching database constraints, constructor validation, tenant/entity consistency and history changes together. Single-tenant UX does not by itself select a database uniqueness constraint. If names can repeat across tenants, establish tenant context before resolving the account; picking a default tenant after an ambiguous login does not resolve the identity. Current deployments do not require shared-user membership or tenant switching.

Define who may provision accounts and assign initial roles, the source of authenticated administrator identity, and whether activation/invitation is included. Define the initial credential handoff if needed; do not place credentials/tokens in general history. Account email/phone verification, ongoing credential recovery and general role lifecycle require separate contracts if brought into scope.

Verify atomic rejection for organizations/groups, duplicate logins including concurrent attempts, stale/competing promotions, unauthorized initial roles and mixed contact/provisioning rollback. Keep creation evidence and initial-role choice observable. Public self-registration and a full authentication product are separate from this administrative provisioning milestone.

## Completion gate for each implementation iteration

- Record the selected contract, bounded changes and remaining decisions. Add or update an ADR when behavior changes; preserve historical independent reviews as evidence.
- Complete SQL, schema-builder create/drop registration, constructor integration, C# methods/readers and grants for the declared capability. Keep internal helpers and tables outside ordinary application access.
- For every child family, deliver an as-of function, composable SQL read components plus standalone reader, diff and ordered actions, and a C# reader. Prove expected payloads at known before/after revisions, ordering, deletion/restoration and no-op behavior. Include a mixed-family Save with exactly one root revision, cross-family action order, full rollback and a coordinated read under concurrent writing. Apply this evidence checklist to iterations 1–3; "history exists" is insufficient.
- Add meaningful lifecycle, historical reconstruction, actor/tenant, permissions, concurrency and rollback tests for the changed behavior. Exercise existing shared guarantees through composition rather than duplicating every infrastructure test mechanically.
- Run focused checks and then the maintained full gate under both profiles using the [testing handoff](testing-handoff.md). Record actual commit/worktree, counts, failures/skips and verified disposable-database removal. Test the real schema cycle when schema/seed integration changes.
- Update this tracker and both guides where their implementation claims change. Report what is complete and what remains; passing child tests alone does not establish HTTP or full-contact completion.

For each iteration append a short execution record: date, scope, decisions, source checkpoint, changed entry points, verification/evidence, remaining work and next iteration. Keep all iterations above marked planned until work is actually delivered. This planning pass checks documentation only and does not claim a new database test run.

## SQL authoring style

Follow the author's [create_audit_unit_begin.sql](../src/Framework/Sistrategia.Data.SqlClient/Scripts/Data/create_audit_unit_begin.sql) style for new and substantively edited SQL scripts: the repository copyright/license and script header, concise contract comments, uppercase keywords, bracketed application schema/object names, four-space indentation, separated logical steps, explicit BEGIN/END blocks for conditional branches, readable declarations and multiline named EXEC arguments. Keep intentional statement terminators and readable THROW formatting. Use accurate dates/version/contributor metadata rather than copying the reference's historical values into new scripts.

Style does not change transaction ownership, execution permissions or isolation contracts: `WITH EXECUTE AS OWNER`, for example, is selected for the procedure's security needs and is not a formatting default. Avoid unrelated mass reformatting; apply this convention within each iteration's touched SQL scope.

## Planning revision record

2026-09-07, revision 2: incorporated independent feedback after source checks. Added early reader composition, explicit phone/address/name fidelity regressions, family evidence criteria, service tenant context and visibility checkpoints; split integration into 5a/5b and separated contact discovery. Brought login scope into the first discussion without treating it as decided or blocking child work. Kept company equality/locking as an explicit design choice and retained phone → web links → addresses. Recorded the author's SQL style preference. No production SQL/C# changes or database test execution belong to this revision.

## Deferred work

Dedicated groups and membership/hierarchy; shared users across tenants and tenant switching; public self-registration; complete account/role lifecycle and recovery; contact merge/deduplication; live office/location inheritance; permanent erasure; customer upgrades/backfill; historical migration/coverage adapters; disconnected delivery; other providers; production-scale benchmarks and remote CI/deployment verification. These are retained work, not prerequisites for every family. Revisit an item only when a selected iteration needs its contract.

## Working references

- [Design handoff](dbrow_version-design-session-handoff.md) and [primary design](dbrow_version-allocation-design.md).
- [Email usage/reference](email-reference-family.md), [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) and [family porting recipe](guide-cc/10-porting-a-family.md).
- [Ordinary user construction, ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md) and [independent review](user-construction-independent-review.md); newer person-only policy supersedes its open eligibility question.
- [Focused legacy findings](dbrow_version-legacy-implementation-findings.md), before bounded source intake for a family.
- [Testing handoff](testing-handoff.md), [guide-co](guide-co/README.md) and [guide-cc](guide-cc/README.md).
