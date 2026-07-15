/*************************************************************************************************************
* create_data_database_schema.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2025-Jul-14
* Created:			2010-Sep-08
* Version:			8.0.0.0
*************************************************************************************************************/

-- IF SCHEMA_ID(N'data') IS NULL EXEC (N'CREATE SCHEMA [data]');
-- GO

CREATE SEQUENCE [data].[dbrow_version_seq] AS BIGINT START WITH 1 INCREMENT BY 1 CACHE 100;

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[schema_version]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[schema_version] (
     [database_schema_version]      NVARCHAR(50)    NOT NULL
        CONSTRAINT [def_database_schema_version] DEFAULT '8.0.0.0'
    ,CONSTRAINT [pk_schema_version] PRIMARY KEY CLUSTERED ( [database_schema_version] ASC )
);
INSERT INTO [data].[schema_version] VALUES ('8.0.0.0');

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dboperation_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[dboperation_type] (
     [dboperation_type_id]      INT             NOT NULL
    ,[dboperation_code]         NCHAR(6)        NOT NULL
    ,[display_name]             NVARCHAR(255)   NOT NULL
    ,[action_display_name]      NVARCHAR(255)   NOT NULL
    ,CONSTRAINT [pk_dboperation_type]   PRIMARY KEY CLUSTERED ( [dboperation_type_id] ASC )
    ,CONSTRAINT [uq_dboperation_type_code] UNIQUE ([dboperation_code])
);

INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (1, 'INSERT', 'Agregar', 'Agregó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (2, 'UPDATE', 'Actualizar', 'Actualizó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (3, 'DELETE', 'Eliminar', 'Eliminó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (4, 'UNDOVR', 'Restaurar', 'Restauró');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (5, 'UNDODL', 'Recuperar', 'Recuperó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (6, 'LOCKED', 'Bloquear', 'Bloqueó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (7, 'UNLOCK', 'Desbloquear', 'Desbloqueó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (8, 'VALIDA', 'Validar', 'Validó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (9, 'INVALD', 'Desvalidar', 'Desvalidó');
INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (10, 'ERASED', 'Eliminar Permanentemente', 'Eliminó Permanentemente');

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dbrow_version]
-- -----------------------------------------------------------------------------------------------------------
-- CREATE TABLE [data].[dbrow_version] (
--     [dbrow_version]        BIGINT      NOT NULL    IDENTITY(1,1)   -- dbrow_version timestamp
--    ,[dboperation_type_id]  INT         NOT NULL
--    ,[modified]             DATETIME    NOT NULL
--    ,[modified_by]          INT         NOT NULL
--    ,CONSTRAINT [pk_data_dbrow_version]	PRIMARY KEY CLUSTERED ( [dbrow_version] ASC )
-- );

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[tenant]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[tenant] (
     [tenant_id]            INT                 NOT NULL    IDENTITY(1,1)
    ,[public_key]           UNIQUEIDENTIFIER    NOT NULL    CONSTRAINT [def_tenant_public_key] DEFAULT NEWID()
    ,[name]                 NVARCHAR(256)       NOT NULL
    ,CONSTRAINT [pk_data_tenant] PRIMARY KEY CLUSTERED ( [tenant_id] ASC)
    ,CONSTRAINT [uq_data_tenant_public_key] UNIQUE ([public_key])
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dbrow_version]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[dbrow_version] (
     [tenant_id]            INT         NOT NULL
    ,[dbrow_version]        BIGINT      NOT NULL -- NEXT VALUE FOR data.dbrow_version_seq
    ,[dboperation_type_id]  INT         NOT NULL -- the BUSINESS operation of the transaction
    ,[modified]             DATETIME2   NOT NULL
    ,[modified_by]          INT         NOT NULL -- entity_id of the actor (user_id)
    ,CONSTRAINT [pk_data_dbrow_version]	PRIMARY KEY CLUSTERED ( [tenant_id] ASC, [dbrow_version] ASC )
    ,CONSTRAINT [fk_dbrow_version_op] FOREIGN KEY ([dboperation_type_id])
            REFERENCES [data].[dboperation_type]([dboperation_type_id])
    ,CONSTRAINT [fk_dbrow_version_tenant] FOREIGN KEY ([tenant_id])
        REFERENCES [data].[tenant]([tenant_id])
);

CREATE INDEX idx_dbrow_version_tenant_id 
    ON [data].[dbrow_version] ([tenant_id], [dbrow_version] DESC);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[sequence]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[sequence_type] (
     [sequence_type_id]     INT             NOT NULL IDENTITY (1,1)
    ,[tenant_id]            INT             NOT NULL
    ,[name]                 NVARCHAR(100)   NOT NULL
    ,[status]               NVARCHAR(1)     NOT NULL
    ,CONSTRAINT [pk_data_sequence_type]	PRIMARY KEY CLUSTERED ( [sequence_type_id] ASC )
);

CREATE TABLE [data].[sequence] (
     [sequence_id]          INT             NOT NULL IDENTITY (1,1)
    ,[tenant_id]            INT             NOT NULL
    ,[type_id]              INT             NOT NULL
    ,[name]                 NVARCHAR(100)   NOT NULL
    ,[padding]              INT             NOT NULL
    ,[prefix]               NVARCHAR(10)        NULL
    ,[last_number]          INT             NOT NULL
    ,[from_date]            DATE            NOT NULL
    ,[to_date]              DATE                NULL
    ,[status]               NVARCHAR(1)     NOT NULL
    ,CONSTRAINT [pk_data_sequence]	PRIMARY KEY CLUSTERED ( [sequence_id] ASC )
);

CREATE TABLE [data].[language] (
     [language_id]          INT             NOT NULL -- IDENTITY (1,1)
    ,[code]                 NVARCHAR(6)     NOT NULL
    ,[language]             NVARCHAR(50)    NOT NULL
    ,[localized_language]   NVARCHAR(50)    NOT NULL
    ,CONSTRAINT [pk_data_language]	PRIMARY KEY CLUSTERED ( [language_id] ASC )
)

CREATE TABLE [data].[string_value] (
     [string_id]            INT             NOT NULL
    ,[language_id]          INT             NOT NULL
    ,[value]                NVARCHAR(MAX)    NOT NULL 
    ,CONSTRAINT [pk_data_string_value]	PRIMARY KEY CLUSTERED ( [string_id] ASC, [language_id] ASC )
)










-- -- -----------------------------------------------------------------------------------------------------------
-- -- Table [data].[applied_migration]  (migration journal — Etapa 2 spec 15, Bloque C)
-- -- Records each numbered migration script (Scripts/Migrations/*.sql) applied by SqlMigrationRunner so it is
-- -- applied exactly once. On an existing database that predates the journal the runner creates this table
-- -- itself (idempotently) and bootstraps the historical migrations as already-applied.
-- -- -----------------------------------------------------------------------------------------------------------
-- CREATE TABLE [data].[applied_migration] (
--      [applied_migration_id]  INT             NOT NULL IDENTITY(1,1)
--     ,[migration_name]        NVARCHAR(260)   NOT NULL
--     ,[checksum]              NVARCHAR(64)         NULL
--     ,[applied_at]            DATETIME2(7)    NOT NULL
--         CONSTRAINT [def_applied_migration_applied_at] DEFAULT SYSUTCDATETIME()
--     ,[applied_by]            NVARCHAR(128)        NULL
--     ,[duration_ms]           INT                  NULL
--     ,CONSTRAINT [pk_applied_migration] PRIMARY KEY CLUSTERED ( [applied_migration_id] ASC )
--     ,CONSTRAINT [uq_applied_migration_name] UNIQUE ( [migration_name] )
-- );