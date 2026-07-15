// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Data;

public abstract class DatabaseSchemaBuilder : IDatabaseSchemaBuilder
{
    protected readonly string ConnectionString;

    public DatabaseSchemaBuilder(string connectionString) {
        ConnectionString = connectionString;
    }

    public abstract string SchemaName { get; }
    public abstract string SchemaDescription { get; }
    public abstract string Version { get; }

    public abstract void CreateSchemaObjects();
    public abstract void DropSchemaObjects();
    public abstract void CreateSchemaTables();
    public abstract void DropSchemaTables();
    public abstract void CreateSchemaViews();
    public abstract void DropSchemaViews();
    public abstract void CreateSchemaFunctions();
    public abstract void DropSchemaFunctions();
    public abstract void DropSchemaTypes();
    public abstract void InsertMinimalData();

    //public abstract void CreateSchema();
    //public abstract void DropSchema();

    //public abstract void UpgradeSchema();
    //public abstract void DowngradeSchema();

    //public abstract bool CanUpgradeSchema(string fromVersion);
    //public abstract bool CanDowngradeSchema(string toVersion);

    //public abstract bool CheckSchema();

    //public abstract void DropIndexes();
    //public abstract void CreateIndexes();
    //public abstract void ReIndexDatabase();

    #region Create Schema

    protected abstract void CreateSchemaObject(string schema);
    protected abstract void CreateSchemaObjectIfNotExists(string schema);

    #endregion

    #region Drop Schema

    protected abstract void DropSchemaObject(string name);
    protected abstract void DropSchemaObjectIfExists(string name);

    #endregion

    protected abstract void RunLocalStoredCommands(string resourceName);
}
