# ADR 0014: integrated contact service and access boundary

Date: 2026-09-07. Status: implemented for fresh schemas; verification is recorded in the testing handoff.
Iteration 5a, over committed iteration 4 (`c421d3a`).

## Context

ADRs 0009–0013 provide complete declared child families and person/organization profiles. Applications
still have to open audit units, resolve actor/tenant context, apply access decisions and assemble
several commands themselves. The full reader reconstructs a specified revision coherently, but choosing
the current revision with a separate query would introduce a race. HTTP and provisioning remain later work.

## Service and scope

`IContactService` and `SqlContactService` live in `Sistrategia.Data.SqlClient.Contacts`, beside the
existing provider input/state contracts they compose. `AddSqlContactService` registers a scoped service;
the host must register its context accessor and authorization policy separately. There is no permissive
production policy, System fallback or automatic WebAPI registration.

The service exposes person/organization creation, ordered atomic saves, current detail, historical
revision/comparison and a limited current directory detail projection. It uses the existing SQL/C#
writers and full reader. It does not round-trip through the older mutable `Sistrategia.Core.Contact`
graph, whose constructor/collection behavior is not the complete historical service contract. Existing
domain classes remain usable; service DTOs carry the established stable ordinal, saved display_order,
visibility and revision semantics directly. A legacy graph adapter is separate work.

This provider-first placement avoids a second copy of every immutable value and profile DTO. A future
provider can extract the behavioral interface and value types when it implements the same contract;
this iteration does not claim a provider-independent assembly or a PostgreSQL/MySQL implementation.

## Trusted context and authorization

Request objects contain no actor or tenant fields. Once per service call, `IContactContextAccessor`
supplies a trusted authenticated actor and explicitly resolved tenant. Empty or missing context rejects.
The host is responsible for authenticating that identity; constructing the context record is not
authentication. SQL independently rechecks that the actor is active and belongs to the specified tenant,
and that the target belongs to that tenant. A valid actor from another tenant cannot read or mutate it.

`IContactAuthorizer` decides a capability for `(actor, tenant, contact public key, permission)`. Every
required permission is checked before opening the write unit. Creation checks Create, and its initial
commands additionally check Edit/Delete/Restore as applicable. Existing saves check the distinct command
permissions. This deliberately prevents permission for a harmless early command from authorizing a later
delete. A policy can restrict individual contacts; it need not grant tenant-wide access.

| Operation | Required permission |
| --- | --- |
| Create root | Create |
| Replace profile or insert/replace/delete/restore/move a child | Edit |
| Delete root | Delete |
| Restore root | Restore |
| Current complete declared state | ReadDetail |
| Historical revision, differences and action payloads | ReadDetail and ReadHistory |
| Limited current directory detail | ReadDirectory |

These are host capabilities, not new rows in `security.role`. There is no invented owner field or
company-membership permission model. A host policy must not infer write permission from a separately
read, mutable profile: that would require locking and validating the policy data within the write
transaction. Capability decisions here occur at admission; atomic revocation of external grants is not
promised. HTTP authentication, concrete application grants and their lifetime are wired in iteration 5b.
The SQL principal should have `contact_runtime`; raw SQL access bypasses these application decisions
and remains a trusted backend capability.

## Visibility and response contracts

Full current detail is an authorized internal view. It may include private channels, private roots
and soft-deleted roots with their lifecycle metadata. It returns state only, without historical diff
or action payloads. Historical detail requires the additional history permission, including when the
caller requests the current revision by its number. This prevents old values in action payloads from
leaking through a current-detail grant.

Directory detail has a separate response type: public key, revision, category, display name and public
child values. A private or deleted root produces NotFound. Each family includes only live `IsPublic`
associations, ordered by its saved display_order. Remaining order values can have gaps; filtering does
not promote a hidden principal or renumber stored positions. The response omits personal profile fields,
summary, history, action evidence, audit actors and phone parsing/raw-input metadata. A public address
exposes its complete immutable address value and catalog labels. `DoNotContact` does not authorize
messaging, nor does directory visibility grant permission to send communications.

The directory operation still requires an authenticated tenant user and an explicit policy grant.
It is a detail projection, not an anonymous endpoint, list/search implementation or pagination contract.
Full and directory reads consume the same coherent backend snapshot and project it before returning.

## Save contract

One request targets one contact. Existing saves require a positive **unit-entry** expected revision;
creation starts at expected zero internally. A command list is copied before the first asynchronous
context/policy call and is bounded to 256 commands. Commands and nested inputs are immutable records.
An existing save must contain at least one command; creation may omit initial commands.

Commands execute sequentially in supplied list order across families. Root creation is first, followed
by initial commands in that same audit unit. Every command receives the original expected token, so
profile and any number of child changes produce at most one root bump. Effective actions retain their
global order; no-ops produce no extra action. The closed command family cannot run arbitrary callbacks
or commit an intermediate unit. Root restore may precede profile/child edits in one save.

Omitting a command leaves that state unchanged. `ReplaceContactProfile` replaces all declared editable
profile fields: optional NULL clears and boolean defaults remain false. Child Replace/Restore supplies
the complete value and association metadata; NULL optional metadata clears and IsPublic defaults false.
These are explicit commands, not whole-list replacement or automatic diffs against an old client graph.
Insert allocates an ordinal; restore reuses a retained ordinal; move uses an existing ordinal and a
one-based live position. Move to position 1 selects the principal. Insert and restore append.

Returned `ContactSaveResult` contains the public key, **final committed entity revision**, the audit
unit's nullable stamp and child identity references indexed by zero-based request command position.
These references identify retained children, even if another command subsequently edits/deletes them.
They do not claim intermediate values or display positions are final. New identities are available
after Save; command references to earlier newly allocated identities are not implemented. Supply desired
initial order through insertion order, or use a later Save with returned ordinals. Empty-effective saves
return the unchanged revision and a NULL audit stamp. Creation always has a stamp.

Results are constructed before commit and returned only after confirmed commit. There is no fallible
post-commit read that could mix in a later writer. Fetch detail separately when wanted; it may already
reflect a subsequent revision. A successful token is evidence of this save's revision, not a lease on
the current state. Public-key reuse is not an idempotency receipt.

## Current read boundary

`SqlContactReader.ReadCurrentAsync` passes SQL NULL for the requested revision. Only the full-profile
path in `contact_channels_read_core` resolves NULL to the current root revision, **after acquiring the
same clustered root barrier** used for specified-revision reads. The existing transaction then reads
root, profile, names and all four families at that bound. There is no separate current-version query.
`contacts.contact_read` keeps its 16 result sets; its required `@entity_version` argument may now be
explicitly NULL. Existing standalone/channel-only contracts still require a specific revision.

The historical reader continues to use captured immutable catalog/name values and rejects missing
profile coverage. Unported relationships and account configuration are not reconstructed or fabricated.

## Validation and failure outcomes

Shape/token/command validation combines service guards with existing typed inputs and SQL family
guards. SQL still checks widths, child existence, geographic consistency and lifecycle dependencies.
Invalid late commands and cancellation before commit abort the whole unit, including earlier profile
or child work. Email validation retains the family's value/width contract; no new mail-delivery or
verification policy is implied.

`ContactServiceException.Failure` distinguishes Validation, Forbidden, NotFound, Conflict, Dependency,
HistoryUnavailable and Storage. Known SQL numbers map explicitly; unknown provider/invariant errors
remain Storage. Stale versions, deleted/locked roots and deadlocks are conflicts; missing roots,
children or revisions are NotFound. Original exceptions are retained for trusted diagnostics. HTTP
must map intentional responses and never serialize exception internals or SQL diagnostic text.

Cancellation propagates as `OperationCanceledException`, including SQL attention errors reported by
SqlClient as `SqlException` when the request token is cancelled. Once commit is admitted it uses the
existing uncancellable unit contract. **`AuditUnitCommitUncertainException` passes through unchanged**
with its original provider error and provisional stamp; it is not mapped to validation or cancellation.
No request, deadlock or uncertain commit is automatically retried. Durable receipts/reconciliation
remain required before offering automatic replay. Existing unit tests exercise actual commit failure;
new service tests exercise cancellation of a blocked late command and complete rollback.

## Verification and next step

The [testing handoff](../testing-handoff.md#iteration-5a-integrated-contact-service--2026-09-07)
records focused/full runs and resource cleanup. The service tests create persons and organizations with
all four families, change profile/phone/address atomically, inspect old/current revisions and combined
diff/actions, reject stale writes and roll back a failing final command. They also cover all family
lifecycle/order dispatch, private/public projections, allowed/denied per-contact access, cross-tenant
targets, missing context, SQL cancellation and current reads blocked against a mixed writer. The actual
application schema cycle resolves the scoped service and creates/reads an organization using its normal
seeded actor. Historical probes and fixtures are preserved.

Next is iteration 5b: HTTP authentication/context integration, authorization wiring and endpoint/error
contracts. Discovery/search, user provisioning/login uniqueness, customer upgrades and remote deployment
remain separate work.
