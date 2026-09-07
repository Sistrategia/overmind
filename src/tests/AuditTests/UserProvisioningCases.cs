using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Security;

namespace Overmind.AuditTests;

internal static class UserProvisioningCases
{
    internal const string Password = "Local test passphrase 2026!";
    private static readonly Guid Actor = ContactProfileCases.Actor, Tenant = ContactProfileCases.Tenant;
    private sealed class Policy : IUserProvisioningAuthorizer
    {
        public ValueTask<bool> CanProvisionAsync(ContactActorContext context, Guid contact, CancellationToken token) => ValueTask.FromResult(true);
        public ValueTask<bool> CanAssignRoleAsync(ContactActorContext context, int role, CancellationToken token) => ValueTask.FromResult(true);
    }
    private static SqlUserProvisioningService Service(AuditDatabase db, Guid? actor = null, Guid? tenant = null) =>
        new(db.ConnectionString, new ContactServiceCases.Context(new(actor ?? Actor, tenant ?? Tenant)), new ContactServiceCases.Policy(), new Policy());
    private static UserAccountInput Account(string login, int? role = null) => new(login, Password, "account@example.test", role);
    private static async Task Failure(Func<Task> action, ContactFailure failure) {
        try { await action(); Assert.Fail("Expected provisioning failure."); }
        catch (ContactServiceException error) { Assert.AreEqual(failure, error.Failure); }
    }
    private static async Task<string> Hash(AuditDatabase db, int id) {
        await using var connection = new SqlConnection(db.ConnectionString); await connection.OpenAsync();
        using var command = new SqlCommand("SELECT password_hash FROM security.[user] WHERE user_id=@id", connection);
        command.Parameters.AddWithValue("@id", id);
        return (string)(await command.ExecuteScalarAsync())!;
    }

    internal static async Task AtomicAndPasswords(AuditDatabase db) {
        var service = Service(db);
        await db.ExecuteAsync("INSERT contacts.contact_type(contact_type_id,code_name) VALUES (3,N'group');");
        await db.ExecuteAsync("INSERT security.role(role_name,display_name,description) VALUES (N'Provisioned',N'Provisioned',N'Test');");
        var created = await service.CreateAsync(new(ContactProfileCases.Person, Account("Ernesto@example.test", 1), ContactServiceCases.Initial()));
        Assert.AreEqual(1, created.EntityVersion); Assert.AreEqual(4, created.ChildIdentities.Count);
        var hash = await Hash(db, created.UserId);
        var encoded = Convert.FromBase64String(hash);
        Assert.AreEqual((byte)1, encoded[0]);
        Assert.AreEqual(2u, System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(encoded.AsSpan(1, 4)), "Identity V3 must use HMAC-SHA512.");
        Assert.AreEqual(220_000u, System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(encoded.AsSpan(5, 4)));
        Assert.AreEqual(PasswordVerificationResult.Success, ProvisioningPassword.CreateHasher().VerifyHashedPassword(new object(), hash, Password));
        Assert.AreEqual(PasswordVerificationResult.Failed, ProvisioningPassword.CreateHasher().VerifyHashedPassword(new object(), hash, Password + "wrong"));
        var second = await service.CreateAsync(new(ContactProfileCases.Person, Account("different@example.test")));
        Assert.AreNotEqual(hash, await Hash(db, second.UserId), "Each hash requires its own random salt.");
        var reader = new SqlContactReader(db.ConnectionString);
        var first = await reader.ReadAsync(created.PublicKey, Actor, 1, Tenant);
        Assert.AreEqual(4, first.Channels.EmailRevision.EntityTypeId);
        Assert.AreEqual("before@example.test", first.Channels.EmailRevision.Emails.Single().Email);
        await db.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM security.user_history WHERE user_id={created.UserId} AND login_name=N'Ernesto@example.test'
                AND email=N'account@example.test' AND email_confirmed=0) THROW 52000,'Missing account history.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.event WHERE subject_id={created.UserId}
                AND TRY_CONVERT(INT,JSON_VALUE(event_args,'$.initial_role_id'))=1) THROW 52000,'Missing selected role evidence.',1;
            IF EXISTS (SELECT 1 FROM security.[user] WHERE user_id={created.UserId} AND password_salt IS NOT NULL)
                THROW 52000,'V3 hash unexpectedly needs a separate salt.',1;
            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('security.user_history')
                AND name IN ('password','password_hash','password_salt')) THROW 52000,'Secret history column.',1;
            """);
        Assert.IsFalse((await Hash(db, created.UserId)).Contains(Password));
        var contact = await ContactProfileCases.Create(db);
        var before = await reader.ReadAsync(contact.PublicKey, Actor, 1, Tenant);
        var promotion = await service.PromoteAsync(new(contact.PublicKey, 1, Account("promoted@example.test", 1), [
            new ReplaceContactProfile(ContactProfileCases.Person with { FullName = "After promotion" }),
            new InsertContactPhone(new("+527773123456")), new InsertContactAddress(new(Address1: "New office"))]));
        Assert.AreEqual(2, promotion.EntityVersion);
        var after = await reader.ReadAsync(contact.PublicKey, Actor, 2, Tenant, 1);
        Assert.AreEqual(2, before.Channels.EmailRevision.EntityTypeId); Assert.AreEqual(4, after.Channels.EmailRevision.EntityTypeId);
        Assert.AreEqual("After promotion", after.Profile.FullName);
        Assert.AreEqual(1, after.Channels.Phones.Count); Assert.AreEqual(1, after.Channels.Addresses.Count);
        var pending = await ContactProfileCases.Create(db);
        await Failure(() => service.PromoteAsync(new(pending.PublicKey, 1, Account("ERNESTO@EXAMPLE.TEST"), [
            new ReplaceContactProfile(ContactProfileCases.Person with { FullName = "Must roll back" }),
            new InsertContactEmail("rollback@example.test")])), ContactFailure.Conflict);
        var untouched = await reader.ReadCurrentAsync(pending.PublicKey, Actor, Tenant);
        Assert.AreEqual(1, untouched.EntityVersion); Assert.AreEqual(ContactProfileCases.Person.FullName, untouched.Profile.FullName);
        Assert.AreEqual(0, untouched.Channels.EmailRevision.Emails.Count);
        await Failure(() => service.PromoteAsync(new(pending.PublicKey, 2, Account("stale@example.test"))), ContactFailure.Conflict);
        await Failure(() => service.PromoteAsync(new(pending.PublicKey, 1, Account("invalidrole@example.test", 999),
            [new InsertContactEmail("rollback-role@example.test")])), ContactFailure.Validation);
        foreach (var type in new[] { 2, 3 }) {
            await Failure(() => service.CreateAsync(new(new(type, "Not a person"), Account("company@example.test"))), ContactFailure.Validation);
            var key = Guid.NewGuid();
            await db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{key}',@created_by='{Actor}',@full_name=N'Nonperson',@contact_type_id={type};");
            await Failure(() => service.PromoteAsync(new(key, 1, Account("nonperson@example.test"))), ContactFailure.Validation);
        }
        // SQL capability is narrow: wrapper allowed, legacy constructor and raw writes denied.
        await db.ExecuteAsync($"""
            CREATE USER provision_test WITHOUT LOGIN;
            ALTER ROLE provisioning_runtime ADD MEMBER provision_test;
            EXECUTE AS USER='provision_test';
            IF HAS_PERMS_BY_NAME('security.user_provision','OBJECT','EXECUTE')<>1 THROW 52000,'Missing public capability.',1;
            IF HAS_PERMS_BY_NAME('security.user_insert','OBJECT','EXECUTE')<>0 THROW 52000,'Legacy constructor exposed.',1;
            IF HAS_PERMS_BY_NAME('security.user','OBJECT','SELECT')<>0 THROW 52000,'Account table exposed.',1;
            EXEC security.user_provision @contact_public_key='{pending.PublicKey}',@actor='{Actor}',@tenant='{Tenant}',
                @expected_entity_version=1,@login_name=N'restricted@example.test',@password_hash=N'{hash}';
            REVERT;
            """);
    }

    internal static async Task LoginAndConcurrency(AuditDatabase db) {
        var service = Service(db);
        var first = await service.CreateAsync(new(ContactProfileCases.Person, Account("Case@example.test")));
        await Failure(() => service.CreateAsync(new(ContactProfileCases.Person, Account("CASE@EXAMPLE.TEST"))), ContactFailure.Conflict);
        await service.CreateAsync(new(ContactProfileCases.Person, Account("cáse@example.test")));
        await service.CreateAsync(new(ContactProfileCases.Person, Account("case+tag@example.test")));
        await service.CreateAsync(new(ContactProfileCases.Person, Account("ca.se@example.test")));
        // The database defines Unicode equivalence; C# does not calculate a competing uppercase key.
        await service.CreateAsync(new(ContactProfileCases.Person, Account("é@example.test")));
        await Failure(() => service.CreateAsync(new(ContactProfileCases.Person, Account("e\u0301@example.test"))), ContactFailure.Conflict);
        foreach (var login in new[] { "", " spaced@example.test", "tab\t@example.test", "space @example.test", "zero\0@example.test", new string('x', 257) }) {
            await Failure(() => service.CreateAsync(new(ContactProfileCases.Person, Account(login))), ContactFailure.Validation);
        }
        var otherTenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091EE"); var otherActor = Guid.NewGuid();
        await db.ExecuteAsync($"EXEC entities.entity_insert @entity_type_id=4,@public_key='{otherActor}',@tenant='{otherTenant}',@created_by='{Actor}',@display_name=N'Other actor';");
        await Service(db, otherActor, otherTenant).CreateAsync(new(ContactProfileCases.Person, Account("CASE@example.test")));
        await db.ExecuteAsync($"""
            BEGIN TRY
                UPDATE security.[user] SET tenant_id=999 WHERE user_id={first.UserId};
                THROW 52000,'Account changed tenant without its owner.',1;
            END TRY BEGIN CATCH
                IF ERROR_NUMBER()<>547 THROW;
            END CATCH;
            BEGIN TRY
                EXEC security.user_insert @created_by='{Actor}',@full_name=N'Duplicate',@login_name=N'case@example.test';
                THROW 52000,'Privileged constructor bypassed login uniqueness.',1;
            END TRY BEGIN CATCH
                IF ERROR_NUMBER() NOT IN (2601,2627) THROW;
            END CATCH;
            """);
        var hash = ProvisioningPassword.CreateHasher().HashPassword(new object(), Password);
        var a = await ContactProfileCases.Create(db); var b = await ContactProfileCases.Create(db);
        await using var holder = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant);
        await holder.ProvisionUserAsync(a.PublicKey, 1, "race@example.test", hash);
        var contender = service.PromoteAsync(new(b.PublicKey, 1, Account("RACE@EXAMPLE.TEST")));
        await WaitForBlock(db);
        // Independent key must commit while the conflicting login holder is still uncommitted.
        await service.CreateAsync(new(ContactProfileCases.Person, Account("unrelated@example.test"))).WaitAsync(TimeSpan.FromSeconds(12));
        await holder.CommitAsync();
        await Failure(() => contender, ContactFailure.Conflict);
        var same = await ContactProfileCases.Create(db);
        await using var promotionHolder = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Tenant);
        await promotionHolder.ProvisionUserAsync(same.PublicKey, 1, "promotion-race@example.test", hash);
        var promotionContender = service.PromoteAsync(new(same.PublicKey, 1, Account("promotion-loser@example.test")));
        await WaitForBlock(db);
        await promotionHolder.CommitAsync();
        await Failure(() => promotionContender, ContactFailure.Conflict);
        var loser = await new SqlContactReader(db.ConnectionString).ReadCurrentAsync(b.PublicKey, Actor, Tenant);
        Assert.AreEqual(1, loser.EntityVersion); Assert.AreEqual(2, loser.Channels.EmailRevision.EntityTypeId);
    }
    private static async Task WaitForBlock(AuditDatabase db) {
        await using var connection = new SqlConnection(db.ConnectionString); await connection.OpenAsync();
        var deadline = DateTime.UtcNow.AddSeconds(12);
        while (DateTime.UtcNow < deadline) {
            using var command = new SqlCommand("SELECT COUNT(*) FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id>0", connection);
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) > 0) return;
            await Task.Delay(50);
        }
        Assert.Fail("Expected actual SQL contention was not observed.");
    }

    internal static async Task HttpAccess(AuditDatabase db) {
        await using var host = await ContactHttpHost.Start(db.ConnectionString);
        string Payload(string login, int? role = null, int type = 1) => JsonSerializer.Serialize(new {
            profile = new { contactTypeId = type, fullName = "HTTP account" },
            account = new { loginName = login, password = Password, initialRoleId = role },
            commands = new[] { new { kind = "email.insert", value = "http@example.test" } }
        });
        await db.ExecuteAsync("INSERT security.role(role_name,display_name,description) VALUES (N'Role',N'Role',N'Initial');");
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Unauthorized, Payload("http@example.test"));
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Forbidden, Payload("http@example.test"), host.Token());
        var admin = host.Token(provision: "*");
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Forbidden, Payload("http@example.test", 1), admin);
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Forbidden, Payload("http@example.test"), host.Token([], provision: "*"));
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.BadRequest, Payload("org@example.test", type: 2), admin);
        var success = await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Created, Payload("HTTP@example.test", 1), host.Token(provision: "*", assignRole: 1));
        Assert.AreEqual(JsonValueKind.String, success.Body.GetProperty("dbrowVersion").ValueKind);
        Assert.IsFalse(success.Body.GetRawText().Contains(Password)); Assert.IsFalse(success.Body.GetRawText().Contains("password"));
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Conflict, Payload("http@EXAMPLE.test"), admin);
        foreach (var json in new[] {
            "{\"account\":{\"loginName\":\"x\",\"passwordHash\":\"forged\"}}",
            Payload("x@example.test").Replace("\"password\":", "\"password\":\"duplicate\",\"password\":"),
            Payload("x@example.test").Replace(Password, "short"),
            Payload("x@example.test").Replace("\"profile\":", "\"tenant\":\"spoof\",\"profile\":") })
            await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.BadRequest, json, admin);
        var contact = await ContactProfileCases.Create(db);
        var promotion = JsonSerializer.Serialize(new { expectedEntityVersion = 1, account = new { loginName = "promotion-http@example.test", password = Password },
            commands = new[] { new { kind = "email.insert", value = "promoted-http@example.test" } } });
        await host.Send(HttpMethod.Post, $"/api/users/{contact.PublicKey}/promote", HttpStatusCode.Forbidden, promotion,
            host.Token([], provision: contact.PublicKey.ToString("D")));
        var promoted = await host.Send(HttpMethod.Post, $"/api/users/{contact.PublicKey}/promote", HttpStatusCode.OK, promotion,
            host.Token(["edit:" + contact.PublicKey], provision: contact.PublicKey.ToString("D")));
        Assert.AreEqual(2, promoted.Body.GetProperty("entityVersion").GetInt32());
        await host.Send(HttpMethod.Post, $"/api/users/{contact.PublicKey}/promote", HttpStatusCode.Conflict, promotion, admin);
        await host.Send(HttpMethod.Post, $"/api/users/{Guid.NewGuid()}/promote", HttpStatusCode.NotFound, promotion, admin);
        var otherTenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091EE"); var otherActor = Guid.NewGuid();
        await db.ExecuteAsync($"EXEC entities.entity_insert @entity_type_id=4,@public_key='{otherActor}',@tenant='{otherTenant}',@created_by='{Actor}',@display_name=N'Other actor';");
        var other = host.Token(actor: otherActor, tenant: otherTenant, provision: "*");
        await host.Send(HttpMethod.Post, $"/api/users/{contact.PublicKey}/promote", HttpStatusCode.NotFound, promotion, other);
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Created, Payload("http@example.test"), other);
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Forbidden, Payload("spoof@example.test"), host.Token(tenant: otherTenant, provision: "*"));
    }
}
