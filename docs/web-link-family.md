# Web-link family

Updated: 2026-09-07. Iteration 2 implemented and verified for fresh schemas.
Contract: [ADR 0011](adr/0011-web-link-values-and-contact-associations.md).

## One save across three families

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, authenticatedActor, tenant);
await unit.UpdateEmailAsync(contact, expectedVersion, emailOrdinal, "new@example.test");
await unit.UpdatePhoneAsync(contact, expectedVersion, phoneOrdinal,
    new PhoneInput("312-3456", "MX", "777"), location: "Office", extension: "204");
await unit.InsertWebLinkAsync(contact, expectedVersion,
    new WebLinkInput("https://example.test/Profile?a=1&b=%2f#Bio", "website", "Company profile"),
    location: "Work", isPublic: true);
await unit.CommitAsync();
```

Use the unit-entry expected revision on every command. These writes share one audit allocation and
one contact revision. Outputs are provisional until commit; validation, SQL and cancellation failures
abort the whole unit. An uncertain commit retains the existing explicit recovery contract.

`InsertWebLinkAsync`, `UpdateWebLinkAsync`, `DeleteWebLinkAsync`, `RestoreWebLinkAsync`,
`MoveWebLinkAsync` and `MakeWebLinkPrincipalAsync` use the same lifecycle as email and phone.
`ordinal` identifies the association permanently; `display_order` is its saved position, with 1 principal.
Insert/restore append, delete closes gaps, move shifts positions. Update/restore replace all metadata:
omitted optional values clear it and omitted `isPublic` sets false. Two entries may share a URL.

## Fields and exact values

| Field | Contract |
| --- | --- |
| `Url` | Required absolute HTTP/HTTPS URL, at most 2048 UTF-16 units; exact accepted text is stored in the shared immutable URL dictionary. |
| `LinkType` | Optional extensible lowercase ASCII token, 1–50 characters from `a-z`, `0-9`, `_`, `-`; examples: `website`, `linkedin`, `other`. No host-based inference. |
| `DisplayText` | Optional plain text, up to 256 UTF-16 units, stored on the association and in its history/actions. |
| `location` | Optional exact label, up to 100 UTF-16 units, referenced through an immutable label dictionary. |
| `isPublic` | Default false; directory-display eligibility, still subject to root privacy and application authorization. |

Path case, escape spelling, query order, fragment, explicit port and final slash are preserved.
Metadata keeps trailing spaces; NULL and empty label/display text are distinct. URL whitespace and
controls must be encoded; credentials, backslashes and malformed percent escapes reject.
Validation does not fetch a URL. URLs that resolve to the same resource need not share a dictionary ID.
Changing one contact's association never changes another contact's URL or a historical revision.

## Historical reading

```csharp
var reader = new SqlContactChannelsReader(connectionString);
var revision = await reader.ReadAsync(contact, authenticatedActor, entityVersion: 3,
    tenant: tenant, compareEntityVersion: 2);
var links = revision.WebLinks;
var differences = revision.WebLinkDifferences;
var actions = revision.Actions; // Globally ordered email, phone and web_link effective actions.

var linksOnly = await new SqlContactWebLinkReader(connectionString)
    .ReadAsync(contact, authenticatedActor, 3, tenant, compareEntityVersion: 2);
```

The composed reader resolves the root and both revision bounds once, holds its shared clustered root
barrier through every family, and consumes server completion. Ten SQL result sets are now returned:
root plus state/diff/actions for each of email, phone and web links. Earlier email-only and phone-only
SQL APIs keep their four-set contract. The web-link-only API also returns root plus three family sets.
Internal readers retain private values and flags; these are not public-directory endpoints.

## SQL and construction

The public boundary is `contacts.contact_web_link_change`, with operation wrappers
`contact_web_link_insert`, `web_link_update`, `web_link_delete`, `web_link_restore`, `web_link_move`.
Use `@url`, `@link_type`, `@location_name`, `@display_text`, `@is_public`, contact/actor/tenant context,
the required unit-entry expected revision and optional INOUT audit/ordinal/order outputs.
Native callers must validate with `WebLinkInput.Validate()` or an equivalent trusted adapter first;
SQL structural guards do not replace complete URI parsing. Compose in an explicitly enrolled caller
transaction and roll back the whole unit on any failure.

`contacts.contact_insert` and `security.user_insert` append `@web_link_url`, `@web_link_type`,
`@web_link_location_name`, `@web_link_display_text`, `@web_link_is_public`. Initial entries participate
in revision 1. Metadata without a URL rejects. Promotion accepts account inputs; supplied initial
web-link arguments reject as unsupported contact detail, including an explicitly false visibility.

`contact_channels_runtime` permits web-link and combined commands/reads alongside email and phone.
`email_runtime` alone gains no web-link capability. Neither permits direct dictionary/history access,
private writer/reader components or constructors. Deployment membership survives schema recreation.

The legacy domain `WebLink` keeps exact values, tracks `DisplayOrder` and `IsPublic`, and treats
`Ordinal` as identity. A new collection entry leaves identity allocation to the database. This domain
object is not yet a complete persistence/service mapper; use the explicit audit commands above.

## Verification and next work

The [testing handoff](testing-handoff.md#iteration-2-web-links--2026-09-07) records 64/64 passing full-gate
tests in 6 min 38 sec, zero failures/skips or build warnings/errors, and verified removal of all 74
created test databases. Two initial connection-failure intent names were independently verified absent. Coverage includes three-family saves and consistent reads, exact shared
values, historical replacement, ordering, no-ops, rollback, permissions and constructor field fidelity.
Next is iteration 3: immutable addresses and their geographic catalog contract. Contact service/HTTP,
root lifecycle, user provisioning and customer migrations remain separately planned.
