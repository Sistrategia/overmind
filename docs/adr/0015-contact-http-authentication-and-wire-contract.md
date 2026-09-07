# ADR 0015: contact HTTP authentication and wire contract

Date: 2026-09-07. Status: implemented; final execution evidence lives in the testing handoff.
Iteration 5b, over `04a4409` (completed iteration 5a documentation checkpoint).

## Context and authentication choice

Iteration 5a supplies an integrated contact service with required host context and authorization. The
WebAPI previously had no authentication pipeline and exposed anonymous development schema operations.
This iteration adds the declared contact HTTP surface and an explicit host implementation of those
service contracts. Login uniqueness remains deferred until provisioning; this is not a login/token
issuance implementation.

There was no configured identity provider in the repository. Configurable JWT validation was announced
as the implementation assumption after an optional authentication preference question received no reply.
It is an integration contract, not a claim that the author selected a particular provider or that a
live issuer has been configured. A later host adapter may use another authentication mechanism while
preserving the service's trusted context and authorization requirements.

Use the standard ASP.NET Core bearer handler, with the .NET 8
[JwtBearer 8.0.30 package](https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.JwtBearer/8.0.30).
The authority must be HTTPS. The configured issuer, audience, signature and lifetime are validated;
unsigned tokens and algorithms outside RS256/PS256/ES256 reject. Expiration is mandatory, with 30 seconds
of clock skew. Keys come from trusted authority metadata, not token-supplied URLs. Inbound claim mapping
is disabled, tokens are not saved, and authentication responses omit diagnostic details. These checks
follow the framework's [bearer validation model](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication).

`ContactAuthentication:Authority`, `Issuer` and `Audience`, plus the existing default SQL connection,
are mandatory startup configuration. No shared secret, test key, issuer address or tenant fallback is
installed in appsettings. HTTPS redirection remains enabled; there is no permissive CORS policy.
Production HTTPS termination, trusted-proxy configuration and live issuer metadata/key rotation remain
deployment responsibilities and were not exercised by the in-process tests.

## Signed identity and grants

| Claim | Meaning |
| --- | --- |
| `overmind_actor` | Exactly one nonempty GUID in D format: the database entity public key of the authenticated user. |
| `overmind_tenant` | Exactly one nonempty GUID in D format: the explicitly resolved database tenant public key. |
| `overmind_contact` | Repeated grant values `permission:target`; target is one contact GUID or `*` within the signed tenant. |

The issuer must establish these mappings. An external provider's `sub` or `tid` is not assumed to be
an Overmind entity/tenant ID. Missing or repeated actor/tenant claims invalidate authentication (401).
The HTTP context adapter has no default tenant. Headers such as X-Actor/X-Tenant are ignored; JSON
actor/tenant fields and unexpected query selectors reject. The bearer handler uses the Authorization
header, not request-body credentials, cookies or query-string tokens.

Grant names are case-sensitive: `create`, `edit`, `delete`, `restore`, `read_detail`, `read_history`,
`read_directory`. Each grant is exact; unknown/malformed values grant nothing. For example,
`read_detail:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` grants current detail of that one contact, whereas
`edit:*` covers edits within the token's tenant. Create plus initial child commands requires Create
and Edit as in ADR 0014. The service checks every required permission before opening a write unit.

These are issuer-managed capabilities, not a new SQL role/membership lifecycle. Grant revocation is
bounded by token lifetime unless the host adds a revocation policy. SQL still rechecks active actor
and tenant ownership on every operation; a wildcard does not bypass either check. `is_system`, an
ordinary account role name or a client-supplied GUID grants no automatic privilege.

## HTTP routes

| Method and path | Contract |
| --- | --- |
| POST `/api/contacts` | Create a person/organization with initial commands; 201 with committed save result and Location. |
| POST `/api/contacts/{contact}/save` | One expected revision and an ordered command array; 200 with committed save result. |
| GET `/api/contacts/{contact}` | Current declared state; ReadDetail. |
| GET `/api/contacts/{contact}/revisions/{version}?compareEntityVersion={prior}` | Historical state, optional comparison and actions; ReadDetail plus ReadHistory. |
| GET `/api/contacts/{contact}/directory` | Limited current directory detail; ReadDirectory plus root/child visibility filtering. |

Root deletion/restoration are Save commands so restoration and further edits can share one atomic
operation. There are no independently committed convenience child endpoints. Controllers call the
service once per request and pass RequestAborted through. Current/historical read coherence and final
committed save identities remain the service contracts; the controller does not assemble family reads
or issue a post-commit current query. Responses for contact routes use `Cache-Control: no-store`.

The declared detail/edit/history surface is complete within the existing profile/family scope. This
does not include listing/search, groups, relationships, account lifecycle, provisioning or token issuance.

## JSON and optimistic concurrency

Inputs are case-sensitive camelCase JSON with content type application/json, at most 1 MiB and depth
32. The byte bound is enforced while reading, including a body without Content-Length. Duplicate
properties at every object depth, unknown fields and invalid command discriminators reject. Numeric
strings do not substitute for integer revision/ordinal fields; booleans must be JSON booleans.

Create accepts `profile`, optional `commands`, and optional `publicKey`. Save accepts
`expectedEntityVersion` and `commands`; its target comes from the route. `kind` is the closed command
discriminator: `profile.replace`, `contact.delete`, `contact.restore`, or a child family name
(`email`, `phone`, `web_link`, `address`) followed by `.insert`, `.replace`, `.delete`, `.restore`, `.move`.
An irrelevant field rejects rather than silently being discarded (for example, `value` on delete).
The converter maps these 23 types directly to the service's commands; there are no arbitrary callback,
SQL or CLR-type-name inputs. The same discriminator map supplies OpenAPI alternatives.

Profile and value/association replacements follow ADR 0014: omitted commands preserve state; omitted
optional fields in Replace clear through their defaults. NULL/default semantics are not JSON Merge
Patch or whole-list replacement. Existing Save requires a positive unit-entry expected revision;
creation uses zero internally. Stale tokens produce 409. There is no If-Match/ETag alternative in this
iteration and no automatic reconciliation/retry. A client-selected creation key is not an idempotency key.

JSON response Int64 values, including dbrow_version stamps, are **decimal strings** to preserve precision
in JavaScript clients. Entity revisions, child ordinals, positions and SQL INT IDs remain numbers.
Optional state fields retain explicit NULL values. Current detail exposes authorized internal state
without actions/diffs; directory detail is a different response type without personal profile/history
payloads and only public live channels. Private/deleted roots return 404 in the directory. Filtering
does not renumber stored display_order or select a replacement for a hidden principal.

Development Swagger documents bearer authentication, POST bodies, all 23 command alternatives and
string audit stamps. The [HTTP guide](../contact-http-api.md) provides concrete payloads and claim setup.

## Responses and uncertain outcomes

| Condition | HTTP / code |
| --- | --- |
| Missing, invalid, expired, unsigned or ambiguous-identity token | 401 / unauthenticated, with WWW-Authenticate: Bearer |
| Missing grant or rejected SQL actor/tenant | 403 / forbidden |
| Invalid JSON, shape or service validation | 400 / validation |
| Wrong media type / oversized body | 415 / json_required; 413 / request_too_large |
| Missing root/child/revision, wrong tenant target, hidden directory root | 404 / not_found |
| Stale token, duplicate identity or incompatible lifecycle state | 409 / conflict |
| Protected deletion dependency | 409 / dependency |
| Missing historical coverage | 409 / history_unavailable |
| Commit acknowledgement uncertain | 500 / commit_uncertain |
| Other provider/internal error | 500 / storage |
| Cancellation without a disconnected request | 408 / cancelled |

Application errors use ProblemDetails with stable `code`, trace ID and `automaticRetryAllowed: false`.
The response never includes exception/SQL text, connection details, tokens or provisional commit stamps.
Internal errors are logged through the host logger for trusted diagnostics. HTTP/model-binding errors
also use sanitized validation responses; ordinary framework routing failures retain normal HTTP semantics.
There is no developer exception page around contact endpoints, even in Development.

An admitted commit remains uncancellable. Its uncertain exception is mapped before generic errors;
the API does not return success, label it a validation failure or automatically retry. A confirmed
commit may outlive a disconnected client, and the absence of a response is not evidence of rollback.
When RequestAborted indicates disconnection, cancellation aborts the response instead of fabricating
a reliable error body. Durable receipts/reconciliation remain future work.

## Development schema boundary

The former anonymous `api/dev` controller is now protected by authentication, a signed
`overmind_schema_admin=true` grant, Development environment **and**
`Development:EnableSchemaEndpoints=true`. The switch defaults false. Contact grants do not authorize
schema maintenance, and the maintenance grant never enables these endpoints in Production. This closes
the adjacent destructive bypass without exposing bootstrap/login shortcuts through contact endpoints.

## Verification

[Testing handoff](../testing-handoff.md#iteration-5b-contact-http-boundary--2026-09-07) records focused/full
gates and resource reconciliation. Tests use the production hosting composition and real JWT middleware
via [TestHost 8.0.30](https://www.nuget.org/packages/Microsoft.AspNetCore.TestHost/8.0.30), with ephemeral RSA
keys and static test metadata; they do not replace authentication with a fake header scheme. They
exercise signature/issuer/audience/lifetime/claim rejection, authorization, strict and streamed JSON,
OpenAPI, exact Int64 transport and sanitized outcome mapping. Actual SQL cases under both RCSI profiles
cover person/organization creation, every command kind, old/current revisions, combined actions,
stale tokens, failing-last-command rollback, privacy and valid cross-tenant actor rejection.

The HTTP uncertain-commit test injects the service exception to verify response/no-retry behavior;
the existing full suite separately retains real terminated-session commit-failure and cancellation
tests. No live identity provider, external TLS listener, customer database, remote CI or deployment
was exercised. No SQL schema or audit mechanism changed. Next is iteration 6 provisioning, beginning
with the explicitly deferred login uniqueness/tenant-resolution decision.
