// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Data;

public interface IDatabaseManager
{
    void CreateDatabase();
    void CreateSchema();
    void DropSchema();
    void DropLoadTables();

    void InsertSampleData(string namedSampleSet);

    string DataSource { get; }
    string InitialCatalog { get; }
    string DatabaseServerVersion { get; }
    string GetDatabaseSchemaVersion();

    //IEnumerable<Tenant> GetAllTenants();
}
