# Contact profiles and lifecycle

Updated: 2026-09-07. Iteration 4 implements the declared person/organization profile for fresh schemas.
See [ADR 0013](adr/0013-contact-profiles-names-and-root-lifecycle.md) for decisions and precise boundaries.

## Create a person with initial channels

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
var person = await unit.CreateContactAsync(new ContactProfileInput(
    ContactTypeId: 1, FullName: "Ernesto Ocampo", PersonFirstName: "Ernesto",
    PersonLastName1: "Ocampo", DisplayName: "Neto"));
await unit.InsertEmailAsync(person.PublicKey, 0, "ernesto@example.test", location: "Work");
await unit.InsertPhoneAsync(person.PublicKey, 0, new PhoneInput("312-3456", "MX", "777"));
await unit.InsertWebLinkAsync(person.PublicKey, 0, new WebLinkInput("https://example.test"));
await unit.InsertAddressAsync(person.PublicKey, 0, new AddressInput(
    StreetName: "Morelos", ExtNumber: "25", Country: "México", City: "Cuernavaca"));
await unit.CommitAsync();
```

Everything belongs to revision 1. Use expected version **0** for a root created in this unit, and
the revision seen at unit entry for an existing root. Returned identifiers/revisions are provisional
until commit. A validation or SQL error aborts the entire save.

For an organization, use `ContactTypeId: 2` and its name in `FullName`, with common presentation,
privacy/contact flags and optional `Recruiting`. Person-only name/details reject for organizations.
Category conversion and group creation are not exposed through these commands.

## Edit explicit profile fields

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
await unit.UpdateContactAsync(contact, expectedVersion, new ContactProfileInput(
    ContactTypeId: 1, FullName: "Ernesto Ocampo", PersonFirstName: "Ernesto",
    PersonLastName1: "Ocampo", PersonAlias: "Neto", Summary: "Preferred contact"));
await unit.UpdateAddressAsync(contact, expectedVersion, addressOrdinal,
    new AddressInput(Address1: "New office", Country: "México"));
await unit.CommitAsync();
```

Profile update replaces every supported editable field: NULL clears optional values, booleans default
false, and NULL `DisplayName` selects the supplied full name. Supply the complete desired profile,
including optional fields that should remain. Existing company text, birth-place IDs, relationships,
account fields and lifecycle flags are outside that replacement and remain unchanged.

Full name is explicit. The API preserves individual name components without deriving a cultural name
order, trimming spelling or automatically keeping a combined surname in sync with split surnames.
Empty optional components, NULL, case, accents and trailing spaces remain distinct. Names are shared
immutable values, so changing one contact never changes another contact's spelling or earlier history.

Supported fields and widths are listed in the [ADR](adr/0013-contact-profiles-names-and-root-lifecycle.md).
The new input bounds summary to 4096 UTF-16 units; older privileged data can still be read without
silently truncating it. Native callers use `ContactProfileInput.PrepareForDatabase()` or equivalent
validation for `@profile_data`, including Unicode checks.

## Delete and restore

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
await unit.DeleteContactAsync(contact, expectedVersion);
await unit.CommitAsync();
```

Soft deletion retains child values, identities and saved positions. Current summary views hide the
root; child/profile edits reject while it is deleted. `RestoreContactAsync` clears deletion metadata
and restores editability without changing the children. A restore and subsequent edits can share one
unit and its original expected revision. Historical readers can inspect the deleted revision.

Deletion rejects contacts with accounts or relationships in either direction, including referenced
organizations. Resolve those through their explicit future operations; this command does not disable
accounts or remove relationships. System, groups, category conversion, locking and validation
transitions are outside this API. Already-deleted delete and already-active restore are no-ops after
context and optimistic checks.

## Read a complete declared revision

```csharp
var revision = await new SqlContactReader(connectionString)
    .ReadAsync(contact, authenticatedActor, entityVersion: 3, tenant: tenant,
        compareEntityVersion: 2);
var profile = revision.Profile;
var profileChanges = revision.ProfileDifferences;
var addresses = revision.Channels.Addresses;
var actions = revision.Actions; // Contact and child actions in one global order.
```

One server transaction/root barrier covers the profile and all four child families. Name history uses
captured immutable references. Profile diffs return complete old/new payloads; actions retain effective
commands even if their final changes cancel out. Root action ordinals identify actions, not child rows.
Missing complete profile history raises 52010 instead of borrowing today's names.

The full SQL API is `contacts.contact_read` (16 result sets). Existing channel-only and standalone
family APIs retain their shapes. `contacts.contact_change` is the SQL create/update/delete/restore
boundary. Both new APIs require an explicit tenant; the trusted application supplies actor/tenant
context. Assign its database principal to `contact_runtime` for profile/lifecycle plus channels.
`contact_channels_runtime` and `email_runtime` alone gain no profile capability. Direct tables,
private helpers and legacy constructors remain restricted.

## Verification and next work

See the [testing record](testing-handoff.md#iteration-4-contact-profiles-and-lifecycle--2026-09-07).
The plan, both explanatory guides and handoffs now point to this profile contract. Next is iteration
5a, the integrated service with authorization and save contracts, followed by HTTP and provisioning.
This iteration does not publish endpoints or implement relationship/account lifecycle, discovery,
customer migrations or login uniqueness.
