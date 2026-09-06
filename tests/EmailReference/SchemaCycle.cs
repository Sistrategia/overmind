using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging.Abstractions;
using Sistrategia.Data;
using Sistrategia.Data.SqlClient;
using Sistrategia.Overmind.Data.SqlClient;

internal static class SchemaCycle
{
    public static async Task RunAsync(string connectionString) {
        // Program validates that this is a runner-created disposable database.
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
        await AssertBusinessRunnerAsync(database, connectionString);
        await AssertPrincipalAsync(connectionString);
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                CREATE USER email_deployment_test WITHOUT LOGIN;
                ALTER ROLE email_runtime ADD MEMBER email_deployment_test;
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
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        manager.CreateSchema();
        await AssertSeedAsync(connectionString);
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                IF COALESCE(IS_ROLEMEMBER('email_runtime','email_deployment_test'),0)<>1
                    THROW 52000,'Recreation lost deployment role membership.',1;
                IF OBJECT_ID('entities.entity_child_sequence') IS NOT NULL
                    THROW 52000,'Recreation restored the removed counter table.',1;
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        Console.WriteLine("PASS C#: real schema cycle, explicit business runner/rollback, contact-card and actor email, login independence, deployment role and legacy cleanup");
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
        // Legacy user_insert leaves this seed's root typed as contact. It cannot supply actor
        // context to the strict email API until the separate user-lifecycle work fixes creation.
        // Do not weaken actor validation or quietly promote it through test-only raw DML.
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            var added = await unit.InsertEmailAsync(user, 1, "card-principal@example.test");
            await unit.MakeEmailPrincipalAsync(user, 1, added.Ordinal);
            await unit.CommitAsync();
        }
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.InsertEmailAsync(actor, 1, "actor-secondary@example.test");
            var principal = await unit.InsertEmailAsync(actor, 1, "actor-principal@example.test");
            await unit.MakeEmailPrincipalAsync(actor, 1, principal.Ordinal);
            await unit.CommitAsync();
        }
        using var check = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@user AND email_address=N'card-principal@example.test')
                THROW 52000,'Contact card ignored saved order.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity_view WHERE public_key=@user AND modified_by_email=N'actor-principal@example.test')
                THROW 52000,'Actor display ignored saved order.',1;
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
            """, connection);
        await command.ExecuteNonQueryAsync();
    }

    private sealed record TestConnectionStringProvider(string ConnectionString) : IConnectionStringProvider;
}
