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
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Security.User.create_security_user_insert.sql");
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
        using (var conn = new SqlConnection(ConnectionString)) {
            //             var command = new SqlCommand(@"
            // INSERT INTO [data].[tenant] ([public_key],[name]) VALUES (@tenant, @tenant_name);
            // INSERT INTO [data].[dbrow_version] ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by]) 
            //     VALUES (1, COALESCE((SELECT MAX(dbrow_version) + 1 FROM [data].[dbrow_version] WHERE [tenant_id] = 1), 1), 1, @created, 1)
            // INSERT INTO [entities].[entity] ([entity_type_id], [public_key], [tenant_id], [logical_key], [display_name], [created], [created_by], [modified], [modified_by], [summary], [is_private], [is_system], [dbrow_version]) 
            //     VALUES (1, '71F092F4-3A35-463D-9589-E5EE1373F7D5', 1, 'system', 'System User', @created, 1, @created, 1, 'System User', 0, 1, 1)
            // INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id], [full_name]) --, [dbrow_version]) 
            //     VALUES (1, 1, 'System User') --, 1)
            // INSERT INTO [security].[user] ([user_id], [login_name], [password_hash]) 
            //     VALUES (1, 'system', NULL) "
            //                 , conn);
            var command = new SqlCommand(
                @"DECLARE @dbrow_version INT
SET @dbrow_version = NEXT VALUE FOR [data].[dbrow_version_seq];
INSERT INTO [data].[tenant] ([public_key],[name]) VALUES (@tenant, @tenant_name);
INSERT INTO [data].[dbrow_version] ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by]) 
    VALUES (1, COALESCE((SELECT MAX(dbrow_version) + 1 FROM [data].[dbrow_version] WHERE [tenant_id] = 1), 1), 1, @created, 1)
INSERT INTO [entities].[entity] ([entity_type_id], [public_key], [tenant_id], [logical_key], [display_name], [created], [created_by], [modified], [modified_by], [summary], [is_private], [is_system], [dbrow_version]) 
    VALUES (1, '71F092F4-3A35-463D-9589-E5EE1373F7D5', 1, 'system', 'System User', @created, 1, @created, 1, 'System User', 0, 1, 1)
INSERT INTO [entities].[entity_history] ([dbrow_version],[tenant_id],[entity_id],[dboperation_type_id],[logical_key],[display_name],[summary],[image_url],[thumbnail_url],[is_private])
    VALUES (1, 1, 1, 1, 'system', 'System User', 'System User', NULL, NULL, 0)
INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id], [full_name]) --, [dbrow_version]) 
    VALUES (1, 1, 'System User') --, 1)
INSERT INTO [security].[user] ([user_id], [login_name], [password_hash]) 
    VALUES (1, 'system', NULL) 
" // , '71F092F4-3A35-463D-9589-E5EE1373F7D5' 'Default tenant added.'
, conn);

            //             @"INSERT INTO [data].[tenant] ([public_key],[name]) VALUES (@tenant, @tenant_name);
            // INSERT INTO [data].[dbrow_version] ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by]) 
            //     VALUES (1, COALESCE((SELECT MAX(dbrow_version) + 1 FROM [data].[dbrow_version] WHERE [tenant_id] = 1), 1), 1, @created, 1)
            // INSERT INTO [entities].[entity] ([entity_type_id], [public_key], [tenant_id], [logical_key], [display_name], [created], [created_by], [modified], [modified_by], [summary], [is_private], [is_system], [dbrow_version]) 
            //     VALUES (1, '71F092F4-3A35-463D-9589-E5EE1373F7D5', 1, 'system', 'System User', @created, 1, @created, 1, 'System User', 0, 1, 1)
            // INSERT INTO [entities].[entity_history] ([dbrow_version],[entity_id],[logical_key],[display_name],[summary],[image_url],[thumbnail_url],[is_private])
            //     VALUES (1, 1, 'system', 'System User', 'System User', NULL, NULL, 0)
            // INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id], [full_name]) --, [dbrow_version]) 
            //     VALUES (1, 1, 'System User') --, 1)
            // INSERT INTO [security].[user] ([user_id], [login_name], [password_hash]) 
            //     VALUES (1, 'system', NULL) 
            // INSERT INTO [entities].[entity] ([entity_type_id], [public_key], [tenant_id], [logical_key], [display_name], [created], [created_by], [modified], [modified_by], [summary], [is_private], [is_system], [dbrow_version]) 
            //     VALUES (0, @tenant, 1, 'default_tenant', @tenant_name, @created, 1, @created, 1, @tenant_name, 0, 1, 1)
            // INSERT INTO [entities].[entity_history] ([dbrow_version],[entity_id],[logical_key],[display_name],[summary],[image_url],[thumbnail_url],[is_private])
            //     VALUES (1, 2, 'default_tenant', @tenant_name, @tenant_name, NULL, NULL, 0)
            // INSERT INTO [entities].[event] ([event_type_id],[tenant_id],[public_key],[display_name],[created],[created_by]
            // , [subject_type_id], [subject_id], [subject_public_key], [summary], [is_system], [dbrow_version])
            // VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'data.tenant.new')
            // , 1,NEWID(),'Instancia por defecto agregada.',@created, 1
            // , (SELECT [entity_type_id] FROM [entities].[entity_type] WHERE [code_name] = 'tenant'), 2
            // , @tenant
            // , 'Instancia por defecto agregada.', 1, 1)
            // " // , '71F092F4-3A35-463D-9589-E5EE1373F7D5' 'Default tenant added.'


            command.Parameters.AddWithValue("tenant", Guid.Parse(tenant));
            command.Parameters.AddWithValue("created", created);
            command.Parameters.AddWithValue("tenant_name", tenantName);
            conn.Open();
            command.ExecuteNonQuery();
        }
    }

    #region RunLocalStoredCommands

    protected override void RunLocalStoredCommands(string resourceName) {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        SqlDatabase.RunLocalStoredCommands(assembly, resourceName);
    }

    #endregion
}
