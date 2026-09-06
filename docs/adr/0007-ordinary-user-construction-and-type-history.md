# ADR 0007: Ordinary user construction and historical type

Date: 2026-09-05.
Status: implemented for fresh schemas; review before broader account-lifecycle adoption.

Companions: [email corrections](0006-email-review-corrections-and-saved-order.md), [tenant/actor policy](0003-tenant-actor-and-catalog-policy.md), [audit-unit contract](0002-portable-audit-unit-and-history.md), [usage and verification](../email-reference-family.md).

## Problem and scope

The actual application seed exposed an integration gap after the email correction pass: security.user_insert created a contact and a security.user row but left the entity's type as contact. The strict email actor resolver correctly rejected that account with 51201. Its existing-contact branch also added the security row without changing the aggregate version or preserving a historical type transition.

Fix administrative creation of an ordinary account, including promotion of an existing contact. Keep the strict email actor rule. An account that has committed through this constructor can subsequently be the actor for email operations, including through the restricted email_runtime capability. This is not a complete authentication, self-registration, role-management or account-lifecycle implementation.

## Construction contract

security.user_insert resolves an existing active user actor in the target tenant through entities.actor_resolve. An omitted tenant resolves the established default tenant GUID. Explicit invalid tenants, unknown/non-user/inactive actors and cross-tenant actors fail. The caller/backend still authenticates the actor and authorizes account creation and any requested initial role; a supplied GUID is not authentication or administrative permission.

There is no System-by-omission, MAX(tenant_id) fallback or implicit self-registration in this entry point. The installation sample now explicitly attributes account creation to the bootstrapped System user, which is the process creating it. The sample's historical created value remains occurrence metadata; the ledger's recorded_at remains local server allocation time. This intentional attribution change replaces the sample's old claim that the not-yet-created account created itself.

Public self-registration remains a separate future API with its own authorization and actor-ID reservation contract. Entity IDENTITY and the explicit System ID 1 reservation remain unchanged. This pass does not route ordinary creation through the legacy entity_insert self-rebinding branch: the ordinary constructor has already validated its existing actor. Direct legacy entity/contact construction remains a separate privileged boundary.

Optional INOUT dbrow_version is preserved. New trailing parameters are:

| Parameter | Contract |
| --- | --- |
| expected_entity_version | For an existing contact, required unit-entry optimistic token. For a new root, omitted or 0. |
| entity_version OUTPUT | Resulting aggregate revision, provisional until the owning transaction commits. |
| user_id OUTPUT | Constructed local entity/contact/user ID, likewise provisional. |

Standalone calls own/enroll/complete their transaction. Ambient callers enroll explicitly and own rollback on failure. A non-NULL version asserts this active unit; it cannot join an old committed unit. Creation does not provide an idempotency receipt: a second account creation for the same contact is a conflict, not automatic success.

## New roots and existing contacts

A new user continues to reuse contact_insert for the contact payload and initial email family. The provisional root starts with the contact type, then receives its user subtype and final user type before commit. The shared snapshot helper replaces only this unit's provisional root snapshot. The result is one committed revision 1 with user type, contact payload, account payload and initial email evidence. No committed contact-only intermediate revision is invented.

For an existing contact, user_insert locks and validates the root before first allocation. It rejects missing/stale expected versions, wrong-tenant roots, deleted/locked roots, existing accounts and roots that are not ordinary contacts. It then adds the account, sets the user type, bumps the aggregate once and records the new root payload. Earlier committed contact-type history remains intact.

Promotion preserves the existing contact's name, other contact fields and contact email list. The legacy constructor's contact-detail inputs are used only when constructing a new contact. For example, email on promotion initializes the separate account email; it does not replace the contact-card email. A future dedicated promotion API can make that smaller input shape clearer without changing this state transition.

An existing contact already changed earlier in the same unit still uses its unit-entry token and receives no second bump. A contact first created in this unit uses expected version 0 and remains at revision 1 after promotion. Later email commands under the same actor can join that unit. Trying to switch attribution to the new user before the creation unit completes fails the one-actor rule; after commit the new user can act in a new unit.

## History and reconstruction

entity_history now has a required entity_type_id with an FK to entity_type. All production creation writers, including System bootstrap, use the private entities.entity_history_snapshot helper. It requires this unit's root stamp and matching spine, copies the final root payload and upserts only the current unit. Revision 1 is INSERT payload; the supported subsequent promotion snapshot is UPDATE payload. This helper is used for construction/promotion; future general root delete/restore APIs still need their own declared lifecycle semantics.

security.user_history records the non-secret account payload at construction: login, account email and confirmation flag, account phone and confirmation flag, two-factor setting and lockout configuration. It has tenant/ledger/root references and a root-leading history index. Its private user_history_create writer requires a user-typed root, security row and this unit's matching spine. System bootstrap also writes and validates the presence of its construction history.

Password hashes, salts, security/concurrency tokens and login-attempt telemetry are excluded from this general history. Account email supplied during construction is now actually stored on security.user and starts unconfirmed. Subsequent contact email edits, reordering and deletion do not alter it or its confirmation status.

The email reader's historical root result adds entity_type_id; the C# revision exposes EntityTypeId. Reading a promoted contact at its earlier revision returns contact type, while reading at promotion returns user type. The email diff may correctly remain empty because this was a root/account change, not an email-list edit. This reader still reconstructs the email family and root context, not a complete account/role state.

The existing security.user.new event remains linked to the audit unit. Its versioned event_args now retains the selected initial_role_id, including null when none was requested. Account history plus root history provides the construction payload; the event preserves the initial assignment choice. Later account settings and role mutations must adopt their own history protocol before claiming full user-lifecycle reconstruction.

## Initial role and optional company references

The legacy optional initial-role name must resolve to exactly one definition belonging to this tenant or to the shared/global scope. Unknown, other-tenant-only and ambiguous global/local names fail instead of being ignored or arbitrarily selected. The chosen definition is held while assigning it. This is scope validation of the existing construction option, not a new role administration capability, role-definition history, or automatic permission to assign Administrator.

The constructor can also invoke the legacy optional company path. Its name lookup was tenant-independent, making a same-name company in another tenant a possible relationship target. That lookup is now scoped to this tenant and the company contact category; multiple matches fail. An existing company's active/unlocked eligibility is retained through the transaction without bumping the referenced company. A newly created company now receives its missing contact payload history in the same audit unit, alongside its entity history/spine.

Names are still a legacy convenience, not portable company identity or an idempotent find-or-create protocol. Concurrent missing-name creations may still create separate companies; there is no new global company-name uniqueness rule. An explicit company-ID API and full relationship lifecycle/history remain later work. The relationship is owned by the originating contact; this change does not claim that the company's version reconstructs all reverse memberships.

## Boundaries, compatibility and cost

email_runtime still denies user_insert and the new private snapshot helpers. It can use an ordinary constructed user's identity for its granted email operations when the trusted backend supplies that authenticated/authorized context. No new broad application grants, cross-tenant System bypass or public preallocated actor-ID input were introduced.

The root helper avoids duplicating the growing root snapshot column list between entity creation, user promotion and bootstrap. An ordinary user adds one account history row; promotion adds one root snapshot and, unless already bumped in the unit, one spine revision. The type column modestly increases root history storage. The optional company eligibility and role-definition locks add targeted coupling to their respective construction paths. These are correctness regressions and storage observations, not a capacity benchmark.

SQL Server uses the existing unit/locking profile. The new business guarantees require ordinary transactions, row locking, history snapshots and conflict checks available in other principal relational engines. FOR JSON here only formats small event metadata; another adapter can construct equivalent versioned data. No new engine-global identity mechanism or distributed protocol is required.

This is fresh creation DDL, not an upgrade/backfill for populated databases containing old user types. Rebuild/restart before recreating a development schema. A real upgrade must preserve what was recorded and distinguish a corrective type migration from an original historical promotion; it must not simply label all earlier contact history as user.

Still separate: public self-registration, broader legacy constructor hardening, login uniqueness/authentication policy and matching constraints, account update/delete/restore, credential and recovery workflows, full role/relationship history, migration/coverage adapters and delivery. The fix closes the ordinary-user actor prerequisite for the email reference family; it is not a production-readiness claim for all security subsystems.

## Verification and review

The full disposable SQL/C# runner includes ordinary creation history and actor use under email_runtime; distinct account/contact email; earlier type reconstruction; promotion conflicts; wrong tenant/type/inactive root; invalid actor and implicit self-registration rejection; new/existing-root composition and rollback; initial global/local role selection and rejected ambiguous/foreign names; tenant-scoped company creation/history; and competing promotions.

The actual Overmind CreateSchema → DropSchema → CreateSchema regression now checks seeded type/account history and performs email changes as the ordinary seeded user. It no longer substitutes System to avoid the original 51201 error. System bootstrap with default tenant local ID 2 and all existing email/cancellation/concurrency cases remain in the runner. Final profile results are recorded in the [guide](../email-reference-family.md).

The [follow-up review prompt](../user-construction-independent-review-prompt.md) provides the source map and targeted questions. This pass follows the email correction checkpoint a3b715a; preserve the earlier independent report as its own historical record.
