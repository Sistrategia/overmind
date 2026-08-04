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
-- Table [data].[language]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[language] (
     [language_id]          INT             NOT NULL -- IDENTITY (1,1)
    ,[code]                 NVARCHAR(6)     NOT NULL
    -- ,[language]             NVARCHAR(50)    NOT NULL
    -- ,[localized_language]   NVARCHAR(50)    NOT NULL
    ,[display_name]         NVARCHAR(50)    NOT NULL
    ,[localized_name]       NVARCHAR(50)    NOT NULL
    ,CONSTRAINT [pk_data_language]	PRIMARY KEY CLUSTERED ( [language_id] ASC )
    ,CONSTRAINT [uq_data_language_code] UNIQUE ([code])
);

MERGE [data].[language] AS t
USING (VALUES (1,N'en',N'English',N'English'),
              (2,N'es-MX',N'Spanish (Mexico)',N'Español (México)'),
              (3,N'ja',N'Japanese',N'日本語')) AS s([id],[code],[name],[loc])
ON t.[language_id] = s.[id]
WHEN NOT MATCHED THEN INSERT ([language_id],[code],[display_name],[localized_name])
    VALUES (s.[id],s.[code],s.[name],s.[loc]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[string_value]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[string_value] (
     [string_id]            INT             NOT NULL
    ,[language_id]          INT             NOT NULL
    ,[value]                NVARCHAR(MAX)   NOT NULL 
    ,CONSTRAINT [pk_data_string_value]	PRIMARY KEY CLUSTERED ( [string_id] ASC, [language_id] ASC )
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dboperation_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[dboperation_type] (
     [dboperation_type_id]      INT             NOT NULL
    ,[dboperation_code]         NCHAR(6)        NOT NULL
    -- ,[display_name]             NVARCHAR(255)   NOT NULL
    -- ,[action_display_name]      NVARCHAR(255)   NOT NULL
    ,CONSTRAINT [pk_dboperation_type]   PRIMARY KEY CLUSTERED ( [dboperation_type_id] ASC )
    ,CONSTRAINT [uq_dboperation_type_code] UNIQUE ([dboperation_code])
);

MERGE [data].[dboperation_type] AS t
USING (VALUES (1,N'INSERT'),(2,N'UPDATE'),(3,N'DELETE'),(4,N'UNDOVR'),(5,N'UNDODL'),
              (6,N'LOCKED'),(7,N'UNLOCK'),(8,N'VALIDA'),(9,N'INVALD'),(10,N'ERASED')) AS s([id],[code])
ON t.[dboperation_type_id] = s.[id]
WHEN NOT MATCHED THEN INSERT ([dboperation_type_id],[dboperation_code]) VALUES (s.[id], s.[code]);

-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (1, 'INSERT', 'Agregar', 'Agregó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (2, 'UPDATE', 'Actualizar', 'Actualizó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (3, 'DELETE', 'Eliminar', 'Eliminó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (4, 'UNDOVR', 'Restaurar', 'Restauró');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (5, 'UNDODL', 'Recuperar', 'Recuperó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (6, 'LOCKED', 'Bloquear', 'Bloqueó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (7, 'UNLOCK', 'Desbloquear', 'Desbloqueó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (8, 'VALIDA', 'Validar', 'Validó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (9, 'INVALD', 'Desvalidar', 'Desvalidó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (10, 'ERASED', 'Eliminar Permanentemente', 'Eliminó Permanentemente');

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dboperation_type_localized]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[dboperation_type_localized] (
     [dboperation_type_id]  INT            NOT NULL
    ,[language_id]          INT            NOT NULL
    ,[display_name]         NVARCHAR(100)  NOT NULL
    ,[action_display_name]  NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_dboperation_type_localized] PRIMARY KEY CLUSTERED ([dboperation_type_id],[language_id])
    ,CONSTRAINT [fk_dotl_op] FOREIGN KEY ([dboperation_type_id])
        REFERENCES [data].[dboperation_type]([dboperation_type_id])
    ,CONSTRAINT [fk_dotl_language] FOREIGN KEY ([language_id])
        REFERENCES [data].[language]([language_id]) ON DELETE CASCADE
    );

MERGE [data].[dboperation_type_localized] AS t
USING (VALUES
     (1,1,N'Insert',N'Added'),        (1,2,N'Agregar',N'Agregó')
    ,(2,1,N'Update',N'Updated'),      (2,2,N'Actualizar',N'Actualizó')
    ,(3,1,N'Delete',N'Deleted'),      (3,2,N'Eliminar',N'Eliminó')
    ,(4,1,N'Restore',N'Restored'),    (4,2,N'Restaurar',N'Restauró')
    ,(5,1,N'Recover',N'Recovered'),   (5,2,N'Recuperar',N'Recuperó')
    ,(6,1,N'Lock',N'Locked'),         (6,2,N'Bloquear',N'Bloqueó')
    ,(7,1,N'Unlock',N'Unlocked'),     (7,2,N'Desbloquear',N'Desbloqueó')
    ,(8,1,N'Validate',N'Validated'),  (8,2,N'Validar',N'Validó')
    ,(9,1,N'Invalidate',N'Invalidated'),(9,2,N'Desvalidar',N'Desvalidó')
    ,(10,1,N'Erase',N'Erased'),       (10,2,N'Borrar (regulatorio)',N'Borró (regulatorio)')
) AS s([op],[lang],[dn],[adn])
ON t.[dboperation_type_id] = s.[op] AND t.[language_id] = s.[lang]
WHEN NOT MATCHED THEN INSERT ([dboperation_type_id],[language_id],[display_name],[action_display_name])
    VALUES (s.[op],s.[lang],s.[dn],s.[adn]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[module]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[module] (
     [module_id]       INT           NOT NULL IDENTITY(1,1)
    ,[code_name]       NVARCHAR(50)  NOT NULL
    ,[schema_version]  NVARCHAR(50)  NOT NULL
    ,[install_order]   INT           NOT NULL
    ,CONSTRAINT [pk_data_module] PRIMARY KEY CLUSTERED ([module_id])
    ,CONSTRAINT [uq_data_module_code] UNIQUE ([code_name])
);

MERGE [data].[module] AS t
USING (VALUES (N'data',N'1.0.0',1),(N'entities',N'1.0.0',2),
              (N'contacts',N'1.0.0',3),(N'security',N'1.0.0',4)) AS s([code_name],[schema_version],[install_order])
ON t.[code_name] = s.[code_name]
WHEN NOT MATCHED THEN INSERT ([code_name],[schema_version],[install_order]) VALUES (s.[code_name],s.[schema_version],s.[install_order]);

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
-- Table [data].[applied_migration]  (migration journal — Etapa 2 spec 15, Bloque C)
-- Records each numbered migration script (Scripts/Migrations/*.sql) applied by SqlMigrationRunner so it is
-- applied exactly once. On an existing database that predates the journal the runner creates this table
-- itself (idempotently) and bootstraps the historical migrations as already-applied.
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [data].[applied_migration] (
     [applied_migration_id] INT             NOT NULL IDENTITY(1,1)
    ,[module_id]            INT             NOT NULL
    ,[version]              NVARCHAR(50)    NOT NULL
    -- ,[migration_name]       NVARCHAR(260)   NOT NULL
    ,[script_name]          NVARCHAR(256)   NOT NULL
    -- ,[checksum]             NVARCHAR(64)        NULL
    ,[checksum]             BINARY(32)      NOT NULL
    ,[applied]              DATETIME2       NOT NULL
        CONSTRAINT [def_applied_migration_applied] DEFAULT SYSUTCDATETIME()
    ,[applied_by]           NVARCHAR(128)       NULL -- NOT NULL ?
    ,[duration_ms]          INT                 NULL
    ,CONSTRAINT [pk_applied_migration] PRIMARY KEY CLUSTERED ( [applied_migration_id] ASC )
    -- ,CONSTRAINT [uq_applied_migration_name] UNIQUE ( [migration_name] )
    -- ,CONSTRAINT [uq_applied_script_name] UNIQUE ( [script_name] )
    ,CONSTRAINT [uq_applied_migration] UNIQUE ([module_id],[script_name])
    ,CONSTRAINT [fk_applied_migration_module] FOREIGN KEY ([module_id])
            REFERENCES [data].[module]([module_id])
);