// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Data;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

public abstract class SqlDatabaseSchemaBuilder : DatabaseSchemaBuilder
{
    protected readonly SqlDatabase SqlDatabase;

    public SqlDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString) {
        SqlDatabase = new SqlDatabase(connectionString, logger);
    }

    #region Create Schema

    protected override void CreateSchemaObject(string schema) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF NOT EXISTS(SELECT * FROM sys.schemas WHERE name = N'{schema}') EXEC('CREATE SCHEMA [{schema}] AUTHORIZATION [dbo]');");

    protected override void CreateSchemaObjectIfNotExists(string schema) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF NOT EXISTS(SELECT * FROM sys.schemas WHERE name = N'{schema}') EXEC('CREATE SCHEMA [{schema}] AUTHORIZATION [dbo]');");

    #endregion

    #region Drop Schema

    protected override void DropSchemaObject(string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP SCHEMA [{name}]");

    protected override void DropSchemaObjectIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery($"IF EXISTS (SELECT * FROM sys.schemas WHERE name = N'{name}') BEGIN DROP SCHEMA [{name}] END");

    #endregion

    #region Drop Table

    protected void DropTable(string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP TABLE [{name}]");

    protected void DropTable(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP TABLE [{schema}].[{name}]");

    protected void DropTableIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[{name}]') AND type in (N'U')) DROP TABLE [{name}]");

    protected void DropTableIfExists(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[{schema}].[{name}]') AND type in (N'U')) DROP TABLE [{schema}].[{name}]");

    #endregion

    #region Drop Views

    protected void DropView(string name) {
        SqlDatabase.ExecuteNonQuery($"DROP VIEW [{name}]");
    }

    protected void DropView(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP VIEW [{schema}].[{name}]");

    protected void DropViewIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID(N'[{name}]') AND type in (N'V')) DROP VIEW [{name}]");

    protected void DropViewIfExists(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID(N'[{schema}].[{name}]') AND type in (N'V')) DROP VIEW [{schema}].[{name}]");

    #endregion

    #region Drop Stored Procedure

    protected virtual void DropProcedure(string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP PROCEDURE [dbo].[{name}]");

    protected virtual void DropProcedure(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP PROCEDURE [{schema}].[{name}]");

    protected virtual void DropProcedureIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( OBJECT_ID(N'[dbo].[{name}]') IS NOT NULL ) DROP PROCEDURE [dbo].[{name}]");

    protected virtual void DropProcedureIfExists(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( OBJECT_ID(N'[{schema}].[{name}]') IS NOT NULL ) DROP PROCEDURE [{schema}].[{name}]");

    #endregion

    #region Drop Functions

    protected virtual void DropFunction(string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP FUNCTION [dbo].[{name}]");

    protected virtual void DropFunction(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP FUNCTION [{schema}].[{name}]");

    protected virtual void DropFunctionIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( OBJECT_ID(N'[dbo].[{name}]') IS NOT NULL ) DROP FUNCTION [dbo].[{name}]");

    protected virtual void DropFunctionIfExists(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( OBJECT_ID(N'[{schema}].[{name}]') IS NOT NULL ) DROP FUNCTION [{schema}].[{name}]");

    #endregion

    #region Drop Types

    protected virtual void DropType(string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP TYPE [dbo].[{name}]");

    protected virtual void DropType(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery($"DROP TYPE [{schema}].[{name}]");

    protected virtual void DropTypeIfExists(string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( TYPE_ID(N'[dbo].[{name}]') IS NOT NULL ) DROP TYPE [dbo].[{name}]");

    protected virtual void DropTypeIfExists(string schema, string name) =>
        SqlDatabase.ExecuteNonQuery(
            $"IF ( TYPE_ID(N'[{schema}].[{name}]') IS NOT NULL ) DROP TYPE [{schema}].[{name}]");

    #endregion
    // protected abstract void RunLocalStoredCommands(string resourceName);
}
