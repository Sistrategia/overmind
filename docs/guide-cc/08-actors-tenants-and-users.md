# 8. Actors, tenants and users

Previous: [7. Shared values](07-shared-values.md) · [Index](README.md) · Next: [9. Reading history](09-reading-history.md)

## Who may act

`entities.actor_resolve` is the one rule for "who is this actor". Given the actor's public key and an optional tenant key, it:

- resolves the tenant (an omitted tenant means the seeded default tenant; an unknown one fails with 51200);
- finds an entity with that key, **in that tenant**, whose type is `user`, not deleted and not locked;
- fails with 51201 otherwise.

There is no fallback to System, no `is_system` bypass, no cross-tenant privilege. The audit's answer to "who" is only as good as this rule, and the old `COALESCE(…, 1)` was the single most damaging silent behaviour the reviews found, because it produced plausible ledger rows attributed to System.

What SQL checks is eligibility shape: type, tenant, lifecycle. It does not authenticate. The backend that supplies the actor's GUID has already authenticated the person and decided they may touch this contact. A GUID is a claim, not a credential; the `email_runtime` role is for a trusted backend, not for end users.

## Tenants

Every business row has one owning tenant, directly or through its root. A single-tenant installation still has a real tenant row, the seeded default. Shared definitions (operation types, entity types, event types, global role definitions) have no tenant. Shared values are global but only reachable through tenant-owned associations. Cross-tenant references fail: the actor must be in the target tenant, and the target root must be in the tenant the unit resolved (51202).

## System

System User is entity 1, public key `71F092F4-…`, type `user`, `is_system = 1`, created by `security.system_user_bootstrap` inside the default tenant with its own construction history. It is the actor for named platform processes: installation, bootstrap, migrations. It is never a fallback. The installation seed now creates the sample account with System as `@created_by` because the installer really is the process creating it; the old seed claimed the account had created itself.

## Creating and promoting users

`security.user_insert` is the administrative constructor. It resolves the actor strictly, then either creates a new account or promotes an existing contact:

**New account.** The contact is built by `contact_insert` inside the same unit (contact payload, first email if given, optional company), then the security row is added, the entity's type is set to `user`, the root's history snapshot is replaced with the final payload, and `security.user_history` is written. The result is one committed revision 1 with the user type. No intermediate "contact-only" revision is ever committed.

**Promotion.** The caller passes the existing contact's public key and its `expected_entity_version`. The constructor locks the root before allocating, refuses a contact that already has an account (51601), is of another type (51600), is in another tenant (51202) or is deleted or locked (51203), then adds the account, sets the type, bumps the aggregate once, and writes a new root history row and the account history. The earlier contact-type history is untouched. Contact details supplied on promotion are currently ignored rather than rejected; the second review recommends rejecting them, so do not rely on them.

Account email (`security.user.email`) is separate from the contact's email list. On a new account the same address becomes both the first contact email and the account email; afterwards, editing, moving or deleting contact emails never changes login, account email or its confirmation status.

**Initial role.** `@user_primary_role` must name exactly one definition that is either global or belongs to this tenant. Unknown, other-tenant or ambiguous names fail (51602); the chosen id is recorded in the creation event's arguments.

**Optional company.** `@person_company` links or creates a company contact within the tenant. An ambiguous name fails (51313); a deleted or locked company fails (51203). Two concurrent creations of the same new company can still both create it; the review recommends the same exact-value lock the dictionaries use.

## What is deferred, and why it matters to you

- **Public self-registration.** The old `@created_by = @public_key` trick that rebound the actor after the insert still exists in the legacy `entity_insert`, but the ordinary constructor never reaches it. A proper self-registration API with reserved entity ids is designed in ADR 0003 and not implemented.
- **Login uniqueness.** Two accounts can share a login today. Decide the scope (global or per tenant) before any application role reaches the constructor.
- **Account and role lifecycle.** Update, lock, delete, restore, role changes: not implemented, no history writers yet.
- **Who may hold an account.** A company contact can currently be promoted; decide whether that is intended.

Next: [9. Reading history](09-reading-history.md)
