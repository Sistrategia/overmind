# Contact and user provisioning master plan

Updated: 2026-09-07. Status: planning; implementation iterations have not started.
Source checkpoint reviewed: `bb2b2c2`. This document tracks the next work; ADRs 0005–0007 describe the implemented foundation.

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

The latest documented full gate passed 38 tests, zero failures/skips, in both READ COMMITTED profiles (RCSI off/on). Subsequent commits refactor four audit procedures. Planning has not rerun tests at HEAD; establish current evidence when implementation starts. See the [testing handoff](testing-handoff.md) for commands, database ownership/cleanup and the distinction between maintained tests and archived probes.

## Iterations and completion criteria

The order below is a proposal. Contact integration begins with the second family and grows throughout; it is not postponed until every table is built. Open decisions are resolved at the iteration that needs them, rather than turning all future security work into prerequisites for phone.

| Iteration | Deliverable | Completion criterion | Status |
| --- | --- | --- | --- |
| 0 | Bounded correction pass and current baseline | Constructor findings in scope have atomic rejection/concurrency regressions; existing full gate passes. | Planned |
| 1 | Complete phone family and email/phone composition | Both families can change in one C# unit with one contact revision, truthful history and whole rollback. | Planned |
| 2 | Complete web-link family | SQL/C# lifecycle, ordering, visibility, history and mixed-family composition work. | Planned |
| 3 | Immutable address family and catalog contract | Shared-value reuse is safe, one contact's edit leaves others unchanged, and old revisions reconstruct old addresses. | Planned |
| 4 | Person/organization profile and contact lifecycle | Supported profile/name/root changes are audited; lifecycle and relationship boundaries are explicit. | Planned |
| 5 | Integrated Contact API v1 | Current/historical reads and atomic saves work across the declared fields/families through an authenticated service/HTTP boundary. | Planned |
| 6 | Administrative user provisioning | New-person/account and existing-person promotion use the contact API contracts, chosen login policy and explicit authorization. | Planned |

### 0. Corrections before expanding the public constructor boundary

Review the latest source and establish a fresh build/test baseline. Keep this pass bounded to the existing construction reference:

- Enforce person-only ordinary accounts on construction and promotion; retain working System bootstrap and normal person paths.
- Reject supplied unsupported contact-detail inputs during promotion, before defaults conceal whether inputs were supplied. Preserve the distinct account-email input. A dedicated promotion API follows in iteration 6.
- Correct the company-name miss race if the legacy convenience is retained. Recheck under a tenant/name lock with equality semantics consistent with the lookup; preserve rejection of pre-existing ambiguity. Prove unrelated names remain independent.
- Correct creation-event occurrence metadata while preserving server recording time, and make the actual seed use the constructor's existing initial-role evidence.

Do not turn historical acceptance probes into desired behavior. [Testing handoff: unresolved recipes](testing-handoff.md#unresolved-recipes-and-future-assertions--not-executed-in-this-integration) supplies the counterexamples. Login uniqueness is a required decision before provisioning exposure, not a reason to stop child-family work. General contact-constructor hardening belongs to iteration 4; explicit root operation semantics must precede its lifecycle writers.

### 1. Phones: prove the second family

Define the accepted number, normalized matching representation, country context, area code, extension, label and visibility contract. Preserve entered data; do not assume the existing Mexico-oriented domain formatting functions define international identity. Decide duplicate-association behavior and distinguish omitted fields from explicit clearing in the eventual API.

Implement the retained child identity, live association, final history, actions, public wrappers/private writer, as-of reader/diff, C# commands, schema registration/drop and restricted permissions. Fix widths and checked foreign keys against actual schemas. Route initial constructor phones through the same writer so creation remains revision 1. Current summary views must select saved order rather than `ordinal = 1`.

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

Implement the same complete lifecycle and constructor integration as the other families. Prove that two contacts can reference one address, editing one repoints only that association, and historical reads retain the old value and correct catalog interpretation. Test partial addresses, concurrent value creation and mixed-family rollback. A relationship to an organization's live office location is separate work; shared immutable values do not imply automatic propagation to employees.

### 4. Persons, organizations and contact-level operations

Declare the supported Contact v1 profile fields and history coverage. Cover both entity presentation fields and contact payload; full name alone does not reconstruct editable structured person-name components. Define name/display-name derivation and explicit clearing behavior. Keep organization fields distinct from person fields. Contact-category conversion remains undecided; account promotion changes entity type and is not permission to convert an organization into a person.

Harden the contact construction boundary with strict actor/tenant resolution and required context, removing reliance on privileged legacy fallbacks for public calls. Compose initial child collections through family writers in one unit. Expose revisions and stable child identifiers through C# contracts.

Define soft delete/restore semantics and give root snapshots explicit validated operation semantics before implementing those writers. Address child visibility/editability while a root is inactive, restoration behavior, and what happens when the contact is also an account or is a referenced organization. Do not silently cascade account disablement, role changes or relationship removal. If lock/unlock or validation transitions are included, give them similarly explicit contracts; otherwise mark them unsupported in v1.

For organization relationships, prefer explicit contact identity over names. Decide whether employment/representation belongs in v1. If included, specify cardinality, owning aggregate, locking, history and historical display of the referenced party. Dedicated group membership/hierarchy remains deferred. Preserve legacy behavior outside the new capability without claiming it has acquired these guarantees.

### 5. Integrated Contact API v1

Create application contracts for person/organization creation, supported profile changes, child operations, current detail, paginated search/listing, historical revision/diff and lifecycle operations. Align domain models and response DTOs with saved order, visibility and revision tokens.

A logical Save may contain profile and several child commands. It must preserve the established one-unit contract and return final committed revisions/identities. Distinguish updates from whole-list replacement and define omitted versus cleared values. Define consistent ordering of actions across families.

Build a complete reader for the declared fields/families at one aggregate revision and one consistent read boundary. Calling independent family readers sequentially is not proof of a coherent current contact snapshot. Preserve historical root/profile/name and catalog context. Return the supported scope honestly; do not fabricate history for unported relationships.

Add service/HTTP endpoints with trusted authentication-derived actor/tenant context, contact-level authorization, field visibility rules, request validation and intentional conflict/error responses. Tenant resolution may be application/host configuration; client-supplied actor GUIDs are not authentication. Define how uncertain commits are surfaced. If automatic request retries are promised, add durable idempotency/recovery receipts before making that promise.

Acceptance example: create a person with all four child families, then change their name, phone and address in one Save. Read both revisions, inspect the combined diff/actions, demonstrate stale-token rejection and prove that a failing final command rolls back the entire Save. Repeat relevant operations for an organization and validate authorized versus unauthorized HTTP access.

### 6. Administrative user provisioning

Provide two clear operations: create a new person with an account, and promote an existing person using its expected revision. Promotion accepts account inputs; callers can compose explicit contact edits in the same unit when authorized. Preserve previous contact history and the existing one-revision promotion behavior.

Before exposure, settle login uniqueness scope, normalization and tenant resolution together. Single-tenant UX does not by itself select a database uniqueness constraint. If names can repeat across tenants, establish tenant context before resolving the account; picking a default tenant after an ambiguous login does not resolve the identity. Current deployments do not require shared-user membership or tenant switching.

Define who may provision accounts and assign initial roles, the source of authenticated administrator identity, and whether activation/invitation is included. Define the initial credential handoff if needed; do not place credentials/tokens in general history. Account email/phone verification, ongoing credential recovery and general role lifecycle require separate contracts if brought into scope.

Verify atomic rejection for organizations/groups, duplicate logins including concurrent attempts, stale/competing promotions, unauthorized initial roles and mixed contact/provisioning rollback. Keep creation evidence and initial-role choice observable. Public self-registration and a full authentication product are separate from this administrative provisioning milestone.

## Completion gate for each implementation iteration

- Record the selected contract, bounded changes and remaining decisions. Add or update an ADR when behavior changes; preserve historical independent reviews as evidence.
- Complete SQL, schema-builder create/drop registration, constructor integration, C# methods/readers and grants for the declared capability. Keep internal helpers and tables outside ordinary application access.
- Add meaningful lifecycle, historical reconstruction, actor/tenant, permissions, concurrency and rollback tests for the changed behavior. Exercise existing shared guarantees through composition rather than duplicating every infrastructure test mechanically.
- Run focused checks and then the maintained full gate under both profiles using the [testing handoff](testing-handoff.md). Record actual commit/worktree, counts, failures/skips and verified disposable-database removal. Test the real schema cycle when schema/seed integration changes.
- Update this tracker and both guides where their implementation claims change. Report what is complete and what remains; passing child tests alone does not establish HTTP or full-contact completion.

For each iteration append a short execution record: date, scope, decisions, source checkpoint, changed entry points, verification/evidence, remaining work and next iteration. Keep all iterations above marked planned until work is actually delivered. This planning pass checks documentation only and does not claim a new database test run.

## Deferred work

Dedicated groups and membership/hierarchy; shared users across tenants and tenant switching; public self-registration; complete account/role lifecycle and recovery; contact merge/deduplication; live office/location inheritance; permanent erasure; customer upgrades/backfill; historical migration/coverage adapters; disconnected delivery; other providers; production-scale benchmarks and remote CI/deployment verification. These are retained work, not prerequisites for every family. Revisit an item only when a selected iteration needs its contract.

## Working references

- [Design handoff](dbrow_version-design-session-handoff.md) and [primary design](dbrow_version-allocation-design.md).
- [Email usage/reference](email-reference-family.md), [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) and [family porting recipe](guide-cc/10-porting-a-family.md).
- [Ordinary user construction, ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md) and [independent review](user-construction-independent-review.md); newer person-only policy supersedes its open eligibility question.
- [Focused legacy findings](dbrow_version-legacy-implementation-findings.md), before bounded source intake for a family.
- [Testing handoff](testing-handoff.md), [guide-co](guide-co/README.md) and [guide-cc](guide-cc/README.md).
