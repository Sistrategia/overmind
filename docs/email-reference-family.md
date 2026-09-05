# Email reference family: usage, tests and review map

Implemented 2026-09-05 for fresh Overmind schemas. [ADR 0005](adr/0005-email-reference-family.md) records decisions, tradeoffs and remaining work. These scripts are creation DDL, not an upgrade/migration package for an existing database.

## C# composition

The backend authenticates/authorizes the actor, target tenant and contact before using this API. Use the returned child ordinal with its owning contact; EmailId is a shared catalog key.

```csharp
await using var unit = await SqlAuditUnit.BeginAsync(connectionString, actorPublicKey, tenantPublicKey);
var added = await unit.InsertEmailAsync(contactPublicKey, expectedEntityVersion, "a@example.test", "Home");
var edited = await unit.UpdateEmailAsync(contactPublicKey, expectedEntityVersion,
    added.Ordinal, "b@example.test", location: null, isPublic: false);
await unit.CommitAsync();
// added/edited were provisional until commit. Both refer to one contact revision and audit unit.
```

Update replaces the email/location/visibility fields; NULL location clears it. DeleteEmailAsync requires an existing ordinal. RestoreEmailAsync deliberately reuses a known absent identity and supplies its restored values. InsertEmailAsync always allocates a new child identity. Ordinary edits require the unit-entry expectedEntityVersion; repeated calls do not switch to their own freshly returned version.

Any failed command invalidates the unit and rolls back earlier commands. Cancellation does too, including a cancelled queued call. Dispose without commit rolls back. Do not retry an uncertain commit blindly: durable request receipt handling is not implemented by this reference API. MARS, exposed raw transaction handles, savepoint partial success and automatic retry are not supported.

```csharp
var history = new SqlContactEmailReader(connectionString);
var revision = await history.ReadAsync(contactPublicKey, actorPublicKey,
    entityVersion: 3, tenant: tenantPublicKey, compareEntityVersion: 2);
// Emails: state at revision 3. Differences: email changes from revision 2 to 3.
// Actions: ordered effective email actions in revision 3, with actual values, actor and UTC time.
// DisplayName/FullName come from historical payload, even if today's contact has been renamed/deleted.
```

The reader owns a short serializable transaction; it rejects ambient transactions. It reconstructs the email family and historical root context, not every contact child family. A missing revision/root payload throws instead of becoming a misleading empty collection. Legacy coverage/baseline support is separate, as described in ADR 0004.

## Native SQL composition

```sql
SET XACT_ABORT ON;
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
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
```

A standalone command opens/enrolls/commits its own transaction. A supplied version without an enrolled caller transaction fails. NULL inside an enrolled unit discovers and joins its existing allocation. Old committed versions, mismatched tenant/actor and cross-database reuse fail. Session hints cannot establish ownership.

Assign the trusted backend's database user to the shipped email_runtime role for the reference API. This role intentionally excludes legacy constructors, administrative bootstrap and raw table/catalog access. Other application capabilities require their own reviewed grants. Passing an actor GUID does not authenticate the caller; this is a backend API, not an unrestricted end-user SQL endpoint.

## Run the verification

Prerequisites: .NET 8, Python 3, sqlcmd and a local SQL Server account allowed to create/drop disposable test databases. The first build restores normal project dependencies; no additional test framework package was introduced.

```powershell
dotnet build tests/EmailReference/EmailReference.csproj --nologo
python tests/sql/run_dbrow_version_tests.py --server localhost
```

The Python runner loads real repository DDL/procedures, builds the harness without restoring again, runs SQL and C# assertions, and removes only its own generated OvermindAuditTest_<random> databases. The C# harness rejects arbitrary database names. No application migration or rebuild runs against an existing database.

Verified on 2026-09-05 against local SQL Server 2022: the expanded suite passed, the C# build reported zero warnings/errors, and all three generated databases were removed. The historical-reader lock regression first failed with the original update lock and passed after the exclusive-root correction. The application schema-cycle regression reproduced the reported seed enrollment error 51102 before the fix and passed afterward.

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
- The actual OvermindSqlDatabaseManager CreateSchema → DropSchema → CreateSchema cycle, including embedded application seeds, their enclosing resource-runner transaction, seeded user, email history, aggregate revision and action evidence. The business seed explicitly enrolls that transaction; rebuild/restart the application to load a changed embedded SQL resource.
- Two databases sharing one connection/engine transaction and matching numeric hints still rejecting foreign-version reuse.

Not claimed: a capacity benchmark, every SQL Server/Azure version, PostgreSQL/MySQL execution, generic authorization/role lifecycle, full schema-upgrade testing, historical import, redaction, commit-loss fault injection or exactly-once retry receipts.

## Source map for an independent reviewer

| Concern | Entry point |
| --- | --- |
| Native enrollment/discovery/allocation | Scripts/Data/create_audit_unit_begin.sql, create_audit_unit_assert.sql, create_dbrow_version_ensure.sql |
| Actor/root ordering | Scripts/Entities/create_actor_resolve.sql, create_entity_write_lock.sql, create_entity_version_bump.sql |
| Email state machine | Scripts/Contacts/Emails/create_contact_email_write.sql |
| Public SQL boundary | Scripts/Contacts/Emails/create_contact_email_change.sql and lifecycle wrappers |
| Exact values and durable child identity | Scripts/Contacts/Emails/create_email_schema.sql, create_email_values_ensure.sql |
| Read/diff/action consumer | Scripts/Contacts/Emails/create_contact_emails_as_of.sql, create_contact_email_read.sql |
| C# ownership and reader | SqlAuditUnit.cs, SqlContactEmailReader.cs |
| Grants | Scripts/Security/create_email_runtime_permissions.sql |
| Fresh System/tenant construction | Scripts/Security/User/create_system_user_bootstrap.sql, Scripts/Data/create_tenant_insert.sql, SecurityDatabaseSchemaBuilder.cs |
| Executable cases | tests/sql/email_family_tests.sql, tests/sql/run_dbrow_version_tests.py, tests/EmailReference/Program.cs, tests/EmailReference/SchemaCycle.cs |

Source paths except tests are relative to src/Framework/Sistrategia.Data.SqlClient. No edits were made to CFUS-TOP-React, LaSalle-egresados or SistrategiaDataAnalysis.
