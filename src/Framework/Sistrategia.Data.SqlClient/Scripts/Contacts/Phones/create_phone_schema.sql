-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_phone_schema.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

CREATE TABLE [contacts].[phone] (
    [phone_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_phone] PRIMARY KEY,
    [e164] VARCHAR(16) COLLATE Latin1_General_100_BIN2 NOT NULL CONSTRAINT [uq_phone_e164] UNIQUE,
    [country_calling_code] VARCHAR(3) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [national_number] VARCHAR(14) COLLATE Latin1_General_100_BIN2 NOT NULL,
    CONSTRAINT [ck_phone_components] CHECK (
        DATALENGTH(e164) BETWEEN 3 AND 16 AND LEFT(e164,1)='+'
        AND SUBSTRING(e164,2,15) NOT LIKE '%[^0-9]%'
        AND DATALENGTH(country_calling_code) BETWEEN 1 AND 3
        AND country_calling_code NOT LIKE '%[^0-9]%' AND LEFT(country_calling_code,1)<>'0'
        AND DATALENGTH(national_number) BETWEEN 1 AND 14 AND national_number NOT LIKE '%[^0-9]%'
        AND e164='+'+country_calling_code+national_number)
);

-- Immutable accepted input and interpretation; localized geography is never a contact address.
CREATE TABLE [contacts].[phone_input] (
    [input_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_phone_input] PRIMARY KEY,
    [phone_id] INT NOT NULL CONSTRAINT [fk_phone_input_value] REFERENCES [contacts].[phone](phone_id),
    [phone_data] NVARCHAR(2048) NOT NULL,
    [value_hash] AS CONVERT(BINARY(32),HASHBYTES('SHA2_256',CONVERT(VARBINARY(4096),phone_data))) PERSISTED,
    [value_length] AS DATALENGTH(phone_data) PERSISTED,
    [numbering_region] AS CONVERT(VARCHAR(3),JSON_VALUE(phone_data,'$.numbering_region')) PERSISTED,
    [area_code] AS CONVERT(VARCHAR(15),JSON_VALUE(phone_data,'$.area_code')) PERSISTED,
    [subscriber_number] AS CONVERT(VARCHAR(15),JSON_VALUE(phone_data,'$.subscriber_number')) PERSISTED,
    CONSTRAINT [ck_phone_input_json] CHECK (ISJSON(phone_data)=1),
    CONSTRAINT [uq_phone_input_pair] UNIQUE (phone_id,input_id)
);
CREATE INDEX [ix_phone_input_hash] ON [contacts].[phone_input](value_hash,value_length);
CREATE INDEX [ix_phone_input_region] ON [contacts].[phone_input](numbering_region,area_code) INCLUDE(phone_id);

CREATE TABLE [contacts].[phone_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,[value_key] AS CONVERT(VARBINARY(200),[location_name]) PERSISTED
    ,[value_length] AS DATALENGTH([location_name]) PERSISTED
    ,CONSTRAINT [pk_phone_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_phone_location_name] UNIQUE ([value_key],[value_length])
);

CREATE TABLE [contacts].[contact_phone] (
     [contact_id]       INT             NOT NULL
    ,[tenant_id]        INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[display_order]    INT             NOT NULL
    ,[phone_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[input_id] INT NOT NULL
    ,[extension] NVARCHAR(25) NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_phone_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,[dbrow_version]  BIGINT  NOT NULL
    ,CONSTRAINT [fk_contact_phone_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_contact_phone_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [ck_contact_phone_ordinal] CHECK ([ordinal] > 0)
    ,CONSTRAINT [ck_contact_phone_order] CHECK ([display_order] > 0)
    ,CONSTRAINT [pk_contact_phone] PRIMARY KEY CLUSTERED (
        [contact_id] ASC, [ordinal] ASC
    )
);

-- Root-locked commands enforce a dense, unique order at completion; range moves are set based.
CREATE INDEX [ix_contact_phone_order] ON [contacts].[contact_phone] ([contact_id],[display_order],[ordinal])
    INCLUDE ([phone_id],[location_id],[input_id],[extension],[is_public],[dbrow_version]);

ALTER TABLE [contacts].[contact_phone] WITH CHECK ADD CONSTRAINT
    [fk_contact_phone_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])

ALTER TABLE [contacts].[contact_phone] WITH CHECK ADD CONSTRAINT
    [fk_contact_phone_phone] FOREIGN KEY([phone_id])
REFERENCES [contacts].[phone] ([phone_id])

ALTER TABLE [contacts].[contact_phone] WITH CHECK ADD CONSTRAINT
    [fk_contact_phone_phone_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[phone_location] ([location_id])

-- ALTER TABLE [contacts].[contact_phone] CHECK CONSTRAINT [fk_contact_phone_contact]
-- ALTER TABLE [contacts].[contact_phone] CHECK CONSTRAINT [fk_contact_phone_phone]

CREATE TABLE [contacts].[contact_phone_history] (
     [dbrow_version]        BIGINT  NOT NULL
    ,[tenant_id]            INT     NOT NULL
    ,[dboperation_type_id]  INT     NOT NULL
    ,[contact_id]           INT     NOT NULL
    ,[ordinal]              INT     NOT NULL
    ,[phone_id]             INT     NOT NULL
    ,[location_id]          INT         NULL
    ,[input_id] INT NOT NULL
    ,[extension] NVARCHAR(25) NULL
    ,[is_public]            BIT     NOT NULL
    ,[display_order]        INT     NOT NULL
    ,CONSTRAINT [pk_contact_phone_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
    ,CONSTRAINT [fk_phone_history_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_phone_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [fk_phone_history_value] FOREIGN KEY ([phone_id]) REFERENCES [contacts].[phone]([phone_id])
    ,CONSTRAINT [fk_phone_history_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[phone_location]([location_id])
    ,CONSTRAINT [ck_phone_history_operation] CHECK ([dboperation_type_id] IN (1,2,3))
    ,CONSTRAINT [ck_phone_history_order] CHECK ([display_order] > 0)
);

CREATE INDEX [ix_phone_history_root] ON [contacts].[contact_phone_history] ([contact_id],[ordinal],[dbrow_version] DESC)
    INCLUDE ([tenant_id],[dboperation_type_id],[phone_id],[location_id],[input_id],[extension],[is_public],[display_order]);

-- Retained identity, including insert/delete in one unit. Restoring an identity is explicit.
CREATE TABLE [contacts].[contact_phone_identity] (
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [tenant_id] INT NOT NULL, [created_version] BIGINT NOT NULL,
    CONSTRAINT [pk_contact_phone_identity] PRIMARY KEY ([contact_id],[ordinal]),
    CONSTRAINT [fk_phone_identity_contact] FOREIGN KEY ([contact_id]) REFERENCES [contacts].[contact]([contact_id]),
    CONSTRAINT [fk_phone_identity_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_phone_identity_ledger] FOREIGN KEY ([tenant_id],[created_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
);
ALTER TABLE [contacts].[contact_phone] ADD CONSTRAINT [fk_phone_live_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_phone_identity]([contact_id],[ordinal]);
ALTER TABLE [contacts].[contact_phone_history] ADD CONSTRAINT [fk_phone_history_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_phone_identity]([contact_id],[ordinal]);

-- Typed action evidence survives change/revert or insert/delete with no final child snapshot.
CREATE TABLE [contacts].[contact_phone_action] (
    [tenant_id] INT NOT NULL, [dbrow_version] BIGINT NOT NULL, [action_ordinal] INT NOT NULL,
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [operation] VARCHAR(10) NOT NULL,
    [phone_id] INT NOT NULL, [location_id] INT NULL, [input_id] INT NOT NULL, [extension] NVARCHAR(25) NULL, [is_public] BIT NOT NULL,
    [previous_display_order] INT NULL, [display_order] INT NULL,
    [payload_version] INT NOT NULL CONSTRAINT [df_phone_action_payload] DEFAULT 2,
    [show_in_timeline] BIT NOT NULL,
    CONSTRAINT [pk_contact_phone_action] PRIMARY KEY ([tenant_id],[dbrow_version],[action_ordinal]),
    CONSTRAINT [fk_phone_action_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version]),
    CONSTRAINT [fk_phone_action_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_phone_action_identity] FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_phone_identity]([contact_id],[ordinal]),
    CONSTRAINT [fk_phone_action_value] FOREIGN KEY ([phone_id]) REFERENCES [contacts].[phone]([phone_id]),
    CONSTRAINT [fk_phone_action_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[phone_location]([location_id]),
    CONSTRAINT [ck_phone_action_operation] CHECK ([operation] IN ('insert','update','delete','restore','move')),
    CONSTRAINT [ck_phone_action_order] CHECK (
        ([operation]='delete' AND [display_order] IS NULL AND [previous_display_order] IS NOT NULL AND [previous_display_order]>0)
        OR ([operation]<>'delete' AND [display_order] IS NOT NULL AND [display_order]>0
            AND ([previous_display_order] IS NULL OR [previous_display_order]>0)))
);
CREATE INDEX [ix_phone_action_root] ON [contacts].[contact_phone_action] ([contact_id],[dbrow_version],[action_ordinal]);
ALTER TABLE [contacts].[contact_phone] ADD CONSTRAINT [fk_contact_phone_input] FOREIGN KEY (phone_id,input_id) REFERENCES [contacts].[phone_input](phone_id,input_id);
ALTER TABLE [contacts].[contact_phone_history] ADD CONSTRAINT [fk_contact_phone_history_input] FOREIGN KEY (phone_id,input_id) REFERENCES [contacts].[phone_input](phone_id,input_id);
ALTER TABLE [contacts].[contact_phone_action] ADD CONSTRAINT [fk_contact_phone_action_input] FOREIGN KEY (phone_id,input_id) REFERENCES [contacts].[phone_input](phone_id,input_id);
