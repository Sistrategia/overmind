# Email reference family: usage, tests and review map

Implemented 2026-09-05 for fresh Overmind schemas. [ADR 0005](adr/0005-email-reference-family.md) records the initial implementation; [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) records the email corrections; [ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md) resolves ordinary user construction and historical type. These scripts are creation DDL, not an upgrade/migration package for an existing database.

## Saved order and principal email

Ordinal is stable child identity. DisplayOrder is the saved one-based position, and IsPrincipal is derived from position 1. New emails and restored emails append. Delete closes the gap; update preserves position. MoveEmailAsync changes position and MakeEmailPrincipalAsync moves to position 1. The contact-card view follows this order even after ordinal 1 is deleted. Temporary UI sorts must not persist an order change. Account/login/recovery email remains independent.

## C# composition

The backend authenticates/authorizes the actor, target tenant and contact before using this API. Use the returned child ordinal with its owning contact; EmailId is a shared catalog key.

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, actorPublicKey, tenantPublicKey);
var added = await unit.InsertEmailAsync(contactPublicKey, expectedEntityVersion, "a@example.test", "Home");
var edited = await unit.UpdateEmailAsync(contactPublicKey, expectedEntityVersion,
    added.Ordinal, "b@example.test", location: null, isPublic: false);
var principal = await unit.MakeEmailPrincipalAsync(contactPublicKey, expectedEntityVersion, added.Ordinal);
await unit.CommitAsync();
// All results were provisional until commit and share one contact revision and audit unit.
```

Update replaces the email/location/visibility fields; NULL location clears it. DeleteEmailAsync requires an existing ordinal. RestoreEmailAsync deliberately reuses a known absent identity and supplies its restored values. InsertEmailAsync always allocates a new child identity. Ordinary edits require the unit-entry expectedEntityVersion; repeated calls do not switch to their own freshly returned version.

Any failed command invalidates the unit and rolls back earlier commands. Cancellation, including a cancelled queued call, prevents commit when observed before commit admission. Dispose without commit rolls back. Once commit is admitted, a later cancellation/disposal cannot undo it. Exceptions from issued provider commit become AuditUnitCommitUncertainException, preserving the original exception and provisional DbrowVersion for correlation. Do not retry an uncertain commit blindly: durable request receipt handling is not implemented by this reference API. MARS, exposed raw transaction handles, savepoint partial success and automatic retry are not supported.

```csharp
var history = new SqlContactEmailReader(connectionString);
var revision = await history.ReadAsync(contactPublicKey, actorPublicKey,
    entityVersion: 3, tenant: tenantPublicKey, compareEntityVersion: 2);
// Emails: state at revision 3. Differences: email changes from revision 2 to 3.
// Actions: ordered effective email actions in revision 3, with actual values, actor and UTC time.
// Emails carry DisplayOrder/IsPrincipal; Differences carry old/new positions.
// Action payload version 2 carries PreviousDisplayOrder/DisplayOrder, including move commands.
// DisplayName/FullName come from historical payload, even if today's contact has been renamed/deleted.
// EntityTypeId also comes from historical payload, including contact-to-user promotion.
```

The reader owns a short serializable transaction; it rejects ambient transactions. Root-leading history indexes and required root seeks bound its root-payload access. It reconstructs the email family and historical root context, not every contact child family. A missing revision/root payload throws instead of becoming a misleading empty collection. Legacy coverage/baseline support is separate, as described in ADR 0004. A move/revert can leave an empty net diff with several actual actions; shifted siblings receive final snapshots.

## Native SQL composition

```sql
SET XACT_ABORT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
DECLARE @v BIGINT = NULL, @ordinal INT = NULL, @revision INT = NULL;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC data.audit_unit_begin;
    EXEC contacts.contact_email_insert
         @contact_public_key = @contact,
         @created_by = @actor,
         @tenant = @tenant,
         @expected_entity_version = @expected,
         @email_address = N'a@example.test',
         @ordinal = @ordinal OUTPUT,
         @dbrow_version = @v OUTPUT,
         @entity_version = @revision OUTPUT;
    EXEC contacts.email_update
         @contact_public_key = @contact,
         @modified_by = @actor,
         @tenant = @tenant,
         @expected_entity_version = @expected,
         @ordinal = @ordinal,
         @email_address = N'b@example.test',
         @dbrow_version = @v OUTPUT;
    EXEC contacts.email_move
         @contact_public_key = @contact,
         @modified_by = @actor,
         @tenant = @tenant,
         @expected_entity_version = @expected,
         @ordinal = @ordinal,
         @display_order = 1,
         @dbrow_version = @v OUTPUT;
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
```

A standalone command opens/enrolls/commits its own transaction. Writers require READ COMMITTED, with or without RCSI, checked again on each ownership assertion. A supplied version without an enrolled caller transaction fails. NULL inside an enrolled unit discovers and joins its existing allocation. Old committed versions, mismatched tenant/actor and cross-database reuse fail. Session hints cannot establish ownership.

For embedded business batches use SqlDatabase.RunLocalStoredAuditCommands. It owns/enrolls one transaction and fails if enrollment support is missing. Ordinary RunLocalStoredCommands remains for DDL/resources. The application business seed now selects the audited runner; it no longer needs its own enrollment preamble.

Assign the trusted backend's database user to the shipped email_runtime role for the reference API. This deployment-owned role and its memberships survive DropSchema; recreation reapplies object grants. The role intentionally excludes legacy constructors, administrative bootstrap and raw table/catalog access. Other application capabilities require their own reviewed grants. Passing an actor GUID does not authenticate the caller; this is a backend API, not an unrestricted end-user SQL endpoint.

The ordinary-user prerequisite is now resolved: user_insert commits a user-typed root with account creation history, and the schema-cycle test performs email changes as that normally created seed user. It validates an existing user actor; the installation seed explicitly uses System for administrative creation. Public self-registration remains a separate API design, and the email role still cannot invoke constructors.

For administrative SQL creation, supply an authenticated/authorized existing actor and either a new public key or an existing contact with its expected_entity_version. Existing contacts retain their contact details/email list. The appended user_id and entity_version OUTPUT parameters and optional INOUT dbrow_version support composition; expected versions are always from unit entry. Creation/role assignment authorization remains the backend's responsibility. See ADR 0007 for examples of the transitions and the still-unimplemented login/account lifecycle policies.

## Run the verification

Current commands, configuration, prerequisites, coverage mapping and execution evidence are maintained in the [testing handoff](testing-handoff.md). The supported path uses .NET 8 with MSTest/VSTest and a dedicated full SQL Server test instance; Python, Node.js and sqlcmd are no longer required.

```powershell
$env:OVERMIND_TEST_CONNECTION_STRING = 'Server=localhost;Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
dotnet restore src/overmind.sln
dotnet build src/overmind.sln -c Release --no-restore
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=audit.trx' --results-directory artifacts/test-results
```

The full command discovers both RCSI profiles and executes real production DDL, SQL fixtures and C# behavior through direct SqlClient sessions. Each scenario creates and removes only its own generated databases, with resource journals and TRX results. See the handoff before configuring a remote server: the certificate bypass above is an explicit local test setting.

Verified on 2026-09-05 against local SQL Server 2022: the complete email-correction and ordinary-user-construction suite passed under READ COMMITTED with RCSI off and with RCSI on, including the final company-reference changes. Both builds reported zero warnings/errors; each profile created and removed three disposable databases (six in final validation). The actual schema-cycle test now uses the normally constructed seed user as its email actor and checks its user type/account history, alongside the audited business runner and view/login/membership checks. Competing promotions and the C# historical type reader passed in both profiles.

Earlier regressions independently reproduced the writer/reader lock-upgrade problem and application seed enrollment error 51102. The root-history lock regression failed with indexes alone and passed after requiring root-leading seeks. These tests remain in the expanded suite.

Coverage includes:

- Existing allocation/constructor regression cases and 80 allocations across four connections.
- Contact creation with initial email, version 1, history/action evidence and private default visibility.
- Repeated update/delete/restore, insert/delete/recreate, committed cancellation/restoration and stable ordinals.
- Equal-value no-ops; changes returning to entry state with intermediate action values retained.
- Stale tokens, missing child/contact, missing lookup after successful lookup, wrong actors/tenants, inactive actors/roots, forged versions and raw unenrolled transactions.
- Exact case, trailing spaces, trailing zero UTF-16 code units, widths and catalog result-variable reset.
- A non-owner role invoking the public path while internal execution, direct catalog access and private lock acquisition are rejected.
- Same-root concurrent edits, an older allocation discovering a later root, concurrent catalog misses and nonblocking existing-value hits across unrelated roots. Historical readers wait at the initial exclusive root lock and proceed after release.
- C# commit/disposal/failure/cancellation lifetime, historical fields, revision diffs, actor/time, root deletion context and missing revisions.
- The actual C# System bootstrap with default tenant ID 2, repeated bootstrap, subsequent tenant/business allocations and first email.
- The actual OvermindSqlDatabaseManager CreateSchema → DropSchema → CreateSchema cycle, including embedded application seeds, their explicitly audited runner transaction, seeded user, email history, aggregate revision and action evidence. Rebuild/restart the application to load a changed embedded SQL resource.
- Saved-order append/move/promote/delete/restore, intermediate positions, final shifted-row snapshots, net move/revert diffs, runtime-role moves, and actual contact/actor views without changing login/account email.
- Distinct new email/location values inserted under the runtime role into the same catalog gaps while another unit remains open; bounded root-history locks inside the actual reader amid 200 unrelated contacts.
- Queued cancellation versus commit, cancellation/disposal during blocked SQL, provider commit failure after terminating only the unit's own disposable-database session, and commit preceding a later queued command.
- Unsupported isolation before/after enrollment, explicit batch success/rollback/missing-helper failure, role membership persistence, and cleanup of the removed legacy child counter on drop.
- Ordinary user creation at revision 1, existing-contact promotion with historical type, account history excluding credentials, and ordinary-user C# email operations without a System substitute.
- Promotion before/after child edits, rollback of new/existing roots, competing promotions, actor/tenant failures, and eligible versus ambiguous/foreign initial roles.
- Optional company references scoped to tenant/company category, new company contact history, and rejection of inactive/ambiguous name matches.
- Two databases sharing one connection/engine transaction and matching numeric hints still rejecting foreign-version reuse.

Not claimed: a capacity benchmark, every SQL Server/Azure version, PostgreSQL/MySQL execution, generic authorization/role lifecycle, full schema-upgrade testing, historical import, redaction, commit-loss fault injection or exactly-once retry receipts.

## Source map for an independent reviewer

| Concern | Entry point |
| --- | --- |
| Native enrollment/discovery/allocation | Scripts/Data/create_audit_unit_begin.sql, create_audit_unit_assert.sql, create_dbrow_version_ensure.sql |
| Actor/root ordering | Scripts/Entities/create_actor_resolve.sql, create_entity_write_lock.sql, create_entity_version_bump.sql |
| Email state machine and final snapshots | Scripts/Contacts/Emails/create_contact_email_write.sql, create_contact_email_history_sync.sql |
| Public SQL boundary | Scripts/Contacts/Emails/create_contact_email_change.sql and lifecycle wrappers |
| Exact values and durable child identity | Scripts/Contacts/Emails/create_email_schema.sql, create_email_values_ensure.sql |
| Read/diff/action consumer | Scripts/Contacts/Emails/create_contact_emails_as_of.sql, create_contact_email_read.sql |
| C# ownership and reader | SqlAuditUnit.cs, AuditUnitCommitUncertainException.cs, SqlContactEmailReader.cs |
| Grants | Scripts/Security/create_email_runtime_permissions.sql |
| Fresh System/tenant construction | Scripts/Security/User/create_system_user_bootstrap.sql, Scripts/Data/create_tenant_insert.sql, SecurityDatabaseSchemaBuilder.cs |
| Ordinary user construction/type history | Scripts/Security/User/create_security_user_insert.sql, create_user_history_schema.sql, create_user_history_create.sql; Scripts/Entities/create_entity_history_snapshot.sql; src/tests/sql/user_construction_tests.sql; src/tests/AuditTests/SqlScenarios.cs, UserConstructionCases.cs |
| Discoverable tests and retained cases | src/tests/AuditTests/AuditScenarios.cs, SqlScenarios.cs, SharedUnitCases.cs, OrderingCases.cs, LifetimeCases.cs, SchemaCycle.cs; src/tests/sql/email_family_tests.sql, email_order_tests.sql; [testing handoff](testing-handoff.md) |

Source paths except tests are relative to src/Framework/Sistrategia.Data.SqlClient. No edits were made to CFUS-TOP-React, LaSalle-egresados or SistrategiaDataAnalysis.
