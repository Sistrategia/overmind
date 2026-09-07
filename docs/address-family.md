# Address family

Updated: 2026-09-07. Iteration 3 implemented for fresh schemas.
Contract: [ADR 0012](adr/0012-immutable-address-values-and-geographic-catalogs.md).

An address is a shared immutable value. A contact owns its association with that value: stable
`ordinal`, saved `display_order`, optional label reference and visibility. Editing the association
selects another address; other contacts and earlier revisions keep the original.

## Writing an address

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
await unit.UpdateEmailAsync(contact, expectedVersion, emailOrdinal, "new@example.test");
await unit.UpdatePhoneAsync(contact, expectedVersion, phoneOrdinal,
    new PhoneInput("312-3456", "MX", "777"));
await unit.InsertWebLinkAsync(contact, expectedVersion, new WebLinkInput("https://example.test"));
var address = await unit.InsertAddressAsync(contact, expectedVersion,
    new AddressInput(StreetName: "Calle Morelos", ExtNumber: "25", IntNumber: "B",
        ZipCode: "62000", Country: "México", State: "Morelos", City: "Cuernavaca",
        Colony: "Centro", References: "Entrada lateral"), location: "Office");
await unit.CommitAsync();
```

Use the same unit-entry expected revision for each command on that contact. These four commands
share one allocation/revision and globally ordered actions. Returned IDs/revisions are provisional
until commit; validation and SQL errors abort the entire save. Existing uncertain-commit handling
still applies.

`InsertAddressAsync`, `UpdateAddressAsync`, `DeleteAddressAsync`, `RestoreAddressAsync`,
`MoveAddressAsync` and `MakeAddressPrincipalAsync` follow the established family lifecycle.
Insert/restore append, delete closes gaps, move changes position without changing identity.
Update/restore replace the full address and association metadata: NULL clears optional fields,
an omitted label clears it, and omitted visibility sets false. Two associations may share one value.

## Fields and geography

Use either `Address1`/`Address2` **or** `StreetName` with optional `ExtNumber`/`IntNumber`.
Supplying both representations rejects; numbers require a nonblank street. Lines, street,
references and geographic names allow 256 UTF-16 units, numbers 25, postal code 32, label 100.
Postal code remains text, including spaces and leading zeros. Accepted values are not trimmed or
case-folded; NULL, empty and trailing-space variants can identify different values.

Geography and postal code can accompany either format. Lines-only, postal-only and country-only
partial addresses work; an empty or references-only address does not. Missing fields stay unknown.

Geographic names require context: state requires country; city/county require country and optionally
state; colony requires city. A city/county without state is its own explicit scope. County and city
are parallel, not an assumed hierarchy. These are exact catalog values, not a supplied official
dataset. No phone country or LADA fills address geography.

Alternatively supply `CountryId`, `StateId`, `CountyId`, `CityId` and/or `ColonyId`. Valid child IDs
supply their catalog ancestors; supplied IDs and names must all agree. Unknown IDs, mismatched
parents and unscoped names reject rather than selecting the first match.

To correct a city name or parent, select/create the corrected catalog value through an address
command and replace the desired association. Old values and their catalog labels cannot be updated
or deleted; existing contacts and historical revisions retain their old spelling. There is no
automatic propagation from a company's office to its employees.

## Reading all four families

```csharp
var revision = await new SqlContactChannelsReader(connectionString)
    .ReadAsync(contact, authenticatedActor, entityVersion: 3, tenant: tenant,
        compareEntityVersion: 2);
var addresses = revision.Addresses; // Each has an AddressValue with resolved IDs and names.
var differences = revision.AddressDifferences;
var actions = revision.Actions; // Global email/phone/web_link/address action order.

var addressesOnly = await new SqlContactAddressReader(connectionString)
    .ReadAsync(contact, authenticatedActor, 3, tenant, compareEntityVersion: 2);
```

The composed reader holds one root barrier and reads 13 SQL result sets: root followed by
state/diff/actions for email, phone, web links and addresses. Earlier standalone APIs keep their
four-set shapes; the address-only API also has four. Internal readers include private values and
flags. The later full reader includes the declared profile/name history; iteration 5a adds service authorization. HTTP integration remains later work.

## SQL, constructors and permissions

`contacts.contact_address_change` is the public operation boundary, with wrappers
`contact_address_insert`, `address_update`, `address_delete`, `address_restore`, `address_move`.
Pass `@address_data` from `AddressInput.PrepareForDatabase()`, optional `@location_name` and
`@is_public`, contact/actor/tenant context and the unit-entry expected revision. Native adapters
must validate equivalently, including Unicode text; SQL guards structure, widths and geography
but do not duplicate complete backend Unicode validation. Enroll ambient transactions explicitly
and roll back the whole unit on any error.

Both constructors accept appended `@address_data` and `@address_is_public`. Legacy line/zip/geography
arguments still route through the same writer, but cannot be mixed with JSON. Initial addresses
are in revision 1. Orphan label/visibility and promotion-time contact address inputs reject.
Constructor parameters validate full input before assigning bounded columns.

`contact_channels_runtime` permits address operations and composed reads; `email_runtime` remains
email-only. Direct tables, private helpers and constructors remain outside ordinary runtime access.
The domain `Address` tracks exact complete fields, `DisplayOrder` and `IsPublic`; collection edits
preserve persisted ordinals and leave allocation of new ones to the database.

## Verification and next work

The [testing handoff](testing-handoff.md#iteration-3-immutable-addresses--2026-09-07) records focused
and full results, concurrency schedules and disposable-database reconciliation. Iteration 4 now delivers the declared
person/organization profile and contact lifecycle; iteration 5a adds the integrated service. Official catalog loading/search,
customer migration, HTTP, and user provisioning remain separate work.

Iteration 4 adds the [full contact reader](contact-profile-and-lifecycle.md) for the declared profile
and all four child families. Existing channel/standalone reader shapes remain unchanged.

Iteration 5a adds the [integrated service](contact-service.md), which owns trusted context/access
checks, ordered atomic saves and current/historical reads across the profile and all four families.
The earlier direct unit/reader examples remain valid backend APIs. HTTP integration is iteration 5b.
