# ADR 0003: Tenant ownership, actor scope, bootstrap, and shared catalogs

Date: 2026-09-05.
Status: recommended overall policy. [ADR 0005](0005-email-reference-family.md) implements email tenant/actor checks, exact email dictionaries and System/tenant bootstrap prerequisites. General first-user preallocation, shared-actor delegation and role/user lifecycle remain separate work.

Companions: [primary design](../dbrow_version-allocation-design.md), [audit unit](0002-portable-audit-unit-and-history.md), [provider profiles](0004-portable-delivery-and-provider-profiles.md), and [independent answers](../dbrow_version-independent-review-v3-answers.md).

## Decision: retain a real default tenant and explicit shared data

Ordinary business aggregates and audit units have an owning tenant, even when the installation has only one tenant. A configured default resolves an omitted tenant at the public boundary. An explicit invalid tenant fails; an omitted tenant without an unambiguous configured/authorized default also fails. Never select MAX(tenant_id). Internal writers receive the resolved ID and do not repeat tenant inference.

NULL does not mean default, unknown, and global simultaneously. Tables containing only shared values need no tenant column. For the existing mixed role-definition table, NULL has one explicit meaning: a shared definition. Keep application users unaware of tenant selection where the installation is single-tenant; preserve the same internal ownership checks and data shape.

The existing default tenant GUID is a bootstrap convention, not proof that two installations belong to the same customer. Import requires an authorized source-to-destination tenant mapping even if their seeded public keys match.

## Ownership categories

| Category | Ownership and access |
| --- | --- |
| Contact, invoice, entity subtype, child relationship, history | One owning tenant, directly or through its root |
| Shared immutable values | Global storage; application enumeration through authorized tenant associations |
| Standard definitions and global role definitions | Shared meaning; controlled migration/administrative changes |
| Tenant-defined role | Owned by that tenant |
| Role assignment | Scoped to the assigned user's tenant, or explicit membership scope if multi-tenant membership is later supported |
| Platform identity | Shared identity with an explicit operation-authorization policy; not automatically unrestricted |

A relationship to a shared value is tenant-owned even though the value is not. Ordinary references to another business entity must stay within the owning tenant. Cross-tenant business relationships require a separately named domain operation and authorization; neither a GUID nor an FK makes them authorized.

Every public write validates the target aggregate and tenant-owned references in addition to resolving the tenant and actor. For user promotion, lock and validate the existing contact before adding security.user. Reject a contact of another tenant, an already promoted contact, or a deleted contact unless explicit restoration is part of the operation. Record type promotion, user history, and the aggregate bump together.

## Roles and logins

Global role definitions are supported. A global Administrator definition assigned to a tenant's user means administrator within that assignment scope. It does not grant platform access. Existing one-tenant users allow assignment scope to be derived from the root. A future user with several tenant memberships requires explicit membership-scoped assignments; do not extend current semantics by accident.

Tenant-specific roles remain optional. If both scopes are enabled, use stable definition IDs/codes for assignment. Public name lookup must yield exactly one permitted definition; unknown or ambiguous names fail. Do not introduce implicit tenant-over-global shadowing. The existing UNIQUE(tenant_id, role_name) does not prohibit a global and a tenant-local row with the same name, so procedures must not rely on it to resolve that ambiguity. Ported schemas must explicitly enforce global-name uniqueness because engines differ in unique-constraint treatment of NULL.

Role assignment and revocation are audited changes to the user aggregate. Global definition changes that alter authorization are also audited as platform configuration changes, including a definition version so old assignments remain interpretable. Shared storage is not an exemption from auditing mutable security meaning. Do not preserve credential hashes in general history.

Recommend login uniqueness within a tenant, with tenant selection resolved before authentication lookup. A single-tenant deployment supplies its default transparently. Applications needing globally unique logins can select that stronger product policy, but must not change lookup semantics after accounts exist without migration. The database constraint must match the deployed policy. If tenant_id is copied onto security.user for its unique key, enforce consistency with the owning entity using an appropriate composite FK/unique key; a duplicated column maintained only by convention is insufficient.

## Actor identity, authorization, and layer order

Keep *_by as the local entity ID. Authentication and domain authorization remain responsibilities of the application/security boundary. The data helper validates unit consistency, not who a person is. The entities layer resolves identity shape and lifecycle using entities-owned metadata, avoiding an entities-to-security dependency.

For the current type set, a user actor must have the user type. is_system alone does not make an arbitrary entity an eligible actor. If future actor subtypes are added, declare their actor eligibility in entities-owned type metadata seeded by their owning module; do not assume only one most-specific type can ever be an actor. Security construction must establish the corresponding user data before commit, and reconciliation tests verify that type and subtype records agree.

The resolver returns actor identity and owning scope. The trusted public boundary authorizes the requested target tenant and operation. Ordinary actors operate in their authorized tenant. A platform identity may be represented by the existing protected System User in the default tenant, but its storage tenant is not used to infer every operation's target.

Platform use is explicit:

- System User is reserved for named bootstrap, migration, and maintenance operations; unknown identities never fall back to it.
- Each integration has a distinct actor. Its permitted tenants/operations come from explicit grants or service policy, not is_system.
- Anonymous can be a shared identity. Each public endpoint supplies its authorized tenant and restricted action; callers cannot use the identity to choose arbitrary tenant operations.
- Support/delegation records distinguish the authenticated initiator from the attributed/effective actor where needed.
- Historical imports preserve the mapped source actor and separately record the importing service. A login-less historical actor is not thereby authorized for current writes. Deleted actors remain reconstructible but are not eligible for ordinary new actions.

A SQL public entry point must enforce the portion of this policy assigned to it. Any resolved actor ID or cross-tenant context accepted without re-resolution is confined to internal procedures with no public EXECUTE grant. The design does not claim that a supplied actor GUID authenticates its sender.

## Bootstrap and entity-ID reservation

For the SQL Server remake, recommend replacing entity IDENTITY with an entities-owned sequence so creation chains can reserve the actor's entity ID before writing the ledger. PostgreSQL has equivalent sequence support. MySQL can implement an internal generated-key reservation table; this is an adapter detail, not a tenant counter held until every business transaction commits. See ADR 0004.

Define three distinct entry paths:

1. Administrative user creation resolves an existing authorized actor and creates or promotes a contact.
2. Public self-registration reserves a fresh entity ID internally, uses it as the attributed actor, and records a self-registration action. It accepts no preallocated ID or privileged flags from the public caller.
3. Trusted bootstrap reserves the required IDs and invokes an internal user-construction primitive that accepts them. It does not call the public self-registration path and allocate a second actor ID.

The internal construction primitive is shared by the public paths but is not itself an application entry point. Tenant creation, ledger allocation, System/first-user creation, subtype rows, and history follow their FK dependency order within the same controlled transaction. The helper may validate the already-created tenant but must not create a circular FK requirement that an uninserted actor already exist in the data layer. Verify actor completion before committing the bootstrap.

The reserved System User ID 1 and well-known public key are current compatibility contracts. Preserve them on fresh SQL Server builds, initialize the entity allocator above reserved values, and fail if bootstrap finds conflicting identities. Do not merely change tests to accept any OUTPUT ID while leaving DEFAULT(1) references in the schema. An imported System identity is mapped deliberately; foreign integer 1 is never trusted as a local actor identity.

The migration changes SCOPE_IDENTITY retrieval for entities, explicit-ID handling, builder bootstrap order, and both remaining direct ledger writers. Catalog tables may retain IDENTITY. Audit these call sites as one focused change. Preallocation is a simplicity choice; a tightly restricted correction before commit can also produce a correct committed audit, but is not the preferred SQL Server path.

## Shared immutable catalogs

Retain value interning where repeated values and narrow historical references justify its cost. Names and location labels are reasonable candidates. Email and phone catalogs can also be retained; their value depends more on historical repetition than on live deduplication. Do not assume every free-text field needs a catalog or every catalog row needs to be an entity.

Value identity is separate from person identity. Shared references to a spelling do not identify the same person or establish a family relationship. Matching creates candidates within authorized scope and follows domain rules. Universal seeded labels may be publicly listed; customer-contributed names/email/address values are enumerated through authorized associations, not raw global catalogs.

A value used by retained history does not change in place. Corrections create/select another value and update the audited association. Define accepted input precisely: recommend preserving accepted spelling, case, accents, and significant whitespace, with a separate normalized search form. Any trimming or normalization of incoming data must be explicit and versioned; historical import preserves original evidence even if the target accepts a transformed value.

An exact-value key must implement that contract on every engine. SQL Server BIN2 preserves distinctions that a linguistic case/accent-insensitive collation may collapse, but its string comparisons still pad trailing spaces. A 2026-09-05 probe found N'Juan' equal to N'Juan ' under Latin1_General_100_BIN2, with different byte lengths. Use a binary value key with length where required, or explicitly choose a trimming contract. Search normalization is non-unique and never silently substitutes its first spelling for the exact value. [SQL Server comparison rules](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/string-comparison-assignment)

Interning protocol: read an existing immutable value without an exclusive/update lock; on a miss use the provider's tested unique-insert/conflict-resolution method, and return the winning exact identity. Reset OUTPUT result variables before no-row lookups. Provider defaults differ: do not copy SQL Server exception recovery or range locks into another engine. The unique key is the final integrity boundary. Defined parent scope is part of identity for cities and similar catalogs.

Measure hit-path blocking, concurrent misses, long histories, joins, index sizes, and log bytes with representative distributions. Shared dictionaries can reduce payload storage while adding seeks, rows, and joins. Neither a fixed five-row amplification estimate nor zero lock waits is a deployment guarantee.

## Redaction and retained values

Repointing an association to a sentinel unlinks the subject but does not physically remove the old catalog value. Decide whether the required outcome is unlinking, redaction, or eventual physical removal. Cleanup may remove only values with no required live, history, action, or retained-export references, under a controlled process. Never delete a shared value still legitimately referenced by another subject/tenant.

Retained ordinary values remain immutable. Explicit erasure is an audited exception with scope, actor, policy version, and a delivery instruction for replicas. Reconstructed history after redaction must identify that evidence was redacted, not invent an original value. Retained exports and backups have their own declared retention/erasure behavior; the schema cannot claim to erase disconnected copies immediately.

## Required acceptance cases

- Omitted tenant resolves only the configured authorized default; explicit invalid tenant fails.
- Same public key/default seed in unrelated source databases does not bypass tenant import mapping.
- Wrong-tenant contact promotion and role assignment fail; permitted global definitions work; ambiguous names fail.
- A shared actor's permitted operation succeeds, while is_system alone cannot grant arbitrary cross-tenant action.
- Public self-registration cannot select an existing actor ID; bootstrap reuses its one reserved actor and preserves System ID 1.
- Type promotion and role changes reconstruct; current actor eligibility and historical actor resolution differ intentionally.
- Catalog exact spelling survives history and export; normalized matches do not overwrite it; parallel interning returns one exact identity.
- Redaction does not damage another tenant's references or claim physical deletion while the payload is retained.

No SQL/schema changes are made by this ADR. Its reference implementation remains a separate step after the contracts in ADRs 0002 and 0004 are incorporated.
