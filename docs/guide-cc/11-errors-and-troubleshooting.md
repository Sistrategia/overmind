# 11. Errors and troubleshooting

Previous: [10. Porting a family](10-porting-a-family.md) · [Index](README.md) · Next: [12. Status and map](12-status-and-map.md)

All custom errors are `THROW` with numbers in the 51000 range, grouped by layer. `XACT_ABORT` is on in every writer, so after any of these the transaction is doomed and the owner must roll back; a partial commit is never possible.

## 510xx: allocation and reuse (`data.dbrow_version_ensure`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51001 | requires an active, committable caller transaction | You called a helper outside a transaction or after an error doomed it. Open and enroll first. |
| 51002 | an existing tenant is required | The tenant id did not resolve. Pass a valid tenant key. |
| 51003 | an actor entity ID is required | Internal: a caller passed NULL as actor. |
| 51004 | supplied audit version does not exist for this tenant | The number is not this tenant's. Do not pass numbers across tenants. |
| 51005 | the audit unit has a different tenant or actor | Two actors in one unit. Use two units. |
| 51006 / 51007 | timestamp or operation type missing | Internal helper misuse. |
| 51008 | a supplied audit version requires the caller's active transaction | You passed a number with no ambient transaction. Either drop the number or open and enroll. |

## 511xx: enrollment and ownership (`data.audit_unit_begin`, `audit_unit_assert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51100 | enrollment requires a committable caller transaction | `BEGIN TRANSACTION` first. |
| 51101 / 51104 | could not enroll / could not guard the new allocation | The private lock could not be taken. Should not happen; report it. |
| 51102 | the ambient transaction is not enrolled | **The most common one.** You opened a transaction and called an audited procedure without `EXEC data.audit_unit_begin`. Seeds must run through `RunLocalStoredAuditCommands`. |
| 51103 | supplied audit version is not owned by this transaction and database | You passed a committed or foreign number. Pass NULL to join, or pass the number this unit allocated. |
| 51105 | action does not belong to this audit unit | Internal: action counter asked for another unit's ledger row. |
| 51106 | audit writes require READ COMMITTED isolation | Your session is in SNAPSHOT, REPEATABLE READ or SERIALIZABLE. Use READ COMMITTED (RCSI is fine). |

## 512xx: actors, tenants and roots (`entities.actor_resolve`, `entity_write_lock`, `entity_version_bump`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51200 | unknown target tenant | The tenant key does not exist. |
| 51201 | an active user actor authorized for this tenant is required | The actor is not a user-typed, active entity in that tenant. Check the GUID, the tenant, and that the account was created through `user_insert`. |
| 51202 | target does not exist in this tenant | Contact key unknown or belongs to another tenant. |
| 51203 | target is deleted or locked (also: referenced company) | Lifecycle blocks the write. |
| 51204 | a later unit has changed this root; retry the whole operation | Late-root ordering conflict or lost race in the bump. Roll back and retry the whole unit. |
| 51205 | root stamp has no matching audit spine | Data inconsistency between entity and spine. Investigate; never patch by hand. |
| 51206 | the expected entity version is stale or missing | Classic optimistic conflict, or you forgot the token. Reload the aggregate and retry with its current version. |

## 513xx: email family (`contacts.contact_email_write`, `email_values_ensure`, `contact_insert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51300 / 51301 | email or location length out of range | Values are 1 to 256 and up to 100 UTF-16 code units. Nothing is truncated silently. |
| 51302 / 51303 | unknown operation / visibility flags must be explicit | Internal or caller misuse. |
| 51304 | the target entity is not a contact | Root exists but has no contact row. |
| 51305 / 51306 | ordinal missing / association does not exist | Update, delete or move named a child that is not live. |
| 51307 | restore requires an existing, currently absent identity | Restore only recreates a known deleted child. |
| 51308 | new ordinals are allocated, not supplied | Do not pass an ordinal on insert. |
| 51309 | email identity has incomplete prior history | The identity's birth unit shows no cancelling delete yet there is no history. Data inconsistency; investigate. |
| 51310 | supply a position only to move | Position is not an insert or restore parameter. |
| 51311 | order is not a dense unique list | Invariant check failed after a change. Should not happen through the writers; report it. |
| 51312 | could not lock the email value | Dictionary applock timed out under your `LOCK_TIMEOUT`. Roll back and retry. |
| 51313 | company name is ambiguous within this tenant | Two companies share the name. Select the company explicitly (an id-based API is planned). |

## 514xx: reader (`contacts.contact_email_read`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51400 | requires its own read transaction | Do not call the reader inside an open transaction. |
| 51401 | requested revision does not exist | Wrong version number for this contact. |
| 51402 | historical root payload unavailable | No root history at or below the bound. Fresh schemas always have it; legacy imports may not. |

## 515xx: bootstrap and tenants (`security.system_user_bootstrap`, `data.tenant_insert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51500 / 51503 | bootstrap or tenant creation requires a unit with no existing allocation | Run them standalone, not inside another business unit. |
| 51501 | could not lock System bootstrap | Another bootstrap is running. |
| 51502 | conflicting or incomplete System identity | Entity 1 exists but is not the expected System. The bootstrap will not repair it. Investigate. |

## 516xx: user construction (`security.user_insert`, `user_history_create`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51600 | type definitions required / only an ordinary contact can be promoted | Seeds missing, or the root is not a contact-typed entity. |
| 51601 | this contact already has a user account | Promotion of an existing account. |
| 51602 | initial role name must identify exactly one eligible definition | Unknown, other-tenant or ambiguous global/local role name. |
| 51603 | new user construction accepts only version 0 or omitted | You passed an expected version for a root that does not exist. |
| 51604 | user creation history requires this unit's user root, subtype and spine | Internal precondition; report it. |

## Engine errors you will meet

| Number | Meaning here |
| --- | --- |
| 1205 | Deadlock victim. Two units locked roots in opposite order. Retry the whole unit. |
| 1222 | Lock timeout under your `LOCK_TIMEOUT`. Usually a long-running unit holds the root. |
| 229 | Permission denied. The runtime role tried to reach a table or an internal helper directly. |
| 2627 / 2601 | Unique key. Public key or dictionary value collision; the unit is doomed. |

## Three habits that avoid most errors

1. Open, **enroll**, work, commit. Never skip the middle step.
2. Pass the `entity_version` the user actually saw, and reload on 51206.
3. Treat a failed unit as gone. Discard every output value, roll back, start a new unit.

Next: [12. Status and map](12-status-and-map.md)
