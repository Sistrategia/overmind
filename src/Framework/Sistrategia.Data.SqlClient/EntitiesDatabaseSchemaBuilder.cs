// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Microsoft.Extensions.Logging;
// using Sistrategia.Data;
// using Sistrategia.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

internal class EntitiesDatabaseSchemaBuilder : SqlDatabaseSchemaBuilder
{
    public EntitiesDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString, logger) { }

    public override string SchemaName => "entities";
    public override string SchemaDescription => "Sistrategia.Entities.SqlClient";
    public override string Version => "6.0.6829.0";

    public override void CreateSchemaObjects() {
        CreateSchemaObject("entities");
    }

    public override void CreateSchemaTables() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entities_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.Events.create_events_schema.sql");
    }

    public override void CreateSchemaViews() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.Events.create_event_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_history_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_identifier_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_day_in_time_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_point_in_time_view.sql");
    }

    public override void CreateSchemaFunctions() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_actor_resolve.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_write_lock.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_version_bump.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_insert.sql");
        // //RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_entity_update.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.Events.create_event_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.Events.create_event_create.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_identifier_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_day_in_time_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.create_point_in_time_insert.sql");
    }

    public override void InsertMinimalData() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Entities.insert_minimal_data.sql");
    }

    public override void DropSchemaTypes() {

    }
    public override void DropSchemaFunctions() {
        DropProcedureIfExists("entities", "point_in_time_insert");
        DropProcedureIfExists("entities", "day_in_time_insert");
        DropProcedureIfExists("entities", "identifier_insert");

        DropProcedureIfExists("entities", "event_create");
        DropProcedureIfExists("entities", "event_insert");

        DropProcedureIfExists("entities", "entity_update");
        DropProcedureIfExists("entities", "entity_insert");
        DropProcedureIfExists("entities", "entity_version_bump");
        DropProcedureIfExists("entities", "entity_write_lock");
        DropProcedureIfExists("entities", "actor_resolve");
    }

    public override void DropSchemaViews() {
        DropViewIfExists("entities", "event_view");
        DropViewIfExists("entities", "entity_point_in_time_view");
        DropViewIfExists("entities", "entity_day_in_time_view");
        DropViewIfExists("entities", "entity_identifier_view");
        DropViewIfExists("entities", "entity_history_view");
        DropViewIfExists("entities", "entity_audit_view");
        DropViewIfExists("entities", "entity_view");
    }

    public override void DropSchemaTables() {
        DropTableIfExists("entities", "year_month_dimension");
        DropTableIfExists("entities", "entity_point_in_time");
        DropTableIfExists("entities", "entity_day_in_time");

        DropTableIfExists("entities", "entity_identifiers");
        DropTableIfExists("entities", "entity_metadata");

        DropTableIfExists("entities", "event");
        DropTableIfExists("entities", "event_type_localized");
        DropTableIfExists("entities", "event_type");

        DropTableIfExists("entities", "entity_history");
        DropTableIfExists("entities", "entity_version_history");
        DropTableIfExists("entities", "entity_child_sequence");
        DropTableIfExists("entities", "entity");
        DropTableIfExists("entities", "entity_type_property");
        DropTableIfExists("entities", "entity_type");

        DropTableIfExists("entities", "point_in_time_value");
        DropTableIfExists("entities", "day_in_time_value");
        DropTableIfExists("entities", "point_in_time");

        DropTableIfExists("entities", "identifier");
        DropTableIfExists("entities", "identifier_type");
    }

    public override void DropSchemaObjects() {
        DropSchemaObjectIfExists("entities");
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

