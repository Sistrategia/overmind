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

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[event_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[event_type] (
     [event_type_id]        INT            NOT NULL IDENTITY(1,1)
--  ,[event_code]           NVARCHAR(100)  NOT NULL
    ,[code_name]            NVARCHAR(100)  NOT NULL
--  ,[display_name]         NVARCHAR(256)       NOT NULL    
--  ,[description]          NVARCHAR(2048)          NULL
    ,CONSTRAINT [pk_entities_event_type] PRIMARY KEY CLUSTERED ([event_type_id] ASC )
    -- ,CONSTRAINT [uq_event_type_code] UNIQUE ([event_code])
    ,CONSTRAINT [uq_event_type_code] UNIQUE ([code_name])
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[event_type_localized]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[event_type_localized] (
     [event_type_id]     INT             NOT NULL
    ,[language_id]       INT             NOT NULL
    ,[title_template]    NVARCHAR(256)   NOT NULL
    ,[summary_template]  NVARCHAR(1024)      NULL
    ,CONSTRAINT [pk_event_type_localized] PRIMARY KEY CLUSTERED ([event_type_id],[language_id])
    ,CONSTRAINT [fk_etl_event_type] FOREIGN KEY ([event_type_id])
        REFERENCES [entities].[event_type]([event_type_id])
    ,CONSTRAINT [fk_etl_language] FOREIGN KEY ([language_id])
        REFERENCES [data].[language]([language_id]) ON DELETE CASCADE
);



-- -----------------------------------------------------------------------------------------------------------
-- Table [entities].[event]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [entities].[event] (
     [event_id]             BIGINT           NOT NULL IDENTITY(1,1)
    ,[event_type_id]        INT              NOT NULL
    ,[tenant_id]            INT              NOT NULL
    ,[public_key]           UNIQUEIDENTIFIER NOT NULL
--  ,[display_name]         NVARCHAR(256)       NOT NULL
--  ,[author_entity_id]     INT              NOT NULL -- created_by
    ,[created]              DATETIME2        NOT NULL    CONSTRAINT [def_event_created] DEFAULT (GETUTCDATE())
    ,[created_by]           INT              NOT NULL
    ,[subject_type_id]      INT              NOT NULL
    ,[subject_id]           INT              NOT NULL -- ,[subject_entity_id]
    ,[subject_public_key]   UNIQUEIDENTIFIER NOT NULL
    ,[event_args]           NVARCHAR(MAX)        NULL -- created ?
--  ,[occurred]             DATETIME2        NOT NULL
--  ,[summary]              NVARCHAR(MAX)           NULL    
    ,[is_system]            BIT              NOT NULL CONSTRAINT [def_event_is_system] DEFAULT 0
    ,[dbrow_version]        BIGINT           NOT NULL
    ,CONSTRAINT [pk_entities_event] PRIMARY KEY CLUSTERED ([event_id])
    ,CONSTRAINT [uqc_entities_event_public_key] UNIQUE NONCLUSTERED ( [public_key] ASC )
    ,CONSTRAINT [fk_event_type] FOREIGN KEY ([event_type_id])
        REFERENCES [entities].[event_type]([event_type_id])
    ,CONSTRAINT [fk_event_subject_type] FOREIGN KEY ([subject_type_id])
        REFERENCES [entities].[entity_type]([entity_type_id])
    ,CONSTRAINT [fk_event_ledger] FOREIGN KEY ([tenant_id],[dbrow_version])
        REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [ck_event_args_json] CHECK ([event_args] IS NULL OR ISJSON([event_args]) = 1)
);
-- CREATE INDEX [ix_event_subject] ON [entities].[event]
--     ([tenant_id],[subject_entity_id],[occurred] DESC);
CREATE INDEX [ix_event_subject] ON [entities].[event]
    ([tenant_id],[subject_id],[created] DESC);


-- ALTER TABLE [entities].[event]  WITH CHECK ADD  CONSTRAINT [fk_event_event_type] FOREIGN KEY([event_type_id])
-- REFERENCES [entities].[event_type] ([event_type_id])
-- --ALTER TABLE [entities].[event] NOCHECK CONSTRAINT [fk_event_event_type] 
-- ALTER TABLE [entities].[event] CHECK CONSTRAINT [fk_event_event_type] 
-- --ALTER TABLE [entities].[event]  WITH CHECK ADD  CONSTRAINT [fk_event_user] FOREIGN KEY([created_by])
-- --REFERENCES [security].[user] ([user_id])
-- --ALTER TABLE [entities].[event] CHECK CONSTRAINT [fk_event_user]

