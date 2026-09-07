using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;

namespace Overmind.AuditTests;

internal static class ContactServiceCases
{
    internal sealed class Context(ContactActorContext value) : IContactContextAccessor
    {
        public int Calls { get; private set; }
        public ValueTask<ContactActorContext> GetAsync(CancellationToken cancellationToken) { Calls++; return ValueTask.FromResult(value); }
    }
    internal sealed class Policy : IContactAuthorizer
    {
        internal Func<ContactActorContext, Guid, ContactPermission, bool> Allow = (_, _, _) => true;
        internal readonly List<(ContactActorContext Context, Guid Contact, ContactPermission Permission)> Calls = [];
        public ValueTask<bool> IsAllowedAsync(ContactActorContext context, Guid contact, ContactPermission permission,
            CancellationToken cancellationToken) {
            Calls.Add((context, contact, permission));
            return ValueTask.FromResult(Allow(context, contact, permission));
        }
    }
    internal static SqlContactService Service(AuditDatabase db, Policy? policy = null, ContactActorContext? context = null) =>
        new(db.ConnectionString, new Context(context ?? new(ContactProfileCases.Actor, ContactProfileCases.Tenant)), policy ?? new());
    internal static readonly ContactProfileInput Person = new(1, "Person before", PersonFirstName: "Before", Summary: "private summary");
    internal static ContactCommand[] Initial(bool isPublic = false) => [
        new InsertContactEmail("before@example.test", "Work", isPublic),
        new InsertContactPhone(new("+527773123456"), "Work", "25", isPublic),
        new InsertContactWebLink(new("https://example.test/before"), "Work", isPublic),
        new InsertContactAddress(new(Address1: "Before"), "Work", isPublic)];
    internal static async Task Failure(ContactFailure expected, Func<Task> action) {
        var error = await Assert.ThrowsExactlyAsync<ContactServiceException>(action);
        Assert.AreEqual(expected, error.Failure, error.ToString());
    }

    internal static async Task Acceptance(AuditDatabase db) {
        var service = Service(db);
        foreach (var type in new[] { 1, 2 }) {
            var profile = type == 1 ? Person : new ContactProfileInput(2, "Organization before", Recruiting: true);
            var created = await service.CreateAsync(new(profile, Initial()));
            Assert.AreEqual(1, created.EntityVersion);
            Assert.IsNotNull(created.AuditDbrowVersion);
            Assert.AreEqual(4, created.ChildIdentities.Count);
            CollectionAssert.AreEqual(new[] { 0, 1, 2, 3 }, created.ChildIdentities.Select(i => i.CommandIndex).ToArray());
            var first = await service.ReadCurrentAsync(created.PublicKey);
            Assert.AreEqual(created.AuditDbrowVersion, first.DbrowVersion);
            Assert.AreEqual(1, first.Emails.Count);
            Assert.AreEqual(1, first.Phones.Count);
            Assert.AreEqual(1, first.WebLinks.Count);
            Assert.AreEqual(1, first.Addresses.Count);
            var updated = profile with { FullName = "After", PersonFirstName = type == 1 ? "After" : null, Summary = null };
            var saved = await service.SaveAsync(new(created.PublicKey, 1, [
                new ReplaceContactProfile(updated),
                new ReplaceContactPhone(1, new("+527773123456"), Extension: "After", IsPublic: true),
                new ReplaceContactAddress(1, new(Address1: "After"), IsPublic: true)]));
            Assert.AreEqual(2, saved.EntityVersion);
            var second = await service.ReadRevisionAsync(created.PublicKey, 2, 1);
            Assert.AreEqual(saved.AuditDbrowVersion, second.DbrowVersion);
            Assert.AreEqual("After", second.Profile.FullName);
            Assert.IsNull(second.Profile.Summary);
            Assert.AreEqual(profile.FullName, second.ProfileDifferences.Single().OldProfile.FullName);
            Assert.AreEqual("Before", second.Channels.AddressDifferences.Single().OldAddress!.Address1);
            CollectionAssert.AreEqual(new[] { "contact", "phone", "address" }, second.Actions.Select(a => a.Family).ToArray());
            Assert.AreEqual(profile.FullName, (await service.ReadRevisionAsync(created.PublicKey, 1)).Profile.FullName);
            await Failure(ContactFailure.Conflict, () => service.SaveAsync(new(created.PublicKey, 1,
                [new ReplaceContactProfile(profile)])));
            await Failure(ContactFailure.Validation, () => service.SaveAsync(new(created.PublicKey, 2, [
                new ReplaceContactProfile(profile), new ReplaceContactPhone(1, new("+527773123456"), Extension: "rolled back"),
                new ReplaceContactAddress(1, new(Address1: "Broken", CountryId: int.MaxValue))])));
            Assert.AreEqual(2, (await service.ReadCurrentAsync(created.PublicKey)).EntityVersion);
            Assert.AreEqual("After", (await service.ReadCurrentAsync(created.PublicKey)).Phones.Single().Extension);
            var noop = await service.SaveAsync(new(created.PublicKey, 2, [new ReplaceContactProfile(updated)]));
            Assert.AreEqual(2, noop.EntityVersion);
            Assert.IsNull(noop.AuditDbrowVersion);
        }
    }

    internal static async Task LifecycleAndOrdering(AuditDatabase db) {
        var service = Service(db);
        var created = await service.CreateAsync(new(Person, Initial().Concat(Initial(true)).ToArray()));
        var contact = created.PublicKey;
        var move = await service.SaveAsync(new(contact, 1, [new MoveContactEmail(2, 1), new MoveContactPhone(2, 1),
            new MoveContactWebLink(2, 1), new MoveContactAddress(2, 1)]));
        Assert.AreEqual(2, move.EntityVersion);
        var ordered = await service.ReadCurrentAsync(contact);
        Assert.AreEqual(2, ordered.Emails[0].Ordinal);
        Assert.AreEqual(2, ordered.Phones[0].Ordinal);
        Assert.AreEqual(2, ordered.WebLinks[0].Ordinal);
        Assert.AreEqual(2, ordered.Addresses[0].Ordinal);
        await service.SaveAsync(new(contact, 2, [new DeleteContactEmail(1), new DeleteContactPhone(1),
            new DeleteContactWebLink(1), new DeleteContactAddress(1)]));
        await service.SaveAsync(new(contact, 3, [new RestoreContactEmail(1, "restored@example.test"),
            new RestoreContactPhone(1, new("+527773123456")), new RestoreContactWebLink(1, new("https://example.test/restored")),
            new RestoreContactAddress(1, new(Address1: "Restored")),
            new ReplaceContactEmail(1, "final@example.test", IsPublic: true),
            new ReplaceContactWebLink(1, new("https://example.test/final"), IsPublic: true)]));
        var restored = await service.ReadCurrentAsync(contact);
        Assert.AreEqual(1, restored.Emails[1].Ordinal);
        Assert.AreEqual(2, restored.Emails[1].DisplayOrder);
        Assert.AreEqual("final@example.test", restored.Emails[1].Email);
        Assert.AreEqual("https://example.test/final", restored.WebLinks[1].Url);
        await service.SaveAsync(new(contact, 4, [new DeleteContact()]));
        Assert.IsNotNull((await service.ReadCurrentAsync(contact)).Profile.Deleted);
        await Failure(ContactFailure.NotFound, () => service.ReadDirectoryAsync(contact));
        await Failure(ContactFailure.Conflict, () => service.SaveAsync(new(contact, 5, [new InsertContactEmail("fail@example.test")])));
        var undeleted = await service.SaveAsync(new(contact, 5, [new RestoreContact(), new ReplaceContactProfile(Person with { FullName = "Restored root" })]));
        Assert.AreEqual(6, undeleted.EntityVersion);
        var final = await service.ReadRevisionAsync(contact, 6, 5);
        Assert.IsNull(final.Profile.Deleted);
        Assert.AreEqual(2, final.Channels.Addresses.Count);
        CollectionAssert.AreEqual(new[] { 2, 1 }, final.Channels.EmailRevision.Emails.Select(e => e.Ordinal).ToArray());
        CollectionAssert.AreEqual(new[] { "restore", "update" }, final.ProfileActions.Select(a => a.Operation).ToArray());
    }

    internal static async Task AccessAndVisibility(AuditDatabase db) {
        var policy = new Policy();
        var service = Service(db, policy);
        var created = await service.CreateAsync(new(Person, Initial().Concat(Initial(true)).ToArray()));
        var contact = created.PublicKey;
        var directory = await service.ReadDirectoryAsync(contact);
        Assert.AreEqual(2, directory.Emails.Single().Ordinal);
        Assert.AreEqual(2, directory.Phones.Single().DisplayOrder);
        Assert.AreEqual(1, directory.WebLinks.Count);
        Assert.AreEqual(1, directory.Addresses.Count);
        var json = JsonSerializer.Serialize(directory);
        Assert.IsFalse(json.Contains("private summary", StringComparison.Ordinal));
        Assert.IsFalse(json.Contains("RawInput", StringComparison.Ordinal));
        Assert.IsFalse(json.Contains("Actions", StringComparison.Ordinal));
        Assert.AreEqual(2, (await service.ReadCurrentAsync(contact)).Emails.Count);
        Assert.IsTrue(policy.Calls.All(c => c.Context.Actor == ContactProfileCases.Actor && c.Context.Tenant == ContactProfileCases.Tenant));

        policy.Allow = (_, key, permission) => key == contact && permission == ContactPermission.ReadDirectory;
        await service.ReadDirectoryAsync(contact);
        await Failure(ContactFailure.Forbidden, () => service.ReadCurrentAsync(contact));
        await Failure(ContactFailure.Forbidden, () => service.ReadRevisionAsync(contact, 1));
        await Failure(ContactFailure.Forbidden, () => service.CreateAsync(new(Person)));
        await Failure(ContactFailure.Forbidden, () => service.SaveAsync(new(contact, 1, [new DeleteContact()])));
        policy.Allow = (_, key, permission) => key == contact && permission == ContactPermission.Edit;
        await Failure(ContactFailure.Forbidden, () => service.SaveAsync(new(contact, 1,
            [new ReplaceContactProfile(Person with { FullName = "Unauthorized" }), new DeleteContact()])));
        policy.Allow = (_, _, _) => true;
        Assert.AreEqual(1, (await service.ReadCurrentAsync(contact)).EntityVersion);
        await service.SaveAsync(new(contact, 1, [new ReplaceContactProfile(Person with { IsPrivate = true })]));
        await Failure(ContactFailure.NotFound, () => service.ReadDirectoryAsync(contact));
        Assert.IsTrue((await service.ReadCurrentAsync(contact)).Profile.IsPrivate);

        policy.Allow = (_, _, permission) => permission == ContactPermission.ReadDetail;
        await service.ReadCurrentAsync(contact);
        await Failure(ContactFailure.Forbidden, () => service.ReadRevisionAsync(contact, 1));
        await Failure(ContactFailure.NotFound, () => service.ReadCurrentAsync(Guid.NewGuid()));
        await Failure(ContactFailure.Forbidden, () => Service(db, context: new(Guid.NewGuid(), ContactProfileCases.Tenant)).ReadCurrentAsync(contact));
        await Failure(ContactFailure.Forbidden, () => Service(db, context: new(ContactProfileCases.Actor, Guid.NewGuid())).ReadCurrentAsync(contact));
        // Privileged fixture construction provides an active user-typed actor in the existing other tenant.
        var otherTenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091EE");
        var otherActor = Guid.NewGuid();
        await db.ExecuteAsync($"""
            EXEC entities.entity_insert @entity_type_id=4,@public_key='{otherActor}',@tenant='{otherTenant}',
                @display_name=N'Other actor',@created_by='{ContactProfileCases.Actor}';
            """);
        var otherService = Service(db, context: new(otherActor, otherTenant));
        var own = await otherService.CreateAsync(new(new(1, "Other tenant person")));
        await otherService.ReadCurrentAsync(own.PublicKey);
        await Failure(ContactFailure.NotFound, () => otherService.ReadCurrentAsync(contact));
        await Failure(ContactFailure.NotFound, () => otherService.SaveAsync(new(contact, 2, [new DeleteContact()])));
    }

    internal static async Task ValidationAndCancellation(AuditDatabase db) {
        var service = Service(db);
        var contact = (await service.CreateAsync(new(Person, Initial()))).PublicKey;
        await Failure(ContactFailure.Validation, () => service.SaveAsync(new(contact, 1, [])));
        await Failure(ContactFailure.Validation, () => service.SaveAsync(new(contact, 0, [new DeleteContact()])));
        await Failure(ContactFailure.Validation, () => service.SaveAsync(new(contact, 1,
            [new ReplaceContactProfile(Person with { FullName = "Rollback" }), new ReplaceContactPhone(1, new("bad phone"))])));
        await Failure(ContactFailure.Validation, () => service.SaveAsync(new(contact, 1,
            [new InsertContactEmail("valid@example.test"), new InsertContactEmail(new string('x', 257))])));
        await Failure(ContactFailure.NotFound, () => service.SaveAsync(new(contact, 1, [new DeleteContactAddress(999)])));
        await Failure(ContactFailure.Conflict, () => service.CreateAsync(new(Person, PublicKey: contact)));
        var rejectedKey = Guid.NewGuid();
        await Failure(ContactFailure.Validation, () => service.CreateAsync(new(Person,
            [new InsertContactEmail("valid@example.test"), new InsertContactWebLink(new("javascript:bad"))], rejectedKey)));
        await Failure(ContactFailure.NotFound, () => service.ReadCurrentAsync(rejectedKey));
        Assert.AreEqual(1, (await service.ReadCurrentAsync(contact)).EntityVersion);

        var path = Path.Combine(AppContext.BaseDirectory, "ProductionSql", "Contacts", "Addresses", "create_contact_address_change.sql");
        var original = File.ReadAllText(path);
        const string gate = "service_cancel_boundary";
        await db.ExecuteAsync(original.Replace("SET NOCOUNT ON;", GateSql(gate)));
        await using var observer = new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        var owner = await Hold(observer, gate);
        using var cancellation = new CancellationTokenSource();
        Task<ContactSaveResult>? pending = null;
        try {
            pending = service.SaveAsync(new(contact, 1, [new ReplaceContactProfile(Person with { FullName = "Cancelled" }),
                new ReplaceContactAddress(1, new(Address1: "Cancelled"))]), cancellation.Token);
            await Blocked(observer, owner);
            cancellation.Cancel();
            await Assert.ThrowsAsync<OperationCanceledException>(async () => await pending);
        } finally {
            await Release(observer, gate);
            if (pending is not null) { try { await pending; } catch (OperationCanceledException) { } }
            await db.ExecuteAsync(original);
        }
        Assert.AreEqual(1, (await service.ReadCurrentAsync(contact)).EntityVersion);
        Assert.AreEqual(Person.FullName, (await service.ReadCurrentAsync(contact)).Profile.FullName);
    }

    internal static async Task CurrentReaderConcurrency(AuditDatabase db) {
        var service = Service(db);
        var contact = (await service.CreateAsync(new(Person, Initial()))).PublicKey;
        var path = Path.Combine(AppContext.BaseDirectory, "ProductionSql", "Contacts", "Profiles", "create_contact_profile_read_rows.sql");
        var original = File.ReadAllText(path);
        const string gate = "service_current_boundary";
        await db.ExecuteAsync(original.Replace("SET NOCOUNT ON;", GateSql(gate)));
        await using var observer = new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        var owner = await Hold(observer, gate);
        Task<ContactDetail>? read = null;
        Task<ContactSaveResult>? write = null;
        try {
            read = service.ReadCurrentAsync(contact);
            var readerId = await Blocked(observer, owner);
            write = service.SaveAsync(new(contact, 1, [new ReplaceContactProfile(Person with { FullName = "After" }),
                new ReplaceContactEmail(1, "after@example.test"), new ReplaceContactPhone(1, new("+527773123456"), Extension: "After"),
                new ReplaceContactWebLink(1, new("https://example.test/after")), new ReplaceContactAddress(1, new(Address1: "After"))]));
            await Blocked(observer, readerId);
            Assert.IsFalse(write.IsCompleted);
        } finally {
            await Release(observer, gate);
            try { if (read is not null) await read; }
            finally { try { if (write is not null) await write; } finally { await db.ExecuteAsync(original); } }
        }
        var before = await read!;
        Assert.AreEqual(1, before.EntityVersion);
        Assert.AreEqual(Person.FullName, before.Profile.FullName);
        Assert.AreEqual("before@example.test", before.Emails.Single().Email);
        Assert.AreEqual("Before", before.Addresses.Single().Address.Address1);
        var after = await service.ReadCurrentAsync(contact);
        Assert.AreEqual(2, after.EntityVersion);
        Assert.AreEqual("After", after.Profile.FullName);
        Assert.AreEqual("after@example.test", after.Emails.Single().Email);
        Assert.AreEqual("After", after.Phones.Single().Extension);
        Assert.AreEqual("https://example.test/after", after.WebLinks.Single().Url);
        Assert.AreEqual("After", after.Addresses.Single().Address.Address1);
    }
    private static string GateSql(string gate) => $"SET NOCOUNT ON; DECLARE @service_gate INT; EXEC @service_gate=sys.sp_getapplock @Resource=N'{gate}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @service_gate<0 THROW 52900,'Service gate timed out.',1;";
    private static async Task<int> Hold(SqlConnection observer, string gate) {
        using var command = new SqlCommand($"DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=N'{gate}',@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0; IF @r<0 THROW 52900,'Cannot acquire gate.',1; SELECT @@SPID;", observer);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }
    private static async Task Release(SqlConnection observer, string gate) {
        using var command = new SqlCommand($"EXEC sys.sp_releaseapplock @Resource=N'{gate}',@LockOwner='Session';", observer);
        await command.ExecuteNonQueryAsync();
    }
    private static async Task<int> Blocked(SqlConnection observer, int blocker) {
        var deadline = DateTime.UtcNow.AddSeconds(12);
        while (DateTime.UtcNow < deadline) {
            using var command = new SqlCommand("SELECT TOP(1) session_id FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id=@blocker;", observer);
            command.Parameters.AddWithValue("@blocker", blocker);
            var value = await command.ExecuteScalarAsync();
            if (value is not null && value is not DBNull) return Convert.ToInt32(value);
            await Task.Delay(50);
        }
        throw new AssertFailedException($"No actual blocked request behind owned session {blocker}.");
    }
}
