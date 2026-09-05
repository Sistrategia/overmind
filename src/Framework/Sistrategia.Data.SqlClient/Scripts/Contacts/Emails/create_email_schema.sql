/*************************************************************************************************************
* create_email_schema.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE TABLE [contacts].[email] (
     [email_id]         INT             NOT NULL IDENTITY(1,1)
    ,[email_address]    NVARCHAR(256)   NOT NULL
    ,[value_key] AS CONVERT(VARBINARY(512),[email_address]) PERSISTED
    ,[value_length] AS DATALENGTH([email_address]) PERSISTED
    ,CONSTRAINT [pk_email] PRIMARY KEY CLUSTERED ( [email_id] ASC )	
    ,CONSTRAINT [uq_email_address] UNIQUE ([value_key],[value_length])
);

-- SET IDENTITY_INSERT [contacts].[email] ON;
-- INSERT INTO [contacts].[email] ([email_id],[email_address]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[email] OFF;

CREATE TABLE [contacts].[email_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,[value_key] AS CONVERT(VARBINARY(200),[location_name]) PERSISTED
    ,[value_length] AS DATALENGTH([location_name]) PERSISTED
    ,CONSTRAINT [pk_email_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_email_location_name] UNIQUE ([value_key],[value_length])
);
-- SET IDENTITY_INSERT [contacts].[email_location] ON;
-- INSERT INTO [contacts].[email_location] ([location_id],[location_name]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[email_location] OFF;

CREATE TABLE [contacts].[contact_email] (
     [contact_id]       INT             NOT NULL
    ,[tenant_id]        INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[email_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_email_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,[dbrow_version]  BIGINT  NOT NULL
    ,CONSTRAINT [fk_contact_email_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_contact_email_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [ck_contact_email_ordinal] CHECK ([ordinal] > 0)
    ,CONSTRAINT [pk_contact_email] PRIMARY KEY CLUSTERED (
        [contact_id] ASC, [ordinal] ASC
    )
    -- ,CONSTRAINT [fk_contact_email_contact]  FOREIGN KEY ([contact_id])
    --     REFERENCES [contacts].[contact]([contact_id])
    -- ,CONSTRAINT [fk_contact_email_email]    FOREIGN KEY ([email_id])
    --     REFERENCES [contacts].[email]([email_id])
    -- ,CONSTRAINT [fk_contact_email_location] FOREIGN KEY ([location_id])
    --     REFERENCES [contacts].[email_location]([location_id])
);

ALTER TABLE [contacts].[contact_email] WITH CHECK ADD CONSTRAINT 
    [fk_contact_email_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])

ALTER TABLE [contacts].[contact_email] WITH CHECK ADD CONSTRAINT 
    [fk_contact_email_email] FOREIGN KEY([email_id])
REFERENCES [contacts].[email] ([email_id])

ALTER TABLE [contacts].[contact_email] WITH CHECK ADD CONSTRAINT 
    [fk_contact_email_email_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[email_location] ([location_id])

-- ALTER TABLE [contacts].[contact_email] CHECK CONSTRAINT [fk_contact_email_contact]
-- ALTER TABLE [contacts].[contact_email] CHECK CONSTRAINT [fk_contact_email_email]

CREATE TABLE [contacts].[contact_email_history] (
     [dbrow_version]        BIGINT  NOT NULL
    ,[tenant_id]            INT     NOT NULL
    ,[dboperation_type_id]  INT     NOT NULL
    ,[contact_id]           INT     NOT NULL
    ,[ordinal]              INT     NOT NULL
    ,[email_id]             INT     NOT NULL
    ,[location_id]          INT         NULL
    ,[is_public]            BIT     NOT NULL
    ,CONSTRAINT [pk_contact_email_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
    ,CONSTRAINT [fk_email_history_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_email_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [fk_email_history_value] FOREIGN KEY ([email_id]) REFERENCES [contacts].[email]([email_id])
    ,CONSTRAINT [fk_email_history_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[email_location]([location_id])
    ,CONSTRAINT [ck_email_history_operation] CHECK ([dboperation_type_id] IN (1,2,3))
);

CREATE INDEX [ix_email_history_root] ON [contacts].[contact_email_history] ([contact_id],[ordinal],[dbrow_version] DESC)
    INCLUDE ([tenant_id],[dboperation_type_id],[email_id],[location_id],[is_public]);

-- Retained identity, including insert/delete in one unit. Restoring an identity is explicit.
CREATE TABLE [contacts].[contact_email_identity] (
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [tenant_id] INT NOT NULL, [created_version] BIGINT NOT NULL,
    CONSTRAINT [pk_contact_email_identity] PRIMARY KEY ([contact_id],[ordinal]),
    CONSTRAINT [fk_email_identity_contact] FOREIGN KEY ([contact_id]) REFERENCES [contacts].[contact]([contact_id]),
    CONSTRAINT [fk_email_identity_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_email_identity_ledger] FOREIGN KEY ([tenant_id],[created_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
);
ALTER TABLE [contacts].[contact_email] ADD CONSTRAINT [fk_email_live_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_email_identity]([contact_id],[ordinal]);
ALTER TABLE [contacts].[contact_email_history] ADD CONSTRAINT [fk_email_history_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_email_identity]([contact_id],[ordinal]);

-- Typed action evidence survives change/revert or insert/delete with no final child snapshot.
CREATE TABLE [contacts].[contact_email_action] (
    [tenant_id] INT NOT NULL, [dbrow_version] BIGINT NOT NULL, [action_ordinal] INT NOT NULL,
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [operation] VARCHAR(10) NOT NULL,
    [email_id] INT NOT NULL, [location_id] INT NULL, [is_public] BIT NOT NULL,
    [payload_version] INT NOT NULL CONSTRAINT [df_email_action_payload] DEFAULT 1,
    [show_in_timeline] BIT NOT NULL,
    CONSTRAINT [pk_contact_email_action] PRIMARY KEY ([tenant_id],[dbrow_version],[action_ordinal]),
    CONSTRAINT [fk_email_action_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version]),
    CONSTRAINT [fk_email_action_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_email_action_identity] FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_email_identity]([contact_id],[ordinal]),
    CONSTRAINT [fk_email_action_value] FOREIGN KEY ([email_id]) REFERENCES [contacts].[email]([email_id]),
    CONSTRAINT [fk_email_action_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[email_location]([location_id]),
    CONSTRAINT [ck_email_action_operation] CHECK ([operation] IN ('insert','update','delete','restore'))
);
CREATE INDEX [ix_email_action_root] ON [contacts].[contact_email_action] ([contact_id],[dbrow_version],[action_ordinal]);
