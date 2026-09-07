# Iteration 6: provisioning preparation

Date: 2026-09-07. Source checkpoint: `a8cf783` (completed iteration 5b).
Status: historical preparation, superseded by [ADR 0016](adr/0016-tenant-logins-and-administrative-provisioning.md).
The author subsequently selected tenant-scoped, case-insensitive logins and requested local password
setup. The credential-free proposal below was not accepted. See the [implementation guide](user-provisioning-api.md)
for current behavior; this document preserves the pre-decision review.

See the [master plan](contact-api-master-plan.md#6-administrative-user-provisioning),
[constructor corrections](adr/0008-constructor-corrections.md) and
[HTTP contract](adr/0015-contact-http-authentication-and-wire-contract.md).

## Existing foundation

- `security.user_insert` supports new-person construction and existing-person promotion, rejects
  organizations/groups and ignored promotion contact inputs, validates actor/tenant and initial-role
  eligibility, and preserves the unit-entry expected revision and one aggregate bump.
- Account construction history excludes credentials; the creation event retains the selected initial
  role ID. Contact email and account email are separate.
- `security.user` currently has `login_name` without an enforced uniqueness constraint or a tenant
  column. Its commented-out global unique constraint is historical text, not implemented policy.
- `security.role` has local IDs and tenant/global definitions. The constructor resolves an optional
  role name and validates scope; this does not authorize an administrator to grant that role.
- The contact service owns its transaction through commit. Provisioning must compose lower-level
  contact/account operations inside one `SqlAuditUnit`; invoking the existing public Create/Save
  methods and then creating the account would commit contact work too early.
- The HTTP host validates signed actor/tenant and contact grants. Those grants do not currently
  authorize provisioning. No login, token issuer or credential activation flow was implemented in 5b.

## Login decision required before constraints

The author explicitly deferred login uniqueness until provisioning. Proposed policy, awaiting the
author's answer: **unique within a tenant, case-insensitive**, with tenant resolved by the application
before account lookup. `Ernesto` and `ernesto` would identify the same login within one tenant;
independent tenants could each have that login. A single-tenant application could supply its configured
tenant without asking the human to enter it. This does not introduce shared-user membership.

The alternative is global uniqueness across all tenants. That prevents independent tenants from
reusing the same normalized login and should be selected deliberately if desired.

After scope is selected, record the precise normalization contract in ADR 0016 before implementation:
accepted characters/length, whitespace, case, accents and Unicode equivalence, original spelling,
and one authoritative comparison/key used consistently by SQL and C#. Do not accidentally adopt
the development database's default collation as the public identity contract. Matching fixtures must
cover actual equivalence and distinctions, not merely C# string comparison.

For tenant uniqueness, carry the resolved tenant into the account row and enforce a composite foreign
key to its owning entity, then enforce uniqueness on tenant plus the agreed login key. Update normal
construction, reserved System bootstrap, history/read projections and schema-cycle fixtures together.
The schema constraint must cover privileged constructor calls as well as HTTP requests. Preserve
System's technical exception without granting company accounts or cross-tenant administrative access.

## Proposed implementation shape

Two explicit service/HTTP operations: create a person with an account, and promote an existing person
using its expected revision. New-person creation accepts the declared profile and initial channel
commands. Promotion accepts account inputs plus explicitly authorized contact commands, not legacy
constructor profile switches. Each operation owns one unit, validates all required capabilities before
writes, returns committed identities/revisions and preserves uncertain-commit outcomes without retry.

Add a provisioning capability distinct from contact editing and a separate authorization check for
the exact requested initial role. Reuse the trusted signed actor/tenant boundary. Prefer explicit role
identity in the new API; retain the legacy name-based constructor contract where needed, without
allowing an unverified name-to-ID change between authorization and insertion. Restrict the database
runtime capability to public provisioning procedures and keep helper/table writes private.

Credential and activation scope must also be stated before exposing these endpoints. The current
constructor's optional hash/salt inputs and the JWT API's trusted issuer do not establish a credential
handoff. Recommended bounded direction is provisioning account records and initial roles separately
from password setup/invitations, with no password, hash or token in HTTP responses or general history.
This is a proposal, not an author-selected identity-provider integration or a claim that a provisioned
account can immediately sign in. If local password activation is required, specify its separate
credential contract before implementing it.

## Implementation verification

Run meaningful SQL, service and real HTTP cases under both existing RCSI profiles:

- Both operations, earlier and promoted history/type, initial-role evidence and four-family composition.
- Same/equivalent login concurrency, tenant-scope behavior, different-login progress, constructor
  enforcement and complete rollback when a duplicate is discovered after earlier contact edits.
- New/existing organization and group rejection, stale and competing promotions, actor/tenant
  spoofing, unauthorized provisioning and unauthorized initial-role assignment.
- Mixed contact/account failure with one unit and one revision; strict transport, no secret payload,
  committed-result precision and distinct conflict/uncertain-commit handling.
- Actual System bootstrap and application schema create/drop/create after account DDL changes.

Then rebuild/discover and run the full maintained regression gate, reconcile every owned database,
update ADR/master plan/both guides/handoffs and report fresh-schema/local verification boundaries.
Use the author's audit-unit SQL style. Do not modify archived review probes or commit on the author's
behalf. Migration of populated customer databases, public registration, shared users, invitations,
credential recovery and general account/role lifecycle remain separate unless explicitly brought in.
