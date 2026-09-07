using System.Data;
using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

[TestClass, TestCategory("Infrastructure")]
public sealed class PhoneParsingTests
{
    [TestMethod]
    public void InternationalNationalSplitAndInvalidPhoneInputs() {
        var full = PhoneParser.Parse(new("+52 777 312-3456"));
        var national = PhoneParser.Parse(new("7773123456", "MX"));
        var split = PhoneParser.Parse(new("312-3456", "MX", "777"));
        Assert.AreEqual("+527773123456", full.E164);
        Assert.AreEqual(full.E164, national.E164);
        Assert.AreEqual(full.E164, split.E164);
        Assert.AreEqual("777", split.AreaCode);
        Assert.AreEqual("3123456", split.SubscriberNumber);
        Assert.AreEqual("312-3456", split.RawInput);
        Assert.AreEqual("MX", split.NumberingRegion);
        Assert.AreEqual("+442079460018", PhoneParser.Parse(new("020 7946 0018", "GB")).E164);
        Assert.AreEqual("+390236618300", PhoneParser.Parse(new("+39 02 3661 8300")).E164);
        Assert.IsTrue(PhoneParser.Parse(new("+39 02 3661 8300")).NationalNumber.StartsWith('0'));
        Assert.AreEqual("CA", PhoneParser.Parse(new("+1 416 555 0123")).NumberingRegion);
        Assert.IsNull(PhoneParser.Parse(new("+800 1234 5678")).NumberingRegion);
        foreach (var invalid in new PhoneInput[] {
            new("312-3456", "MX"), new("7773123456"), new("+52 1 7773123456"),
            new("+527773123456 ext 204"), new("call +527773123456"), new("+52７773123456"),
            new("+527773123456", "MX", "777"), new("7773123456", "ZZ"), new("+1234567890123456"),
            new("911", "MX"), new("+44 02079460018") })
            Assert.ThrowsExactly<ArgumentException>(() => PhoneParser.Parse(invalid), invalid.ToString());
    }
}

internal static class PhoneCases
{
    private static readonly Guid Actor = Guid.Parse(SqlScenarios.actor);
    private static readonly PhoneInput Input = new("+52 777 312-3456");
    private static string Data(PhoneInput input) => PhoneParser.PrepareForDatabase(input);

    private static async Task<Guid> Create(AuditDatabase db) {
        var key = Guid.NewGuid();
        await db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{key}',@created_by='{Actor}',@full_name=N'Phone fixture';");
        return key;
    }

    internal static async Task Lifecycle(AuditDatabase db) {
        var contact = await Create(db);
        var reader = new SqlContactChannelsReader(db.ConnectionString);
        PhoneWriteResult first;
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "first@example.test");
            first = await unit.InsertPhoneAsync(contact, 1, Input, "Desk", new string('x', 25), true);
            var second = await unit.InsertPhoneAsync(contact, 1, new("312-3456", "MX", "777"), "Branch", "204");
            Assert.AreEqual(first.PhoneId, second.PhoneId);
            Assert.AreEqual(2, second.EntityVersion);
            await unit.MakePhonePrincipalAsync(contact, 1, second.Ordinal);
            await unit.InsertEmailAsync(contact, 1, "second@example.test");
            await unit.CommitAsync();
        }
        var r2 = await reader.ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
        CollectionAssert.AreEqual(new[] { "email", "phone", "phone", "phone", "email" }, r2.Actions.Select(a => a.Family).ToArray());
        Assert.AreEqual(5, r2.Actions.Select(a => a.ActionOrdinal).Distinct().Count());
        CollectionAssert.AreEqual(new[] { 2, 1 }, r2.Phones.Select(p => p.Ordinal).ToArray());
        Assert.AreEqual(new string('x', 25), r2.Phones[1].Extension);
        Assert.AreEqual("312-3456", r2.Phones[0].Phone.RawInput);
        Assert.AreEqual(2, r2.PhoneDifferences.Count);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            var noop = await unit.UpdatePhoneAsync(contact, 2, first.Ordinal, Input, "Desk", new string('x', 25), true);
            Assert.IsNull(noop.DbrowVersion);
            Assert.AreEqual(2, noop.EntityVersion);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.UpdatePhoneAsync(contact, 2, first.Ordinal, new("+527773123456"), extension: "204 ");
            await unit.UpdatePhoneAsync(contact, 2, first.Ordinal, Input, "Desk", new string('x', 25), true);
            await unit.MovePhoneAsync(contact, 2, first.Ordinal, 1);
            await unit.MovePhoneAsync(contact, 2, first.Ordinal, 2);
            await unit.CommitAsync();
        }
        var r3 = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual(0, r3.PhoneDifferences.Count);
        Assert.AreEqual(4, r3.PhoneActions.Count);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.DeletePhoneAsync(contact, 3, 2);
            await unit.UpdatePhoneAsync(contact, 3, 1, Input); // Clear label/extension/public.
            await unit.CommitAsync();
        }
        var r4 = await reader.ReadAsync(contact, Actor, 4, compareEntityVersion: 3);
        Assert.AreEqual(1, r4.Phones.Count);
        Assert.IsTrue(r4.Phones[0].IsPrincipal);
        Assert.IsNull(r4.Phones[0].Extension);
        Assert.IsNull(r4.Phones[0].Location);
        Assert.IsFalse(r4.Phones[0].IsPublic);
        Assert.AreEqual("delete", r4.PhoneDifferences.Single(d => d.Ordinal == 2).Operation);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestorePhoneAsync(contact, 4, 2, Input, extension: "204");
            var ephemeral = await unit.InsertPhoneAsync(contact, 4, Input);
            await unit.DeletePhoneAsync(contact, 4, ephemeral.Ordinal);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestorePhoneAsync(contact, 5, 3, Input);
            await unit.DeletePhoneAsync(contact, 5, 3);
            var next = await unit.InsertPhoneAsync(contact, 5, Input);
            Assert.AreEqual(4, next.Ordinal);
            await unit.CommitAsync();
        }
        var r6 = await reader.ReadAsync(contact, Actor, 6, compareEntityVersion: 5);
        CollectionAssert.AreEqual(new[] { 1, 2, 4 }, r6.Phones.Select(p => p.Ordinal).ToArray());
        Assert.AreEqual(3, r6.PhoneActions.Count);
        Assert.AreEqual(1, r6.PhoneDifferences.Count);
        Assert.AreEqual(2, (await reader.ReadAsync(contact, Actor, 2)).Phones.Count);
        await db.ExecuteAsync($$"""
            DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{contact}}');
            IF EXISTS (SELECT 1 FROM contacts.contact_phone_history WHERE contact_id=@id AND ordinal=3)
                THROW 52000,'Ephemeral child invented final history.',1;
            IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id IN
                (OBJECT_ID('contacts.contact_phone'),OBJECT_ID('contacts.contact_phone_history'),OBJECT_ID('contacts.contact_phone_action'))
                AND (is_disabled=1 OR is_not_trusted=1)) THROW 52000,'Phone foreign keys are not checked.',1;
            IF (SELECT phone_number FROM contacts.contact_view WHERE contact_id=@id)<>'+527773123456'
                THROW 52000,'Current phone summary lost saved principal.',1;
            """);
    }

    internal static async Task RejectionRollback(AuditDatabase db) {
        var contact = await Create(db);
        foreach (var invalid in new PhoneInput[] { new("3123456", "MX"), new("+527773123456 ext 2"), new("7773123456") }) {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertPhoneAsync(contact, 1, invalid));
            Assert.IsNull(unit.DbrowVersion);
            await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => unit.CommitAsync());
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertPhoneAsync(contact, 1, Input);
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertEmailAsync(contact, 1, new string('a', 257)));
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertPhoneAsync(contact, 1, Input, extension: new string('e', 26)));
        }
        var revision = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(contact, Actor, 1);
        Assert.AreEqual(0, revision.Phones.Count);
        Assert.AreEqual(0, revision.EmailRevision.Emails.Count);
        await db.ExecuteAsync($$"""
            DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{contact}}');
            IF (SELECT entity_version FROM entities.entity WHERE entity_id=@id)<>1
                OR EXISTS (SELECT 1 FROM contacts.contact_phone_identity WHERE contact_id=@id)
                OR EXISTS (SELECT 1 FROM contacts.contact_email_identity WHERE contact_id=@id)
                OR EXISTS (SELECT 1 FROM contacts.contact_phone_action WHERE contact_id=@id)
                THROW 52000,'Rejected Save left aggregate/child evidence.',1;
            """);
    }

    internal static async Task ConstructorPermissions(AuditDatabase db) {
        var contact = Guid.NewGuid();
        await using var connection = new SqlConnection(db.ConnectionString);
        await connection.OpenAsync();
        using (var command = new SqlCommand($"EXEC contacts.contact_insert @public_key='{contact}',@created_by='{Actor}',@full_name=N'Phone creation',@phone_data=@data,@phone_location_name=@location,@phone_extension=@extension,@email_address=N'initial@example.test',@address1=N'Address must not identify phone',@city=N'Other city',@country=N'Other country';", connection)) {
            command.Parameters.Add("@data", SqlDbType.NVarChar, -1).Value = Data(Input);
            command.Parameters.Add("@location", SqlDbType.NVarChar, -1).Value = new string('L', 100);
            command.Parameters.Add("@extension", SqlDbType.NVarChar, -1).Value = new string('E', 25);
            await command.ExecuteNonQueryAsync();
        }
        var revision = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(contact, Actor, 1);
        Assert.AreEqual("MX", revision.Phones.Single().Phone.NumberingRegion);
        Assert.AreEqual(1, revision.EmailRevision.Emails.Count);
        Assert.AreEqual(new string('E', 25), revision.Phones.Single().Extension);
        Assert.AreEqual(new string('L', 100), revision.Phones.Single().Location);
        var user = Guid.NewGuid();
        using (var command = new SqlCommand($"EXEC security.user_insert @public_key='{user}',@created_by='{Actor}',@full_name=N'Phone user',@login_name=N'phone-user',@phone_data=@data,@phone_location_name=@location,@phone_extension=@extension;", connection)) {
            command.Parameters.Add("@data", SqlDbType.NVarChar, -1).Value = Data(Input);
            command.Parameters.Add("@location", SqlDbType.NVarChar, -1).Value = new string('L', 100);
            command.Parameters.Add("@extension", SqlDbType.NVarChar, -1).Value = new string('E', 25);
            await command.ExecuteNonQueryAsync();
        }
        var userRevision = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(user, Actor, 1);
        Assert.AreEqual(new string('E', 25), userRevision.Phones.Single().Extension);
        Assert.AreEqual(new string('L', 100), userRevision.Phones.Single().Location);
        Assert.AreEqual(4, userRevision.EmailRevision.EntityTypeId);
        var validData = Data(Input);
        string Changed(string property, JsonNode value) {
            var data = JsonNode.Parse(validData)!.AsObject();
            data[property] = value;
            return data.ToJsonString();
        }
        foreach (var badData in new[] {
            "{}", "not-json", Changed("e164", JsonValue.Create("+527773123457")!),
            Changed("numbering_region", JsonValue.Create("MEXICOLONG")!),
            Changed("country_calling_code", JsonValue.Create(52)!),
            validData[..^1] + ",\"e164\":\"+527773123456\"}" }) {
            Assert.AreNotEqual(validData, badData, "Invalid-input fixture must actually change the payload.");
            using var command = new SqlCommand($"""
                BEGIN TRAN;
                EXEC data.audit_unit_begin;
                BEGIN TRY
                    EXEC contacts.contact_email_insert @contact_public_key='{contact}',@created_by='{Actor}',
                        @expected_entity_version=1,@email_address=N'rolled-back-sql@example.test';
                    EXEC contacts.contact_phone_change @operation='insert',@contact_public_key='{contact}',
                        @actor='{Actor}',@expected_entity_version=1,@phone_data=@data;
                    THROW 52000,'Malformed interpretation was accepted.',1;
                END TRY
                BEGIN CATCH
                    IF XACT_STATE()<>0 ROLLBACK;
                    IF ERROR_NUMBER()<>51700 THROW;
                END CATCH;
                """, connection);
            command.Parameters.Add("@data", SqlDbType.NVarChar, -1).Value = badData;
            await command.ExecuteNonQueryAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertPhoneAsync(contact, 0, Input));
            Assert.AreEqual(51206, error.Number);
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Guid.NewGuid())) {
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertPhoneAsync(contact, 1, Input));
        }
        var unchanged = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(contact, Actor, 1);
        Assert.AreEqual(1, unchanged.Phones.Count);
        Assert.AreEqual(1, unchanged.EmailRevision.Emails.Count);
        await db.ExecuteAsync("CREATE USER channels_app WITHOUT LOGIN; ALTER ROLE contact_channels_runtime ADD MEMBER channels_app;");
        foreach (var proc in new[] { "contact_phone_write", "contact_phone_read_rows", "contact_email_read_rows", "contact_channels_read_core", "phone_values_ensure" }) {
            await db.ExecuteAsync($$"""
                EXECUTE AS USER='channels_app';
                BEGIN TRY
                    EXEC contacts.{{proc}};
                    THROW 52000,'Private component was executable.',1;
                END TRY
                BEGIN CATCH
                    IF ERROR_NUMBER()<>229 THROW;
                END CATCH;
                REVERT;
                """);
        }
        await db.ExecuteAsync($$"""
            EXECUTE AS USER='channels_app';
            EXEC contacts.contact_channels_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=1;
            EXEC contacts.contact_phone_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=1;
            REVERT;
            EXECUTE AS USER='email_app';
            BEGIN TRY
                EXEC contacts.contact_phone_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=1;
                THROW 52000,'Email-only role gained phone capability.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>229 THROW;
            END CATCH;
            REVERT;
            BEGIN TRAN;
            BEGIN TRY
                EXEC contacts.contact_channels_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=1;
                THROW 52000,'Composed reader accepted ambient transaction.',1;
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
            await unit.InsertPhoneAsync(contact, 1, Input, extension: "before");
            await unit.CommitAsync();
        }
        var component = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "ProductionSql", "Contacts", "Phones", "create_contact_phone_read_rows.sql"));
        const string rendezvous = "phone_reader_test_boundary";
        // Test-only scheduling gate at the first phone component statement, after email results.
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
                await unit.UpdatePhoneAsync(contact, 2, 1, Input, extension: "after");
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
        Assert.AreEqual("before", before.Phones.Single().Extension);
        Assert.AreEqual("before@example.test", before.EmailRevision.Emails.Single().Email);
        var after = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual("after", after.Phones.Single().Extension);
        Assert.AreEqual("after@example.test", after.EmailRevision.Emails.Single().Email);
        CollectionAssert.AreEqual(new[] { "phone", "email" }, after.Actions.Select(a => a.Family).ToArray());
    }

    internal static async Task CatalogConcurrency(AuditDatabase db) {
        var contactA = await Create(db);
        var contactB = await Create(db);
        var contactC = await Create(db);
        await using var holder = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
        var held = await holder.InsertPhoneAsync(contactA, 1, Input);
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
            var result = await unit.InsertPhoneAsync(contactB, 1, new("7773123456", "MX"));
            await unit.CommitAsync();
            return result;
        });
        try {
            await WaitForBlockedSession(observer, sessionId);
            await using var distinct = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await distinct.InsertPhoneAsync(contactC, 1, new("+44 20 7946 0018")).WaitAsync(TimeSpan.FromSeconds(8));
            await distinct.CommitAsync();
            Assert.IsFalse(contender.IsCompleted, "Equivalent number escaped uncommitted canonical value protection.");
        } finally {
            await holder.CommitAsync();
            await contender;
        }
        Assert.AreEqual(held.PhoneId, (await contender).PhoneId);
        await db.ExecuteAsync($$"""
            IF (SELECT COUNT(*) FROM contacts.phone WHERE e164='+527773123456')<>1
                THROW 52000,'Concurrent canonical phone creation duplicated the value.',1;
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
