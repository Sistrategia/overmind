-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_address_schema.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE TABLE [contacts].[country] (
    [country_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_country] PRIMARY KEY,
    [country] NVARCHAR(256) NOT NULL,
    [integration_int_id] INT NULL,
    [value_key] AS CONVERT(VARBINARY(512),[country]) PERSISTED,
    [value_length] AS DATALENGTH([country]) PERSISTED
);
CREATE UNIQUE INDEX [uq_country_scoped_value] ON [contacts].[country] ([value_key],[value_length]);

CREATE TABLE [contacts].[state] (
    [state_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_state] PRIMARY KEY,
    [state] NVARCHAR(256) NOT NULL,
    [country_id] INT NOT NULL,
    [integration_int_id] INT NULL,
    [value_key] AS CONVERT(VARBINARY(512),[state]) PERSISTED,
    [value_length] AS DATALENGTH([state]) PERSISTED,
    CONSTRAINT [fk_state_country] FOREIGN KEY ([country_id]) REFERENCES [contacts].[country]([country_id]),
    CONSTRAINT [uq_state_country] UNIQUE ([state_id],[country_id])
);
CREATE UNIQUE INDEX [uq_state_scoped_value] ON [contacts].[state] ([country_id],[value_key],[value_length]);

CREATE TABLE [contacts].[county] (
    [county_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_county] PRIMARY KEY,
    [county] NVARCHAR(256) NOT NULL,
    [country_id] INT NOT NULL,
    [state_id] INT NULL,
    [integration_int_id] INT NULL,
    [value_key] AS CONVERT(VARBINARY(512),[county]) PERSISTED,
    [value_length] AS DATALENGTH([county]) PERSISTED,
    [state_scope] AS ISNULL([state_id],0) PERSISTED,
    CONSTRAINT [fk_county_country] FOREIGN KEY ([country_id]) REFERENCES [contacts].[country]([country_id]),
    CONSTRAINT [fk_county_state] FOREIGN KEY ([state_id]) REFERENCES [contacts].[state]([state_id]),
    CONSTRAINT [fk_county_state_country] FOREIGN KEY ([state_id],[country_id]) REFERENCES [contacts].[state]([state_id],[country_id]),
    CONSTRAINT [uq_county_country] UNIQUE ([county_id],[country_id]),
    CONSTRAINT [uq_county_state] UNIQUE ([county_id],[state_id])
);
CREATE UNIQUE INDEX [uq_county_scoped_value] ON [contacts].[county] ([country_id],[state_scope],[value_key],[value_length]);

CREATE TABLE [contacts].[city] (
    [city_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_city] PRIMARY KEY,
    [city] NVARCHAR(256) NOT NULL,
    [country_id] INT NOT NULL,
    [state_id] INT NULL,
    [integration_int_id] INT NULL,
    [value_key] AS CONVERT(VARBINARY(512),[city]) PERSISTED,
    [value_length] AS DATALENGTH([city]) PERSISTED,
    [state_scope] AS ISNULL([state_id],0) PERSISTED,
    CONSTRAINT [fk_city_country] FOREIGN KEY ([country_id]) REFERENCES [contacts].[country]([country_id]),
    CONSTRAINT [fk_city_state] FOREIGN KEY ([state_id]) REFERENCES [contacts].[state]([state_id]),
    CONSTRAINT [fk_city_state_country] FOREIGN KEY ([state_id],[country_id]) REFERENCES [contacts].[state]([state_id],[country_id]),
    CONSTRAINT [uq_city_country] UNIQUE ([city_id],[country_id]),
    CONSTRAINT [uq_city_state] UNIQUE ([city_id],[state_id])
);
CREATE UNIQUE INDEX [uq_city_scoped_value] ON [contacts].[city] ([country_id],[state_scope],[value_key],[value_length]);

CREATE TABLE [contacts].[colony] (
    [colony_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_colony] PRIMARY KEY,
    [colony] NVARCHAR(256) NOT NULL,
    [city_id] INT NOT NULL,
    [integration_int_id] INT NULL,
    [value_key] AS CONVERT(VARBINARY(512),[colony]) PERSISTED,
    [value_length] AS DATALENGTH([colony]) PERSISTED,
    CONSTRAINT [fk_colony_city] FOREIGN KEY ([city_id]) REFERENCES [contacts].[city]([city_id]),
    CONSTRAINT [uq_colony_city] UNIQUE ([colony_id],[city_id])
);
CREATE UNIQUE INDEX [uq_colony_scoped_value] ON [contacts].[colony] ([city_id],[value_key],[value_length]);

CREATE TABLE [contacts].[address] (
    [address_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_address] PRIMARY KEY,
    [address1] NVARCHAR(256) NULL,
    [address2] NVARCHAR(256) NULL,
    [street_name] NVARCHAR(256) NULL,
    [ext_number] NVARCHAR(25) NULL,
    [int_number] NVARCHAR(25) NULL,
    [zip_code] NVARCHAR(32) NULL,
    [references] NVARCHAR(256) NULL,
    [country_id] INT NULL CONSTRAINT [fk_address_country] REFERENCES [contacts].[country]([country_id]),
    [state_id] INT NULL CONSTRAINT [fk_address_state] REFERENCES [contacts].[state]([state_id]),
    [county_id] INT NULL CONSTRAINT [fk_address_county] REFERENCES [contacts].[county]([county_id]),
    [city_id] INT NULL CONSTRAINT [fk_address_city] REFERENCES [contacts].[city]([city_id]),
    [colony_id] INT NULL CONSTRAINT [fk_address_colony] REFERENCES [contacts].[colony]([colony_id]),
    [value_key] AS CONVERT(VARBINARY(4096),CONCAT(
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([address1]))+N':'+[address1],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([address2]))+N':'+[address2],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([street_name]))+N':'+[street_name],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([ext_number]))+N':'+[ext_number],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([int_number]))+N':'+[int_number],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([zip_code]))+N':'+[zip_code],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH([references]))+N':'+[references],N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),[country_id])))+N':'+CONVERT(NVARCHAR(11),[country_id]),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),[state_id])))+N':'+CONVERT(NVARCHAR(11),[state_id]),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),[county_id])))+N':'+CONVERT(NVARCHAR(11),[county_id]),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),[city_id])))+N':'+CONVERT(NVARCHAR(11),[city_id]),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),[colony_id])))+N':'+CONVERT(NVARCHAR(11),[colony_id]),N'-1:'))) PERSISTED,
    [value_hash] BINARY(32) NOT NULL,
    CONSTRAINT [ck_address_hash] CHECK ([value_hash]=HASHBYTES('SHA2_256',[value_key])),
    CONSTRAINT [fk_address_state_country] FOREIGN KEY ([state_id],[country_id]) REFERENCES [contacts].[state]([state_id],[country_id]),
    CONSTRAINT [fk_address_city_country] FOREIGN KEY ([city_id],[country_id]) REFERENCES [contacts].[city]([city_id],[country_id]),
    CONSTRAINT [fk_address_city_state] FOREIGN KEY ([city_id],[state_id]) REFERENCES [contacts].[city]([city_id],[state_id]),
    CONSTRAINT [fk_address_county_country] FOREIGN KEY ([county_id],[country_id]) REFERENCES [contacts].[county]([county_id],[country_id]),
    CONSTRAINT [fk_address_county_state] FOREIGN KEY ([county_id],[state_id]) REFERENCES [contacts].[county]([county_id],[state_id]),
    CONSTRAINT [fk_address_colony_city] FOREIGN KEY ([colony_id],[city_id]) REFERENCES [contacts].[colony]([colony_id],[city_id]),
    CONSTRAINT [ck_address_parent_presence] CHECK (
        ([state_id] IS NULL OR [country_id] IS NOT NULL)
        AND ([city_id] IS NULL OR [country_id] IS NOT NULL)
        AND ([county_id] IS NULL OR [country_id] IS NOT NULL)
        AND ([colony_id] IS NULL OR [city_id] IS NOT NULL))
);
CREATE INDEX [ix_address_hash] ON [contacts].[address] ([value_hash]);

CREATE TABLE [contacts].[address_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,[value_key] AS CONVERT(VARBINARY(200),[location_name]) PERSISTED
    ,[value_length] AS DATALENGTH([location_name]) PERSISTED
    ,CONSTRAINT [pk_address_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_address_location_name] UNIQUE ([value_key],[value_length])
);

CREATE TABLE [contacts].[contact_address] (
     [contact_id]       INT             NOT NULL
    ,[tenant_id]        INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[display_order]    INT             NOT NULL
    ,[address_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_address_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,[dbrow_version]  BIGINT  NOT NULL
    ,CONSTRAINT [fk_contact_address_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_contact_address_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [ck_contact_address_ordinal] CHECK ([ordinal] > 0)
    ,CONSTRAINT [ck_contact_address_order] CHECK ([display_order] > 0)
    ,CONSTRAINT [pk_contact_address] PRIMARY KEY CLUSTERED (
        [contact_id] ASC, [ordinal] ASC
    )
);

CREATE INDEX [ix_contact_address_order] ON [contacts].[contact_address] ([contact_id],[display_order],[ordinal])
    INCLUDE ([address_id],[location_id],[is_public],[dbrow_version]);

ALTER TABLE [contacts].[contact_address] WITH CHECK ADD CONSTRAINT
    [fk_contact_address_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])

ALTER TABLE [contacts].[contact_address] WITH CHECK ADD CONSTRAINT
    [fk_contact_address_address] FOREIGN KEY([address_id])
REFERENCES [contacts].[address] ([address_id])

ALTER TABLE [contacts].[contact_address] WITH CHECK ADD CONSTRAINT
    [fk_contact_address_address_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[address_location] ([location_id])


CREATE TABLE [contacts].[contact_address_history] (
     [dbrow_version]        BIGINT  NOT NULL
    ,[tenant_id]            INT     NOT NULL
    ,[dboperation_type_id]  INT     NOT NULL
    ,[contact_id]           INT     NOT NULL
    ,[ordinal]              INT     NOT NULL
    ,[address_id]             INT     NOT NULL
    ,[location_id]          INT         NULL
    ,[is_public]            BIT     NOT NULL
    ,[display_order]        INT     NOT NULL
    ,CONSTRAINT [pk_contact_address_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
    ,CONSTRAINT [fk_address_history_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_address_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [fk_address_history_value] FOREIGN KEY ([address_id]) REFERENCES [contacts].[address]([address_id])
    ,CONSTRAINT [fk_address_history_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[address_location]([location_id])
    ,CONSTRAINT [ck_address_history_operation] CHECK ([dboperation_type_id] IN (1,2,3))
    ,CONSTRAINT [ck_address_history_order] CHECK ([display_order] > 0)
);

CREATE INDEX [ix_address_history_root] ON [contacts].[contact_address_history] ([contact_id],[ordinal],[dbrow_version] DESC)
    INCLUDE ([tenant_id],[dboperation_type_id],[address_id],[location_id],[is_public],[display_order]);

CREATE TABLE [contacts].[contact_address_identity] (
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [tenant_id] INT NOT NULL, [created_version] BIGINT NOT NULL,
    CONSTRAINT [pk_contact_address_identity] PRIMARY KEY ([contact_id],[ordinal]),
    CONSTRAINT [fk_address_identity_contact] FOREIGN KEY ([contact_id]) REFERENCES [contacts].[contact]([contact_id]),
    CONSTRAINT [fk_address_identity_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_address_identity_ledger] FOREIGN KEY ([tenant_id],[created_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
);
ALTER TABLE [contacts].[contact_address] ADD CONSTRAINT [fk_address_live_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_address_identity]([contact_id],[ordinal]);
ALTER TABLE [contacts].[contact_address_history] ADD CONSTRAINT [fk_address_history_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_address_identity]([contact_id],[ordinal]);

CREATE TABLE [contacts].[contact_address_action] (
    [tenant_id] INT NOT NULL, [dbrow_version] BIGINT NOT NULL, [action_ordinal] INT NOT NULL,
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [operation] VARCHAR(10) NOT NULL,
    [address_id] INT NOT NULL, [location_id] INT NULL, [is_public] BIT NOT NULL,
    [previous_display_order] INT NULL, [display_order] INT NULL,
    [payload_version] INT NOT NULL CONSTRAINT [df_address_action_payload] DEFAULT 2,
    [show_in_timeline] BIT NOT NULL,
    CONSTRAINT [pk_contact_address_action] PRIMARY KEY ([tenant_id],[dbrow_version],[action_ordinal]),
    CONSTRAINT [fk_address_action_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version]),
    CONSTRAINT [fk_address_action_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_address_action_identity] FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_address_identity]([contact_id],[ordinal]),
    CONSTRAINT [fk_address_action_value] FOREIGN KEY ([address_id]) REFERENCES [contacts].[address]([address_id]),
    CONSTRAINT [fk_address_action_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[address_location]([location_id]),
    CONSTRAINT [ck_address_action_operation] CHECK ([operation] IN ('insert','update','delete','restore','move')),
    CONSTRAINT [ck_address_action_order] CHECK (
        ([operation]='delete' AND [display_order] IS NULL AND [previous_display_order] IS NOT NULL AND [previous_display_order]>0)
        OR ([operation]<>'delete' AND [display_order] IS NOT NULL AND [display_order]>0
            AND ([previous_display_order] IS NULL OR [previous_display_order]>0)))
);
CREATE INDEX [ix_address_action_root] ON [contacts].[contact_address_action] ([contact_id],[dbrow_version],[action_ordinal]);
