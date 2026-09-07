# ADR 0012: Immutable address values and geographic catalogs

Date: 2026-09-07. Status: implemented for fresh schemas in iteration 3, over `06d177d`.
Extends [ADR 0010](0010-composed-contact-family-reader.md) and the family mechanism in
[ADR 0011](0011-web-link-values-and-contact-associations.md). The author requested shared immutable
complete addresses with reference-only contact associations. Field-level choices below are this
iteration's implementation decisions; the optional question about street representation received no
answer before implementation, so the stated one-representation-per-value assumption was used.

## Problem and decision

The legacy constructor matched only lines, postal code and city/state/country. It could reuse a row
containing different structured street, number, colony, county or reference fields, and conflated NULL
with empty text. Geographic lookup could choose the first state/city without its parent context.
Mutable geographic labels would also make an old address display today's spelling.

Store the complete address as an immutable shared value. Each contact owns its association, identified
by a stable `ordinal`, with a separate `display_order`, optional exact label reference and `is_public`
defaulting to false. `contact_address` stores `address_id` and `location_id`, never address text.
Its tenant must equal the owning entity's tenant through checked composite FKs; this is an integrity
constraint, not an independent tenant choice or a physical partitioning claim.

An edit selects or creates another value and repoints that association. Other contacts and earlier
revisions keep the original address. A live relationship to an organization's office, with automatic
propagation to employees, is a different contract and is not introduced here.

## Complete value and representation

| Field | Storage/meaning |
| --- | --- |
| `address1`, `address2` | Optional NVARCHAR(256) lines for a free-form postal address. |
| `street_name` | Optional NVARCHAR(256), used instead of address lines. |
| `ext_number`, `int_number` | Optional NVARCHAR(25), requiring a nonblank structured street. |
| `zip_code` | Optional NVARCHAR(32); preserve letters, leading zeros and spaces. |
| `references` | Optional NVARCHAR(256) directions/reference text. |
| `country_id`, `state_id`, `county_id`, `city_id`, `colony_id` | Optional checked geographic references; valid child IDs supply required ancestors. |

Choose address lines **or** structured street/number fields for each value. Supplying both rejects,
even if one supplied field is empty; there is no precedence that silently ignores one representation.
Geography, postal code and references can accompany either. Country-only, postal-only and lines-only
addresses are valid. At least one substantive postal component or geographic reference is required;
an empty object or references-only object rejects. Partial data is retained as partial data.

All seven text fields and five resolved IDs participate in identity. Accepted spelling, case, spaces
and Unicode are preserved. NULL and empty text are distinct; a missing JSON field and explicit JSON
null both mean NULL. No postal normalization, transliteration or physical-place equivalence is inferred.
Labels are separate immutable NVARCHAR(100) values and do not affect complete address identity.

The persisted key encodes each field in fixed field order using its byte length and content, with a
distinct NULL marker. A SHA-256 index narrows lookup; the full key **and its length** are always
rechecked. A checked hash column must match the computed key. Transaction-owned hash application
locks serialize misses, followed by another exact lookup. Hash collisions can add waiting but cannot
merge different values. Deduplication is enforced through the controlled writer; the hash index is
deliberately nonunique so hash collision is not treated as value equality. Direct table writes are
outside the runtime capability. All declared widths fit the 4096-byte key without truncation.

## Geographic scope and corrections

| Catalog | Exact identity and parent rule |
| --- | --- |
| Country | Exact name, globally shared. |
| State | Country plus exact state name; country required. |
| County | Country, optional state scope, exact county name. |
| City | Country, optional state scope, exact city name. |
| Colony | City plus exact colony name; city required. |

Names are NVARCHAR(256). Case and trailing spaces distinguish accepted names even under a
case-insensitive database collation. Country-only city/county scopes support partial or no-state
addresses; their unknown state is part of their identity. Adding a state creates/selects another
scoped value. County and city are parallel catalogs, not an assumed universal county-to-city tree.

The resolver validates every explicit ID before using it, infers its known ancestors, and checks any
supplied names against those IDs exactly. Name-based child resolution requires its parent context.
It never searches globally for the first matching city/state. City and county must agree with the
resolved country/state, including NULL scope; a colony must agree with its city. Invalid IDs,
contradictory names/IDs and missing required parent context reject with 51921. Checked FKs supplement
the writer's stricter resolution rules. A legacy private helper delegates to this same resolver.

Country/state/county/city/colony, complete address and address-label rows reject UPDATE and DELETE
through `INSTEAD OF` triggers (51922). This guards history against accidental privileged mutation as
well as restricting application grants; it is not protection against a database owner disabling DDL.
Correct a label or parent by creating/selecting another catalog value and then explicitly replacing
affected contact associations. Old addresses retain old IDs and labels. Do not rewrite old histories.

These catalogs are exact shared values, not a supplied official geographic dataset or proof that a
postal address exists. No localized-name, authoritative code, merge, geocoding or postal deliverability
contract is implemented. Existing `integration_int_id` columns are retained but have no new population
or update workflow; a future source mapping contract must preserve this immutability. Phone numbering
geography remains independent and never fills a contact address automatically.

## Validation and native transport

`AddressInput` accepts the fields above using either geographic IDs, names, or consistent combinations.
`PrepareForDatabase()` validates and serializes exact snake_case JSON for `@address_data`.
`AddressValue` is the read projection, containing resolved IDs and their immutable names.

SQL accepts one JSON object, at most 16384 UTF-16 units, with recognized unique keys, appropriate
string/null types and positive integer/null IDs. Unknown properties, trailing-space property names,
duplicates, invalid types, overlength values, mixed street representation and inconsistent geography
reject before a successful save. Constructor strings and JSON are accepted as NVARCHAR(MAX), then
validated before assigning bounded columns, avoiding parameter truncation.

Trusted native adapters must use `AddressInput.PrepareForDatabase()` or equivalent validation,
including legacy constructor strings. Backend validation rejects unpaired UTF-16 surrogates and uses
Unicode whitespace rules; SQL's structural checks are not a second complete Unicode validator.
No text is normalized by validation. This is a trusted SQL/backend boundary, not an HTTP input API.

## Lifecycle, construction and reading

Public SQL exposes `contact_address_change` and insert/update/delete/restore/move wrappers; C# exposes
the corresponding `SqlAuditUnit` methods and `MakeAddressPrincipalAsync`. Insert/restore append,
delete closes gaps, move preserves ordinal, and update/restore replace the full value and metadata.
Identical updates/current-position moves allocate nothing. Effective change/revert keeps ordered
actions even with an empty final diff. Insert/delete retains the allocated identity and actions.

All four families share one audit unit, one unit-entry expected root revision and one bump per
touched contact. C# input validation runs inside command admission so any failed command aborts
earlier commands too. Native ambient callers must enroll and roll back the whole unit on error.
Existing cancellation and uncertain-commit behavior is unchanged.

`contact_insert` and `user_insert` append `@address_data` and `@address_is_public`. Legacy initial
line/zip/city/state/country inputs are translated through the same writer; they cannot be mixed with
JSON. An optional label stays NULL when omitted. Orphan metadata rejects, and promotion rejects
supplied contact-address inputs, including an explicitly false visibility. Initial addresses belong
to revision 1; creation events represent their hidden initial family actions. Constructors remain a
privileged, partially legacy boundary pending iteration 4.

The composed SQL reader now returns **13 result sets**: root, then state/diff/actions for email, phone,
web link and address. One coordinator resolves revisions and holds the shared root barrier throughout.
`SqlContactChannelsReader` exposes addresses/differences/actions and merges all four families' actions.
`contact_address_read`/`SqlContactAddressReader` provide a four-set standalone view; all previous
standalone shapes remain unchanged. Deploy the matching rebuilt C# reader with fresh DDL. Native
composed consumers must read the appended sets and server completion. Root/profile coverage is still
partial; this does not claim a complete contact or account history API.

`contact_channels_runtime` adds address commands/reads. `email_runtime` remains email-only. Private
components, constructors and direct tables remain denied. Internal readers return private values
and visibility flags; later service/HTTP layers must apply authorization and directory visibility.
Current contact summaries choose the first saved address. Domain Address/AddressCollection preserve
exact fields, stable identity and saved order, without assigning ordinals to new local entries.

## Verification and remaining scope

See the [testing record](../testing-handoff.md#iteration-3-immutable-addresses--2026-09-07) for the final
gate and resource reconciliation. Address regressions cover every identity field and the legacy
omitted-field counterexample, NULL/empty/case/space distinctions, partial addresses, hierarchy
rejection, immutable corrections and historical isolation, lifecycle/order, constructor widths,
permissions, four-family rollback and one-barrier reads, same-value concurrency and distinct progress.
The real application create/drop/create path checks initial address history and saved-order summaries.

Fresh schemas only. Customer upgrades, authoritative catalog loading/discovery, person/organization
profile and root lifecycle, service/HTTP exposure, and independent review execution remain separate.
Iteration 4 is next. Login uniqueness is still explicitly deferred until provisioning.
