# Contact and user provisioning master plan

Updated: 2026-09-07, iterations 0–5b complete. Iteration 6 is next and has not started.
Production source checkpoint reviewed: `bb2b2c2`; original plan committed in `52a0e1c`. This document tracks the next work; ADRs 0005–0015 describe the implemented foundation.

The goal is to grow the email reference into a coherent contact API for persons and organizations, then build administrative user provisioning on that API. Deliver one bounded iteration at a time, with usable SQL/C# behavior, historical evidence and verification before moving on. The author authorized iterations 0–5b on 2026-09-07; later iterations remain planned.

## Decisions already made

| Subject | Decision and consequence |
| --- | --- |
| Audit foundation | Keep one owned audit unit, one actor/tenant and one aggregate bump per unit, unit-entry optimistic tokens, final touched-row history and ordered effective actions. Email is the implemented reference. |
| Initial contact scope | Focus on persons and organizations. A group remains a valid conceptual party that can collect organizations or people and have its own contact information. Dedicated group/membership work is deferred; do not redefine a group as merely a UI list or remove existing group support. |
| Ordinary accounts | Only human person contacts receive ordinary accounts, on both new construction and promotion. Organizations and groups can be parties, but do not become ordinary login identities or write actors. Reserved System bootstrap is the existing technical exception. Iteration 0 implements enforcement and regression tests for new construction/promotion. |
| Address ownership | Complete address values are shared and immutable. `contact_address` holds references and ordering, with required identity/audit metadata; it does not contain address text. Editing one association selects or creates another address value and leaves other contacts and earlier history unchanged. |
| Address catalogs | An address may reference `country_id`, `state_id`, city and other geographic catalogs. Address lines may be NVARCHAR columns on the immutable address value. Interning the lines into additional catalogs is optional and undecided. |
| Tenant experience | Optimize for existing single-tenant applications and multitenant applications without shared users. The application may resolve tenant context without asking the user to type it at login. Shared-user membership, default-tenant selection and tenant switching are future possibilities, not an implemented contract. |
| Service tenant context | The service resolves and passes an explicit tenant to database operations, from trusted application/host or authenticated context. The SQL resolver's existing default GUID is a compatibility behavior, not the service's tenant-selection contract. |
| Account contact channels | Contact email and phone are distinct from account email and recovery/verification phone. A contact edit must not silently modify security channels or confirmation state. |
| Phone identity and parsing | Complete international identity; preserve raw input and versioned interpretation separately. Explicit country for national/split input, optional LADA decomposition and qualified numbering geography. See [ADR 0009](adr/0009-phone-values-parsing-and-numbering-geography.md). |
| Delivery scope | Build on fresh-schema SQL Server support first. Customer upgrades, synchronization and additional providers remain separate deliverables. Preserve the portable behavioral contracts. |

The author explicitly retained stable ordinal identity plus separate display_order position as the convention for the new child lists: first saved item is default, insert/restore append, and delete closes gaps. Family-specific deviations, if needed, must be explicit. Labels and visibility are association metadata, not part of the shared address's identity. Iteration 3 uses an optional immutable label reference and restrictive is_public default; see ADR 0012.

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

The migration gate at `d660dd4` passed 32 tests. The subsequent review-probe integration, committed in `b395bb3`, raised the documented full gate to 38 tests, zero failures/skips, in both READ COMMITTED profiles (RCSI off/on). Later commits refactor four audit procedures. Iteration 0 established a fresh 38-test baseline and completed the expanded 42-test gate; its execution record below supersedes this starting position. See the [testing handoff](testing-handoff.md) for commands, database ownership/cleanup and the distinction between maintained tests and archived probes.

## Iterations and completion criteria

The order below is a proposal. Contact integration begins with the second family and grows throughout; it is not postponed until every table is built. Open decisions are resolved at the iteration that needs them, rather than turning all future security work into prerequisites for phone.

| Iteration | Deliverable | Completion criterion | Status |
| --- | --- | --- | --- |
| 0 | Bounded correction pass and current baseline | Constructor findings in scope have atomic rejection/concurrency regressions; existing full gate passes. | Complete; [ADR 0008](adr/0008-constructor-corrections.md) |
| 1 | Complete phone family and shared reader boundary | As-of/diff/actions and C# reads prove email/phone state at the same revision; mixed saves have one revision, global action order and whole rollback. | Complete; [ADRs 0009](adr/0009-phone-values-parsing-and-numbering-geography.md)/[0010](adr/0010-composed-contact-family-reader.md) |
| 2 | Complete web-link family | SQL/C# lifecycle, ordering, visibility, history and mixed-family composition work. | Complete; [ADR 0011](adr/0011-web-link-values-and-contact-associations.md) |
| 3 | Immutable address family and catalog contract | Shared-value reuse is safe, one contact's edit leaves others unchanged, and old revisions reconstruct old addresses. | Complete; [ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md) |
| 4 | Person/organization profile and contact lifecycle | Supported profile/name/root changes are audited; lifecycle and relationship boundaries are explicit. | Complete; [ADR 0013](adr/0013-contact-profiles-names-and-root-lifecycle.md) |
| 5a | Integrated contact service | Current/historical detail and atomic saves cover the declared fields/families using one read/write boundary respectively, with explicit trusted actor/tenant context. | Complete; [ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md) |
| 5b | Contact HTTP API | Endpoints apply authentication-derived context, authorization, visibility, validation and tested conflict/error responses to the completed service. | Complete; [ADR 0015](adr/0015-contact-http-authentication-and-wire-contract.md) |
| 6 | Administrative user provisioning | New-person/account and existing-person promotion use the contact API contracts, chosen login policy and explicit authorization. | Planned |

Paginated listing/search is a separately tracked contact-discovery deliverable after the service contracts stabilize. It remains part of the broader contact roadmap but does not block coherent detail/history, atomic Save or administrative provisioning. Do not describe the broader contact surface as complete while discovery is still pending.

## Decision checkpoints

| When | Decision to resolve | Current position |
| --- | --- | --- |
| Iteration 0 discussion | Login uniqueness scope and its tenant-resolution assumptions | **Author explicitly deferred until provisioning, 2026-09-07.** No login constraint or account tenant column is added in iteration 0. Decide and enforce the policy before provisioning exposure. |
| Before the iteration 0 company fix | Company-name equality and serialization | **Selected in iteration 0:** retain database-collation equality and use tenant-scoped CHECKSUM synchronization buckets with full-predicate recheck. Collisions only add waiting. See ADR 0008 for seeks, collation-drift rejection, tests and tradeoffs. |
| Before iteration 1 reader implementation | Shared consistent read boundary | Selected: one coordinator-owned SERIALIZABLE transaction and root barrier, private family components and existing as-of functions; [ADR 0010](adr/0010-composed-contact-family-reader.md). |
| Before iteration 1 phone DDL | Complete phone value identity and derived matching | Selected with the author: E.164 identity, calling code/national strings, preserved input, backend parsing and optional metadata decomposition. Geographic catalog FKs belong to a separate versioned prefix-to-many-places map; no address inheritance. |
| Before iteration 1 public contracts | Meaning of `is_public` | Directory-display eligibility, subject to root privacy and application authorization; restrictive default. Trusted internal readers retain flags and data. No anonymous endpoint in iteration 1; HTTP enforcement remains in 5b. |
| Before iteration 3 | Address fields, catalog hierarchy and historical labels | Selected in iteration 3: lines or structured street per value, exact full-field identity, explicit partial scopes and immutable catalog labels; [ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md). |
| Before iterations 4 and 6 | Profile/lifecycle/relationship scope; provisioning/activation scope | Iteration 4 selects explicit profile replacement, protected soft delete/restore, no category conversion or relationship editing. Provisioning scope remains for iteration 6; groups/shared-user membership remain deferred. |

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

Delivered in [ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md) and the
[address guide](address-family.md). The requirements below are retained as the acceptance checklist.

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

Implemented contract: [ADR 0013](adr/0013-contact-profiles-names-and-root-lifecycle.md) and the
[profile/lifecycle guide](contact-profile-and-lifecycle.md). The requirements below remain the acceptance checklist.

Declare the supported Contact v1 profile fields and history coverage. Cover both entity presentation fields and contact payload; full name alone does not reconstruct editable structured person-name components. Define name/display-name derivation and explicit clearing behavior. Keep organization fields distinct from person fields. Contact-category conversion remains undecided; account promotion changes entity type and is not permission to convert an organization into a person.

Preserve exact accepted person-name spelling through dictionary resolution as well as history. The current `person_name` UNIQUE and lookups use database collation; under case-insensitive collation, `Ernesto` and `ERNESTO` can reuse the first spelling. Use exact-value interning consistent with the email bytes-and-length pattern, with normalized search kept separate. Regress case, accents and trailing-space distinctions under the declared accepted-input policy, current views and earlier revisions; historical name references must not acquire another contact's spelling.

Harden the contact construction boundary with strict actor/tenant resolution and required context, removing reliance on privileged legacy fallbacks for public calls. Compose initial child collections through family writers in one unit. Expose revisions and stable child identifiers through C# contracts.

Define soft delete/restore semantics and give root snapshots explicit validated operation semantics before implementing those writers. Address child visibility/editability while a root is inactive, restoration behavior, and what happens when the contact is also an account or is a referenced organization. Do not silently cascade account disablement, role changes or relationship removal. If lock/unlock or validation transitions are included, give them similarly explicit contracts; otherwise mark them unsupported in v1.

For organization relationships, prefer explicit contact identity over names. Decide whether employment/representation belongs in v1. If included, specify cardinality, owning aggregate, locking, history and historical display of the referenced party. Dedicated group membership/hierarchy remains deferred. Preserve legacy behavior outside the new capability without claiming it has acquired these guarantees.

### 5a. Integrated contact service and coherent reader

The implemented contract is [ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md); the [service guide](contact-service.md) gives setup and usage. The criteria below remain the scope of this iteration.

Create service contracts for person/organization creation, supported profile changes, child operations, current detail, historical revision/diff and lifecycle operations. Align domain models and response DTOs with saved order, visibility and revision tokens. The service takes trusted authenticated actor context and always passes its explicitly resolved tenant to the database. Define and test contact-level authorization and visibility decisions here; HTTP authentication supplies this context in 5b, not from request-body actor identifiers.

A logical Save may contain profile and several child commands. It must preserve the established one-unit contract and return final committed revisions/identities. Distinguish updates from whole-list replacement and define omitted versus cleared values. Define consistent ordering of actions across families.

Extend the reader coordination implemented with phone to the complete declared fields/families at one aggregate revision and one consistent read boundary. Calling independent public family readers sequentially is not proof of a coherent current contact snapshot. Preserve historical root/profile/name and catalog context. Return the supported scope honestly; do not fabricate history for unported relationships.

Define service-level validation, conflict and uncertain-commit outcomes. If automatic request retries are promised, add durable idempotency/recovery receipts before making that promise.

Acceptance example: create a person with all four child families, then change their name, phone and address in one Save. Read both revisions, inspect the combined diff/actions, demonstrate stale-token rejection and prove that a failing final command rolls back the entire Save. Repeat relevant operations for an organization, verify the reader against a concurrent writer, and exercise allowed/denied service access. This iteration can complete without HTTP.

### 5b. Contact HTTP boundary

The implemented contract is [ADR 0015](adr/0015-contact-http-authentication-and-wire-contract.md); the [HTTP guide](contact-http-api.md) gives configuration, claims, payloads and responses.

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

## Iteration 0 execution record — 2026-09-07

Implemented locally over `4a30dc0`, following the author's authorization. Ordinary accounts now require
person contacts on construction/promotion; unsupported promotion details are rejected before defaults,
with whole-unit rollback coverage. Company convenience lookup uses tenant/collation-compatible miss
protection and a full-name recheck. A measured READ COMMITTED actor scan was corrected with a targeted
seek so unrelated company creation can proceed. Creation occurrence reaches `entities.event.created`;
server recording stays in the audit ledger. The actual seed uses constructor initial-role evidence.

The author explicitly deferred login uniqueness until provisioning. No login constraint was added.
SQL formatting follows the requested audit-unit style on substantively touched scripts.

Baseline 38/38 and final 42/42 passed, including both RCSI profiles; final duration 5 min 14 sec,
zero failures/skips or build warnings/errors. All 149 distinct disposable databases across the seven
runs have verified removal evidence. See [ADR 0008](adr/0008-constructor-corrections.md) and the
[testing execution record](testing-handoff.md#iteration-0-constructor-corrections--2026-09-07).
The next step at that checkpoint was iteration 1, now delivered in the record below.

## Iteration 1 execution record — 2026-09-07

Authorized after discussion of Mastio/CFUS split phone input and geographic segmentation; implemented
locally over iteration 0 commit `78e2d9e`. [ADR 0009](adr/0009-phone-values-parsing-and-numbering-geography.md)
records complete international identity, preserved input/metadata, explicit backend parsing and qualified
numbering geography. [ADR 0010](adr/0010-composed-contact-family-reader.md) records the shared read transaction
and private components. [Phone family](phone-family.md) gives SQL/C# entry points and a mixed Save example.

Delivered phone lifecycle, retained identity, saved order, final history, diffs/actions, immutable values,
constructor/seed integration and checked FKs. SqlAuditUnit composes email/phone changes and rolls back both
after parser/SQL failure. SqlContactChannelsReader reconstructs both families under one root barrier;
the email-only API remains compatible. A new opt-in role adds phone without widening existing email grants.
Labels/extensions survive their full widths through both constructors. Legacy ambiguous phone parameters
reject; adapters use PhoneParser.PrepareForDatabase. Current summaries follow saved principal order.

Final build/discovery and full gate passed **53/53**, both RCSI profiles, zero failures/skips or build
warnings/errors, **5 min 30 sec**. All **142** distinct disposable databases across seven runs have verified
removal records; [testing evidence](testing-handoff.md#iteration-1-phone-and-composed-reader--2026-09-07).
Geographic-ID mapping tables are deliberately empty pending a sourced dataset; parser metadata already
provides qualified numbering-region/area grouping. Fresh schemas only; no customer migration, phone UI,
HTTP API, account-phone workflow or independent review execution is claimed. Login uniqueness remains
deferred until provisioning. Next at that checkpoint was iteration 2, now authorized and implemented below.

## Iteration 2 execution record — 2026-09-07

Authorized over `00c72f2`, after the author confirmed ordinal identity and display_order position.
[ADR 0011](adr/0011-web-link-values-and-contact-associations.md) records exact immutable HTTP/HTTPS
URLs, contact-owned type/display text/label/visibility and the validation boundary. Full lifecycle,
historical state/diffs/actions, constructor/promotion integration, grants and C# commands/readers are
implemented. The shared reader adds web links after email/phone under the same root barrier.
Domain objects retain exact values and stop allocating ordinal identities in collection insertion.
The [usage guide](web-link-family.md) describes the ten-result-set composed reader and native contract.

Focused web-link tests passed 11/11; the initial real schema cycle passed 2/2. The final full gate
passed **64/64**, both RCSI profiles, zero failures/skips or build warnings/errors, **6 min 38 sec**.
All **74 created databases** have verified removal evidence; two initial sandbox connection-failure
intent names were separately checked absent. See the [testing record](testing-handoff.md#iteration-2-web-links--2026-09-07).
Next at that checkpoint was iteration 3, now delivered below. Login uniqueness remains deferred until provisioning. Fresh schemas only; no HTTP,
customer upgrade, sibling-project change or independent review execution is claimed.

## Planning revision record

2026-09-07, revision 2: incorporated independent feedback after source checks. Added early reader composition, explicit phone/address/name fidelity regressions, family evidence criteria, service tenant context and visibility checkpoints; split integration into 5a/5b and separated contact discovery. Brought login scope into the first discussion without treating it as decided or blocking child work. Kept company equality/locking as an explicit design choice and retained phone → web links → addresses. Recorded the author's SQL style preference. No production SQL/C# changes or database test execution belong to this revision.

## Iteration 3 execution record — 2026-09-07

Authorized over committed iteration 2 (`06d177d`); implementation remains local/uncommitted.
[ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md) records complete immutable
addresses, all-field exact identity, scoped immutable geographic catalogs, partial addresses and
replacement-based corrections. The [address guide](address-family.md) gives C#/SQL usage. The
implementation supports address lines or structured street/number fields, one representation per
value, using the stated assumption after an optional question received no reply.

Delivered the complete SQL/C# lifecycle, saved order, retained identity, history/diffs/actions,
constructor integration, checked FKs, restricted capability and domain state. Contact associations
contain references and identity/order/audit/visibility metadata only. Catalog/value edits select
replacements, preserving other contacts and historical labels. The shared reader now reconstructs
email, phone, web links and addresses under one root barrier, with global action order and rollback
across all four families. Earlier standalone reader contracts remain intact.

Focused verification passed **17/17**; the full gate passed **77/77**, both RCSI profiles,
**8 min 58 sec**, zero failures/skips or build warnings/errors. All **110** disposable databases
across five runs have verified removal evidence; [testing record](testing-handoff.md#iteration-3-immutable-addresses--2026-09-07).
Both guide families, handoffs and schema-cycle coverage are updated. Official geographic datasets,
source mappings, customer migration and service/HTTP are not delivered. Next at that checkpoint was
iteration 4, now delivered below. Login scope remains deferred until provisioning.

## Iteration 4 execution record — 2026-09-07

Authorized over committed iteration 3 (`4f4fd78`); implementation remains local/uncommitted.
[ADR 0013](adr/0013-contact-profiles-names-and-root-lifecycle.md) and the
[profile/lifecycle guide](contact-profile-and-lifecycle.md) define explicit person/organization
profile replacement, exact immutable name values and complete relational profile history.
The new contact capability creates contacts, edits supported fields and performs protected soft
delete/restore. Initial and later profile/channel commands share one audit unit and root revision.
Root history now receives explicit operation intent; effective commands retain ordered action evidence.

The full SQL/C# reader adds profile state, differences and actions to all four child families under
the existing root barrier. Previous channel readers retain their result shapes. Existing constructor
and System name/profile snapshots use the same history helper. The opt-in contact_runtime role adds
the new public commands and reader while private helpers and legacy constructors remain restricted.

Protected deletion and deferral of relationship editing/category conversion were stated implementation
assumptions after optional questions received no reply. Deletion rejects accounts and linked contacts;
restore preserves child identities and saved order. Employment/representation editing, lock/validation
transitions and account lifecycle remain separate. Login uniqueness remains deferred until provisioning.

Final focused tests passed **15/15**; the full gate passed **90/90**, both RCSI profiles,
**11 min 13 sec**, zero failures/skips or build warnings/errors. All **128** disposable databases
across seven runs have matching intent/create/identity/removal evidence, with verified post-DROP absence.
See the [testing record](testing-handoff.md#iteration-4-contact-profiles-and-lifecycle--2026-09-07).
Fresh-schema/local SQL Server verification only. Next at that checkpoint was iteration 5a, implemented below.
Service/HTTP, discovery, customer upgrades and independent review execution were outside iteration 4.

## Iteration 5a execution record — 2026-09-07

Authorized over committed iteration 4 (`c421d3a`); implementation is now committed in `7d99164`.
Final verification/handoff updates remain local.
[ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md) and the
[service guide](contact-service.md) define IContactService/SqlContactService, scoped registration,
explicit trusted actor/tenant context and required contact-capability authorization. No permissive
production policy or HTTP registration is installed; the host supplies both context and grants.

One ordered Save composes profile and all four families through one unit/original expected token,
returning committed final revision and command-indexed child identities. Omitted commands preserve
state; Replace supplies complete declared fields and NULL clears optional values. No whole-list
replacement, automatic replay or durable receipt is claimed. New-child ordinals are returned after
commit; initial order follows insertion order. Domain/state DTOs preserve stable ordinal, saved order
and visibility without silently round-tripping the older mutable Contact graph.

Current detail contains declared state only; historical detail additionally requires history access.
Directory detail is a separate projection that hides private/deleted roots, private channels, personal
profile fields and history/actions. Current revision selection happens inside the full reader's existing
root barrier; prior result-set shapes remain compatible. Known failures map to service categories while
cancellation and uncertain commit retain distinct outcomes. SQL still enforces active actor/tenant scope.

Focused verification passed **13/13** including all service scenarios in both RCSI profiles, database-free
guards and actual schema/DI integration using the normal seeded actor. Final build/discovery passed with
zero warnings/errors. The full gate passed **101/101** in **12 min 17 sec**, both RCSI profiles,
zero failures/skips. All **118** disposable databases across three runs have matching intent, creation,
engine identity and verified removal; see the [testing record](testing-handoff.md#iteration-5a-integrated-contact-service--2026-09-07).
Next at that checkpoint was iteration 5b, now implemented below. Login uniqueness remains deferred
until provisioning. Customer upgrades, discovery/search, deployment and independent review are separate.

## Iteration 5b execution record — 2026-09-07

Authorized over `04a4409`; local/uncommitted. [ADR 0015](adr/0015-contact-http-authentication-and-wire-contract.md)
and the [HTTP guide](contact-http-api.md) define validated JWT authentication, signed database actor/tenant
claims and per-contact/tenant-scoped grants. Configurable JWT was the stated assumption after an optional
question received no reply; no particular provider, live issuer or token issuance is claimed.

Delivered five contact routes for create, atomic ordered Save, current detail, historical revision/diff
and limited directory detail. The wire contract rejects unknown/duplicate/spoofed fields, bounds streamed
bodies and preserves Int64 stamps as strings. The same service read/write boundary enforces coherence,
privacy and full rollback. Responses distinguish validation, missing data, authorization, stale tokens,
dependencies and uncertain commit, with no automatic retries or internal diagnostics exposed.
Development schema operations now require explicit Development opt-in and a separate signed grant.
OpenAPI includes authentication, request bodies and all 23 command alternatives.

Initial focused tests passed 7/7; expanded focused verification passed **7/7 in 49 sec**, including real
JWT middleware, every command kind, both SQL profiles, cross-tenant requests, streamed limits and bigint
precision. Restore/build/discovery passed with zero warnings/errors. The full gate passed **108/108** in
**14 min 49 sec**, both RCSI profiles, zero failures/skips. All **108** disposable databases across three
runs have verified removal (216 journal copies, zero unresolved); details are in the
[testing handoff](testing-handoff.md#iteration-5b-contact-http-boundary--2026-09-07).
No SQL/audit mechanism, historical probe or original fixture changed. Next is **iteration 6**, beginning
with the explicitly deferred login uniqueness/tenant-resolution decision. Listing/search, live issuer
setup, deployment and customer migrations remain separate work.

## Deferred work

Dedicated groups and membership/hierarchy; shared users across tenants and tenant switching; public self-registration; complete account/role lifecycle and recovery; contact merge/deduplication; live office/location inheritance; permanent erasure; customer upgrades/backfill; historical migration/coverage adapters; disconnected delivery; other providers; production-scale benchmarks and remote CI/deployment verification. These are retained work, not prerequisites for every family. Revisit an item only when a selected iteration needs its contract.

## Working references

- [Design handoff](dbrow_version-design-session-handoff.md) and [primary design](dbrow_version-allocation-design.md).
- [Email usage/reference](email-reference-family.md), [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) and [family porting recipe](guide-cc/10-porting-a-family.md).
- [Ordinary user construction, ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md) and [independent review](user-construction-independent-review.md); newer person-only policy supersedes its open eligibility question.
- [Focused legacy findings](dbrow_version-legacy-implementation-findings.md), before bounded source intake for a family.
- [Testing handoff](testing-handoff.md), [guide-co](guide-co/README.md) and [guide-cc](guide-cc/README.md).
