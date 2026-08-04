/*************************************************************************************************************
* create_phone_schema.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE TABLE [contacts].[phone] (
     [phone_id]     INT             NOT NULL IDENTITY(1,1)
    ,[phone_number] NVARCHAR(25)    NOT NULL    
    ,[area_code]    NVARCHAR(6)         NULL
    ,[numbers_only] NVARCHAR(15)    NOT NULL
    ,[city_id]      INT                 NULL
    ,[state_id]     INT                 NULL
    ,[country_id]   INT                 NULL
    ,CONSTRAINT [pk_phone] PRIMARY KEY CLUSTERED ( [phone_id] ASC )	
--  ,CONSTRAINT [uq_phone_number] UNIQUE ([phone_number])
);

CREATE TABLE [contacts].[phone_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_phone_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_phone_location_name] UNIQUE ([location_name])
);
-- SET IDENTITY_INSERT [contacts].[phone_location] ON;
-- INSERT INTO [contacts].[phone_location] ([location_id],[location_name]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[phone_location] OFF;

CREATE TABLE [contacts].[contact_phone] (
     [contact_id]       INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[phone_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[extension]        NVARCHAR(25)        NULL -- 10
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_phone_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,CONSTRAINT [pk_contact_phone] PRIMARY KEY CLUSTERED				( [contact_id] ASC, [ordinal] ASC )
);

ALTER TABLE [contacts].[contact_phone]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_phone_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])
ALTER TABLE [contacts].[contact_phone]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_phone_phone] FOREIGN KEY([phone_id])
REFERENCES [contacts].[phone] ([phone_id])
ALTER TABLE [contacts].[contact_phone]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_phone_phone_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[phone_location] ([location_id])

ALTER TABLE [contacts].[contact_phone] NOCHECK CONSTRAINT [fk_contact_phone_contact]
ALTER TABLE [contacts].[contact_phone] NOCHECK CONSTRAINT [fk_contact_phone_phone]


CREATE TABLE [contacts].[contact_phone_history] (
     [dbrow_version]        BIGINT        NOT NULL
    ,[dboperation_type_id]  INT           NOT NULL
    ,[contact_id]           INT           NOT NULL
    ,[ordinal]              INT           NOT NULL
    ,[phone_id]             INT           NOT NULL
    ,[location_id]          INT               NULL
    ,[extension]            NVARCHAR(10)      NULL
    ,[is_public]            BIT           NOT NULL
    ,CONSTRAINT [pk_contact_phone_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
);