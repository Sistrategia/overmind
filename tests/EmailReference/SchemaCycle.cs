using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging.Abstractions;
using Sistrategia.Data;
using Sistrategia.Overmind.Data.SqlClient;

internal static class SchemaCycle
{
    public static async Task RunAsync(string connectionString) {
        // Program validates that this is a runner-created disposable database.
        // Use the application's real manager, resources, seed batch and transaction runner.
        var manager = new OvermindSqlDatabaseManager(new TestConnectionStringProvider(connectionString),
            NullLogger<Database>.Instance);
        manager.CreateSchema();
        await AssertSeedAsync(connectionString);
        manager.DropSchema();
        await using (var connection = new SqlConnection(connectionString)) {
            await connection.OpenAsync();
            using var command = new SqlCommand("""
                IF EXISTS (SELECT 1 FROM sys.schemas WHERE name IN ('data','entities','contacts','security','overmind'))
                    THROW 52000, 'Application DropSchema left an application schema behind.', 1;
                """, connection);
            await command.ExecuteNonQueryAsync();
        }
        manager.CreateSchema();
        await AssertSeedAsync(connectionString);
        Console.WriteLine("PASS C#: actual Overmind CreateSchema -> DropSchema -> CreateSchema, including business seeds and email history");
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
