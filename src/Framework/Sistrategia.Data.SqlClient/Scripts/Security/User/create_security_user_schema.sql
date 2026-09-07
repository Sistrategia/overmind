-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_security_user_schema.sql
-- Part of the Sistrategia.Security Framework.
-- Last Update: 2026-Sep-07
-- Created: 2026-Sep-07
-- Version: 8.0.0.0

-- A user belongs to exactly its entity's tenant. Login spelling is preserved.
-- The fixed collation, not the database default or a C# uppercase operation, defines equality.
CREATE TABLE [security].[user] (
    [user_id] INT NOT NULL,
    [tenant_id] INT NOT NULL,
    [login_name] NVARCHAR(256) COLLATE Latin1_General_100_CI_AS_KS_WS_SC NOT NULL,
    [password_hash] NVARCHAR(256) NULL,
    [password_salt] NVARCHAR(128) NULL,
    [security_stamp] NVARCHAR(128) NULL,
    [concurrency_stamp] NVARCHAR(128) NULL,
    [email] NVARCHAR(256) NULL,
    [email_confirmed] BIT NOT NULL DEFAULT (0),
    [phone_number] NVARCHAR(16) NULL,
    [phone_number_confirmed] BIT NOT NULL DEFAULT (0),
    [two_factor_enabled] BIT NOT NULL DEFAULT (0),
    [lockout_end] DATETIMEOFFSET NULL,
    [lockout_enabled] BIT NOT NULL DEFAULT (0),
    [access_failed_count] INT NOT NULL DEFAULT (0),
    [last_login_at] DATETIME2 NULL,
    CONSTRAINT [px_security_user] PRIMARY KEY CLUSTERED ([user_id]),
    CONSTRAINT [fk_user_tenant_entity] FOREIGN KEY ([tenant_id], [user_id])
        REFERENCES [entities].[entity] ([tenant_id], [entity_id]),
    CONSTRAINT [uq_user_tenant_login] UNIQUE ([tenant_id], [login_name]),
    CONSTRAINT [ck_user_login_name] CHECK ([security].[login_name_is_valid]([login_name]) = 1)
);

INSERT INTO [entities].[entity_type] ([entity_type_id], [code_name], [database_schema], [database_table], [database_view])
VALUES (4, 'user', 'security', 'user', 'user_view');
