# ADR 0016: Tenant logins and administrative provisioning

Date: 2026-09-07. Status: implemented and verified for fresh schemas; full gate 115/115 in both RCSI profiles.
Source baseline: `a8cf783`. Iteration 6 of the [master plan](../contact-api-master-plan.md).
Companions: [constructor corrections](0008-constructor-corrections.md),
[contact service](0014-integrated-contact-service-and-access-boundary.md),
[HTTP authentication](0015-contact-http-authentication-and-wire-contract.md).

## Author decisions and scope

The author selected tenant-scoped, case-insensitive logins, generally email-shaped, and explicitly
requested local password setup in this iteration. These supersede the deferred login policy and the
unaccepted credential-free proposal in the [preparation record](../user-provisioning-iteration-6-preparation.md).

Deliver two administrative operations: create a person with an account, and promote an existing
person using its expected revision. Both support explicit contact channel/profile composition, initial
password setup and an optional authorized initial role. Ordinary organizations/groups remain ineligible;
the reserved System bootstrap remains its existing technical exception. Public registration, login/token
issuance, invitation delivery, password changes/recovery, account phone verification and general role or
account lifecycle are outside this contract.

## Login equality and tenant ownership

`security.user.tenant_id` is required. A composite FK `(tenant_id,user_id)` references
`entities.entity(tenant_id,entity_id)`. The tenant is the aggregate's tenant, never an independent choice.
`UNIQUE(tenant_id,login_name)` enforces the identity for every writer, including privileged legacy
construction. Account rows retain their login reservation; this iteration has no account deletion or
login-reuse operation.

The login column explicitly uses **Latin1_General_100_CI_AS_KS_WS_SC**. It is case-insensitive,
accent-sensitive, kana-sensitive and width-sensitive, with supplementary-character support. This fixes
comparison independently of database defaults. SQL column comparison is authoritative; no separate
C# uppercase or normalized-login column competes with it. Windows collation equivalences still apply,
including the tested composed/decomposed accented spelling. This is a declared SQL Server provider
contract, not a claim of byte-for-byte portable Unicode case folding. A future provider must match the
accepted equality corpus or explicitly version a changed identity contract.

Original spelling is stored and copied into construction history. `Ernesto@Example.test` conflicts
with `ernesto@example.test` in the same tenant; another tenant can use it. Accent differences, dots and
`+tags` are retained. There is no mailbox-provider canonicalization, domain rewriting, IDNA conversion,
trimming or email confirmation implied by a login. Legacy aliases such as `system` remain accepted:
"generally email" is not an email-only syntax constraint. Account email is a separate optional value and
starts unconfirmed; neither login nor account email populates the contact email list implicitly in the
new API.

Accepted login length is 1–256 UTF-16 code units. Both service validation and the schema-bound SQL
`security.login_name_is_valid` reject these code-unit ranges/values: U+0000–0020, U+007F–00A0, U+1680,
U+2000–200B, U+2028, U+2029, U+202F, U+205F, U+3000 and U+FEFF. No silent whitespace removal occurs.
The column CHECK applies the same validator. The constructor's input is NVARCHAR(MAX), validated before
storage so overlong inputs do not silently become an accepted 256-unit login. Other Unicode comparison
equivalences are those of the named collation; validation is not a general confusable-character filter.

The unique index arbitrates concurrent duplicates at insertion; there is no preflight lookup presented
as a uniqueness guarantee. Losing construction rolls back its provisional contact/history/role writes.
The concurrency test observes actual blocking and verifies unrelated-login progress before the holder
commits. No new allocation mechanism or retry policy is introduced.

The existing actor-email display view coalesces contact email with login. Its fallback now explicitly
uses DATABASE_DEFAULT for that presentation expression, resolving the mixed-collation CASE error in
fresh schema creation. This projection is not an account lookup or uniqueness comparison. Account
history keeps the entered spelling and existing tenant/root/ledger references.

## Administrative authority and initial role

The service reuses the trusted actor/tenant accessor. `IUserProvisioningAuthorizer` checks provisioning
for the target public key and separately checks the exact requested role ID. New-person construction
also needs contact Create; supplied contact edits need Edit. Promotion without contact edits does not
implicitly require permission to read private contact details. All required service permissions are
checked before opening the write unit or hashing the password.

The HTTP adapter accepts signed `overmind_provision` claims containing a contact GUID or `*` for the
token's tenant. Signed `overmind_assign_role` claims contain exact decimal local role IDs; role assignment
has no wildcard shortcut. Ordinary contact grants and schema-maintenance grants do not imply either
capability. The issuer must map role IDs to the configured database and audience. This is an application
capability contract; possession of an existing SQL role name is not automatically a bearer grant.

`user_insert` adds an optional trailing `initial_role_id`. An ID and legacy role name cannot both be
supplied. The exact ID must identify a tenant-local or global definition; a held key seek protects the
definition through assignment. The new API never authorizes one role and then resolves a potentially
different role by name. The existing name-based constructor path retains its ambiguity checks.
The selected ID remains in `security.user.new` event_args and the initial `user_role` row.

The separate `provisioning_runtime` database role inherits contact capabilities and can execute the
owner-executed `security.user_provision` wrapper. It cannot execute `user_insert` directly or read/write
account tables and private audit helpers. The wrapper requires explicit context, an existing contact
(including a root just created in this unit) and a password hash. SQL still checks actor, tenant,
person eligibility, lifecycle and revision. It trusts the backend's administrative authorization and
hash preparation; a hash argument is not evidence of a human password policy check. Do not distribute
this database credential to HTTP clients. Role/membership preservation is tested across schema recreation.

## Atomic service composition and receipts

`IUserProvisioningService` exposes CreateAsync and PromoteAsync. The implementation uses one
`SqlAuditUnit`, the existing contact command dispatcher and `ProvisionUserAsync`; it never calls the
public contact service methods that independently commit. All supplied contact commands execute in
their listed order, then account construction occurs. A final duplicate login or invalid role rolls
back earlier contact edits, history, catalog inserts and allocation ledger writes in that unit.

New roots remain revision 1 using expected version 0 internally. Promotion requires a positive
unit-entry revision and bumps once, including when contact edits precede it. Earlier root type/profile
history remains intact. Initial account payload and role-choice event share the final unit. Root delete
and restore commands are rejected in this surface; use their separate contact lifecycle contract first.
Organization-to-person conversion is not a promotion shortcut.

Receipts include public key, local user ID, final entity revision, audit stamp, original login,
account email, initial role ID and child identities by command index. They contain no password or hash.
They are returned only after confirmed commit, without a fallible post-commit read. No durable recovery
receipt, automatic retry or idempotent create/upsert is promised. The contact reader exposes historical
root type/profile/channels; a full account/role-history HTTP reader is not introduced by these two writes.
Construction evidence is verified directly against account history and the creation event.

## Local password contract

Both operations require an administrator-supplied password: 15–128 UTF-16 code units, not entirely
whitespace. Spaces are otherwise meaningful; no trim, lowercasing, Unicode normalization or composition
rule is applied. A plaintext password is an input secret, never an identity comparison key.

The service uses ASP.NET Core Identity **PasswordHasher**, IdentityV3 format, with **220,000** iterations
of PBKDF2-HMAC-SHA512. Its standard output carries the random salt, PRF, iteration count and subkey.
The existing Microsoft.Extensions.Identity.Core package is updated from 8.0.16 to **8.0.30**, matching the
host's .NET 8 patch line. No custom cryptographic implementation is added. `password_hash` stores the
framework value; `password_salt` remains NULL for this format. Hashing occurs after capability checks
and before opening a transaction, with cancellation checks around the CPU work. It is not cancellable
mid-hash. Work-factor changes must retain verification compatibility and be measured for deployment load.

Password-containing request records redact account input in their generated string representation.
OpenAPI marks password write-only. Responses, construction events and general history omit the plaintext,
hash and salt. The HTTP pipeline does not log request bodies. Deployment logging/proxies must retain that
property. The administrator supplies and hands off the initial password through the application's chosen
channel; no password generation, email delivery, invitation token or forced-change workflow is installed.

This creates a locally verifiable credential; it does not turn the JWT validation host into a login
server. A subsequent login implementation must resolve tenant first, use the same SQL login comparison,
verify the standard hash, and explicitly design rate limits, lockout, compromised-password screening,
rehashing and recovery. A shared external issuer does not automatically learn these local credentials.

## HTTP contract

POST `/api/users` creates a person/account; POST `/api/users/{contact}/promote` promotes a person.
Both use the existing bearer validation, strict bounded JSON, no-store responses and sanitized
ProblemDetails. Actor/tenant/hash/salt fields cannot be supplied in the request DTOs. Creation returns
201 with a contact-detail Location; promotion returns 200. INT IDs/revisions are JSON numbers and Int64
audit stamps remain decimal strings. OpenAPI describes the 21 permitted contact command alternatives.

Missing authentication is 401; missing provisioning/edit/role grants or invalid SQL actor context is
403. Missing/wrong-tenant targets are 404. Invalid inputs/roles/nonperson categories are 400. Duplicate
login, stale revision, competing promotion and already-provisioned roots are 409. Uncertain commit is
500/commit_uncertain, distinct from storage failure, with no provisional stamp or automatic replay.
HTTP uncertain-commit mapping is tested with an injected exception; actual provider commit-failure
coverage remains the existing independent audit-unit test.

## Verification and compatibility

The [testing handoff](../testing-handoff.md#iteration-6-administrative-provisioning--2026-09-07) records
the final run and resources. New scenarios cover SQL/service/HTTP, both RCSI profiles, password hash
format and verification, role evidence, atomic rollback, Unicode login equivalence, duplicate races,
unrelated-key progress, tenant FK protection, restricted runtime and real schema recreation.

Maintained fixture adaptations are explicit: the old NULL-login late failure becomes a duplicate-login
late failure (NULL now fails validation early); synthetic user insertion supplies the owner's tenant;
legacy test aliases containing spaces become hyphenated aliases, including their matching assertions.
Archived independent review probes are preserved as historical inputs. This is fresh-schema SQL Server
verification, not an upgrade/backfill of populated customer accounts. Such an upgrade needs a collision
report and an explicit resolution policy before applying the new constraint.

## Sources

- [Microsoft collation semantics](https://learn.microsoft.com/en-us/sql/relational-databases/collations/collation-and-unicode-support): CI/AS/KS/WS and supplementary-character behavior.
- [ASP.NET Core Identity password hasher options](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-configuration?view=aspnetcore-8.0): versioned password verification and configurable work factor.
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2): the consulted SHA-512 PBKDF2 setting is 220,000 iterations; Argon2id is another supported design direction, not the selected existing Identity format here.
- [Identity Core 8.0.30](https://www.nuget.org/packages/Microsoft.Extensions.Identity.Core/8.0.30): package version used by this implementation.
