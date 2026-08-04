/*************************************************************************************************************
* create_entities_schema.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

-- IF SCHEMA_ID(N'entities') IS NULL EXEC (N'CREATE SCHEMA [entities]');
-- GO

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_type] (
     [entity_type_id]       INT                 NOT NULL -- IDENTITY(1,1)
    ,[code_name]            NVARCHAR(50)        NOT NULL
    ,[database_schema]      NVARCHAR(128)       NOT NULL
    ,[database_table]       NVARCHAR(128)       NOT NULL
    ,[database_view]        NVARCHAR(128)       NOT NULL
    ,CONSTRAINT [pk_entities_entity_type] PRIMARY KEY CLUSTERED ( [entity_type_id] ASC )
    ,CONSTRAINT [uq_entity_type_code] UNIQUE ([code_name])
);

INSERT INTO [entities].[entity_type] ([entity_type_id],[code_name],[database_schema],[database_table],[database_view]) 
VALUES (0, 'tenant', 'data', 'tenant', 'tenant_view');

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_type_property]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_type_property] (
     [entity_type_id]           INT            NOT NULL
    ,[entity_type_property_id]  INT            NOT NULL
    ,[code_name]                NVARCHAR(50)   NOT NULL
    ,[code_data_type]           NVARCHAR(50)   NOT NULL
    ,[db_column_name]           NVARCHAR(128)  NOT NULL
    ,[db_data_type]             NVARCHAR(128)  NOT NULL
    ,[ordinal]                  INT            NOT NULL CONSTRAINT [def_etp_ordinal] DEFAULT 99999
    ,CONSTRAINT [pk_entities_entity_type_property] PRIMARY KEY CLUSTERED
        ([entity_type_id],[entity_type_property_id])
    ,CONSTRAINT [fk_etp_entity_type] FOREIGN KEY ([entity_type_id])
        REFERENCES [entities].[entity_type]([entity_type_id])
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity] (
     [entity_id]            INT                 NOT NULL IDENTITY(1,1)    
    ,[entity_type_id]       INT                 NOT NULL
    ,[tenant_id]            INT                 NOT NULL
    ,[public_key]           UNIQUEIDENTIFIER    NOT NULL CONSTRAINT [def_entity_public_key] DEFAULT NEWID()
    ,[logical_key]          NVARCHAR(256)           NULL
    ,[display_name]         NVARCHAR(256)       NOT NULL
    ,[created]              DATETIME2           NOT NULL CONSTRAINT [def_entity_created] DEFAULT SYSUTCDATETIME()
    ,[created_by]           INT                 NOT NULL
    ,[modified]             DATETIME2			NOT NULL CONSTRAINT [def_entity_modified] DEFAULT SYSUTCDATETIME()
    ,[modified_by]          INT					NOT NULL
    ,[deleted]              DATETIME2               NULL
    ,[deleted_by]           INT                     NULL
    ,[locked]               DATETIME2               NULL
    ,[locked_by]            INT                     NULL
    ,[validated]            DATETIME2               NULL
    ,[validated_by]         INT                     NULL
    ,[summary]              NVARCHAR(MAX)           NULL
    ,[image_url]            NVARCHAR(1024)          NULL
    ,[thumbnail_url]        NVARCHAR(1024)          NULL
    ,[is_private]           BIT                 NOT NULL CONSTRAINT [def_entity_is_private] DEFAULT 0
    ,[is_system]            BIT                 NOT NULL CONSTRAINT [def_entity_is_system] DEFAULT 0

    ,[entity_version]       INT                 NOT NULL CONSTRAINT [def_entity_version] DEFAULT 1

    ,[dbrow_version]        BIGINT              NOT NULL

    ,CONSTRAINT [px_entities_entity] PRIMARY KEY CLUSTERED ( [entity_id] ASC )	
    ,CONSTRAINT [uqc_entities_entity_public_key] UNIQUE NONCLUSTERED ( [public_key] ASC )
);

ALTER TABLE [entities].[entity] WITH CHECK ADD CONSTRAINT [fk_entity_entity_type] FOREIGN KEY([entity_type_id])
REFERENCES [entities].[entity_type] ([entity_type_id])

ALTER TABLE [entities].[entity] CHECK CONSTRAINT [fk_entity_entity_type]

ALTER TABLE [entities].[entity] WITH CHECK ADD CONSTRAINT [fk_entity_tenant] FOREIGN KEY([tenant_id])
REFERENCES [data].[tenant] ([tenant_id])

ALTER TABLE [entities].[entity] CHECK CONSTRAINT [fk_entity_tenant]

CREATE INDEX [ix_entity_tenant] ON [entities].[entity]
    ([tenant_id],[entity_type_id]) INCLUDE ([display_name],[deleted]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_version_history]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_version_history] (
     [tenant_id]        INT    NOT NULL
    ,[dbrow_version]    BIGINT NOT NULL
    ,[entity_id]        INT    NOT NULL
    ,[entity_version]   INT    NOT NULL
    ,CONSTRAINT [pk_entity_version_history] PRIMARY KEY CLUSTERED ([entity_id],[entity_version])
    ,CONSTRAINT [fk_evh_ledger] FOREIGN KEY ([tenant_id],[dbrow_version])
        REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [fk_evh_entity] FOREIGN KEY ([entity_id])
        REFERENCES [entities].[entity]([entity_id])
);
CREATE UNIQUE INDEX [ux_evh_clock] ON [entities].[entity_version_history]
    ([entity_id],[dbrow_version]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_history]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_history] (
     [dbrow_version]        BIGINT              NOT NULL
    ,[tenant_id]            INT                 NOT NULL -- ?
    ,[entity_id]            INT                 NOT NULL
--  ,[entity_type_id]       INT                 NOT NULL
    ,[dboperation_type_id]  INT                 NOT NULL
    ,[logical_key]          NVARCHAR(256)           NULL
    ,[display_name]         NVARCHAR(256)       NOT NULL

    ,[deleted]              DATETIME2               NULL
    ,[deleted_by]           INT                     NULL
    ,[locked]               DATETIME2               NULL
    ,[locked_by]            INT                     NULL
    ,[validated]            DATETIME2               NULL
    ,[validated_by]         INT                     NULL

    ,[summary]              NVARCHAR(MAX)           NULL
    ,[image_url]            NVARCHAR(1024)          NULL
    ,[thumbnail_url]        NVARCHAR(1024)          NULL
    ,[is_private]           BIT                 NOT NULL

    ,CONSTRAINT [px_entities_entity_history] PRIMARY KEY CLUSTERED 
        ( [dbrow_version] ASC, [entity_id] ASC )
    ,CONSTRAINT [fk_entity_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version])
        REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
) 

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_metadata]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_metadata] (     
     [entity_id]            INT                 NOT NULL
--  ,[entity_type_id]       INT                 NOT NULL    
--  ,[modified]             DATETIME2			NOT NULL    CONSTRAINT [def_entity_metadata] DEFAULT (GETUTCDATE())
--  ,[modified_by]          INT					NOT NULL
    ,[json_data]            NVARCHAR(MAX)           NULL    
--  ,[dbrow_version]        BIGINT              NOT NULL

    ,CONSTRAINT [px_entity_metadata] PRIMARY KEY CLUSTERED ( [entity_id] ASC )
    ,CONSTRAINT [ck_entity_metadata_json] CHECK ([json_data] IS NULL OR ISJSON([json_data]) = 1)
    -- ,CONSTRAINT [px_entity_metadata] PRIMARY KEY CLUSTERED ( [dbrow_version] ASC, [entity_id] ASC )
) 

ALTER TABLE [entities].[entity_metadata] WITH CHECK ADD CONSTRAINT [fk_entity_metadata_entity] FOREIGN KEY([entity_id])
REFERENCES [entities].[entity] ([entity_id])

ALTER TABLE [entities].[entity_metadata] CHECK CONSTRAINT [fk_entity_metadata_entity]

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[identifier_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[identifier_type] (
     [identifier_type_id]       INT                 NOT NULL IDENTITY(1,1)
    ,[identifier_key]           NVARCHAR(256)       NOT NULL 
    ,[identifier_name]          NVARCHAR(256)       NOT NULL 
--  ,[language_code]            NVARCHAR(6)             NULL
    ,CONSTRAINT [px_entities_identifier_type] PRIMARY KEY CLUSTERED ( [identifier_type_id] ASC )
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[identifier]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[identifier] (
     [identifier_id]            INT                 NOT NULL IDENTITY(1,1)
    ,[identifier_value]         NVARCHAR(256)       NOT NULL  
    ,CONSTRAINT [px_entities_identifier] PRIMARY KEY CLUSTERED ( [identifier_id] ASC)
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_identifiers] - Temporal identifier mappings (supports history & future-dated)
-- Primary key includes from_date to allow the same identifier to be reused across different time periods
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_identifiers] (
     [entity_id]            INT                 NOT NULL
    ,[identifier_type_id]   INT                 NOT NULL
    ,[identifier_id]        INT                 NOT NULL
    ,[from_date]            DATETIME2           NOT NULL
    ,[to_date]              DATETIME2               NULL  
    ,CONSTRAINT [px_entities_entity_identifiers] PRIMARY KEY CLUSTERED ( [entity_id] ASC, [identifier_type_id] ASC, [identifier_id] ASC, [from_date] ASC)
);

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vatid', 'VATID')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('rfc', 'RFC')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('curp', 'CURP')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('studentid', 'Matrícula')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('cedula.numero', 'Cédula Profesional')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('nss', 'NSS')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('npie', 'NPIE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('folio', 'Folio')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('operacion', 'Operación')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse', 'REPSE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse.folio', 'REPSE Folio')
-- INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse.actividad', 'Proveedor REPSE Actividad')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplierid', 'ID del Proveedor')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contract.id', 'Contrato')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contactoname', 'Contacto')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contactoemail', 'Correo')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('razonsocial','Razón Social')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('customer.name', 'Cliente')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('customer.rfc', 'Cliente RFC')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.name', 'Proveedor')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.rfc', 'Proveedor RFC')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.npie', 'Proveedor NPIE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse', 'Proveedor REPSE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse.folio', 'Proveedor REPSE Folio')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse.actividad', 'Proveedor REPSE Actividad')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vigencia.inicio', 'Inicio Vigencia')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vigencia.fin', 'Fin Vigencia')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('ods', 'ODS')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('uuid', 'UUID')



-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[point_in_time]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[point_in_time] (
     [point_in_time_id]         INT             NOT NULL IDENTITY(1,1)    
    ,[code_name]                NVARCHAR(50)    NOT NULL
    ,[display_name]             NVARCHAR(50)    NOT NULL
    ,[display_name_es]          NVARCHAR(50)    NOT NULL    
    ,CONSTRAINT [px_entities_point_in_time] PRIMARY KEY CLUSTERED ( [point_in_time_id] ASC)
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[day_in_time_value]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[day_in_time_value] (
     [date]                     DATE            NOT NULL     
    ,[year]                     AS (DATEPART(YEAR, [date]))
    ,[quarter]                  AS (DATEPART(Quarter,   [date]))
    ,[month]                    AS (DATEPART(MONTH, [date]))
    ,[day]                      AS (DATEPART(DAY, [date]))
    ,[month_name]               AS ( FORMAT([date], 'MMMM', 'en-US') )
    ,[month_name_mx]            AS ( UPPER(LEFT( FORMAT([date], 'MMMM', 'es-MX'), 1 )) + SUBSTRING ( FORMAT([date], 'MMMM', 'es-MX'), 2, LEN( FORMAT([date], 'MMMM', 'es-MX')) ) )
    -- ,[year_week]                AS (DATEPART(ISO_WEEK, [date]))
    ,[week]                     AS (DATEPART(WEEK, [date]))
    ,[weekday]                  AS (DATEPART(WEEKDAY, [date]))
    -- ,[weekday_mx]               AS ( FORMAT([date], 'dw', 'es-mx') )
    ,[weekday_mx]               AS ( CASE WHEN (DATEPART(WEEKDAY, [date]) - 1 > 0 ) THEN DATEPART(WEEKDAY, [date]) - 1 ELSE 7 END )
    ,[weekdayname]              AS (DATENAME(WEEKDAY, [date]))    
    ,[weekdayname_mx]           AS ( UPPER(LEFT( FORMAT([date], 'dddd', 'es-MX'), 1 )) + SUBSTRING ( FORMAT([date], 'dddd', 'es-MX'), 2, LEN( FORMAT([date], 'dddd', 'es-MX')) ) ) --  AS ( FORMAT([date], 'dddd', 'es-MX') )
    ,CONSTRAINT [px_entities_day_in_time_value] PRIMARY KEY CLUSTERED ( [date] ASC)
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[point_in_time_value]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[point_in_time_value] (
--     [point_in_time_value_id]   INT             NOT NULL IDENTITY(1,1)    
     [date_time]                DATETIMEOFFSET  NOT NULL DEFAULT((GETUTCDATE()))  
    ,[date]                     AS (CAST([date_time] AS DATE)) -- DATE            NOT NULL
    ,[time]                     AS (CAST([date_time] AS TIME))    
    -- ,CONSTRAINT [px_entities_point_in_time_value] PRIMARY KEY CLUSTERED ( [point_in_time_value_id] ASC)
    ,CONSTRAINT [px_entities_point_in_time_value] PRIMARY KEY CLUSTERED ( [date_time] ASC)
);

-- FK


INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('created','Created','Fecha de creación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('modified','Modified','Fecha de modificación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('validated','Validated','Fecha de validación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('locked','Locked','Fecha de Bloqueo')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('deleted','Deleted','Fecha de Eliminación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('generated','Generated','Fecha de Generación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('uploaded','Uploaded','Fecha de Carga')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('initial','Initial','Fecha de Inicio')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('final','Final','Fecha de Fin')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('initial_validity','Inital Validity','Inicio de Vigencia')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('final_validity','Final Validity','Fin de Vigencia')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('contract_signed','Contract Signed','Firma de Contrato')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('transaction_date','Transaction Date','Fecha de Transacción')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('operation_date','Operation Date','Fecha de Operación')


-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_day_in_time]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_day_in_time] (
     [entity_id]                INT                 NOT NULL
    ,[point_in_time_id]         INT                 NOT NULL
    ,[date]                     DATE                NOT NULL
    ,CONSTRAINT [px_entities_entity_day_in_time] PRIMARY KEY CLUSTERED ( [entity_id] ASC, [point_in_time_id], [date] ASC)
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[entity_point_in_time]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[entity_point_in_time] (
     [entity_id]                INT                 NOT NULL
    ,[point_in_time_id]         INT                 NOT NULL
--  ,[point_in_time_value_id]   INT                 NOT NULL    
    ,[date_time]                DATETIMEOFFSET      NOT NULL
--  ,CONSTRAINT [px_entities_entity_point_in_time] PRIMARY KEY CLUSTERED ( [entity_id] ASC, [point_in_time_id], [point_in_time_value_id] ASC)
    ,CONSTRAINT [px_entities_entity_point_in_time] PRIMARY KEY CLUSTERED ( [entity_id] ASC, [point_in_time_id], [date_time] ASC)
);


-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[identifier]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[year_month_dimension] (
     [entity_id]       INT      NOT NULL -- IDENTITY(1,1)
    ,[year]            INT      NOT NULL  
--  ,[quarter]         INT      NOT NULL  
    ,[month]           INT          NULL -- NOT NULL      
    ,CONSTRAINT [px_entities_year_month_dimension] PRIMARY KEY CLUSTERED ( [entity_id] ASC)
);

-- CREATE NONCLUSTERED INDEX [ix_entities_year_month] ON [entities].[year_month_dimension] ([year] ASC, [month] ASC, [entity_id] ASC);
