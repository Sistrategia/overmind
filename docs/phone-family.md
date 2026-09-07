# Phone family and composed contact channels

Updated: 2026-09-07. Iteration 1 is implemented and verified for fresh schemas.
Contracts: [ADR 0009](adr/0009-phone-values-parsing-and-numbering-geography.md) and
[ADR 0010](adr/0010-composed-contact-family-reader.md).

## One Save

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
await unit.UpdateEmailAsync(contact, expectedVersion, emailOrdinal, "new@example.test");
await unit.InsertPhoneAsync(contact, expectedVersion,
    new PhoneInput("312-3456", "MX", "777"), location: "Office", extension: "204");
await unit.CommitAsync();
```

Both commands use the revision observed when the unit began. They share one allocation, one root bump
and ordered action numbers. Outputs remain provisional until commit. Phone parsing is inside command
admission; a parse/SQL/cancellation failure aborts earlier work in the same unit. Start a fresh unit to retry.
Commit uncertainty follows the existing SqlAuditUnit contract.

`InsertPhoneAsync`, `UpdatePhoneAsync`, `DeletePhoneAsync`, `RestorePhoneAsync`, `MovePhoneAsync` and
`MakePhonePrincipalAsync` implement the same stable-identity/saved-order lifecycle as email.
Update/restore replace all supplied association state. NULL label or extension clears it; isPublic defaults
to false. Two entries may reference the same complete number, including entries with different extensions.
Repeated identical replacement is a no-op. An entered-spelling change is audited even if both spellings
resolve to the same complete number. Insert/delete in one unit retains identity/actions without inventing
a final child history row. Restore appends and never reuses another child's ordinal.

## Input and geography

`PhoneParser.Parse(new PhoneInput("+52 777 312-3456"))` returns the complete E.164 identity, calling code,
national significant number and immutable interpretation metadata. National or split input needs explicit
country context. International input does not derive country from a contact's address. Strings preserve
significant zeros. Extensions are separate; embedded extensions, vanity strings and incomplete local input
reject. The initial parser is pinned to libphonenumber-csharp 9.0.38, with application policy version 1.

Area/local decomposition is optional. For Mexico it retains destination grouping as a hint; it does not
assert the contact's city. NumberingRegion is an ISO-style numbering-region code where resolvable; shared
calling codes and nongeographic international services prevent a universal calling-code-to-country FK.
GeographicDescription is the parser's English offline description at capture time and may identify only
a broad region. No lookup of that description creates country/state/city records.

`phone_numbering_area` and `phone_numbering_area_place` provide an optional administrative, versioned
prefix-to-many-places catalog with checked geographic references. They start empty: this iteration does
not claim an authoritative city dataset. Country/area string grouping works from stored interpretations;
geographic-ID enrichment requires a reviewed mapping source. Address/residence segmentation continues to
use contact addresses. Catalog updates never rewrite previously captured phone interpretations.

## Storage and native SQL boundary

| Object | Responsibility |
| --- | --- |
| `contacts.phone` | Shared immutable E.164 identity, calling code and national number; unique full number. |
| `contacts.phone_input` | Exact immutable JSON interpretation, including raw input and parser version; indexed numbering region/area projections. |
| `contacts.phone_location` | Exact label dictionary, up to 100 UTF-16 units. |
| `contacts.contact_phone` | Root/tenant, stable ordinal, saved order, phone/input/label references, extension (25 units), visibility and audit version. |
| `contact_phone_identity/history/action` | Retained identities, final touched-row snapshots and typed effective action evidence. |

Phone/input paired FKs prevent associating an interpretation with a different number. Exact input interning
uses a hash for lookup/transaction locking followed by full bytes AND length comparison; hash equality
alone never establishes identity. Phone lookup uses the complete E.164 key. All public input widths are
validated before narrowing storage, including contact/user constructor label and extension parameters.

Trusted native adapters call `PhoneParser.PrepareForDatabase(input)` and pass the result as `@phone_data`.
The public `contact_phone_change` and operation wrappers accept this prepared value, label, extension,
visibility and the existing actor/tenant/version context. SQL validates recognized, unique string/null
properties, required fields, lengths, ASCII number syntax and component consistency. Numbering-plan
validation belongs to the backend. The SQL JSON string is a transport/storage contract, not a second parser.
Use the provided serializer for stable property order/escaping; differently serialized input is a distinct
accepted representation, even if its JSON properties are semantically equal.

`contact_insert` and `user_insert` append optional `@phone_data`; their initial phone goes through the same
writer with unit-entry revision 0 and commits at revision 1. Initial child actions are hidden from the
timeline in favor of the parent creation event. Legacy `phone_number`, `phone_area_code`, `numbers_only`
and `full_phone` reject rather than guess country context. Labels/extensions without a phone also reject.
The sample installation explicitly supplies a prepared known number; account/recovery phone is unchanged.

## Historical reads and capability

```csharp
var revision = await new SqlContactChannelsReader(connectionString)
    .ReadAsync(contact, authenticatedActor, revisionNumber, tenant, compareEntityVersion: previousRevision);
var emailState = revision.EmailRevision.Emails;
var phoneState = revision.Phones;
var orderedActions = revision.Actions; // Family tag + shared audit action ordinal.
```

The coordinator owns one SERIALIZABLE transaction, resolves root and bounds once, holds the clustered
root-key shared barrier, then reads email and phone state/diff/actions. It returns seven sets: root,
email state/diff/actions, phone state/diff/actions. C# consumes server completion before returning success.
`SqlContactEmailReader` and the four-set `contact_email_read` retain their public behavior. Native
`contact_phone_read` supplies the corresponding root/phone-only four sets. Private components reuse the
as-of functions; they do not own transactions or receive runtime EXECUTE rights. Public readers reject
ambient transactions. This is email/phone reconstruction, not complete contact profile/address history.

Assign the trusted application database principal to `contact_channels_runtime` to add phone and combined
reads/writes. It includes the existing email capability; existing email_runtime users alone gain no phone
access. Deployment roles/memberships survive schema drop/recreate. Neither role grants constructors,
direct table access or private helpers. Authentication and contact-level authorization remain service duties.
is_public means directory eligibility subject to root privacy and authorization, never anonymous access.

## Verification and remaining scope

The maintained tests cover international/national/split input, significant zeros, shared calling codes,
nongeographic numbers, malformed/ambiguous input, original spelling, full-width extension/label, canonical
reuse, no-op/revert, delete/restore/ordering, mixed Save rollback and cross-family action order. Concurrency
tests observe real blocked requests for same-value creation and the composed root barrier; distinct values
progress before the holder commits. The actual application schema cycle checks seed phone revision/history.
Final gate: 53/53 passed in 5 min 30 sec, zero failures/skips and build warnings/errors, both RCSI
profiles. All 142 distinct owned databases across seven runs have verified removal evidence in the
[testing handoff](testing-handoff.md#iteration-1-phone-and-composed-reader--2026-09-07).

Fresh schemas only. Geographic catalog population, unresolved legacy import, customer upgrades, phone UI,
HTTP endpoints, account/recovery phone and general contact lifecycle remain later work. The old domain
`Sistrategia.Contacts.Phone` formatting helpers are legacy UI conveniences and are not used by these new
commands; new integrations should use PhoneInput/PhoneParser and the returned historical state records.
