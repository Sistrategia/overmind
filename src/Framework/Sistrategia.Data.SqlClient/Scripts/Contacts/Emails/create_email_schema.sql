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
    ,CONSTRAINT [pk_email] PRIMARY KEY CLUSTERED ( [email_id] ASC )	
    ,CONSTRAINT [uq_email_address] UNIQUE ([email_address])
);

-- SET IDENTITY_INSERT [contacts].[email] ON;
-- INSERT INTO [contacts].[email] ([email_id],[email_address]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[email] OFF;

CREATE TABLE [contacts].[email_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_email_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_email_location_name] UNIQUE ([location_name])
);
-- SET IDENTITY_INSERT [contacts].[email_location] ON;
-- INSERT INTO [contacts].[email_location] ([location_id],[location_name]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[email_location] OFF;

CREATE TABLE [contacts].[contact_email] (
     [contact_id]       INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[email_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_email_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,[dbrow_version]  BIGINT  NOT NULL
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
    ,[dboperation_type_id]  INT     NOT NULL
    ,[contact_id]           INT     NOT NULL
    ,[ordinal]              INT     NOT NULL
    ,[email_id]             INT     NOT NULL
    ,[location_id]          INT         NULL
    ,[is_public]            BIT     NOT NULL
    ,CONSTRAINT [pk_contact_email_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
);