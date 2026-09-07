using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class WebLinkCases
{
    internal static readonly Guid Actor = Guid.Parse(SqlScenarios.actor);
    private static readonly WebLinkInput Input = new("https://example.test/Profile?a=1&b=%2f#Bio", "website", "Original");
    private static async Task<Guid> Create(AuditDatabase db) {
        var key = Guid.NewGuid();
        await db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{key}',@created_by='{Actor}',@full_name=N'Web-link fixture';");
        return key;
    }
    internal static async Task Lifecycle(AuditDatabase db) {
        var contact = await Create(db);
        var other = await Create(db);
        var reader = new SqlContactChannelsReader(db.ConnectionString);
        var label = new string('L', 99) + " ";
        var input = Input with { DisplayText = new string('D', 255) + " ", LinkType = new string('t', 50) };
        WebLinkWriteResult first;
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "web@example.test");
            first = await unit.InsertWebLinkAsync(contact, 1, input, label, true);
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            var second = await unit.InsertWebLinkAsync(contact, 1, Input, "Other");
            Assert.AreEqual(first.WebLinkId, second.WebLinkId);
            await unit.MakeWebLinkPrincipalAsync(contact, 1, second.Ordinal);
            await unit.CommitAsync();
        }
        var r2 = await reader.ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
        CollectionAssert.AreEqual(new[] { "email", "web_link", "phone", "web_link", "web_link" }, r2.Actions.Select(a => a.Family).ToArray());
        Assert.AreEqual(5, r2.Actions.Select(a => a.ActionOrdinal).Distinct().Count());
        CollectionAssert.AreEqual(new[] { 2, 1 }, r2.WebLinks.Select(w => w.Ordinal).ToArray());
        Assert.AreEqual(label, r2.WebLinks[1].Location);
        Assert.AreEqual(input.DisplayText, r2.WebLinks[1].DisplayText);
        Assert.AreEqual(input.LinkType, r2.WebLinks[1].LinkType);
        Assert.IsTrue(r2.WebLinks[1].IsPublic);
        Assert.AreEqual(2, r2.WebLinkDifferences.Count);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            var noop = await unit.UpdateWebLinkAsync(contact, 2, 1, input, label, true);
            Assert.IsNull(noop.DbrowVersion);
            Assert.AreEqual(2, noop.EntityVersion);
            await unit.MoveWebLinkAsync(contact, 2, 1, 2);
            Assert.IsNull(unit.DbrowVersion);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.UpdateWebLinkAsync(contact, 2, 1, input with { DisplayText = input.DisplayText.TrimEnd() }, label, true);
            await unit.UpdateWebLinkAsync(contact, 2, 1, input, label, true);
            await unit.MoveWebLinkAsync(contact, 2, 1, 1);
            await unit.MoveWebLinkAsync(contact, 2, 1, 2);
            await unit.CommitAsync();
        }
        var r3 = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual(0, r3.WebLinkDifferences.Count);
        Assert.AreEqual(4, r3.WebLinkActions.Count);
        Assert.AreEqual(input.DisplayText.TrimEnd(), r3.WebLinkActions[0].DisplayText);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.DeleteWebLinkAsync(contact, 3, 2);
            await unit.UpdateWebLinkAsync(contact, 3, 1, new(Input.Url));
            await unit.CommitAsync();
        }
        var r4 = await reader.ReadAsync(contact, Actor, 4, compareEntityVersion: 3);
        var surviving = r4.WebLinks.Single();
        Assert.IsTrue(surviving.IsPrincipal);
        Assert.IsNull(surviving.DisplayText);
        Assert.IsNull(surviving.LinkType);
        Assert.IsNull(surviving.Location);
        Assert.IsFalse(surviving.IsPublic);
        Assert.AreEqual("update", r4.WebLinkDifferences.Single(w => w.Ordinal == 1).Operation);
        Assert.AreEqual("delete", r4.WebLinkDifferences.Single(w => w.Ordinal == 2).Operation);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestoreWebLinkAsync(contact, 4, 2, Input);
            var ephemeral = await unit.InsertWebLinkAsync(contact, 4, Input);
            await unit.DeleteWebLinkAsync(contact, 4, ephemeral.Ordinal);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestoreWebLinkAsync(contact, 5, 3, Input);
            await unit.DeleteWebLinkAsync(contact, 5, 3);
            var next = await unit.InsertWebLinkAsync(contact, 5, Input);
            Assert.AreEqual(4, next.Ordinal);
            await unit.CommitAsync();
        }
        var r6 = await reader.ReadAsync(contact, Actor, 6, compareEntityVersion: 5);
        CollectionAssert.AreEqual(new[] { 1, 2, 4 }, r6.WebLinks.Select(w => w.Ordinal).ToArray());
        Assert.AreEqual(1, r6.WebLinkDifferences.Count);
        Assert.AreEqual(3, r6.WebLinkActions.Count);
        var standalone = await new SqlContactWebLinkReader(db.ConnectionString).ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
        CollectionAssert.AreEqual(r2.WebLinks.ToArray(), standalone.WebLinks.ToArray());
        CollectionAssert.AreEqual(r2.WebLinkDifferences.ToArray(), standalone.Differences.ToArray());
        CollectionAssert.AreEqual(r2.WebLinkActions.ToArray(), standalone.Actions.ToArray());
        var variants = new[] { Input.Url, Input.Url.Replace("Profile", "profile"), Input.Url.Replace("%2f", "%2F"),
            Input.Url.Replace("a=1&b=%2f", "b=%2f&a=1"), Input.Url.Replace("#Bio", "#bio"),
            "https://example.test", "https://example.test/", "https://example.test:443/", "https://example.test/á/😀" };
        var ids = new HashSet<int>();
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            foreach (var url in variants) {
                var result = await unit.InsertWebLinkAsync(other, 1, new(url));
                Assert.IsTrue(ids.Add(result.WebLinkId), "Meaningful URL differences collapsed.");
                if (url == Input.Url) Assert.AreEqual(first.WebLinkId, result.WebLinkId);
            }
            await unit.CommitAsync();
        }
        CollectionAssert.AreEqual(variants, (await reader.ReadAsync(other, Actor, 2)).WebLinks.Select(w => w.Url).ToArray());
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.UpdateWebLinkAsync(contact, 6, 1, new("https://changed.test/", DisplayText: ""), "");
            await unit.CommitAsync();
        }
        var r7 = await reader.ReadAsync(contact, Actor, 7, compareEntityVersion: 6);
        var changed = r7.WebLinkDifferences.Single();
        Assert.AreEqual(Input.Url, changed.OldUrl);
        Assert.AreEqual("https://changed.test/", changed.Url);
        Assert.AreEqual("", changed.DisplayText);
        Assert.AreEqual("", changed.Location);
        Assert.AreEqual(Input.Url, (await reader.ReadAsync(contact, Actor, 6)).WebLinks[0].Url);
        Assert.AreEqual(Input.Url, (await reader.ReadAsync(other, Actor, 2)).WebLinks[0].Url);
        await db.ExecuteAsync($$"""
            DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{contact}}');
            IF EXISTS (SELECT 1 FROM contacts.contact_web_link_history WHERE contact_id=@id AND ordinal=3)
                THROW 52000,'Ephemeral web link invented final history.',1;
            IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id IN
                (OBJECT_ID('contacts.contact_web_link'),OBJECT_ID('contacts.contact_web_link_history'),OBJECT_ID('contacts.contact_web_link_action'))
                AND (is_disabled=1 OR is_not_trusted=1)) THROW 52000,'Web-link foreign keys are not checked.',1;
            """);
    }

    internal static async Task RejectionRollback(AuditDatabase db) {
        var contact = await Create(db);
        foreach (var input in new[] { new WebLinkInput("javascript:alert(1)"), new("https://u:p@example.test"),
            new("https://example.test/%zz"), new("https://example.test", "Website"),
            new("https://example.test", DisplayText: new string('d', 257)), new("https://example.test/" + new string('x', 2048)) }) {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertWebLinkAsync(contact, 1, input));
            Assert.IsNull(unit.DbrowVersion);
            await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => unit.CommitAsync());
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertWebLinkAsync(contact, 1, Input, new string('l', 101)));
            Assert.AreEqual(51801, error.Number);
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertWebLinkAsync(contact, 1, Input);
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertEmailAsync(contact, 1, new string('e', 257)));
        }
        foreach (var args in new[] { "@url=N'javascript:alert(1)'", "@url=N'https://user@example.test'",
            "@url=N'https://example.test/%zz'", "@url=N'https://example.test ',@link_type=N'website'",
            "@url=N'https://example.test',@link_type=N'Website'", "@url=N'https://example.test',@display_text=@long" }) {
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($$"""
                DECLARE @long NVARCHAR(MAX)=REPLICATE(N'd',257);
                EXEC contacts.contact_web_link_change @operation='insert',@contact_public_key='{{contact}}',
                    @actor='{{Actor}}',@expected_entity_version=1,{{args}};
                """));
            Assert.IsTrue(error.Number is 51800 or 51817 or 51819);
        }
        var unchanged = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(contact, Actor, 1);
        Assert.AreEqual(0, unchanged.WebLinks.Count + unchanged.Phones.Count + unchanged.EmailRevision.Emails.Count);
        await db.ExecuteAsync($$"""
            IF (SELECT entity_version FROM entities.entity WHERE public_key='{{contact}}')<>1
                THROW 52000,'Failed mixed save advanced root.',1;
            IF EXISTS (SELECT 1 FROM contacts.web_link) THROW 52000,'Failed writes leaked immutable URL values.',1;
            """);
    }

    internal static async Task ConstructorPermissions(AuditDatabase db) {
        var contact = Guid.NewGuid();
        var user = Guid.NewGuid();
        foreach (var isUser in new[] { false, true }) {
            var key = isUser ? user : contact;
            await db.ExecuteAsync($$"""
                DECLARE @url NVARCHAR(MAX)=N'https://example.test/'+REPLICATE(N'x',2027),
                    @label NVARCHAR(MAX)=REPLICATE(N'L',99)+N' ', @display NVARCHAR(MAX)=REPLICATE(N'D',255)+N' ',
                    @type NVARCHAR(MAX)=REPLICATE(N't',50);
                EXEC {{(isUser ? "security.user_insert" : "contacts.contact_insert")}}
                    @public_key='{{key}}',@created_by='{{Actor}}',@full_name=N'Web-link construction',
                    {{(isUser ? "@login_name=N'web-user',@email=N'account@example.test'," : "@email_address=N'contact@example.test',")}}
                    @web_link_url=@url,@web_link_type=@type,@web_link_location_name=@label,
                    @web_link_display_text=@display,@web_link_is_public=1;
                """);
            var constructed = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(key, Actor, 1);
            Assert.AreEqual(1, constructed.EmailRevision.Emails.Count);
            var link = constructed.WebLinks.Single();
            Assert.AreEqual(2048, link.Url.Length);
            Assert.AreEqual(256, link.DisplayText!.Length);
            Assert.AreEqual(100, link.Location!.Length);
            Assert.AreEqual(50, link.LinkType!.Length);
            Assert.IsTrue(link.IsPublic);
            Assert.AreEqual(constructed.DbrowVersion, link.DbrowVersion);
            Assert.IsFalse(constructed.WebLinkActions.Single().ShowInTimeline);
        }
        var promotion = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($$"""
            EXEC security.user_insert @public_key='{{contact}}',@created_by='{{Actor}}',@full_name=NULL,
                @login_name=N'promotion',@expected_entity_version=1,@web_link_is_public=0;
            """));
        Assert.AreEqual(51606, promotion.Number);
        var orphan = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($$"""
            EXEC contacts.contact_insert @created_by='{{Actor}}',@full_name=N'Orphan',@web_link_type=N'website';
            """));
        Assert.AreEqual(51818, orphan.Number);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertWebLinkAsync(contact, 0, Input));
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Guid.NewGuid())) {
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertWebLinkAsync(contact, 1, Input));
        }
        await db.ExecuteAsync("CREATE USER web_app WITHOUT LOGIN; ALTER ROLE contact_channels_runtime ADD MEMBER web_app;");
        foreach (var proc in new[] { "contact_web_link_write", "contact_web_link_history_sync", "contact_web_link_read_rows", "web_link_values_ensure", "contact_channels_read_core" })
            await db.ExecuteAsync($$"""
                EXECUTE AS USER='web_app';
                BEGIN TRY
                    EXEC contacts.{{proc}};
                    THROW 52000,'Private component was executable.',1;
                END TRY
                BEGIN CATCH
                    IF ERROR_NUMBER()<>229 THROW;
                END CATCH;
                REVERT;
                """);
        await db.ExecuteAsync($$"""
            EXECUTE AS USER='web_app';
            EXEC contacts.contact_web_link_insert @contact_public_key='{{contact}}',@actor='{{Actor}}',
                @expected_entity_version=1,@url=N'https://example.test/runtime',@is_public=0;
            EXEC contacts.contact_web_link_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
            EXEC contacts.contact_channels_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
            BEGIN TRY
                SELECT * FROM contacts.web_link;
                THROW 52000,'Direct catalog access was permitted.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>229 THROW;
            END CATCH;
            REVERT;
            EXECUTE AS USER='email_app';
            BEGIN TRY
                EXEC contacts.contact_web_link_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
                THROW 52000,'Email role gained web links.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>229 THROW;
            END CATCH;
            REVERT;
            BEGIN TRAN;
            BEGIN TRY
                EXEC contacts.contact_web_link_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
                THROW 52000,'Web-link reader accepted ambient transaction.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>51400 THROW;
            END CATCH;
            IF XACT_STATE()<>0 ROLLBACK;
            """);
    }

    internal static async Task ReaderConcurrency(AuditDatabase db) {
        var contact = await Create(db);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "before@example.test");
            await unit.InsertWebLinkAsync(contact, 1, Input with { DisplayText = "before" });
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"), extension: "before");
            await unit.CommitAsync();
        }
        var component = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "ProductionSql", "Contacts", "WebLinks", "create_contact_web_link_read_rows.sql"));
        const string rendezvous = "web_link_reader_test_boundary";
        // Test-only scheduling gate at the first web_link component statement, after email results.
        // The root barrier, bounds and family queries are the actual production implementation.
        var instrumented = component.Replace("SET NOCOUNT ON;", $"""
            SET NOCOUNT ON;
            DECLARE @gate INT;
            EXEC @gate=sys.sp_getapplock @Resource=N'{rendezvous}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
            IF @gate<0 THROW 52000,'Reader scheduling gate timed out.',1;
            """);
        await db.ExecuteAsync(instrumented);
        await using var observer = new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        using var getId = new SqlCommand($"DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=N'{rendezvous}',@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0; IF @r<0 THROW 52000,'Cannot acquire reader test gate.',1; SELECT @@SPID;", observer);
        var observerId = Convert.ToInt32(await getId.ExecuteScalarAsync());
        var reader = new SqlContactChannelsReader(db.ConnectionString);
        Task<ContactChannelsRevision>? pendingRead = null;
        Task? pendingWrite = null;
        try {
            pendingRead = reader.ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
            var readerId = await WaitForBlockedSession(observer, observerId);
            pendingWrite = Task.Run(async () => {
                await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
                await unit.UpdateWebLinkAsync(contact, 2, 1, Input with { DisplayText = "after" });
                await unit.UpdatePhoneAsync(contact, 2, 1, new("+527773123456"), extension: "after");
                await unit.UpdateEmailAsync(contact, 2, 1, "after@example.test");
                await unit.CommitAsync();
            });
            await WaitForBlockedSession(observer, readerId);
            Assert.IsFalse(pendingWrite.IsCompleted, "Writer crossed the composed reader's root barrier.");
        } finally {
            using var release = new SqlCommand($"EXEC sys.sp_releaseapplock @Resource=N'{rendezvous}',@LockOwner='Session';", observer);
            await release.ExecuteNonQueryAsync();
            // Observe every participant before database cleanup, also on assertion failure.
            try { if (pendingRead is not null) await pendingRead; }
            finally {
                try { if (pendingWrite is not null) await pendingWrite; }
                finally { await db.ExecuteAsync(component); }
            }
        }
        var before = await pendingRead!;
        Assert.AreEqual("before", before.WebLinks.Single().DisplayText);
        Assert.AreEqual("before", before.Phones.Single().Extension);
        Assert.AreEqual("before@example.test", before.EmailRevision.Emails.Single().Email);
        var after = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual("after", after.WebLinks.Single().DisplayText);
        Assert.AreEqual("after", after.Phones.Single().Extension);
        Assert.AreEqual("after@example.test", after.EmailRevision.Emails.Single().Email);
        CollectionAssert.AreEqual(new[] { "web_link", "phone", "email" }, after.Actions.Select(a => a.Family).ToArray());
    }

    internal static async Task CatalogConcurrency(AuditDatabase db) {
        var contactA = await Create(db);
        var contactB = await Create(db);
        var contactC = await Create(db);
        await using var holder = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
        var held = await holder.InsertWebLinkAsync(contactA, 1, Input);
        await using var observer = new SqlConnection(db.ConnectionString);
        await observer.OpenAsync();
        // Locate this unit through its unique provisional ledger value in the owned database.
        using var holderId = new SqlCommand("SELECT allocation_transaction_id FROM data.dbrow_version WITH (READUNCOMMITTED) WHERE dbrow_version=@version;", observer);
        holderId.Parameters.AddWithValue("@version", held.DbrowVersion);
        var transactionId = Convert.ToInt64(await holderId.ExecuteScalarAsync());
        using var session = new SqlCommand("SELECT session_id FROM sys.dm_tran_session_transactions WHERE transaction_id=@id;", observer);
        session.Parameters.AddWithValue("@id", transactionId);
        var sessionId = Convert.ToInt32(await session.ExecuteScalarAsync());
        var contender = Task.Run(async () => {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            var result = await unit.InsertWebLinkAsync(contactB, 1, Input with { LinkType = "other", DisplayText = "Other contact" });
            await unit.CommitAsync();
            return result;
        });
        try {
            await WaitForBlockedSession(observer, sessionId);
            await using var distinct = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await distinct.InsertWebLinkAsync(contactC, 1, new("https://unrelated.test/Other")).WaitAsync(TimeSpan.FromSeconds(8));
            await distinct.CommitAsync();
            Assert.IsFalse(contender.IsCompleted, "Equivalent number escaped uncommitted canonical value protection.");
        } finally {
            await holder.CommitAsync();
            await contender;
        }
        Assert.AreEqual(held.WebLinkId, (await contender).WebLinkId);
        await db.ExecuteAsync($$"""
            IF (SELECT COUNT(*) FROM contacts.web_link WHERE url='https://example.test/Profile?a=1&b=%2f#Bio')<>1
                THROW 52000,'Concurrent canonical web_link creation duplicated the value.',1;
            """);
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
