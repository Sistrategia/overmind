using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class AddressCases
{
    internal static readonly Guid Actor = Guid.Parse(SqlScenarios.actor);
    private static readonly AddressInput Input = new(StreetName: "Calle Álamo", ExtNumber: "12", IntNumber: "A",
        ZipCode: "AB 12", References: "Blue door", Country: "Country", State: "State", County: "County", City: "City", Colony: "Colony");
    private static async Task<Guid> Create(AuditDatabase db) {
        var key = Guid.NewGuid();
        await db.ExecuteAsync($"EXEC contacts.contact_insert @public_key='{key}',@created_by='{Actor}',@full_name=N'Address fixture';");
        return key;
    }
    internal static async Task Lifecycle(AuditDatabase db) {
        var contact = await Create(db);
        var other = await Create(db);
        var reader = new SqlContactChannelsReader(db.ConnectionString);
        AddressWriteResult first;
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertEmailAsync(contact, 1, "address@example.test");
            first = await unit.InsertAddressAsync(contact, 1, Input, "Home ", true);
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            await unit.InsertWebLinkAsync(contact, 1, new("https://example.test/"));
            var second = await unit.InsertAddressAsync(contact, 1, Input, "Work");
            Assert.AreEqual(first.AddressId, second.AddressId);
            await unit.MakeAddressPrincipalAsync(contact, 1, second.Ordinal);
            await unit.CommitAsync();
        }
        var r2 = await reader.ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
        CollectionAssert.AreEqual(new[] { "email", "address", "phone", "web_link", "address", "address" }, r2.Actions.Select(a => a.Family).ToArray());
        Assert.AreEqual(6, r2.Actions.Select(a => a.ActionOrdinal).Distinct().Count());
        CollectionAssert.AreEqual(new[] { 2, 1 }, r2.Addresses.Select(a => a.Ordinal).ToArray());
        Assert.AreEqual("Home ", r2.Addresses[1].Location);
        Assert.IsTrue(r2.Addresses[1].IsPublic);
        var value = r2.Addresses[1].Address;
        Assert.AreEqual(Input.StreetName, value.StreetName);
        Assert.AreEqual("AB 12", value.ZipCode);
        Assert.AreEqual(Input.References, value.References);
        Assert.IsTrue(value.CountryId > 0 && value.ColonyId > 0 && value.CountyId > 0);
        // Legacy constructor used to match only lines/postal/city/state/country, ignoring the rest.
        var legacyPartial = Guid.NewGuid();
        await db.ExecuteAsync($$"""
            EXEC contacts.contact_insert @public_key='{{legacyPartial}}',@created_by='{{Actor}}',@full_name=N'Legacy partial',
                @zip_code=N'AB 12',@country=N'Country',@state=N'State',@city=N'City';
            """);
        var partial = (await reader.ReadAsync(legacyPartial, Actor, 1)).Addresses.Single();
        Assert.AreNotEqual(first.AddressId, partial.AddressId);
        Assert.IsNull(partial.Address.StreetName);
        Assert.IsNull(partial.Address.ExtNumber);
        Assert.IsNull(partial.Address.CountyId);
        Assert.IsNull(partial.Address.ColonyId);
        Assert.IsNull(partial.Address.References);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            // Names and explicit consistent IDs identify the same immutable value.
            var inputById = Input with { Country = null, State = null, County = null, City = null, Colony = null,
                ColonyId = value.ColonyId, CountyId = value.CountyId };
            var shared = await unit.InsertAddressAsync(other, 1, inputById);
            Assert.AreEqual(first.AddressId, shared.AddressId);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            var noop = await unit.UpdateAddressAsync(contact, 2, 1, Input, "Home ", true);
            Assert.IsNull(noop.DbrowVersion);
            await unit.MoveAddressAsync(contact, 2, 1, 2);
            Assert.IsNull(unit.DbrowVersion);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.UpdateAddressAsync(contact, 2, 1, Input with { References = "Changed" }, "Home ", true);
            await unit.UpdateAddressAsync(contact, 2, 1, Input, "Home ", true);
            await unit.MoveAddressAsync(contact, 2, 1, 1);
            await unit.MoveAddressAsync(contact, 2, 1, 2);
            await unit.CommitAsync();
        }
        var r3 = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual(0, r3.AddressDifferences.Count);
        Assert.AreEqual(4, r3.AddressActions.Count);
        Assert.AreEqual("Changed", r3.AddressActions[0].Address.References);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.DeleteAddressAsync(contact, 3, 2);
            await unit.UpdateAddressAsync(contact, 3, 1, Input with { ExtNumber = "14" });
            await unit.CommitAsync();
        }
        var r4 = await reader.ReadAsync(contact, Actor, 4, compareEntityVersion: 3);
        Assert.AreEqual("14", r4.Addresses.Single().Address.ExtNumber);
        Assert.IsTrue(r4.Addresses.Single().IsPrincipal);
        Assert.IsNull(r4.Addresses.Single().Location);
        Assert.IsFalse(r4.Addresses.Single().IsPublic);
        Assert.AreEqual("12", (await reader.ReadAsync(other, Actor, 2)).Addresses.Single().Address.ExtNumber);
        Assert.AreEqual("12", (await reader.ReadAsync(contact, Actor, 2)).Addresses[0].Address.ExtNumber);
        Assert.AreEqual("delete", r4.AddressDifferences.Single(a => a.Ordinal == 2).Operation);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestoreAddressAsync(contact, 4, 2, Input);
            var ephemeral = await unit.InsertAddressAsync(contact, 4, Input);
            await unit.DeleteAddressAsync(contact, 4, ephemeral.Ordinal);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.RestoreAddressAsync(contact, 5, 3, Input);
            await unit.DeleteAddressAsync(contact, 5, 3);
            var next = await unit.InsertAddressAsync(contact, 5, Input);
            Assert.AreEqual(4, next.Ordinal);
            await unit.CommitAsync();
        }
        var r6 = await reader.ReadAsync(contact, Actor, 6, compareEntityVersion: 5);
        CollectionAssert.AreEqual(new[] { 1, 2, 4 }, r6.Addresses.Select(a => a.Ordinal).ToArray());
        Assert.AreEqual(1, r6.AddressDifferences.Count);
        Assert.AreEqual(3, r6.AddressActions.Count);
        var standalone = await new SqlContactAddressReader(db.ConnectionString).ReadAsync(contact, Actor, 2, compareEntityVersion: 1);
        CollectionAssert.AreEqual(r2.Addresses.ToArray(), standalone.Addresses.ToArray());
        CollectionAssert.AreEqual(r2.AddressDifferences.ToArray(), standalone.Differences.ToArray());
        CollectionAssert.AreEqual(r2.AddressActions.ToArray(), standalone.Actions.ToArray());
        // Every complete-value field participates: omitted legacy lookup fields cannot collapse.
        var variants = new[] { Input, Input with { StreetName = "Other street" }, Input with { ExtNumber = "13" },
            Input with { IntNumber = "B" }, Input with { Colony = "Other colony" }, Input with { County = "Other county" },
            Input with { References = "Other reference" }, Input with { ZipCode = "AB12" },
            Input with { City = "Other city" }, Input with { State = "Other state" }, Input with { Country = "Other country" },
            new(Address1: "Line", Address2: null), new(Address1: "Line", Address2: ""), new(Address1: "Line", Address2: " "),
            new(Address1: "Line "), new(Address1: "line"), new(Address1: "Line", Address2: "Second"),
            new(Country: "Partial country"), new(ZipCode: "SW1A 1AA") };
        var ids = new HashSet<int>();
        var variantContact = await Create(db);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            foreach (var variant in variants)
                Assert.IsTrue(ids.Add((await unit.InsertAddressAsync(variantContact, 1, variant)).AddressId), "Complete address fields collapsed.");
            await unit.CommitAsync();
        }
        Assert.AreEqual(variants.Length, (await reader.ReadAsync(variantContact, Actor, 2)).Addresses.Count);
        await db.ExecuteAsync($$"""
            DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{contact}}');
            IF EXISTS (SELECT 1 FROM contacts.contact_address_history WHERE contact_id=@id AND ordinal=3)
                THROW 52000,'Ephemeral address invented final history.',1;
            IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id IN
                (OBJECT_ID('contacts.contact_address'),OBJECT_ID('contacts.contact_address_history'),OBJECT_ID('contacts.contact_address_action'),OBJECT_ID('contacts.address'))
                AND (is_disabled=1 OR is_not_trusted=1)) THROW 52000,'Address foreign keys are not checked.',1;
            """);
    }

    internal static async Task Hierarchy(AuditDatabase db) {
        var contact = await Create(db);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertAddressAsync(contact, 1, Input);
            await unit.InsertAddressAsync(contact, 1, Input with { Country = "Second country" });
            await unit.InsertAddressAsync(contact, 1, new(Country: "City-state", City: "City-state"));
            await unit.CommitAsync();
        }
        var reader = new SqlContactChannelsReader(db.ConnectionString);
        var r2 = await reader.ReadAsync(contact, Actor, 2);
        var first = r2.Addresses[0].Address;
        var second = r2.Addresses[1].Address;
        Assert.AreNotEqual(first.CountryId, second.CountryId);
        Assert.AreNotEqual(first.StateId, second.StateId);
        Assert.AreNotEqual(first.CountyId, second.CountyId);
        Assert.AreNotEqual(first.CityId, second.CityId);
        Assert.IsNull(r2.Addresses[2].Address.StateId);
        foreach (var invalid in new[] { new AddressInput(City: "City"), new(State: "State"), new(County: "County"),
            new(Colony: "Colony"), new(CountryId: int.MaxValue, Country: "Country"),
            new(CityId: first.CityId, CountryId: second.CountryId), new(ColonyId: first.ColonyId, CityId: second.CityId),
            new(CityId: first.CityId, CountyId: second.CountyId), new(StateId: first.StateId, State: "Different"),
            new(CityId: r2.Addresses[2].Address.CityId, State: "Cannot guess", Country: "City-state") }) {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertAddressAsync(contact, 2, invalid));
            Assert.AreEqual(51921, error.Number);
        }
        foreach (var table in new[] { "country", "state", "county", "city", "colony", "address", "address_location" }) {
            var assignment = table == "address" ? "[references]=N'Rewritten'" : table == "address_location" ? "location_name=N'Rewritten'" : $"[{table}]=N'Rewritten'";
            if (table == "address_location") {
                await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
                await unit.UpdateAddressAsync(contact, 2, 1, Input, "Immutable label");
                await unit.CommitAsync();
            }
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($"UPDATE contacts.[{table}] SET {assignment};"));
            Assert.AreEqual(51922, error.Number);
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.UpdateAddressAsync(contact, 3, 1, Input with { City = "Corrected city", Colony = "Corrected colony" });
            await unit.CommitAsync();
        }
        Assert.AreEqual("City", (await reader.ReadAsync(contact, Actor, 2)).Addresses[0].Address.City);
        var r4 = await reader.ReadAsync(contact, Actor, 4, compareEntityVersion: 3);
        Assert.AreEqual("Corrected city", r4.Addresses[0].Address.City);
        Assert.AreEqual("City", r4.Addresses[1].Address.City);
        Assert.AreEqual("City", r4.AddressDifferences.Single().OldAddress!.City);
    }

    internal static async Task RejectionRollback(AuditDatabase db) {
        var contact = await Create(db);
        foreach (var invalid in new[] { new AddressInput(), new(Address1: "Line", StreetName: "Street"),
            new(StreetName: "Street", ExtNumber: new string('x', 26)), new(Address1: "Line", ZipCode: new string('x', 33)) }) {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            await unit.InsertWebLinkAsync(contact, 1, new("https://example.test/rollback"));
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertAddressAsync(contact, 1, invalid));
            Assert.IsNull(unit.DbrowVersion);
            await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => unit.CommitAsync());
        }
        foreach (var invalid in new[] { Input with { CountryId = int.MaxValue }, Input with { Country = null } }) {
            await using var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await unit.InsertEmailAsync(contact, 1, "rollback@example.test");
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"));
            await unit.InsertWebLinkAsync(contact, 1, new("https://example.test/rollback"));
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertAddressAsync(contact, 1, invalid));
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor)) {
            await unit.InsertAddressAsync(contact, 1, Input);
            await Assert.ThrowsExactlyAsync<ArgumentException>(() => unit.InsertWebLinkAsync(contact, 1, new("javascript:alert(1)")));
        }
        foreach (var json in new[] { "[]", "{}", "{\"address1 \":\"A\"}", "{\"address1\":true}", "{\"address1\":\"A\",\"address1\":\"B\"}",
            "{\"address1\":\"A\",\"mystery\":1}", "{\"address1\":\"A\",\"city_id\":\"1\"}",
            "{\"address1\":\"A\",\"city_id\":1.5}", "{\"address1\":\"A\",\"street_name\":\"B\"}",
            "{\"address1\":\"A\",\"zip_code\":\"" + new string('z',33) + "\"}" }) {
            await using var connection = new SqlConnection(db.ConnectionString);
            await connection.OpenAsync();
            using var command = new SqlCommand($"EXEC contacts.contact_address_change @operation='insert',@contact_public_key='{contact}',@actor='{Actor}',@expected_entity_version=1,@address_data=@data;", connection);
            command.Parameters.Add("@data", SqlDbType.NVarChar, -1).Value = json;
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => command.ExecuteNonQueryAsync());
            Assert.IsTrue(error.Number is 51900 or 51921 or 51923);
        }
        var unchanged = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(contact, Actor, 1);
        Assert.AreEqual(0, unchanged.Addresses.Count + unchanged.Phones.Count + unchanged.WebLinks.Count + unchanged.EmailRevision.Emails.Count);
        await db.ExecuteAsync("IF EXISTS (SELECT 1 FROM contacts.address) OR EXISTS (SELECT 1 FROM contacts.country) THROW 52000,'Failed address writes leaked values/catalogs.',1;");
    }

    internal static async Task ConstructorPermissions(AuditDatabase db) {
        var contact = Guid.NewGuid();
        var user = Guid.NewGuid();
        var wide = Input with { StreetName = new string('s',256), ExtNumber = new string('e',25), IntNumber = new string('i',25),
            ZipCode = new string('z',32), References = new string('r',256), Country = new string('c',256), State = new string('t',256),
            County = new string('n',256), City = new string('y',256), Colony = new string('l',256) };
        foreach (var isUser in new[] { false, true }) {
            var key = isUser ? user : contact;
            await using var connection = new SqlConnection(db.ConnectionString);
            await connection.OpenAsync();
            using var command = new SqlCommand($$"""
                EXEC {{(isUser ? "security.user_insert" : "contacts.contact_insert")}} @public_key='{{key}}',@created_by='{{Actor}}',
                    @full_name=N'Address construction',{{(isUser ? "@login_name=N'address-user'," : "")}}
                    @address_data=@data,@address_location_name=@label,@address_is_public=1;
                """, connection);
            command.Parameters.Add("@data", SqlDbType.NVarChar, -1).Value = wide.PrepareForDatabase();
            command.Parameters.Add("@label", SqlDbType.NVarChar, -1).Value = new string('L',100);
            await command.ExecuteNonQueryAsync();
            var revision = await new SqlContactChannelsReader(db.ConnectionString).ReadAsync(key, Actor, 1);
            var entry = revision.Addresses.Single();
            Assert.AreEqual(256, entry.Address.StreetName!.Length);
            Assert.AreEqual(256, entry.Address.County!.Length);
            Assert.AreEqual(256, entry.Address.Colony!.Length);
            Assert.AreEqual(25, entry.Address.ExtNumber!.Length);
            Assert.AreEqual(32, entry.Address.ZipCode!.Length);
            Assert.AreEqual(100, entry.Location!.Length);
            Assert.IsTrue(entry.IsPublic);
            Assert.AreEqual(revision.DbrowVersion, entry.DbrowVersion);
            Assert.IsFalse(revision.AddressActions.Single().ShowInTimeline);
        }
        var promotion = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($$"""
            EXEC security.user_insert @public_key='{{contact}}',@created_by='{{Actor}}',@full_name=NULL,
                @login_name=N'promotion',@expected_entity_version=1,@address_is_public=0;
            """));
        Assert.AreEqual(51606, promotion.Number);
        foreach (var args in new[] { "@address_location_name=N'Orphan'", "@address_data=N'{\"address1\":\"A\"}',@address1=N'B'" }) {
            var error = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($"EXEC contacts.contact_insert @created_by='{Actor}',@full_name=N'Reject',{args};"));
            Assert.AreEqual(51918, error.Number);
        }
        var overlong = await Assert.ThrowsExactlyAsync<SqlException>(() => db.ExecuteAsync($$"""
            DECLARE @line NVARCHAR(MAX)=REPLICATE(N'x',257);
            EXEC security.user_insert @created_by='{{Actor}}',@login_name=N'oversized-address',@full_name=N'Reject long address',@address1=@line;
            """));
        Assert.AreEqual(51900, overlong.Number);
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor))
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertAddressAsync(contact, 0, Input));
        await using (var unit = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor, Guid.NewGuid()))
            await Assert.ThrowsExactlyAsync<SqlException>(() => unit.InsertAddressAsync(contact, 1, Input));
        await db.ExecuteAsync("CREATE USER address_app WITHOUT LOGIN; ALTER ROLE contact_channels_runtime ADD MEMBER address_app;");
        foreach (var proc in new[] { "address_values_ensure", "address_geography_resolve", "country_value_ensure", "ensure_address_location_upsert", "contact_address_write", "contact_address_history_sync", "contact_address_read_rows" })
            await db.ExecuteAsync($$"""
                EXECUTE AS USER='address_app';
                BEGIN TRY
                    EXEC contacts.{{proc}};
                    THROW 52000,'Private address component was executable.',1;
                END TRY
                BEGIN CATCH
                    IF ERROR_NUMBER()<>229 THROW;
                END CATCH;
                REVERT;
                """);
        await db.ExecuteAsync($$"""
            EXECUTE AS USER='address_app';
            EXEC contacts.contact_address_insert @contact_public_key='{{contact}}',@actor='{{Actor}}',@expected_entity_version=1,
                @address_data=N'{"address1":"Runtime line","country":"Runtime country","city":"Runtime city"}';
            EXEC contacts.contact_address_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
            EXEC contacts.contact_channels_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
            REVERT;
            EXECUTE AS USER='email_app';
            BEGIN TRY
                EXEC contacts.contact_address_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
                THROW 52000,'Email role gained address capability.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>229 THROW;
            END CATCH;
            REVERT;
            BEGIN TRAN;
            BEGIN TRY
                EXEC contacts.contact_address_read @contact_public_key='{{contact}}',@actor='{{Actor}}',@entity_version=2;
                THROW 52000,'Address reader accepted ambient transaction.',1;
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
            await unit.InsertAddressAsync(contact, 1, Input with { References = "before" });
            await unit.InsertWebLinkAsync(contact, 1, new("https://example.test/before"));
            await unit.InsertPhoneAsync(contact, 1, new("+527773123456"), extension: "before");
            await unit.CommitAsync();
        }
        var component = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "ProductionSql", "Contacts", "Addresses", "create_contact_address_read_rows.sql"));
        const string rendezvous = "address_reader_test_boundary";
        // Test-only scheduling gate at the first address component statement, after email results.
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
                await unit.UpdateAddressAsync(contact, 2, 1, Input with { References = "after" });
                await unit.UpdateWebLinkAsync(contact, 2, 1, new("https://example.test/after"));
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
        Assert.AreEqual("before", before.Addresses.Single().Address.References);
        Assert.AreEqual("before", before.Phones.Single().Extension);
        Assert.AreEqual("https://example.test/before", before.WebLinks.Single().Url);
        Assert.AreEqual("before@example.test", before.EmailRevision.Emails.Single().Email);
        var after = await reader.ReadAsync(contact, Actor, 3, compareEntityVersion: 2);
        Assert.AreEqual("after", after.Addresses.Single().Address.References);
        Assert.AreEqual("after", after.Phones.Single().Extension);
        Assert.AreEqual("https://example.test/after", after.WebLinks.Single().Url);
        Assert.AreEqual("after@example.test", after.EmailRevision.Emails.Single().Email);
        CollectionAssert.AreEqual(new[] { "address", "web_link", "phone", "email" }, after.Actions.Select(a => a.Family).ToArray());
    }

    internal static async Task CatalogConcurrency(AuditDatabase db) {
        var contactA = await Create(db);
        var contactB = await Create(db);
        var contactC = await Create(db);
        await using var holder = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
        var held = await holder.InsertAddressAsync(contactA, 1, Input);
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
            var result = await unit.InsertAddressAsync(contactB, 1, Input, location: "Other contact");
            await unit.CommitAsync();
            return result;
        });
        try {
            await WaitForBlockedSession(observer, sessionId);
            await using var distinct = await SqlAuditUnit.BeginAsync(db.ConnectionString, Actor);
            await distinct.InsertAddressAsync(contactC, 1, new(Address1: "Unrelated road", Country: "Unrelated country")).WaitAsync(TimeSpan.FromSeconds(8));
            await distinct.CommitAsync();
            Assert.IsFalse(contender.IsCompleted, "Equivalent number escaped uncommitted canonical value protection.");
        } finally {
            await holder.CommitAsync();
            await contender;
        }
        Assert.AreEqual(held.AddressId, (await contender).AddressId);
        await db.ExecuteAsync($$"""
            IF (SELECT COUNT(*) FROM contacts.address WHERE street_name=N'Calle Álamo')<>1
                THROW 52000,'Concurrent canonical address creation duplicated the value.',1;
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
