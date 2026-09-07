using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Security;
using Overmind.AuditTests;
using Sistrategia.Data;
using Sistrategia.Data.SqlClient;
using Sistrategia.Overmind.Data.SqlClient;

internal static class SchemaCycle
{
    public static async Task RunAsync(string connectionString) {
        // AuditDatabase supplies a connection to a database created and owned by this scenario.
        // Use the application's real manager, resources, seed batch and transaction runner.
        var manager = new OvermindSqlDatabaseManager(new TestConnectionStringProvider(connectionString),
            NullLogger<Database>.Instance);
        var database = new SqlDatabase(connectionString, NullLogger<Database>.Instance);
        try {
            database.RunLocalStoredAuditCommands(new StringReader("SELECT 1;"));
            throw new Exception("Business runner silently skipped missing enrollment support.");
        } catch (SqlException error) when (error.Number == 2812) { }
        manager.CreateSchema();
        await AssertSeedAsync(connectionString);
        await AssertProvisioningAsync(connectionString);
        await AssertBusinessRunnerAsync(database, connectionString);
        await AssertPrincipalAsync(connectionString);
        await AssertProfileAsync(connectionString);
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                CREATE USER email_deployment_test WITHOUT LOGIN;
                ALTER ROLE email_runtime ADD MEMBER email_deployment_test;
                ALTER ROLE contact_runtime ADD MEMBER email_deployment_test;
                ALTER ROLE provisioning_runtime ADD MEMBER email_deployment_test;
                -- Simulate the removed checkpoint table: drop must still clean up an older dev schema.
                CREATE TABLE entities.entity_child_sequence (entity_id INT REFERENCES entities.entity(entity_id));
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        manager.DropSchema();
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                IF EXISTS (SELECT 1 FROM sys.schemas WHERE name IN ('data','entities','contacts','security','overmind'))
                    THROW 52000, 'Application DropSchema left an application schema behind.', 1;
                IF COALESCE(IS_ROLEMEMBER('email_runtime','email_deployment_test'),0)<>1
                    THROW 52000, 'DropSchema removed deployment role membership.', 1;
                IF COALESCE(IS_ROLEMEMBER('contact_runtime','email_deployment_test'),0)<>1
                    THROW 52000, 'DropSchema removed contact capability membership.', 1;
                IF COALESCE(IS_ROLEMEMBER('provisioning_runtime','email_deployment_test'),0)<>1
                    THROW 52000, 'DropSchema removed provisioning capability membership.', 1;
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        manager.CreateSchema();
        await AssertSeedAsync(connectionString);
        await AssertProvisioningAsync(connectionString);
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                IF COALESCE(IS_ROLEMEMBER('email_runtime','email_deployment_test'),0)<>1
                    THROW 52000,'Recreation lost deployment role membership.',1;
                IF COALESCE(IS_ROLEMEMBER('contact_runtime','email_deployment_test'),0)<>1
                    THROW 52000,'Recreation lost contact capability membership.',1;
                IF COALESCE(IS_ROLEMEMBER('provisioning_runtime','email_deployment_test'),0)<>1
                    THROW 52000,'Recreation lost provisioning capability membership.',1;
                IF OBJECT_ID('entities.entity_child_sequence') IS NOT NULL
                    THROW 52000,'Recreation restored the removed counter table.',1;
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        Console.WriteLine("PASS C#: real schema cycle, explicit business runner/rollback, contact-card and actor email, login independence, deployment role and legacy cleanup");
    }

    private static async Task AssertProvisioningAsync(string connectionString) {
        var actor = Guid.Parse("97A45AEE-EF87-4EFF-98D5-E51195A6669A");
        var tenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091ED");
        await using var unit = await SqlAuditUnit.BeginAsync(connectionString, actor, tenant);
        var contact = await unit.CreateContactAsync(new(1, "Provisioned after actual schema creation"));
        var hash = ProvisioningPassword.CreateHasher().HashPassword(new object(), UserProvisioningCases.Password);
        var account = await unit.ProvisionUserAsync(contact.PublicKey, 0, "schema-provision@example.test", hash);
        if (account.EntityVersion != 1) throw new Exception("Actual schema provisioning created an intermediate revision.");
        await unit.CommitAsync();
    }

    private static async Task AssertBusinessRunnerAsync(SqlDatabase database, string connectionString) {
        // No enrollment preamble in either business batch.
        database.RunLocalStoredAuditCommands(new StringReader("""
            EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000025',
                @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name=N'Explicit business runner',@email_address=N'batch@example.test';
            """));
        try {
            database.RunLocalStoredAuditCommands(new StringReader("""
                EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000026',
                    @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name=N'Rolled back batch',@email_address=N'batch@example.test';
                THROW 52043,'Preserve original business error',1;
                """));
            throw new Exception("Business batch error was swallowed.");
        } catch (SqlException error) when (error.Number == 52043) { }
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        using var command = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000025')
                THROW 52000,'Enrolled business batch did not commit.',1;
            IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000026')
                THROW 52000,'Failed business batch left partial work.',1;
            """, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task AssertProfileAsync(string connectionString) {
        var actor=Guid.Parse("97A45AEE-EF87-4EFF-98D5-E51195A6669A");
        var tenant=Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091ED");
        var reader=new SqlContactReader(connectionString);
        var seed=await reader.ReadAsync(actor,actor,1,tenant);
        if (seed.Profile.PersonFirstName is null) throw new Exception("Actual seed lost structured name history.");
        ContactWriteResult created;
        await using (var unit=await SqlAuditUnit.BeginAsync(connectionString,actor,tenant)) {
            created=await unit.CreateContactAsync(new(1,"Exact display",PersonFirstName:"Ernesto "));
            await unit.InsertEmailAsync(created.PublicKey,0,"profile@example.test");
            await unit.CommitAsync();
        }
        await using (var unit=await SqlAuditUnit.BeginAsync(connectionString,actor,tenant)) {
            await unit.UpdateContactAsync(created.PublicKey,1,new(1,"EXACT display",PersonFirstName:"ERNESTO "));
            await unit.CommitAsync();
        }
        var current=await reader.ReadAsync(created.PublicKey,actor,2,tenant,1);
        if (current.Profile.PersonFirstName!="ERNESTO " || current.ProfileDifferences.Single().OldProfile.PersonFirstName!="Ernesto ")
            throw new Exception("Actual application profile history lost exact spelling.");
        await using var connection=new SqlConnection(connectionString);
        await connection.OpenAsync();
        using var command=new SqlCommand("SELECT person_first_name FROM contacts.contact_view WHERE public_key=@key;",connection);
        command.Parameters.AddWithValue("@key",created.PublicKey);
        if ((string?)await command.ExecuteScalarAsync()!="ERNESTO ") throw new Exception("Current contact view changed exact name spelling.");
        var services = new ServiceCollection();
        services.AddScoped<IContactContextAccessor>(_ => new ContactServiceCases.Context(new(actor, tenant)));
        services.AddScoped<IContactAuthorizer>(_ => new ContactServiceCases.Policy());
        services.AddSqlContactService(connectionString);
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        using var scope = provider.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IContactService>();
        var organization = await service.CreateAsync(new(new(2, "Service organization"), ContactServiceCases.Initial(true)));
        var detail = await service.ReadCurrentAsync(organization.PublicKey);
        if (detail.EntityVersion != 1 || detail.Profile.ContactTypeId != 2 || detail.Addresses.Count != 1 ||
            detail.Phones.Count != 1 || detail.Emails.Count != 1 || detail.WebLinks.Count != 1)
            throw new Exception("Actual schema service did not create/read the complete declared contact.");
    }

    private static async Task AssertPrincipalAsync(string connectionString) {
        var user = Guid.Parse("97A45AEE-EF87-4EFF-98D5-E51195A6669A");
        var actor = Guid.Parse("71F092F4-3A35-463D-9589-E5EE1373F7D5");
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        using var original = new SqlCommand("SELECT login_name,email FROM security.[user] u JOIN entities.entity e ON e.entity_id=u.user_id WHERE e.public_key=@user;", connection);
        original.Parameters.AddWithValue("@user", user);
        string login;
        object email;
        await using (var row = await original.ExecuteReaderAsync()) {
            if (!await row.ReadAsync()) throw new Exception("Seeded user missing.");
            login = row.GetString(0);
            email = row.GetValue(1);
        }
        // Actual ordinary constructor output must be eligible without a System-actor workaround.
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, user)) {
            var added = await unit.InsertEmailAsync(user, 1, "card-principal@example.test");
            await unit.MakeEmailPrincipalAsync(user, 1, added.Ordinal);
            await unit.InsertWebLinkAsync(user, 1, new("https://example.test/secondary", "website"));
            var principalLink = await unit.InsertWebLinkAsync(user, 1, new("https://example.test/principal", "website", "Profile"));
            await unit.MakeWebLinkPrincipalAsync(user, 1, principalLink.Ordinal);
            var principalAddress = await unit.InsertAddressAsync(user, 1,
                new(Address1: "New office", Country: "México", State: "Morelos", City: "Cuernavaca"), "Office");
            await unit.MakeAddressPrincipalAsync(user, 1, principalAddress.Ordinal);
            await unit.CommitAsync();
        }
        var channels = await new SqlContactChannelsReader(connectionString).ReadAsync(user, user, 2, compareEntityVersion: 1);
        if (channels.WebLinks.Count != 2 || channels.WebLinks[0].Url != "https://example.test/principal"
            || channels.WebLinkActions.Count != 3 || channels.EmailRevision.Emails[0].Email != "card-principal@example.test"
            || channels.Phones.Count != 1 || channels.Addresses.Count != 2
            || channels.Addresses[0].Address.Address1 != "New office" || channels.AddressActions.Count != 2)
            throw new Exception("Actual schema cycle lost composed channels or saved principal order.");
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.InsertEmailAsync(actor, 1, "actor-secondary@example.test");
            var principal = await unit.InsertEmailAsync(actor, 1, "actor-principal@example.test");
            await unit.MakeEmailPrincipalAsync(actor, 1, principal.Ordinal);
            await unit.CommitAsync();
        }
        using var check = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@user AND email_address=N'card-principal@example.test')
                THROW 52000,'Contact card ignored saved order.',1;
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@user AND address1=N'New office')
                THROW 52000,'Contact card ignored saved address order.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity_view WHERE public_key=@user AND modified_by_email=N'card-principal@example.test')
                THROW 52000,'Actor display ignored saved order.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity_view WHERE public_key='71F092F4-3A35-463D-9589-E5EE1373F7D5' AND modified_by_email=N'actor-principal@example.test')
                THROW 52000,'System actor display ignored saved order.',1;
            IF EXISTS (SELECT login_name,email FROM security.[user] u JOIN entities.entity e ON e.entity_id=u.user_id WHERE e.public_key=@user
                EXCEPT SELECT @login,@email)
                THROW 52000,'Contact ordering changed login or account email.',1;
            """, connection);
        check.Parameters.AddWithValue("@user", user);
        check.Parameters.AddWithValue("@login", login);
        check.Parameters.Add("@email", System.Data.SqlDbType.NVarChar, 256).Value = email;
        await check.ExecuteNonQueryAsync();
    }

    private static async Task AssertSeedAsync(string connectionString) {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        using var command = new SqlCommand("""
            DECLARE @tenant INT=(SELECT tenant_id FROM data.tenant
                WHERE public_key='908E5A8C-0372-4EDC-ADDF-011E059091ED');
            IF @tenant IS NULL OR NOT EXISTS (SELECT 1 FROM entities.entity
                WHERE entity_id=1 AND tenant_id=@tenant AND public_key='71F092F4-3A35-463D-9589-E5EE1373F7D5')
                THROW 52000, 'Schema creation did not seed the default tenant/System identity.', 1;
            DECLARE @contact INT=(SELECT entity_id FROM entities.entity
                WHERE public_key='97A45AEE-EF87-4EFF-98D5-E51195A6669A' AND tenant_id=@tenant);
            IF @contact IS NULL OR NOT EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@contact)
                THROW 52000, 'Application business seed did not create its user.', 1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity e
                JOIN entities.entity_history h ON h.entity_id=e.entity_id AND h.dbrow_version=e.dbrow_version
                JOIN security.user_history u ON u.user_id=e.entity_id AND u.dbrow_version=e.dbrow_version
                JOIN data.dbrow_version v ON v.dbrow_version=e.dbrow_version AND v.tenant_id=e.tenant_id
                WHERE e.entity_id=@contact AND e.entity_type_id=4 AND h.entity_type_id=4 AND h.dboperation_type_id=1
                    AND v.modified_by=1 AND u.email=N'ernesto@sistrategia.com' AND u.email_confirmed=0)
                THROW 52000,'Seeded user lost its final type, account payload or installation actor.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity e
                JOIN contacts.contact_email c ON c.contact_id=e.entity_id AND c.tenant_id=e.tenant_id
                JOIN contacts.contact_email_history h ON h.contact_id=c.contact_id AND h.ordinal=c.ordinal
                    AND h.tenant_id=c.tenant_id AND h.dbrow_version=c.dbrow_version AND h.email_id=c.email_id
                JOIN entities.entity_version_history r ON r.entity_id=e.entity_id AND r.dbrow_version=h.dbrow_version
                    AND r.tenant_id=e.tenant_id AND r.entity_version=e.entity_version
                JOIN data.dbrow_version v ON v.dbrow_version=r.dbrow_version AND v.tenant_id=r.tenant_id
                WHERE e.entity_id=@contact AND e.entity_version=1 AND e.dbrow_version=v.dbrow_version)
                THROW 52000, 'Seeded email did not share creation history, aggregate revision and audit unit.', 1;
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_action WHERE contact_id=@contact AND operation='insert')
                THROW 52000, 'Seeded email lost its action evidence.', 1;
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_address a
                JOIN contacts.contact_address_history h ON h.contact_id=a.contact_id AND h.ordinal=a.ordinal AND h.dbrow_version=a.dbrow_version
                JOIN entities.entity e ON e.entity_id=a.contact_id AND e.dbrow_version=a.dbrow_version
                JOIN contacts.address v ON v.address_id=a.address_id
                WHERE a.contact_id=@contact AND a.display_order=1 AND e.entity_version=1
                    AND v.address1=N'Tabachin #12' AND v.zip_code=N'62130')
                THROW 52000,'Seed address lost immutable value, saved order or revision-one history.',1;
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_phone p
                JOIN contacts.phone n ON n.phone_id=p.phone_id
                JOIN contacts.phone_input i ON i.input_id=p.input_id
                JOIN contacts.contact_phone_history h ON h.contact_id=p.contact_id AND h.ordinal=p.ordinal
                    AND h.dbrow_version=p.dbrow_version AND h.input_id=p.input_id
                JOIN entities.entity e ON e.entity_id=p.contact_id AND e.dbrow_version=p.dbrow_version
                WHERE p.contact_id=@contact AND e.entity_version=1 AND p.display_order=1
                    AND n.e164='+527773288894' AND i.area_code='777')
                OR NOT EXISTS (SELECT 1 FROM contacts.contact_phone_action WHERE contact_id=@contact AND operation='insert')
                THROW 52000,'Seed phone lost canonical value, input, revision-one history or action evidence.',1;
            IF NOT EXISTS (
                SELECT 1 FROM entities.event ev
                JOIN security.user_role ur ON ur.user_id=ev.subject_id
                JOIN security.[role] r ON r.role_id=ur.role_id
                WHERE ev.subject_id=@contact AND ev.dbrow_version=(SELECT dbrow_version FROM entities.entity WHERE entity_id=@contact)
                    AND r.role_name=N'Developer' AND r.tenant_id IS NULL
                    AND TRY_CONVERT(INT,JSON_VALUE(ev.event_args,'$.initial_role_id'))=r.role_id
                    AND ev.created='2022-01-04T21:00:00'
            )
                THROW 52000,'Seeded Developer assignment or occurrence time lost construction evidence.',1;
            """, connection);
        await command.ExecuteNonQueryAsync();
    }

    private sealed record TestConnectionStringProvider(string ConnectionString) : IConnectionStringProvider;
}
