// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Data.SqlClient;

public class SqlConnectionStringProvider : IConnectionStringProvider
{
    private readonly string connectionString;

    public SqlConnectionStringProvider(string connectionString) {
        this.connectionString = connectionString;
    }

    public string ConnectionString => connectionString;
}