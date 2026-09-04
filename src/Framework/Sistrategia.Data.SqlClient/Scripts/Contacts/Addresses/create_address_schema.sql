/*************************************************************************************************************
* create_address_schema.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE TABLE [contacts].[country] (
     [country_id]	INT             NOT NULL IDENTITY(1,1)
    ,[country]      NVARCHAR(256)   NOT NULL 
    ,[integration_int_id]   INT         NULL
    ,CONSTRAINT [pk_country] PRIMARY KEY CLUSTERED ( [country_id] ASC )	
    ,CONSTRAINT [uq_country_name] UNIQUE ([country])
);

CREATE TABLE [contacts].[state] (
     [state_id]     INT             NOT NULL IDENTITY(1,1)
    ,[state]        NVARCHAR(256)   NOT NULL
    ,[country_id]   INT                 NULL
    ,[integration_int_id]   INT         NULL    
    ,CONSTRAINT [pk_state] PRIMARY KEY CLUSTERED ( [state_id] ASC )	
    ,CONSTRAINT [uq_state_name] UNIQUE ([state])
);

CREATE TABLE [contacts].[county] (
     [county_id]      INT             NOT NULL IDENTITY(1,1)
    ,[county]         NVARCHAR(256)   NOT NULL 
    ,[state_id]       INT                 NULL
    ,[integration_int_id]   INT         NULL
    ,CONSTRAINT [pk_county] PRIMARY KEY CLUSTERED ( [county_id] ASC )	  
    ,CONSTRAINT [uq_county_name] UNIQUE ([county])
);

CREATE TABLE [contacts].[city] (
     [city_id]      INT             NOT NULL IDENTITY(1,1)
    ,[city]         NVARCHAR(256)   NOT NULL
    ,[state_id]     INT                 NULL 
    ,[integration_int_id]   INT         NULL    
    ,CONSTRAINT [pk_city] PRIMARY KEY CLUSTERED ( [city_id] ASC )	  
    -- ,CONSTRAINT [uq_city_name] UNIQUE ([city])
);

CREATE TABLE [contacts].[colony] (
     [colony_id]      INT             NOT NULL IDENTITY(1,1)
    ,[colony]         NVARCHAR(256)   NOT NULL 
    ,[city_id]       INT                  NULL
    ,[integration_int_id]   INT           NULL
    ,CONSTRAINT [pk_colony] PRIMARY KEY CLUSTERED ( [colony_id] ASC )
    -- ,CONSTRAINT [uq_colony_name] UNIQUE ([colony])
);

CREATE TABLE [contacts].[address] (
     [address_id]       INT             NOT NULL IDENTITY(1,1)
    ,[address1]         NVARCHAR(256)       NULL    
    ,[address2]         NVARCHAR(256)       NULL

    ,[street_name]      NVARCHAR(256)	    NULL
    ,[ext_number]       NVARCHAR(25)	    NULL
    ,[int_number]       NVARCHAR(25)	    NULL
    ,[colony_id]        INT                 NULL
    ,[county_id]        INT                 NULL

    ,[zip_code]         NVARCHAR(10)        NULL
    ,[city_id]		    INT                 NULL
    ,[state_id]         INT                 NULL
    ,[country_id]       INT                 NULL    
    ,[references]       NVARCHAR(256)		NULL
    ,CONSTRAINT [pk_address] PRIMARY KEY CLUSTERED ( [address_id] ASC )	
    ,CONSTRAINT [fk_address_colony] FOREIGN KEY([colony_id]) REFERENCES [contacts].[colony] ([colony_id])
    ,CONSTRAINT [fk_address_county] FOREIGN KEY([county_id]) REFERENCES [contacts].[county] ([county_id])
    ,CONSTRAINT [fk_address_city] FOREIGN KEY([city_id]) REFERENCES [contacts].[city] ([city_id])
    ,CONSTRAINT [fk_address_state] FOREIGN KEY([state_id]) REFERENCES [contacts].[state] ([state_id])
    ,CONSTRAINT [fk_address_country] FOREIGN KEY([country_id]) REFERENCES [contacts].[country] ([country_id])
);

CREATE TABLE [contacts].[address_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_address_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_address_location_name] UNIQUE ([location_name])
);
-- SET IDENTITY_INSERT [contacts].[address_location] ON;
-- INSERT INTO [contacts].[address_location] ([location_id],[location_name]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[address_location] OFF;

CREATE TABLE [contacts].[contact_address] (
     [contact_id]       INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[address_id]       INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_address_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,CONSTRAINT [pk_contact_address] PRIMARY KEY CLUSTERED				( [contact_id] ASC, [ordinal] ASC )
);

ALTER TABLE [contacts].[contact_address]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_address_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])
ALTER TABLE [contacts].[contact_address]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_address_address] FOREIGN KEY([address_id])
REFERENCES [contacts].[address] ([address_id])
ALTER TABLE [contacts].[contact_address]  WITH NOCHECK ADD  CONSTRAINT [fk_contact_address_address_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[address_location] ([location_id])

ALTER TABLE [contacts].[contact_address] NOCHECK CONSTRAINT [fk_contact_address_contact]
ALTER TABLE [contacts].[contact_address] NOCHECK CONSTRAINT [fk_contact_address_address]
ALTER TABLE [contacts].[contact_address] NOCHECK CONSTRAINT [fk_contact_address_address_location]
