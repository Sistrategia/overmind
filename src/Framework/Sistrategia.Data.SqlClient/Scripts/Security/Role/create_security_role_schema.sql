/*************************************************************************************************************
* create_security_role_schema.sql is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2023-Sep-16
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- Table [security].[role]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [security].[role] (
     [role_id]          INT             NOT NULL IDENTITY(1,1)
    ,[tenant_id]        INT                 NULL
--  ,[application_id]   INT                 NULL

    ,[display_name]     NVARCHAR(100)   NOT NULL
    ,[created]          DATETIME2       NOT NULL DEFAULT(GETUTCDATE())
    ,[created_by]       INT             NOT NULL DEFAULT((1)) -- system
    ,[modified]         DATETIME2       NOT NULL DEFAULT(GETUTCDATE())
    ,[modified_by]      INT             NOT NULL DEFAULT((1)) -- system
    ,[image_url]        NVARCHAR(1024)      NULL
    ,[thumbnail_url]    NVARCHAR(1024)      NULL
    ,[is_private]       BIT             NOT NULL CONSTRAINT [def_security_role_is_private] DEFAULT ((0))	
    ,[is_system]        BIT             NOT NULL CONSTRAINT [def_security_role_is_system] DEFAULT ((0))	

    ,[role_name]        NVARCHAR(100)   NOT NULL    
    ,[description]      NVARCHAR(2048)  NOT NULL

    ,[concurrency_stamp] NVARCHAR(100)      NULL -- MS Identity compatibility

    -- ,[display_name_es]  NVARCHAR(100)       NULL
    -- ,[description_es]   NVARCHAR(2048)      NULL
    -- ,[display_name_ja]  NVARCHAR(100)       NULL
    -- ,[description_ja]   NVARCHAR(2048)      NULL
    -- ,[display_name_pt]  NVARCHAR(100)       NULL
    -- ,[description_pt]   NVARCHAR(2048)      NULL
    ,CONSTRAINT [px_security_role] PRIMARY KEY CLUSTERED ([role_id] ASC )
    -- ,CONSTRAINT [uq_security_role_by_tenant] INDEX NONCLUSTERED ( [tenant_id] ASC )
    ,CONSTRAINT [uq_security_role_name_by_tenant] UNIQUE NONCLUSTERED ( [tenant_id] ASC, [role_name] ASC )
)

CREATE INDEX [ix_security_role_by_tenant] ON [security].[role] ( [tenant_id] ASC );


CREATE TABLE [security].[role_localized] (
     [role_id]          INT             NOT NULL
    ,[language_id]      INT             NOT NULL    
    ,[display_name]     NVARCHAR(100)   NOT NULL
    ,[description]      NVARCHAR(2048)  NOT NULL
    ,CONSTRAINT [px_security_role_localized] PRIMARY KEY CLUSTERED ([role_id] ASC, [language_id] ASC )
    ,CONSTRAINT [fk_security_role_localized_role] FOREIGN KEY ([role_id]) REFERENCES [security].[role] ([role_id]) ON DELETE CASCADE
    ,CONSTRAINT [fk_security_role_localized_language] FOREIGN KEY ([language_id]) REFERENCES [data].[language] ([language_id]) ON DELETE CASCADE
)

--CREATE TABLE [AspNetRoles] (
--    [Id] nvarchar(450) NOT NULL,
--    [Name] nvarchar(256) NULL,
--    [NormalizedName] nvarchar(256) NULL,
--    [ConcurrencyStamp] nvarchar(max) NULL,
--    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
--);

--CREATE TABLE [AspNetRoleClaims] (
--    [Id] int NOT NULL IDENTITY,
--    [RoleId] nvarchar(450) NOT NULL,
--    [ClaimType] nvarchar(max) NULL,
--    [ClaimValue] nvarchar(max) NULL,
--    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
--    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
--);

-- CREATE TABLE [security_role](
--      [role_id]              UNIQUEIDENTIFIER    NOT NULL    CONSTRAINT [def_security_role_role_id] DEFAULT (NEWID())
--     ,[application_id]       UNIQUEIDENTIFIER        NULL 	
--     ,[display_name]         NVARCHAR(256)       NOT NULL 
--     ,[created]              DATETIME            NOT NULL	
--     ,[created_by]           UNIQUEIDENTIFIER    NOT NULL
--     ,[modified]             DATETIME            NOT NULL 	
--     ,[modified_by]          UNIQUEIDENTIFIER    NOT NULL	
--     ,[locked]               DATETIME                NULL    CONSTRAINT [def_security_role_locked] DEFAULT (NULL)
--     ,[locked_by]            UNIQUEIDENTIFIER        NULL    CONSTRAINT [def_security_role_locked_by] DEFAULT (NULL)
--     ,[validated]            DATETIME                NULL    CONSTRAINT [def_security_role_validated] DEFAULT (NULL)
--     ,[validated_by]         UNIQUEIDENTIFIER        NULL    CONSTRAINT [def_security_role_validated_by] DEFAULT (NULL)
--     ,[summary]              NVARCHAR(MAX)           NULL
--     ,[image_url]            NVARCHAR(1024)          NULL
--     ,[thumbnail_url]        NVARCHAR(1024)          NULL	
--     ,[is_private]           BIT                 NOT NULL    CONSTRAINT [def_security_role_is_private] DEFAULT ((0))	
--     ,[is_system]            BIT                 NOT NULL    CONSTRAINT [def_security_role_is_system] DEFAULT ((0))

--     ,[role_name]            NVARCHAR(256)       NOT NULL 
-- --  ,[lowered_role_name]    NVARCHAR(256)       NOT NULL 
--     ,[description]          NVARCHAR(256)           NULL 

-- --  ,[dbrow_identity]       BIGINT              NOT NULL IDENTITY(1,1)
--     ,[dbrow_version]        BIGINT              NOT NULL

-- -- NONCLUSTERED INDEX FOR GUID TO AVOID FRAGMENTATION
--     ,CONSTRAINT [pk_security_role]                  PRIMARY KEY NONCLUSTERED ( [role_id] ASC )
--     ,CONSTRAINT [uq_security_role_role_name]        UNIQUE CLUSTERED    ( [role_name] ASC )
-- --  ,CONSTRAINT [uq_security_role_role_name]        UNIQUE NONCLUSTERED ( [role_name] ASC )
--     ,CONSTRAINT [uq_security_role_display_name]     UNIQUE NONCLUSTERED ( [display_name] ASC )
-- --  ,CONSTRAINT [uqc_security_role_dbrow_identity]  UNIQUE CLUSTERED    ( [dbrow_identity] ASC )
-- )