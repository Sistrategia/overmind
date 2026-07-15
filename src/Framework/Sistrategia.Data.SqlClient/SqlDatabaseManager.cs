// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

public class SqlDatabaseManager : DatabaseManager
{
    protected readonly ILogger<Database> logger;
    protected readonly List<IDatabaseSchemaBuilder> SchemaBuilders;

    public SqlDatabaseManager(IConnectionStringProvider connectionStringProvider, ILogger<Database> logger)
        : base(connectionStringProvider) {
        this.logger = logger ?? throw new ArgumentNullException(nameof(logger));
        SchemaBuilders = new List<IDatabaseSchemaBuilder> {
            new DataDatabaseSchemaBuilder(ConnectionString, logger)
            // ,new EntitiesDatabaseSchemaBuilder(ConnectionString, logger)
            // ,new ContactsDatabaseSchemaBuilder(ConnectionString, logger)
            // ,new SecurityDatabaseSchemaBuilder(ConnectionString, logger)
            // ,new DocumentsDatabaseSchemaBuilder(ConnectionString, logger)
        };
    }

    public override string DataSource =>
        new SqlConnectionStringBuilder(ConnectionString).DataSource;

    public override string InitialCatalog =>
        new SqlConnectionStringBuilder(ConnectionString).InitialCatalog;

    public override string DatabaseServerVersion {
        get {
            using var connection = new SqlConnection(ConnectionString);
            connection.Open();
            return connection.ServerVersion;
        }
    }

    public override void CreateDatabase() {
        SqlDatabaseCreator.CreateDatabase(ConnectionString);
    }

    public override void CreateSchema() {
        foreach (var schema in SchemaBuilders) {
            schema.CreateSchemaObjects();
            schema.CreateSchemaTables();
        }

        foreach (var schema in SchemaBuilders)
            schema.CreateSchemaViews();

        foreach (var schema in SchemaBuilders)
            schema.CreateSchemaFunctions();

        foreach (var schema in SchemaBuilders)
            schema.InsertMinimalData();
    }

    public override void DropSchema() {
        var schemaBuildersReversed = SchemaBuilders.AsEnumerable().Reverse();
        foreach (var schema in schemaBuildersReversed) {
            schema.DropSchemaFunctions();
            schema.DropSchemaTypes();
        }

        foreach (var schema in schemaBuildersReversed)
            schema.DropSchemaViews();

        foreach (var schema in schemaBuildersReversed) {
            schema.DropSchemaTables();
            schema.DropSchemaObjects();
        }
    }

    public override void InsertSampleData(string namedSampleSet) {

    }

    public override void DropLoadTables() {

    }

    public override string GetDatabaseSchemaVersion() {
        using (var connection = new SqlConnection(ConnectionString)) {
            var command = new SqlCommand("SELECT [database_schema_version] FROM [data].[schema_version]; ", connection);
            connection.Open();
            var result = command.ExecuteScalar();
            return result?.ToString() ?? string.Empty;
        }
    }
}
