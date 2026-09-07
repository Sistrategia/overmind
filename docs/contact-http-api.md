# Contact HTTP API

Iteration 5b exposes the integrated service through authenticated HTTP. Start with
[ADR 0015](adr/0015-contact-http-authentication-and-wire-contract.md) for the exact trust and wire contract,
or the [service guide](contact-service.md) for direct C# use.

## Configure the host

Supply these configuration values through your existing host configuration or secret store:

| Configuration key | Value |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | SQL connection for the intended database; use the contact_runtime capability for contact operations. |
| `ContactAuthentication:Authority` | Trusted HTTPS OIDC authority for metadata/signing keys. |
| `ContactAuthentication:Issuer` | Exact expected token issuer. |
| `ContactAuthentication:Audience` | Audience identifying this API. |

Environment-variable names use double underscores, for example `ContactAuthentication__Audience`.
No live issuer or test signing key is checked in. Missing required configuration fails startup.
The API validates bearer JWTs; it does not mint tokens, log users in or decide login uniqueness.
The trusted issuer must map its authenticated user and chosen tenant to these signed claims:

```json
{
  "overmind_actor": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "overmind_tenant": "11111111-2222-3333-4444-555555555555",
  "overmind_contact": [
    "create:*", "edit:*", "read_detail:*", "read_history:*", "read_directory:*"
  ]
}
```

This is an illustrative claim payload, not a usable token. Actor and tenant must be their database
public keys and appear exactly once. The bearer middleware also requires a valid signature, issuer,
audience and expiration. A provider's external subject/tenant IDs are not automatically those database
keys. The SQL layer independently validates the active actor and tenant on every operation.

Grants can target a particular contact instead of `*`, for example
`read_detail:12345678-1234-1234-1234-123456789abc`. Wildcards cover only the signed tenant. Grant names
are case-sensitive. Add `delete` or `restore` only for callers allowed to perform those root operations.
Initial child commands need Edit as well as Create. History needs ReadDetail plus ReadHistory.

Send `Authorization: Bearer <token>` on requests. Do not send actor/tenant in JSON or query parameters;
those fields reject. X-Actor/X-Tenant headers do not change the signed context. Production HTTPS/proxy
and any necessary CORS allowlist must be configured for the intended deployment; no public listener,
permissive CORS rule or live identity-provider setup is installed by this iteration.

## Create a person with four channels

POST `/api/contacts`, Content-Type `application/json`:

```json
{
  "profile": {
    "contactTypeId": 1,
    "fullName": "Ernesto Ocampo",
    "personFirstName": "Ernesto",
    "personLastName1": "Ocampo"
  },
  "commands": [
    { "kind": "email.insert", "value": "ernesto@example.test", "location": "Work", "isPublic": true },
    { "kind": "phone.insert", "value": { "number": "312-3456", "defaultRegion": "MX", "areaCode": "777" } },
    { "kind": "web_link.insert", "value": { "url": "https://example.test" } },
    { "kind": "address.insert", "value": { "address1": "Office", "country": "México" } }
  ]
}
```

A successful response is 201 with Location `/api/contacts/{publicKey}`, entityVersion 1, the audit
stamp as a decimal string and child identities indexed by zero-based command position. Keep these
ordinals for subsequent edits. For an organization use contactTypeId 2 and its explicit fullName;
person-only fields reject for organizations. Optional publicKey requests a specific new key, not an upsert.

## Save several changes atomically

POST `/api/contacts/{publicKey}/save`:

```json
{
  "expectedEntityVersion": 1,
  "commands": [
    {
      "kind": "profile.replace",
      "profile": {
        "contactTypeId": 1,
        "fullName": "Ernesto Ocampo",
        "displayName": "Neto",
        "personFirstName": "Ernesto",
        "personLastName1": "Ocampo"
      }
    },
    { "kind": "phone.replace", "ordinal": 1, "value": { "number": "+527773123456" }, "extension": "25" },
    { "kind": "address.replace", "ordinal": 1, "value": { "address1": "New office", "country": "México" } }
  ]
}
```

The whole request is one audit unit and becomes revision 2. A failure in the final command rolls back
the name and phone changes too. Omitted commands preserve state. Replace supplies the complete desired
supported fields: omitted optional fields clear and visibility defaults false. There is no implicit
whole-list replacement. Up to 256 commands execute in list order; initial insertion order defines
the order of newly allocated children. Whole request bodies are limited to 1 MiB and depth 32.

| Operation | Command fields |
| --- | --- |
| `profile.replace` | profile |
| `contact.delete` / `contact.restore` | kind only |
| `{family}.insert` | value; optional location, isPublic; phone also extension |
| `{family}.replace` / `{family}.restore` | ordinal, value and optional association metadata |
| `{family}.delete` | ordinal |
| `{family}.move` | ordinal, displayOrder |

Families are email, phone, web_link and address. Email value is a string; other values use their
existing input objects. Moving to position 1 selects the principal. Delete retains the child identity;
restore reuses it and appends. Root deletion rejects accounts and relationship dependencies. Restore
may precede further edits in the same Save. Root category conversion and relationship/account editing
are not commands in this surface.

JSON names and command kinds are case-sensitive. Unknown, duplicate and irrelevant fields reject;
`"isPublic": 1` or a quoted revision is invalid. Optional output fields preserve explicit nulls.
All Int64 output values are strings so browser clients retain exact audit numbers; ordinary INT IDs,
entity revisions, ordinals and displayOrder remain JSON numbers.

## Read current state, history or directory detail

- GET `/api/contacts/{publicKey}` returns the declared profile and all four current child families, with revision tokens. ReadDetail may expose private/deleted state to an authorized internal caller, but contains no actions/diffs.
- GET `/api/contacts/{publicKey}/revisions/2?compareEntityVersion=1` reconstructs revision 2 with old/new differences and globally ordered actions. It additionally requires ReadHistory.
- GET `/api/contacts/{publicKey}/directory` returns display name/category and public live channels only. It requires ReadDirectory; private/deleted roots return 404. Filtering preserves saved relative order and does not invent a replacement principal.

Each read uses the service's one coherent root barrier. Current revision selection happens inside it.
Responses use Cache-Control: no-store. There is no listing/search endpoint yet.

## Handle errors deliberately

Errors use ProblemDetails with `code`, `traceId` and `automaticRetryAllowed: false`.
401 means authentication failed; 403 means a grant or SQL actor/tenant check failed. Validation is 400,
unsupported media is 415, oversized input is 413 and unavailable data is 404. Stale tokens are
409/conflict: read the current revision and resolve the edit before submitting a new Save. Protected
deletion is 409/dependency; missing historical coverage is 409/history_unavailable.

500/commit_uncertain is distinct from 500/storage. Do not blindly replay it: the commit might have
succeeded, and no durable recovery receipt exists yet. The response omits provisional stamps and
internal exception text. A disconnected client may receive no response even after commit succeeded.
The server never splits or automatically retries a logical Save.

Development Swagger is available at `/swagger` and documents the bearer scheme and command alternatives.
The old schema tools require Development mode, `Development:EnableSchemaEndpoints=true` and a separate
signed `overmind_schema_admin=true` grant. Ordinary contact grants cannot invoke them.

See the [testing record](testing-handoff.md#iteration-5b-contact-http-boundary--2026-09-07).
Next is iteration 6: settle login uniqueness/tenant resolution, then administrative provisioning.
