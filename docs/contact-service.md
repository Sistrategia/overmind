# Integrated contact service

Iteration 5a adds `IContactService` and `SqlContactService` in
`Sistrategia.Data.SqlClient.Contacts`. See [ADR 0014](adr/0014-integrated-contact-service-and-access-boundary.md)
for authorization, visibility, save and error decisions.

## Wire trusted host context

Register your scoped `IContactContextAccessor` and `IContactAuthorizer`, then call
`services.AddSqlContactService(connectionString)`. Resolve `IContactService` from the request scope.
Both host dependencies are required; there is no allow-all fallback. The context accessor returns
`ContactActorContext(authenticatedActor, resolvedTenant)`. Derive these from trusted application or
authenticated context, never the contact request body. Use the `contact_runtime` database capability.
Iteration 5b will supply the HTTP integration; no endpoints are registered by this helper.

The policy receives the context, target public key and required capability. It can grant individual
contacts. Creation needs Create; initial child commands also need Edit. Profile/child saves need Edit,
root deletion needs Delete, and root restoration needs Restore. Every required grant is checked before
the transaction begins. SQL then independently validates the active actor and tenant ownership.

## Create, then save several changes

```csharp
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;

var profile = new ContactProfileInput(1, "Ernesto Ocampo",
    PersonFirstName: "Ernesto", PersonLastName1: "Ocampo");
var created = await contacts.CreateAsync(new ContactCreateRequest(profile, [
    new InsertContactEmail("ernesto@example.test", "Work", IsPublic: true),
    new InsertContactPhone(new PhoneInput("312-3456", "MX", "777")),
    new InsertContactWebLink(new WebLinkInput("https://example.test")),
    new InsertContactAddress(new AddressInput(Address1: "Office", Country: "México"))
]));

var phoneOrdinal = created.ChildIdentities.Single(x => x.CommandIndex == 1).Ordinal;
var addressOrdinal = created.ChildIdentities.Single(x => x.CommandIndex == 3).Ordinal;
var saved = await contacts.SaveAsync(new ContactSaveRequest(created.PublicKey, created.EntityVersion, [
    new ReplaceContactProfile(profile with { DisplayName = "Neto" }),
    new ReplaceContactPhone(phoneOrdinal, new PhoneInput("+527773123456"), Extension: "25"),
    new ReplaceContactAddress(addressOrdinal, new AddressInput(Address1: "New office", Country: "México"))
]));
```

Here `contacts` is the resolved `IContactService`. Creation is revision 1; the mixed save becomes
revision 2, committed atomically. Returned identities/tokens are committed results. A failure in the
last command rolls back the profile and phone edits too. The service does not retry failures.

For an organization, create `ContactProfileInput(2, "Company name", Recruiting: true)` with common
profile fields and its child commands. Person-only profile fields reject for organizations. Account
creation, company membership, category conversion and relationship editing remain separate operations.

## Commands and omission

Commands run in the supplied order, across all families. Omit a command to preserve existing state.
Replace commands supply the complete desired supported fields; NULL clears optional fields and
IsPublic defaults false. Omitting a collection is not a request to delete all its items.

Each family has Insert, Replace, Delete, Restore and Move commands, such as `DeleteContactPhone`,
`RestoreContactPhone` and `MoveContactPhone`. Existing children use stable ordinals. Move to position 1
selects the principal. Insert/restore append; use initial insertion order for newly created children.
Returned command identities contain no possibly stale intermediate display order or value ID.

Root `DeleteContact` and `RestoreContact` are commands too. Deletion preserves the child lists and
rejects contacts with accounts or relationship dependencies. Restore can precede other edits in the
same Save. Supply the original expected revision for the request; the service reuses it internally.
An entirely ineffective Save returns that same revision and a NULL `AuditDbrowVersion`.

## Read current state or compare revisions

```csharp
var detail = await contacts.ReadCurrentAsync(created.PublicKey);
var revision = await contacts.ReadRevisionAsync(created.PublicKey, saved.EntityVersion,
    compareEntityVersion: created.EntityVersion);
var nameChanges = revision.ProfileDifferences;
var addressChanges = revision.Channels.AddressDifferences;
var actions = revision.Actions; // Effective profile and child actions in their global order.
```

Current detail needs ReadDetail. It contains profile, email, phone, web-link and address state with
stable identity/order/visibility and revision tokens. Selecting the current revision and reading its
components occur under one database root barrier. It can show private/deleted data to the authorized
internal caller. It contains no history/action payloads.

Historical reads need ReadDetail **and** ReadHistory and preserve old names/catalog labels. Missing
coverage rejects rather than borrowing current values. The supported profile/family scope is complete;
relationships and account history are outside this response.

`ReadDirectoryAsync` needs ReadDirectory and returns a smaller current projection: display name,
category and only public live channels. Private/deleted roots return NotFound. Hidden principal items
are not promoted or replaced; filtered saved order can have gaps. This projection has no personal
profile details, actions or history and is not an anonymous directory or search endpoint.

## Handle outcomes

`ContactServiceException.Failure` identifies validation, forbidden access, missing data, conflict,
dependency, missing historical coverage or storage failure. A stale token is Conflict: read the current
state and let the caller resolve their edit before issuing a new Save. Inspect InnerException only in
trusted diagnostics; do not expose it as an HTTP response.

Cancellation before commit aborts the complete Save. `AuditUnitCommitUncertainException` is separate:
its provisional stamp is a correlation hint, not proof of commit. The service preserves that exception
and never blindly replays the request. The existing audit unit does not cancel an admitted commit, and
the service does not turn a confirmed commit into cancellation by checking the token afterward.

See the [verification record](testing-handoff.md#iteration-5a-integrated-contact-service--2026-09-07).
Next is iteration 5b, the HTTP boundary. Login uniqueness stays deferred until provisioning.
