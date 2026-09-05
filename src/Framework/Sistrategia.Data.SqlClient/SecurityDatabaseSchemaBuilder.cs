// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
// using Sistrategia.Data;
// using Sistrategia.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

internal class SecurityDatabaseSchemaBuilder : SqlDatabaseSchemaBuilder
{
    public SecurityDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString, logger) { }

    public override string SchemaName => "security";
    public override string SchemaDescription => "Sistrategia.Security.SqlClient";
    public override string Version => "6.0.6829.0";

    public override void CreateSchemaObjects() {
        CreateSchemaObject("security");
    }

    public override void CreateSchemaTables() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Application.create_security_application_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Role.create_security_role_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.UserRole.create_security_user_role_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.PasswordResetToken.create_security_password_reset_token_schema.sql");
        // // //RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.EmailConfirmationToken.create_security_email_confirmation_token_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Activity.create_security_activity_log_schema.sql");
    }

    public override void CreateSchemaViews() {
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Role.create_security_role_view_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Activity.create_security_online_users_view.sql");
    }

    public override void CreateSchemaFunctions() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_system_user_bootstrap.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.create_email_runtime_permissions.sql");
        // // //RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_create.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_update_password.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_update_lockout.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.PasswordResetToken.create_security_password_reset_token_insert.sql");
        // // //RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.EmailConfirmationToken.create_security_email_confirmation_token_insert.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.UserRole.create_security_user_role_insert.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_update_last_login.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Activity.create_security_activity_log_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.Activity.create_security_activity_log_cleanup.sql");
    }

    public override void InsertMinimalData() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.insert_minimal_data.sql");

        InsertSystemUser("908E5A8C-0372-4EDC-ADDF-011E059091ED", "Default tenant",
            new DateTime(2022, 1, 4, 20, 0, 0, DateTimeKind.Utc));
        // // InsertSystemUser("46BE0A72-4301-4F02-9EBD-6EEBA985B746", "Digitex LTD"
        // //    , new DateTime(2022, 1, 4, 20, 0, 0, DateTimeKind.Utc));

        // ////RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.insert_minimal_data.sql");
    }

    public override void DropSchemaTypes() {

    }

    public override void DropSchemaFunctions() {
        DropProcedureIfExists("security", "system_user_bootstrap");
        DropProcedureIfExists("security", "activity_log_cleanup");
        DropProcedureIfExists("security", "activity_log_insert");
        DropProcedureIfExists("security", "user_update_last_login");
        DropProcedureIfExists("security", "user_role_insert");
        DropProcedureIfExists("security", "email_confirmation_token_insert");
        DropProcedureIfExists("security", "password_reset_token_insert");
        DropProcedureIfExists("security", "user_update_password");
        DropProcedureIfExists("security", "user_create");
        DropProcedureIfExists("security", "user_insert");
        DropProcedureIfExists("security", "user_update_lockout");
    }

    public override void DropSchemaViews() {
        DropViewIfExists("security", "online_users_view");
        DropViewIfExists("security", "user_view");
        DropViewIfExists("security", "role_view");
    }

    public override void DropSchemaTables() {
        DropTableIfExists("security", "activity_log");
        DropTableIfExists("security", "email_confirmation_token");
        DropTableIfExists("security", "password_reset_token");
        DropTableIfExists("security", "user_role");
        DropTableIfExists("security", "user");
        DropTableIfExists("security", "role_localized");
        DropTableIfExists("security", "role");
        DropTableIfExists("security", "application_localized");
        DropTableIfExists("security", "application");
    }

    public override void DropSchemaObjects() {
        DropSchemaObjectIfExists("security");
    }

    //public override void UpgradeSchema() {
    //    throw new NotImplementedException();
    //}

    //public override void DowngradeSchema() {
    //    throw new NotImplementedException();
    //}

    public void InsertSystemUser(string tenant, string tenantName, DateTime created) {
        using var conn = new SqlConnection(ConnectionString);
        using var command = new SqlCommand("security.system_user_bootstrap", conn) {
            CommandType = System.Data.CommandType.StoredProcedure
        };
        command.Parameters.Add("@tenant", System.Data.SqlDbType.UniqueIdentifier).Value = Guid.Parse(tenant);
        command.Parameters.Add("@tenant_name", System.Data.SqlDbType.NVarChar, 256).Value = tenantName;
        command.Parameters.Add("@created", System.Data.SqlDbType.DateTime2).Value = created;
        conn.Open();
        command.ExecuteNonQuery();
    }

    #region RunLocalStoredCommands

    protected override void RunLocalStoredCommands(string resourceName) {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        SqlDatabase.RunLocalStoredCommands(assembly, resourceName);
    }

    #endregion
}
