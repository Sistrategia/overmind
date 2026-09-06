# 12. Status and map

Previous: [11. Errors and troubleshooting](11-errors-and-troubleshooting.md) · [Index](README.md) · [Glossary](glossary.md)

## What exists today

Implemented in the working tree, tested by the disposable-database suite in both READ COMMITTED profiles:

| Area | Objects |
| --- | --- |
| Unit and allocation | `data.audit_isolation_assert`, `audit_unit_begin`, `audit_unit_assert`, `dbrow_version_ensure`, `audit_action_next`, `tenant_insert` |
| Roots | `entities.actor_resolve`, `entity_write_lock`, `entity_version_bump`, `entity_history_snapshot`, `entity_insert`, `event_create`; `entity_history.entity_type_id` |
| Email family | dictionaries with exact keys; `contact_email`, `_identity`, `_history`, `_action`; `email_values_ensure`, `contact_email_history_sync`, `contact_email_write`, `contact_email_change`, `contact_email_insert`, `email_update`, `email_delete`, `email_restore`, `email_move`, `contact_emails_as_of`, `contact_email_read`, `contact_email_history_view`; views select the principal by saved order |
| Users | `security.user_insert` (create and promote), `user_history` and `user_history_create`, `system_user_bootstrap` |
| Roles and grants | `email_runtime` role with EXECUTE on the public email API and enrollment, DENY on everything else |
| C# | `SqlAuditUnit`, `AuditUnitCommitUncertainException`, `SqlContactEmailReader`, `SqlDatabase.RunLocalStoredAuditCommands` |
| Application | real `CreateSchema → DropSchema → CreateSchema` with the installation seed created administratively by System |

## What is designed and not built

| Area | Where the design lives |
| --- | --- |
| Phone, address, name and relationship families with history | [Chapter 10](10-porting-a-family.md) recipe; spec §5 and §6 |
| Root soft delete, undelete and erasure APIs | spec §7; ADR 0002 lifecycle table |
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
| Independent reviews | `docs/email-reference-family-independent-review.md`, `docs/user-construction-independent-review.md`, and the earlier `docs/dbrow_version-independent-review-v3.md` with its answers |
| Why the old code needed this | `docs/dbrow_version-legacy-implementation-findings.md`, `docs/dbrow_version-allocation-analysis_v2.md` |
| Resume notes for agents | `AGENTS.md`, `docs/dbrow_version-design-session-handoff.md` |

## Running the verification

```powershell
python tests/sql/run_dbrow_version_tests.py --server localhost
python tests/sql/run_dbrow_version_tests.py --server localhost --rcsi
```

Both create and drop their own `OvermindAuditTest_<random>` databases, load the real scripts, run the SQL fixtures, the two-connection schedules, the C# harness, the real System bootstrap and the real application schema cycle. They never touch an application database. Review probes live under `tests/review/` and are disposable in the same way.

## The next step

Phone, by the recipe in Chapter 10, after the four small decisions the second review lists. Then address. Then root lifecycle (delete and undelete), which is the customer-visible feature the vocabulary has promised since the first generation.

[Glossary](glossary.md) · [Index](README.md)
