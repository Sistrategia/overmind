-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_web_link_schema.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

CREATE TABLE [contacts].[web_link] (
    [web_link_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_web_link] PRIMARY KEY,
    [url] NVARCHAR(2048) NOT NULL,
    [value_hash] AS CONVERT(BINARY(32),HASHBYTES('SHA2_256',CONVERT(VARBINARY(4096),[url]))) PERSISTED,
    [value_length] AS DATALENGTH([url]) PERSISTED
);
-- Hash narrows lookup/locking; full bytes AND length determine equality, including hash collisions.
CREATE INDEX [ix_web_link_hash] ON [contacts].[web_link] ([value_hash],[value_length]);

CREATE TABLE [contacts].[web_link_location] (
     [location_id]    INT            NOT NULL IDENTITY(1,1)
    ,[location_name]  NVARCHAR(100)  NOT NULL
    ,[value_key] AS CONVERT(VARBINARY(200),[location_name]) PERSISTED
    ,[value_length] AS DATALENGTH([location_name]) PERSISTED
    ,CONSTRAINT [pk_web_link_location] PRIMARY KEY CLUSTERED ([location_id])
    ,CONSTRAINT [uq_web_link_location_name] UNIQUE ([value_key],[value_length])
);

CREATE TABLE [contacts].[contact_web_link] (
     [contact_id]       INT             NOT NULL
    ,[tenant_id]        INT             NOT NULL
    ,[ordinal]          INT             NOT NULL
    ,[display_order]    INT             NOT NULL
    ,[web_link_id]         INT             NOT NULL
    ,[location_id]      INT                 NULL
    ,[link_type] NVARCHAR(50) NULL
    ,[display_text] NVARCHAR(256) NULL
    ,[is_public]        BIT             NOT NULL CONSTRAINT [df_contact_web_link_is_public] DEFAULT 0  -- spec 10: show in public directory
    ,[dbrow_version]  BIGINT  NOT NULL
    ,CONSTRAINT [fk_contact_web_link_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_contact_web_link_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [ck_contact_web_link_ordinal] CHECK ([ordinal] > 0)
    ,CONSTRAINT [ck_contact_web_link_order] CHECK ([display_order] > 0)
    ,CONSTRAINT [pk_contact_web_link] PRIMARY KEY CLUSTERED (
        [contact_id] ASC, [ordinal] ASC
    )
);

-- Root-locked commands enforce a dense, unique order at completion; range moves are set based.
CREATE INDEX [ix_contact_web_link_order] ON [contacts].[contact_web_link] ([contact_id],[display_order],[ordinal])
    INCLUDE ([web_link_id],[location_id],[link_type],[display_text],[is_public],[dbrow_version]);

ALTER TABLE [contacts].[contact_web_link] WITH CHECK ADD CONSTRAINT
    [fk_contact_web_link_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])

ALTER TABLE [contacts].[contact_web_link] WITH CHECK ADD CONSTRAINT
    [fk_contact_web_link_web_link] FOREIGN KEY([web_link_id])
REFERENCES [contacts].[web_link] ([web_link_id])

ALTER TABLE [contacts].[contact_web_link] WITH CHECK ADD CONSTRAINT
    [fk_contact_web_link_web_link_location] FOREIGN KEY([location_id])
REFERENCES [contacts].[web_link_location] ([location_id])


CREATE TABLE [contacts].[contact_web_link_history] (
     [dbrow_version]        BIGINT  NOT NULL
    ,[tenant_id]            INT     NOT NULL
    ,[dboperation_type_id]  INT     NOT NULL
    ,[contact_id]           INT     NOT NULL
    ,[ordinal]              INT     NOT NULL
    ,[web_link_id]             INT     NOT NULL
    ,[location_id]          INT         NULL
    ,[link_type] NVARCHAR(50) NULL
    ,[display_text] NVARCHAR(256) NULL
    ,[is_public]            BIT     NOT NULL
    ,[display_order]        INT     NOT NULL
    ,CONSTRAINT [pk_contact_web_link_history] PRIMARY KEY CLUSTERED
        ([dbrow_version],[contact_id],[ordinal])
    ,CONSTRAINT [fk_web_link_history_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id])
    ,CONSTRAINT [fk_web_link_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
    ,CONSTRAINT [fk_web_link_history_value] FOREIGN KEY ([web_link_id]) REFERENCES [contacts].[web_link]([web_link_id])
    ,CONSTRAINT [fk_web_link_history_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[web_link_location]([location_id])
    ,CONSTRAINT [ck_web_link_history_operation] CHECK ([dboperation_type_id] IN (1,2,3))
    ,CONSTRAINT [ck_web_link_history_order] CHECK ([display_order] > 0)
);

CREATE INDEX [ix_web_link_history_root] ON [contacts].[contact_web_link_history] ([contact_id],[ordinal],[dbrow_version] DESC)
    INCLUDE ([tenant_id],[dboperation_type_id],[web_link_id],[location_id],[link_type],[display_text],[is_public],[display_order]);

-- Retained identity, including insert/delete in one unit. Restoring an identity is explicit.
CREATE TABLE [contacts].[contact_web_link_identity] (
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [tenant_id] INT NOT NULL, [created_version] BIGINT NOT NULL,
    CONSTRAINT [pk_contact_web_link_identity] PRIMARY KEY ([contact_id],[ordinal]),
    CONSTRAINT [fk_web_link_identity_contact] FOREIGN KEY ([contact_id]) REFERENCES [contacts].[contact]([contact_id]),
    CONSTRAINT [fk_web_link_identity_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_web_link_identity_ledger] FOREIGN KEY ([tenant_id],[created_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version])
);
ALTER TABLE [contacts].[contact_web_link] ADD CONSTRAINT [fk_web_link_live_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_web_link_identity]([contact_id],[ordinal]);
ALTER TABLE [contacts].[contact_web_link_history] ADD CONSTRAINT [fk_web_link_history_identity]
    FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_web_link_identity]([contact_id],[ordinal]);

-- Typed action evidence survives change/revert or insert/delete with no final child snapshot.
CREATE TABLE [contacts].[contact_web_link_action] (
    [tenant_id] INT NOT NULL, [dbrow_version] BIGINT NOT NULL, [action_ordinal] INT NOT NULL,
    [contact_id] INT NOT NULL, [ordinal] INT NOT NULL, [operation] VARCHAR(10) NOT NULL,
    [web_link_id] INT NOT NULL, [location_id] INT NULL, [link_type] NVARCHAR(50) NULL, [display_text] NVARCHAR(256) NULL, [is_public] BIT NOT NULL,
    [previous_display_order] INT NULL, [display_order] INT NULL,
    [payload_version] INT NOT NULL CONSTRAINT [df_web_link_action_payload] DEFAULT 2,
    [show_in_timeline] BIT NOT NULL,
    CONSTRAINT [pk_contact_web_link_action] PRIMARY KEY ([tenant_id],[dbrow_version],[action_ordinal]),
    CONSTRAINT [fk_web_link_action_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version]),
    CONSTRAINT [fk_web_link_action_owner] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_web_link_action_identity] FOREIGN KEY ([contact_id],[ordinal]) REFERENCES [contacts].[contact_web_link_identity]([contact_id],[ordinal]),
    CONSTRAINT [fk_web_link_action_value] FOREIGN KEY ([web_link_id]) REFERENCES [contacts].[web_link]([web_link_id]),
    CONSTRAINT [fk_web_link_action_location] FOREIGN KEY ([location_id]) REFERENCES [contacts].[web_link_location]([location_id]),
    CONSTRAINT [ck_web_link_action_operation] CHECK ([operation] IN ('insert','update','delete','restore','move')),
    CONSTRAINT [ck_web_link_action_order] CHECK (
        ([operation]='delete' AND [display_order] IS NULL AND [previous_display_order] IS NOT NULL AND [previous_display_order]>0)
        OR ([operation]<>'delete' AND [display_order] IS NOT NULL AND [display_order]>0
            AND ([previous_display_order] IS NULL OR [previous_display_order]>0)))
);
CREATE INDEX [ix_web_link_action_root] ON [contacts].[contact_web_link_action] ([contact_id],[dbrow_version],[action_ordinal]);
