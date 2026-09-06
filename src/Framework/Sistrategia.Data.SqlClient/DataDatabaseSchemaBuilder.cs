// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

internal class DataDatabaseSchemaBuilder : SqlDatabaseSchemaBuilder
{
    public DataDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString, logger) { }

    public override string SchemaName => "data";
    public override string SchemaDescription => "Sistrategia.Data.SqlClient";
    public override string Version => "6.0.6829.0";

    public override void CreateSchemaObjects() {
        CreateSchemaObject("data");
        // CreateSchemaObject("audit");
    }

    public override void CreateSchemaTables() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_data_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.Lists.create_lists_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Audit.create_audit_system_log_schema.sql");
    }

    public override void CreateSchemaViews() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_data_tenant_view.sql");
    }

    public override void CreateSchemaFunctions() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_audit_isolation_assert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_audit_unit_begin.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_audit_unit_assert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_dbrow_version_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_audit_action_next.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_data_sequence_next_number.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.create_tenant_insert.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.Lists.create_list_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.Lists.create_list_item_insert.sql");
    }

    public override void InsertMinimalData() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Data.insert_minimal_data.sql");
    }

    public override void DropSchemaTypes() {

    }

    public override void DropSchemaFunctions() {
        DropProcedureIfExists("data", "audit_action_next");
        DropProcedureIfExists("data", "dbrow_version_ensure");
        DropProcedureIfExists("data", "audit_unit_assert");
        DropProcedureIfExists("data", "audit_unit_begin");
        DropProcedureIfExists("data", "audit_isolation_assert");
        // DropProcedureIfExists("data", "list_item_insert");
        // DropProcedureIfExists("data", "list_insert");

        DropProcedureIfExists("data", "sequence_next_number");
        DropProcedureIfExists("data", "tenant_insert");
    }

    public override void DropSchemaViews() {
        DropViewIfExists("data", "tenant_view");
    }

    public override void DropSchemaTables() {
        // DropTableIfExists("audit", "system_log");

        // DropTableIfExists("data", "list_item_map");
        // DropTableIfExists("data", "list_item");
        // DropTableIfExists("data", "list");

        DropTableIfExists("data", "applied_migration");

        DropTableIfExists("data", "schema_version");
        DropTableIfExists("data", "string_value");
        DropTableIfExists("data", "string");
        DropTableIfExists("data", "sequence");
        DropTableIfExists("data", "sequence_type");
        // DROP SEQUENCE [data].[dbrow_version_seq]
        // DropTableIfExists("data", "dbrow_version_seq");
        DropSequenceIfExists("data", "dbrow_version_seq");
        DropTableIfExists("data", "dbrow_version");
        DropTableIfExists("data", "tenant");
        DropTableIfExists("data", "module");
        DropTableIfExists("data", "dboperation_type_localized");
        DropTableIfExists("data", "dboperation_type");
        DropTableIfExists("data", "language");
    }

    public override void DropSchemaObjects() {
        // DropSchemaObjectIfExists("audit");


        // DropSequenceIfExists("data", "dbrow_version_seq");
        DropSchemaObjectIfExists("data");
    }

    //public override void UpgradeSchema() {
    //    throw new NotImplementedException();
    //}

    //public override void DowngradeSchema() {
    //    throw new NotImplementedException();
    //}

    #region RunLocalStoredCommands

    protected override void RunLocalStoredCommands(string resourceName) {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        SqlDatabase.RunLocalStoredCommands(assembly, resourceName);
    }

    #endregion
}

