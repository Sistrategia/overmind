// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Data;

public abstract class DatabaseManager : IDatabaseManager
{
    // protected readonly string ConnectionString;
    protected readonly IConnectionStringProvider ConnectionStringProvider;

    public DatabaseManager(IConnectionStringProvider connectionStringProvider) {
        ConnectionStringProvider = connectionStringProvider;
    }

    protected string ConnectionString => ConnectionStringProvider.ConnectionString;

    public abstract void CreateDatabase();
    public abstract void CreateSchema();
    public abstract void DropSchema();
    public abstract void DropLoadTables();

    public abstract void InsertSampleData(string namedSampleSet);

    public abstract string DataSource { get; }
    public abstract string InitialCatalog { get; }
    public abstract string DatabaseServerVersion { get; }
    public abstract string GetDatabaseSchemaVersion();

    //public abstract IEnumerable<Tenant> GetAllTenants();
}
