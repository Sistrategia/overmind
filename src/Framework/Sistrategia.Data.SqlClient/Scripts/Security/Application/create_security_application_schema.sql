/*************************************************************************************************************
* create_security_application_schema.sql is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2023-Sep-16
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- Table [security].[application]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [security].[application] (
     [application_id]   INT             NOT NULL IDENTITY(1,1)
    ,[tenant_id]        INT                 NULL

    ,[display_name]     NVARCHAR(100)   NOT NULL
    ,[created]          DATETIME2       NOT NULL DEFAULT(GETUTCDATE())
    ,[created_by]       INT             NOT NULL DEFAULT((1)) -- system
    ,[modified]         DATETIME2       NOT NULL DEFAULT(GETUTCDATE())
    ,[modified_by]      INT             NOT NULL DEFAULT((1)) -- system
    ,[image_url]        NVARCHAR(1024)      NULL
    ,[thumbnail_url]    NVARCHAR(1024)      NULL
    ,[is_private]       BIT             NOT NULL CONSTRAINT [def_security_application_is_private] DEFAULT ((0))	
    ,[is_system]        BIT             NOT NULL CONSTRAINT [def_security_application_is_system] DEFAULT ((0))	

    ,[application_name]        NVARCHAR(100)   NOT NULL    
    ,[description]      NVARCHAR(2048)  NOT NULL
    
    ,CONSTRAINT [px_security_application] PRIMARY KEY CLUSTERED ([application_id] ASC )    
    ,CONSTRAINT [uq_security_application_name_by_tenant] UNIQUE NONCLUSTERED ( [tenant_id] ASC, [application_name] ASC )
)

CREATE INDEX [ix_security_application_by_tenant] ON [security].[application] ( [tenant_id] ASC );

CREATE TABLE [security].[application_localized] (
     [application_id]   INT             NOT NULL
    ,[language_id]      INT             NOT NULL    
    ,[display_name]     NVARCHAR(100)   NOT NULL
    ,[description]      NVARCHAR(2048)  NOT NULL
    ,CONSTRAINT [px_security_application_localized] PRIMARY KEY CLUSTERED ([application_id] ASC, [language_id] ASC )
    ,CONSTRAINT [fk_security_application_localized_application] FOREIGN KEY ([application_id]) REFERENCES [security].[application] ([application_id]) ON DELETE CASCADE
    ,CONSTRAINT [fk_security_application_localized_language] FOREIGN KEY ([language_id]) REFERENCES [data].[language] ([language_id]) ON DELETE CASCADE
)

