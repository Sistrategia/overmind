# ADR 0013: Contact profiles, exact names and root lifecycle

Date: 2026-09-07. Status: implemented for fresh schemas in iteration 4, over `4f4fd78`.
Builds on [ADR 0012](0012-immutable-address-values-and-geographic-catalogs.md) and the existing audit
unit, root barrier and final-state history contracts. The author authorized iteration 4. The optional
questions about dependency protection and relationship/category scope received no reply before
implementation; the conservative choices announced during the task are recorded below as implementation
assumptions, not explicit answers from the author.

## Problem and supported scope

Earlier contact history recorded a full name and some contact columns, but not structured name
components. Person-name lookup also used database-collation equality, so `Ernesto` and `ERNESTO`
could share the first spelling. Root snapshots chose insert/update from revision alone and could
not express deletion or restoration. The privileged legacy constructor was unsuitable as an ordinary
application creation boundary.

Add an explicit contact profile/lifecycle capability for persons and organizations, with complete
history of its declared fields, strict actor/tenant input, and coherent reads/saves across the profile
and all four child families. Preserve the existing group category and privileged constructor without
exposing group creation or category conversion through this capability.

| Profile fields | Contract |
| --- | --- |
| `contact_type_id` | Person (1) or organization (2); immutable after creation through this API. Resolve the root entity type from the `contact` definition, not a fixed entity-type ID. |
| `full_name` | Required explicit nonblank NVARCHAR(256); serves as the organization's name as well. |
| `display_name` | Optional nonblank NVARCHAR(256); NULL means use the supplied full name on this replacement. |
| `logical_key` | Optional exact NVARCHAR(256). |
| `summary` | Optional exact text, up to 4096 UTF-16 units in the new API, transported as NVARCHAR(MAX). |
| `image_url`, `thumbnail_url` | Optional exact NVARCHAR(1024); this operation stores references, without fetching or validating their remote contents. |
| `is_private`, `do_not_contact` | Explicit booleans in the typed input, default false. |
| Structured person names | Optional exact NVARCHAR(256): title, first name, combined last name, last names 1/2, suffix and alias. |
| Person details | Optional job title (256), birth date, and gender/marital codes (one uppercase ASCII letter); person-only open-to-work and deceased flags. |
| Organization detail | Recruiting flag; person-only fields reject for organizations, and recruiting rejects for persons. |

Full name and structured components are explicitly supplied presentation/content fields. Do not
automatically concatenate, split, trim or reorder names. This avoids imposing one cultural name order
or losing custom display names. Updating components requires supplying the desired full name too.
Combined/split surname components are retained independently; the API does not infer that they agree.
The legacy summary view retains its existing combined-last-name fallback, while the full reader
returns each stored component separately.

Update is a replacement of these declared editable fields. NULL clears an optional field; omitted
booleans become false. Accepted case, accents, Unicode and trailing spaces survive. Empty optional
name components are distinct from NULL. Required full/display names cannot be blank. Birth dates
use ISO calendar dates; no age, gender classification or marital-status catalog policy is inferred
from accepting a one-letter code.

Employment/representation editing, relationship history and category conversion remain outside
iteration 4. Existing `person_company` text and birth-place IDs are captured and returned as preserved
legacy fields, but cannot be written by the new input. A profile replacement preserves them. Company
relationships are neither derived from that text nor changed by profile commands. Current legacy
views may still join live relationships; the new historical reader does not project today's related
organization name onto old profiles. Dedicated groups, lock/unlock and validation transitions,
erasure, merge and account lifecycle require separate contracts.

## Exact names and relational history

`person_name` is an immutable dictionary keyed by exact UTF-16 bytes **and length**. Read-first exact
lookup, transaction-owned hash miss locks and rechecking serialize equivalent misses. Different
hashes can progress independently; a hash collision can add waiting but cannot establish equality.
UPDATE/DELETE triggers reject dictionary mutation (52002). `language_code` is retained but is not
populated or interpreted by this capability; future localization needs a separate contract.

The contact owns its `(contact_id, person_name_type_id)` name slots. Checked contact/value/type FKs
now protect that association. A private replacement helper fills the supported slots under the root
write lock; no stable list ordinal or display_order is invented for fixed semantic name types.

Extend the existing relational `contact_history` with captured contact category and references for
all seven name components. The private `contact_history_snapshot` upserts only the active unit's
stamped root snapshot and captures all actual contact payload fields, including nullable legacy flags
and birth-place/company data. Entity payload stays in `entity_history`; no parallel JSON profile
history is introduced. Immutable name references reconstruct the exact older spelling.

Both existing contact construction (including its automatically created company) and System bootstrap
now use the complete contact snapshot helper. Legacy constructors share exact name interning; name
parameters reach validation without truncating to 256 first. The existing constructor's live
`do_not_contact` now agrees with its historical value. Ordinary user construction delegates through
that path, and promotion continues to preserve the unchanged profile while updating historical entity
type separately. Historical independent probes remain untouched.

A NULL historical contact category explicitly represents incomplete/raw pre-profile history. The new
full reader returns 52010 when either requested profile is unavailable; it never fills missing name
history from today's contact-name rows. Fresh supported constructors always capture the category.
This nullable coverage marker supports explicit failure for existing raw test fixtures; it is not a
populated-database migration or backfill claim.

## Construction and unit semantics

`contacts.contact_change` accepts `create`, `update`, `delete` and `restore`. It requires an explicit
tenant, resolves an existing active user actor in that tenant, verifies any reused unit's attribution,
and rejects unsupported category or input. The opt-in `contact_runtime` role grants this boundary and
the full reader; it inherits channel capabilities. Channel-only and email-only grants are unchanged.
Private helpers, dictionaries/history and legacy constructors remain inaccessible to runtime callers.

Creation requires expected version 0, accepts/generates a public key, creates an ordinary contact root
using the resolved entity-type definition, and initializes revision 1. The validated boundary invokes
the entity constructor with explicit existing actor and tenant; its legacy fallback/self-creation
paths are unreachable through this API. It never creates a company from a name or an account.
The private/privileged legacy contact/user constructors retain their separate compatibility behavior.

`SqlAuditUnit.CreateContactAsync` returns the provisional public key, contact ID, revision and audit
version. Add any number of initial child entries in that same unit using expected version **0**.
Creation plus later profile/child operations remain one revision. Existing-root commands consistently
use the unit-entry expected revision. Validation occurs inside command admission, so C# validation,
SQL, cancellation or concurrency failures invalidate and roll back preceding commands too. Native
ambient callers must enroll explicitly and roll back the whole unit on error. Commit outputs remain
provisional until success; the existing uncertain-commit contract is unchanged.

`ContactProfileInput.PrepareForDatabase()` produces exact snake_case JSON. SQL checks the object,
recognized unique keys, types, lengths, date/code representation and category-specific fields before
assigning bounded values. Native adapters must perform equivalent backend Unicode validation as well;
SQL structural checks do not duplicate unpaired-surrogate and Unicode whitespace validation. This is
a trusted application/SQL boundary, not authentication, authorization or an HTTP API.

Identical profile replacements and already-current lifecycle requests allocate nothing after context,
root and optimistic checks. Effective change/revert retains actions even if the final profile diff is
empty. `contact_profile_action` records versioned JSON of the complete post-command profile, ordered
with all child actions by `audit_action_next`. A creation action provides creation evidence for the
new API; the older constructor retains its existing creation event. Action JSON is command evidence,
while relational tables remain the authoritative final historical state.

## Deletion, restoration and explicit root operations

The private root lock helper adds an `allow_deleted` option used only by contact lifecycle commands.
All existing child/profile edits continue to reject deleted or locked roots. No new command bypasses
the locked-root guard. System and non-person/non-organization roots are outside this lifecycle API.

Soft deletion stamps server recording time and actor on the entity; it retains the contact, all child
rows, identities and saved positions. Current summary views already exclude deleted roots. Trusted
historical readers can still reconstruct the deleted contact and its retained channels. This does
not make it directory-visible: later service/HTTP authorization and visibility rules still apply.
Restoration clears deletion metadata, retains child identities/order and permits subsequent edits
in the same unit using the original unit-entry version. It does not unlock or validate the root.

Deletion rejects any account/derived entity type or relationship in either direction (52007), including
a referenced organization. It never disables an account, removes a relationship or propagates deletion
to another root. Root locking serializes promotion and the legacy constructor's retained company
eligibility check with deletion; a stale contender must retry the whole operation, and an existing
dependency still rejects on the fresh revision. The new API does not create relationships. Direct
privileged DML and unsupported future relationship writers are not granted these guarantees merely
by the presence of an index.

`entity_history_snapshot` now requires explicit operation intent: insert (1), update (2), delete (3)
or undelete (5, existing `UNDODL` vocabulary). It validates intent against root revision/state and
requires the latest recorded snapshot to be deleted before recording restoration. Call sites in entity
construction, bootstrap and user promotion supply intent explicitly. Creation remains operation 1
through later active profile updates in revision 1; restoration remains operation 5 through later
profile updates in that same unit. A subsequent delete records 3. Actions retain each effective
command even where several lifecycle changes collapse into one final snapshot. No lock/validation
operation codes are exposed by this iteration.

## One consistent reader

`contacts.contact_read` and `SqlContactReader` return the declared full profile with all four channel
families under the existing coordinator's SERIALIZABLE transaction and shared clustered root barrier.
The new SQL API returns **16 sets**: the unchanged 13 channel sets, then profile, profile diff and
profile actions. `contact_profile_as_of` reads root-leading historical indexes with required seeks;
profile names come from captured immutable IDs. Profile differences contain complete old/new payloads;
`ContactRevision.Actions` merges profile and child actions in global order, with no child ordinal for
root actions. C# consumes all result sets and server completion before returning success.

Existing `SqlContactChannelsReader`/`contact_channels_read` keep their 13-set contract and all standalone
family readers keep their earlier shapes. Both readers share implementation internally; the full reader
does not call separate public APIs sequentially. Its category/name/profile coverage is explicit and
does not extend to relationships, account configuration or unported entity metadata/classifiers.

## Verification and next work

The [testing handoff](../testing-handoff.md#iteration-4-contact-profiles-and-lifecycle--2026-09-07)
records focused/full executions and resource reconciliation. Regressions cover exact spelling and
name reuse, initial profile plus four families, no-op/revert/clearing, historical reconstruction,
deletion/restoration and saved children, dependency protection, promotion/reference races, rollback,
strict actor/tenant/permissions, missing profile coverage, actual current views and schema recreation,
the shared reader barrier and independent name-miss progress under both RCSI profiles.

Fresh schemas/local SQL Server only. Iteration 5a is the integrated contact service; HTTP is 5b and
administrative provisioning is 6. Login uniqueness remains explicitly deferred until provisioning.
Customer upgrades, remote deployment and independent review execution are separate work.
