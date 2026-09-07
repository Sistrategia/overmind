using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class ContactProfileCases
{
    internal static readonly Guid Actor = Guid.Parse(SqlScenarios.actor);
    internal static readonly Guid Tenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091ED");
    internal static readonly ContactProfileInput Person = new(1, "Ernesto Ocampo", PersonFirstName: "Ernesto",
        PersonLastName1: "Ocampo", PersonLastName2: "", PersonAlias: "Neto ", Summary: "Before", DoNotContact: true);

    internal static async Task Prepare(AuditDatabase db) {
        await db.SeedAsync();
        // Extend the historical minimal fixture only with the definitions this new capability uses.
        await db.ExecuteAsync("""
            INSERT contacts.person_name_type(person_name_type_id,code_name) VALUES
                (1,N'person_title'),(2,N'person_first_name'),(3,N'person_last_name'),(4,N'person_last_name1'),
                (5,N'person_last_name2'),(6,N'person_suffix'),(7,N'person_alias');
            IF NOT EXISTS (SELECT 1 FROM data.dboperation_type WHERE dboperation_type_id=3) INSERT data.dboperation_type VALUES (3,'DELETE');
            IF NOT EXISTS (SELECT 1 FROM data.dboperation_type WHERE dboperation_type_id=5) INSERT data.dboperation_type VALUES (5,'UNDODL');
            """);
    }
    internal static async Task<ContactWriteResult> Create(AuditDatabase db, ContactProfileInput? profile = null) {
        await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant);
        var result = await unit.CreateContactAsync(profile ?? Person);
        await unit.CommitAsync();
        return result;
    }
    private static Task<ContactRevision> Read(AuditDatabase db, Guid contact, int version, int? compare = null) =>
        new SqlContactReader(db.ConnectionString).ReadAsync(contact, Actor, version, Tenant, compare);

    internal static async Task Lifecycle(AuditDatabase db) {
        ContactWriteResult contact;
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            contact = await unit.CreateContactAsync(Person);
            await unit.InsertEmailAsync(contact.PublicKey, 0, "before@example.test");
            await unit.InsertPhoneAsync(contact.PublicKey, 0, new("+527773123456"));
            await unit.InsertWebLinkAsync(contact.PublicKey, 0, new("https://example.test/before"));
            await unit.InsertAddressAsync(contact.PublicKey, 0, new(Address1: "Before"));
            await unit.UpdateContactAsync(contact.PublicKey, 0, Person with { DisplayName = "Neto" });
            await unit.CommitAsync();
        }
        var first = await Read(db, contact.PublicKey, 1);
        Assert.AreEqual("Neto", first.Profile.DisplayName);
        Assert.IsTrue(first.Profile.DoNotContact);
        Assert.AreEqual("", first.Profile.PersonLastName2);
        Assert.AreEqual("Neto ", first.Profile.PersonAlias);
        CollectionAssert.AreEqual(new[] { "contact", "email", "phone", "web_link", "address", "contact" }, first.Actions.Select(a => a.Family).ToArray());
        Assert.AreEqual(6, first.Actions.Select(a => a.ActionOrdinal).Distinct().Count());
        var shared = await Create(db);
        var next = Person with { FullName = "ERNESTO Ocampo", PersonFirstName = "ERNESTO", PersonLastName2 = null,
            PersonAlias = null, Summary = null, DoNotContact = false, ImageUrl = "image:test", IsPrivate = true };
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.UpdateContactAsync(contact.PublicKey, 1, next);
            await unit.UpdateEmailAsync(contact.PublicKey, 1, 1, "after@example.test");
            await unit.UpdateAddressAsync(contact.PublicKey, 1, 1, new(Address1: "After"));
            await unit.CommitAsync();
        }
        var second = await Read(db, contact.PublicKey, 2, 1);
        Assert.AreEqual("ERNESTO", second.Profile.PersonFirstName);
        Assert.IsNull(second.Profile.PersonLastName2);
        Assert.IsNull(second.Profile.Summary);
        Assert.IsTrue(second.Profile.IsPrivate);
        Assert.AreEqual("Ernesto", second.ProfileDifferences.Single().OldProfile.PersonFirstName);
        Assert.AreEqual("Ernesto", (await Read(db, shared.PublicKey, 1)).Profile.PersonFirstName);
        Assert.AreEqual("Ernesto", (await Read(db, contact.PublicKey, 1)).Profile.PersonFirstName);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            var noop = await unit.UpdateContactAsync(contact.PublicKey, 2, next);
            Assert.IsNull(noop.DbrowVersion);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.UpdateContactAsync(contact.PublicKey, 2, next with { PersonFirstName = "Érnesto " });
            await unit.UpdateContactAsync(contact.PublicKey, 2, next);
            await unit.CommitAsync();
        }
        var third = await Read(db, contact.PublicKey, 3, 2);
        Assert.AreEqual(0, third.ProfileDifferences.Count);
        Assert.AreEqual(2, third.ProfileActions.Count);
        Assert.AreEqual("Érnesto ", third.ProfileActions[0].Profile.PersonFirstName);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.DeleteContactAsync(contact.PublicKey, 3);
            await unit.CommitAsync();
        }
        var deleted = await Read(db, contact.PublicKey, 4, 3);
        Assert.IsNotNull(deleted.Profile.Deleted);
        Assert.AreEqual(1, deleted.Channels.Addresses.Count);
        Assert.AreEqual("delete", deleted.ProfileActions.Single().Operation);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => unit.UpdateEmailAsync(contact.PublicKey, 4, 1, "blocked@example.test"));
            Assert.AreEqual(51203, error.Number);
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            var noop = await unit.DeleteContactAsync(contact.PublicKey, 4);
            Assert.IsNull(noop.DbrowVersion);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.RestoreContactAsync(contact.PublicKey, 4);
            await unit.UpdateContactAsync(contact.PublicKey, 4, next with { Summary = "Restored" });
            await unit.UpdatePhoneAsync(contact.PublicKey, 4, 1, new("+527773123456"), extension: "5");
            await unit.CommitAsync();
        }
        var restored = await Read(db, contact.PublicKey, 5, 4);
        Assert.IsNull(restored.Profile.Deleted);
        Assert.AreEqual("Restored", restored.Profile.Summary);
        Assert.AreEqual(3, restored.Actions.Count);
        await db.ExecuteAsync($"""
            IF (SELECT dboperation_type_id FROM entities.entity_history WHERE entity_id={contact.ContactId} AND dbrow_version={first.DbrowVersion})<>1
                THROW 52900,'Creation snapshot lost insert operation.',1;
            IF (SELECT dboperation_type_id FROM entities.entity_history WHERE entity_id={contact.ContactId} AND dbrow_version={deleted.DbrowVersion})<>3
                THROW 52900,'Deletion snapshot is not DELETE.',1;
            IF (SELECT dboperation_type_id FROM entities.entity_history WHERE entity_id={contact.ContactId} AND dbrow_version={restored.DbrowVersion})<>5
                THROW 52900,'Restore operation was overwritten by profile update.',1;
            IF (SELECT COUNT(*) FROM contacts.person_name WHERE CONVERT(VARBINARY(MAX),name)=CONVERT(VARBINARY(MAX),N'Ernesto') AND DATALENGTH(name)=14)<>1
                THROW 52900,'Exact shared name reuse failed.',1;
            """);
    }

    internal static async Task ValidationAndPermissions(AuditDatabase db) {
        var person = await Create(db);
        var organization = await Create(db, new(2, "Organization", Recruiting: true));
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.InsertEmailAsync(person.PublicKey, 1, "rollback@example.test");
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.UpdateContactAsync(person.PublicKey, 1, Person with { PersonFirstName = new string('x',257) }));
            await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => unit.CommitAsync());
        }
        Assert.AreEqual(0,(await Read(db,person.PublicKey,1)).Channels.EmailRevision.Emails.Count);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant)) {
            await unit.UpdateContactAsync(person.PublicKey,1,Person with { FullName="Rolled back" });
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertWebLinkAsync(person.PublicKey,1,new("not-a-url")));
        }
        foreach (var payload in new[] { "{}", "{\"contact_type_id\":1,\"full_name\":true}",
            "{\"contact_type_id\":1,\"full_name\":\"One\",\"full_name\":\"Two\"}",
            "{\"contact_type_id\":1,\"full_name\":\"One\",\"unknown\":0}",
            "{\"contact_type_id\":1,\"full_name\":\"One\",\"do_not_contact\":1}" }) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>db.ExecuteAsync($"DECLARE @key UNIQUEIDENTIFIER=NEWID(); EXEC contacts.contact_change 'create',@key OUTPUT,'{Actor}','{Tenant}',0,N'{payload.Replace("'","''")}';"));
            Assert.AreEqual(52000,error.Number);
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.UpdateContactAsync(organization.PublicKey,1,Person));
            Assert.AreEqual(52004,error.Number);
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.UpdateContactAsync(person.PublicKey,99,Person));
            Assert.AreEqual(51206,error.Number);
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor))
            await Assert.ThrowsExactlyAsync<ArgumentException>(()=>unit.CreateContactAsync(Person));
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Guid.NewGuid(),Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.CreateContactAsync(Person));
            Assert.AreEqual(51201,error.Number);
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091EE"))) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.CreateContactAsync(Person));
            Assert.AreEqual(51201,error.Number);
        }
        var missingTenant=await Assert.ThrowsExactlyAsync<SqlException>(()=>db.ExecuteAsync($"DECLARE @key UNIQUEIDENTIFIER=NEWID(); EXEC contacts.contact_change 'create',@key OUTPUT,'{Actor}',NULL,0,N'{{}}';"));
        Assert.AreEqual(52003,missingTenant.Number);
        await db.ExecuteAsync($$"""
            BEGIN TRAN;
            EXEC data.audit_unit_begin;
            DECLARE @key UNIQUEIDENTIFIER='{{person.PublicKey}}',@v BIGINT;
            BEGIN TRY
                EXEC contacts.contact_change 'update',@key OUTPUT,'{{Actor}}','{{Tenant}}',1,
                    N'{"contact_type_id":1,"full_name":"Invalid snapshot rollback"}',@dbrow_version=@v OUTPUT;
                EXEC entities.entity_history_snapshot {{person.ContactId}},1,@v,@operation=3;
                THROW 52900,'Snapshot accepted delete operation for active root.',1;
            END TRY
            BEGIN CATCH
                IF XACT_STATE()<>0 ROLLBACK;
                IF ERROR_NUMBER()<>52008 THROW;
            END CATCH;
            IF (SELECT entity_version FROM entities.entity WHERE entity_id={{person.ContactId}})<>1
                THROW 52900,'Snapshot rejection did not roll back the unit.',1;
            """);
        await db.ExecuteAsync($$"""
            CREATE USER profile_app WITHOUT LOGIN;
            ALTER ROLE contact_runtime ADD MEMBER profile_app;
            CREATE USER channels_app WITHOUT LOGIN;
            ALTER ROLE contact_channels_runtime ADD MEMBER channels_app;
            EXECUTE AS USER='profile_app';
            DECLARE @key UNIQUEIDENTIFIER=NEWID();
            EXEC contacts.contact_change 'create',@key OUTPUT,'{{Actor}}','{{Tenant}}',0,N'{{new ContactProfileInput(2,"Runtime organization").PrepareForDatabase()}}';
            EXEC contacts.contact_read @key,'{{Actor}}',1,'{{Tenant}}';
            BEGIN TRY EXEC contacts.contact_history_snapshot 1,1,1; THROW 52900,'Private profile writer exposed.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
            BEGIN TRY SELECT * FROM contacts.person_name; THROW 52900,'Name dictionary exposed.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
            BEGIN TRY EXEC contacts.contact_insert @created_by='{{Actor}}',@full_name=N'Bypass'; THROW 52900,'Legacy constructor exposed.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
            REVERT;
            EXECUTE AS USER='channels_app';
            BEGIN TRY EXEC contacts.contact_read '{{person.PublicKey}}','{{Actor}}',1,'{{Tenant}}'; THROW 52900,'Channel role gained profile capability.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
            REVERT;
            """);
        var immutable=await Assert.ThrowsExactlyAsync<SqlException>(()=>db.ExecuteAsync("UPDATE contacts.person_name SET name=N'Changed';"));
        Assert.AreEqual(52002,immutable.Number);
        await db.ExecuteAsync($$"""
            BEGIN TRAN;
            BEGIN TRY EXEC contacts.contact_read '{{person.PublicKey}}','{{Actor}}',1,'{{Tenant}}'; THROW 52900,'Reader accepted ambient transaction.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>51400 THROW; END CATCH;
            IF XACT_STATE()<>0 ROLLBACK;
            """);
        // A raw/incomplete payload is explicitly unavailable, never filled from current name rows.
        await db.ExecuteAsync($"UPDATE contacts.contact_history SET contact_type_id=NULL WHERE contact_id={organization.ContactId};");
        var missingHistory=await Assert.ThrowsExactlyAsync<SqlException>(()=>Read(db,organization.PublicKey,1));
        Assert.AreEqual(52010,missingHistory.Number);
    }

    internal static async Task DependenciesAndLegacyNames(AuditDatabase db) {
        var person=await Create(db);
        await db.ExecuteAsync($"EXEC security.user_insert @public_key='{person.PublicKey}',@created_by='{Actor}',@full_name=NULL,@login_name=N'profile-promoted',@password_hash=N'h',@password_salt=N's',@expected_entity_version=1;");
        var promoted=await Read(db,person.PublicKey,2,1);
        Assert.AreEqual("Ernesto",promoted.Profile.PersonFirstName);
        Assert.AreEqual(4,promoted.Channels.EmailRevision.EntityTypeId);
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            await unit.UpdateContactAsync(person.PublicKey,2,Person with { FullName="Account profile" });
            await unit.CommitAsync();
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.DeleteContactAsync(person.PublicKey,3));
            Assert.AreEqual(52007,error.Number);
        }
        var legacy=Guid.NewGuid();
        await db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{legacy}',@created_by='{Actor}',@full_name=N'Legacy exact',@person_first_name=N'ERNESTO',@person_last_name1=N'Ocampo ',@person_company=N'Legacy company';");
        var historical=await Read(db,legacy,1);
        Assert.AreEqual("ERNESTO",historical.Profile.PersonFirstName);
        Assert.AreEqual("Ocampo ",historical.Profile.PersonLastName1);
        Assert.AreEqual("Legacy company",historical.Profile.PersonCompany);
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.DeleteContactAsync(legacy,1));
            Assert.AreEqual(52007,error.Number);
        }
        await db.ExecuteAsync($$"""
            DECLARE @organization UNIQUEIDENTIFIER=(SELECT e.public_key FROM entities.entity e JOIN contacts.contact c ON c.contact_id=e.entity_id WHERE c.full_name=N'Legacy company');
            BEGIN TRY EXEC contacts.contact_change 'delete',@organization OUTPUT,'{{Actor}}','{{Tenant}}',1; THROW 52900,'Referenced organization deleted.',1;
            END TRY BEGIN CATCH IF ERROR_NUMBER()<>52007 THROW; END CATCH;
            IF (SELECT login_name FROM security.[user] WHERE user_id={{person.ContactId}})<>N'profile-promoted'
                THROW 52900,'Profile change modified account login.',1;
            """);
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            await unit.UpdateContactAsync(legacy,1,Person);
            await unit.CommitAsync();
        }
        Assert.AreEqual("Legacy company",(await Read(db,legacy,2)).Profile.PersonCompany);
    }

    internal static async Task DependencyRaces(AuditDatabase db) {
        var person=await Create(db,new(1,"Deletion wins"));
        await using var observer=new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        await using (var holder=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var deleted=await holder.DeleteContactAsync(person.PublicKey,1);
            var holderId=await SessionForVersion(observer,deleted.DbrowVersion!.Value);
            var promotion=Task.Run(async()=> {
                var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>db.ExecuteAsync($"EXEC security.user_insert @public_key='{person.PublicKey}',@created_by='{Actor}',@full_name=NULL,@login_name=N'deleted-race',@password_hash=N'h',@password_salt=N's',@expected_entity_version=1;"));
                Assert.AreEqual(51203,error.Number);
            });
            try { await WaitForBlockedSession(observer,holderId); }
            finally { await holder.CommitAsync(); await promotion; }
        }
        var account=await Create(db,new(1,"Promotion wins"));
        await using (var promotionConnection=new SqlConnection(db.ConnectionString)) {
            await promotionConnection.OpenAsync();
            await using var transaction=(SqlTransaction)await promotionConnection.BeginTransactionAsync();
            using var promote=new SqlCommand($"EXEC data.audit_unit_begin; EXEC security.user_insert @public_key='{account.PublicKey}',@created_by='{Actor}',@full_name=NULL,@login_name=N'promotion-race',@password_hash=N'h',@password_salt=N's',@expected_entity_version=1; SELECT @@SPID;",promotionConnection,transaction);
            var holderId=Convert.ToInt32(await promote.ExecuteScalarAsync());
            var deletion=Task.Run(async()=> {
                await using var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant);
                var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.DeleteContactAsync(account.PublicKey,1));
                // Promotion changed the unit-entry optimistic revision before eligibility is checked.
                Assert.AreEqual(51206,error.Number);
            });
            try { await WaitForBlockedSession(observer,holderId); }
            finally { await transaction.CommitAsync(); await deletion; }
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>unit.DeleteContactAsync(account.PublicKey,2));
            Assert.AreEqual(52007,error.Number);
        }
        var organization=await Create(db,new(2,"Organization deletion race"));
        var legacy=Guid.NewGuid();
        await using (var holder=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            var deleted=await holder.DeleteContactAsync(organization.PublicKey,1);
            var holderId=await SessionForVersion(observer,deleted.DbrowVersion!.Value);
            var relationship=Task.Run(async()=> {
                var error=await Assert.ThrowsExactlyAsync<SqlException>(()=>db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{legacy}',@created_by='{Actor}',@full_name=N'Failed relationship',@person_company=N'Organization deletion race';"));
                Assert.AreEqual(51203,error.Number);
            });
            try { await WaitForBlockedSession(observer,holderId); }
            finally { await holder.CommitAsync(); await relationship; }
        }
        await db.ExecuteAsync($"IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key='{legacy}') THROW 52900,'Failed relationship left a partial contact.',1;");
    }

    private static async Task<int> SessionForVersion(SqlConnection observer,long version) {
        using var command=new SqlCommand("SELECT s.session_id FROM data.dbrow_version v WITH (READUNCOMMITTED) JOIN sys.dm_tran_session_transactions s ON s.transaction_id=v.allocation_transaction_id WHERE v.dbrow_version=@version;",observer);
        command.Parameters.AddWithValue("@version",version);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }
    internal static async Task ReaderConcurrency(AuditDatabase db) {
        var contact=await Create(db);
        await using (var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant)) {
            await unit.InsertEmailAsync(contact.PublicKey,1,"before@example.test");
            await unit.InsertPhoneAsync(contact.PublicKey,1,new("+527773123456"));
            await unit.InsertWebLinkAsync(contact.PublicKey,1,new("https://example.test/before"));
            await unit.InsertAddressAsync(contact.PublicKey,1,new(Address1:"Before"));
            await unit.CommitAsync();
        }
        var component=File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"ProductionSql","Contacts","Profiles","create_contact_profile_read_rows.sql"));
        const string rendezvous="profile_reader_boundary";
        await db.ExecuteAsync(component.Replace("SET NOCOUNT ON;",$"SET NOCOUNT ON; DECLARE @gate INT; EXEC @gate=sys.sp_getapplock @Resource=N'{rendezvous}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @gate<0 THROW 52900,'Reader gate timed out.',1;"));
        await using var observer=new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        using var getId=new SqlCommand($"DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=N'{rendezvous}',@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0; IF @r<0 THROW 52900,'Cannot acquire gate.',1; SELECT @@SPID;",observer);
        var observerId=Convert.ToInt32(await getId.ExecuteScalarAsync());
        Task<ContactRevision>? pendingRead=null;
        Task? pendingWrite=null;
        try {
            pendingRead=Read(db,contact.PublicKey,2,1);
            var readerId=await WaitForBlockedSession(observer,observerId);
            pendingWrite=Task.Run(async()=> {
                await using var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant);
                await unit.UpdateContactAsync(contact.PublicKey,2,Person with { PersonFirstName="After", FullName="After" });
                await unit.UpdateEmailAsync(contact.PublicKey,2,1,"after@example.test");
                await unit.UpdatePhoneAsync(contact.PublicKey,2,1,new("+527773123456"),extension:"after");
                await unit.UpdateWebLinkAsync(contact.PublicKey,2,1,new("https://example.test/after"));
                await unit.UpdateAddressAsync(contact.PublicKey,2,1,new(Address1:"After"));
                await unit.CommitAsync();
            });
            await WaitForBlockedSession(observer,readerId);
            Assert.IsFalse(pendingWrite.IsCompleted);
        } finally {
            using var release=new SqlCommand($"EXEC sys.sp_releaseapplock @Resource=N'{rendezvous}',@LockOwner='Session';",observer);
            await release.ExecuteNonQueryAsync();
            try { if(pendingRead is not null) await pendingRead; }
            finally { try { if(pendingWrite is not null) await pendingWrite; } finally { await db.ExecuteAsync(component); } }
        }
        var before=await pendingRead!;
        Assert.AreEqual("Ernesto",before.Profile.PersonFirstName);
        Assert.AreEqual("Before",before.Channels.Addresses.Single().Address.Address1);
        Assert.AreEqual("before@example.test",before.Channels.EmailRevision.Emails.Single().Email);
        var after=await Read(db,contact.PublicKey,3,2);
        Assert.AreEqual("After",after.Profile.PersonFirstName);
        Assert.AreEqual("After",after.Channels.Addresses.Single().Address.Address1);
        Assert.AreEqual("after@example.test",after.Channels.EmailRevision.Emails.Single().Email);
        Assert.AreEqual("after",after.Channels.Phones.Single().Extension);
        Assert.AreEqual("https://example.test/after",after.Channels.WebLinks.Single().Url);
        CollectionAssert.AreEqual(new[]{"contact","email","phone","web_link","address"},after.Actions.Select(a=>a.Family).ToArray());
    }

    internal static async Task NameConcurrency(AuditDatabase db) {
        var a=await Create(db,new(1,"One"));
        var b=await Create(db,new(1,"Two"));
        var c=await Create(db,new(1,"Three"));
        await using var holder=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant);
        var held=await holder.UpdateContactAsync(a.PublicKey,1,new(1,"One",PersonFirstName:"Concurrent name"));
        await using var observer=new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        using var session=new SqlCommand("SELECT s.session_id FROM data.dbrow_version v WITH (READUNCOMMITTED) JOIN sys.dm_tran_session_transactions s ON s.transaction_id=v.allocation_transaction_id WHERE v.dbrow_version=@version;",observer);
        session.Parameters.AddWithValue("@version",held.DbrowVersion);
        var holderId=Convert.ToInt32(await session.ExecuteScalarAsync());
        var contender=Task.Run(async()=> {
            await using var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant);
            await unit.UpdateContactAsync(b.PublicKey,1,new(1,"Two",PersonFirstName:"Concurrent name"));
            await unit.CommitAsync();
        });
        try {
            await WaitForBlockedSession(observer,holderId);
            await using var unit=await SqlAuditUnit.BeginAsync(db.ConnectionString,Actor,Tenant);
            await unit.UpdateContactAsync(c.PublicKey,1,new(1,"Three",PersonFirstName:"Different name")).WaitAsync(TimeSpan.FromSeconds(8));
            await unit.CommitAsync();
            Assert.IsFalse(contender.IsCompleted);
        } finally {
            await holder.CommitAsync();
            await contender;
        }
        await db.ExecuteAsync("IF (SELECT COUNT(*) FROM contacts.person_name WHERE name=N'Concurrent name')<>1 THROW 52900,'Concurrent name duplicated.',1;");
    }
    private static async Task<int> WaitForBlockedSession(SqlConnection observer, int blocker) {
        var deadline = DateTime.UtcNow.AddSeconds(12);
        while (DateTime.UtcNow < deadline) {
            using var command = new SqlCommand("SELECT TOP(1) session_id FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id=@blocker;", observer);
            command.Parameters.AddWithValue("@blocker", blocker);
            var value = await command.ExecuteScalarAsync();
            if (value is not null && value is not DBNull) return Convert.ToInt32(value);
            await Task.Delay(50);
        }
        throw new AssertFailedException($"No actual blocked request observed behind owned session {blocker}.");
    }
}
