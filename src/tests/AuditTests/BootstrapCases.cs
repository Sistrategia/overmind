using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class BootstrapCases
{
    internal static void Run(string connectionString) {
        var type = typeof(SqlAuditUnit).Assembly.GetType("Sistrategia.Data.SqlClient.SecurityDatabaseSchemaBuilder")!;
        var builder = Activator.CreateInstance(type, connectionString, Microsoft.Extensions.Logging.Abstractions.NullLogger<Sistrategia.Data.Database>.Instance)!;
        var method = type.GetMethod("InsertSystemUser")!;
        object[] values = ["908E5A8C-0372-4EDC-ADDF-011E059091ED", "Default tenant", new DateTime(2022, 1, 4, 20, 0, 0, DateTimeKind.Utc)];
        method.Invoke(builder, values);
        method.Invoke(builder, values);
        Console.WriteLine("PASS C#: schema builder delegates atomic, idempotent System bootstrap");
    }
}
