# 12. Status and map

Previous: [11. Errors and troubleshooting](11-errors-and-troubleshooting.md) · [Index](README.md) · [Glossary](glossary.md)

## What exists today

Implemented in the working tree, tested by the disposable-database suite in both READ COMMITTED profiles:

| Area | Objects |
| --- | --- |
| Unit and allocation | `data.audit_isolation_assert`, `audit_unit_begin`, `audit_unit_assert`, `dbrow_version_ensure`, `audit_action_next`, `tenant_insert` |
| Roots | `entities.actor_resolve`, `entity_write_lock`, `entity_version_bump`, `entity_history_snapshot`, `entity_insert`, `event_create`; `entity_history.entity_type_id` |
| Email family | dictionaries with exact keys; `contact_email`, `_identity`, `_history`, `_action`; `email_values_ensure`, `contact_email_history_sync`, `contact_email_write`, `contact_email_change`, `contact_email_insert`, `email_update`, `email_delete`, `email_restore`, `email_move`, `contact_emails_as_of`, `contact_email_read`, `contact_email_history_view`; views select the principal by saved order |
| Phone and composed channels | Immutable complete numbers and input interpretations; full phone lifecycle/history/order/actions; `PhoneParser`, phone commands on `SqlAuditUnit`, `SqlContactChannelsReader`; private family reader components under one coordinator. [Phone guide](../phone-family.md) records scope and final verification status. |
| Web-link family | Exact immutable URLs; contact-owned type, label, display text and visibility; lifecycle/order/history/diffs/actions; `WebLinkInput`, web-link `SqlAuditUnit` methods, `SqlContactWebLinkReader` and composed reads. [Web-link guide](../web-link-family.md). |
| Address family | Complete immutable values and scoped immutable geographic catalogs; lifecycle/order/history/diffs/actions; `AddressInput`, address `SqlAuditUnit` methods, `SqlContactAddressReader` and composed thirteen-set reads. [Address guide](../address-family.md). |
| Profile and contact lifecycle | Exact immutable names and complete relational profile history; `contact_change`, `contact_read`, `ContactProfileInput`, contact commands on `SqlAuditUnit`, `SqlContactReader`; protected soft delete/restore and explicit root snapshot operations. [Profile guide](../contact-profile-and-lifecycle.md). |
| Integrated contact service | `IContactService`, `SqlContactService`, scoped registration, required trusted context/contact policy, ordered atomic saves and distinct current/history/directory responses. [Service guide](../contact-service.md). |
| Users | `security.user_insert` (create and promote), `user_history` and `user_history_create`, `system_user_bootstrap` |
| Constructor corrections | Person-only ordinary accounts; unsupported promotion-input rejection; private `contact_company_lookup` with collation-compatible miss protection; actor public-key seeks; occurrence time and actual seed initial-role evidence ([ADR 0008](../adr/0008-constructor-corrections.md)) |
| Roles and grants | `email_runtime` retains email-only capability; opt-in `contact_channels_runtime` adds phone, web links, addresses and combined reads/writes. The additional opt-in `contact_runtime` role grants profile/lifecycle and full reads. All deny direct data access and private components. |
| C# | `SqlAuditUnit`, `AuditUnitCommitUncertainException`, `SqlContactEmailReader`, `SqlDatabase.RunLocalStoredAuditCommands` |
| Application | real `CreateSchema → DropSchema → CreateSchema` with the installation seed created administratively by System |

## What is designed and not built

| Area | Where the design lives |
| --- | --- |
| Relationship lifecycle/history | [Chapter 10](10-porting-a-family.md) recipe; spec §5 and §6 |
| Root lock/validation transitions and erasure APIs | spec §7; ADR 0002 lifecycle table |
| Public self-registration with reserved entity ids | ADR 0003 |
| Login uniqueness, authentication, account and role lifecycle with history | ADR 0003, ADR 0007 deferred list |
| Migration of legacy history with coverage manifests | ADR 0004, legacy findings |
| Disconnected synchronization (outbox, inbox, origin identity) | ADR 0004, primary design §7 |
| Optional commit-ordered capture (Change Tracking) | primary design §8 |
| Tamper evidence (hash chains, SQL ledger) | chained-history alternative, kept optional |

## Where the deep documents are

| Subject | Authoritative document |
| --- | --- |
| Current design entry point | `docs/dbrow_version-allocation-design.md` |
| Unit, ordering and history contract | `docs/adr/0002-portable-audit-unit-and-history.md` |
| Tenants, actors, bootstrap, dictionaries | `docs/adr/0003-tenant-actor-and-catalog-policy.md` |
| Delivery, migration, provider profiles | `docs/adr/0004-portable-delivery-and-provider-profiles.md` |
| Email as implemented | `docs/adr/0005-email-reference-family.md`, then `docs/adr/0006-email-review-corrections-and-saved-order.md` |
| Users as implemented | `docs/adr/0007-ordinary-user-construction-and-type-history.md` |
| Usage and test guide | `docs/email-reference-family.md` |
| Current backend test commands, coverage and evidence | [Testing handoff](../testing-handoff.md) |
| Independent reviews | `docs/email-reference-family-independent-review.md`, `docs/user-construction-independent-review.md`, and the earlier `docs/dbrow_version-independent-review-v3.md` with its answers |
| Why the old code needed this | `docs/dbrow_version-legacy-implementation-findings.md`, `docs/dbrow_version-allocation-analysis_v2.md` |
| Resume notes for agents | `AGENTS.md`, `docs/dbrow_version-design-session-handoff.md` |

## Running the verification

```powershell
$env:OVERMIND_TEST_CONNECTION_STRING = 'Server=localhost;Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
dotnet restore src/overmind.sln
dotnet build src/overmind.sln -c Release --no-restore
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=audit.trx' --results-directory artifacts/test-results
```

The full command runs both real RCSI profiles through MSTest/VSTest, with independently owned disposable databases, real scripts, SQL fixtures, concurrent schedules, C# cases, System bootstrap and application schema cycles. The [testing handoff](../testing-handoff.md) is the maintained operational entry point, including remote-server prerequisites and recovery. Historical review probes remain under `src/tests/review/` and are outside the supported test command.

## The next step

Use the [contact/API master plan](../contact-api-master-plan.md), added 2026-09-07, for the proposed
iterations: bounded corrections, phone, web links, immutable addresses, person/organization profile and
lifecycle, integrated contact service (5a), HTTP boundary (5b), then administrative provisioning. Reader
composition starts with phone; listing/search is separately tracked. Iteration 0 implements person-only
eligibility and the bounded constructor corrections; shared immutable address ownership is decided and
phone, web links and addresses are implemented with final verification recorded in the testing handoff.
Iteration 4 implements the declared person/organization profile and protected contact lifecycle. Iteration 5a adds the integrated service; Iteration 5b now supplies the HTTP boundary. Login uniqueness is explicitly deferred until provisioning.
The master plan and testing handoff record current completion and verification evidence.

[Glossary](glossary.md) · [Index](README.md)

## Integrated service checkpoint (iteration 5a)

`IContactService`, `SqlContactService` and `AddSqlContactService` now compose the declared profile and
all four child families. The host supplies scoped trusted context and an explicit contact-capability
policy; saves authorize every required permission and use one unit. Current detail contains state,
history has a separate permission, and directory detail filters private roots/children into a smaller DTO.
Current revision selection occurs inside the existing read barrier. See the [service guide](../contact-service.md)
and [ADR 0014](../adr/0014-integrated-contact-service-and-access-boundary.md). Iteration 5b now implements HTTP integration;
discovery/search, provisioning/login policy and migration remain separate.

## HTTP checkpoint (iteration 5b)

`ContactApiHosting` wires real bearer authentication, the signed-claim service adapters and
`ContactsController`. The [HTTP guide](../contact-http-api.md) covers routes, required issuer/audience
configuration, exact command JSON, string audit stamps and errors. Schema tools now require opted-in
Development mode plus their own signed grant. No SQL/audit mechanism changed. Provisioning and its
login policy are next; live issuer setup, deployment and discovery/search remain separate.
