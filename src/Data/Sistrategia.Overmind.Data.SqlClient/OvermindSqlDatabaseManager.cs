using Microsoft.Extensions.Logging;
using Sistrategia.Data;
using Sistrategia.Data.SqlClient;

namespace Sistrategia.Overmind.Data.SqlClient;

public class OvermindSqlDatabaseManager : SqlDatabaseManager, IDatabaseManager
{
    Scripts.OvermindDatabaseSchemaBuilder overmindDatabaseSchemaBuilder;

    public OvermindSqlDatabaseManager(
        IConnectionStringProvider connectionStringProvider,
        ILogger<Database> logger)
        : base(connectionStringProvider, logger) {

        overmindDatabaseSchemaBuilder = new Scripts.OvermindDatabaseSchemaBuilder(ConnectionString, logger);
        SchemaBuilders.Add(overmindDatabaseSchemaBuilder);

        // loadDatabaseSchemaBuilder = new Scripts.LoadDatabaseSchemaBuilder(ConnectionString, logger);
        // SchemaBuilders.Add(loadDatabaseSchemaBuilder);
    }

    public override void CreateSchema() {
        base.CreateSchema();
    }

    public override void InsertSampleData(string namedSampleSet) {
        overmindDatabaseSchemaBuilder.InsertSampleData(namedSampleSet);
    }
}
