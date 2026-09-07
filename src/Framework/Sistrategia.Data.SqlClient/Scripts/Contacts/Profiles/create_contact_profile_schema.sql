-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_profile_schema.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

ALTER TABLE [contacts].[contact_history] ADD
    [contact_type_id] INT NULL,
    [person_title_id] INT NULL,
    [person_first_name_id] INT NULL,
    [person_last_name_id] INT NULL,
    [person_last_name1_id] INT NULL,
    [person_last_name2_id] INT NULL,
    [person_suffix_id] INT NULL,
    [person_alias_id] INT NULL;
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_title]
    FOREIGN KEY ([person_title_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_first_name]
    FOREIGN KEY ([person_first_name_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_last_name]
    FOREIGN KEY ([person_last_name_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_last_name1]
    FOREIGN KEY ([person_last_name1_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_last_name2]
    FOREIGN KEY ([person_last_name2_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_suffix]
    FOREIGN KEY ([person_suffix_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_history_person_alias]
    FOREIGN KEY ([person_alias_id]) REFERENCES [contacts].[person_name]([person_name_id]);

ALTER TABLE [contacts].[contact_person_name] ADD CONSTRAINT [fk_contact_name_contact]
    FOREIGN KEY ([contact_id]) REFERENCES [contacts].[contact]([contact_id]);
ALTER TABLE [contacts].[contact_person_name] ADD CONSTRAINT [fk_contact_name_value]
    FOREIGN KEY ([person_name_id]) REFERENCES [contacts].[person_name]([person_name_id]);
ALTER TABLE [contacts].[contact_person_name] ADD CONSTRAINT [fk_contact_name_type]
    FOREIGN KEY ([person_name_type_id]) REFERENCES [contacts].[person_name_type]([person_name_type_id]);

CREATE TABLE [contacts].[contact_profile_action] (
    [tenant_id] INT NOT NULL,
    [dbrow_version] BIGINT NOT NULL,
    [action_ordinal] INT NOT NULL,
    [contact_id] INT NOT NULL,
    [operation] VARCHAR(10) NOT NULL,
    [profile_data] NVARCHAR(MAX) NOT NULL,
    [payload_version] INT NOT NULL DEFAULT 1,
    CONSTRAINT [pk_contact_profile_action] PRIMARY KEY ([dbrow_version],[action_ordinal]),
    CONSTRAINT [fk_profile_action_root] FOREIGN KEY ([tenant_id],[contact_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_profile_action_ledger] FOREIGN KEY ([tenant_id],
        [dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],
        [dbrow_version]),
        
    CONSTRAINT [ck_profile_action_operation] CHECK ([operation] IN ('create','update','delete','restore')),
    CONSTRAINT [ck_profile_action_json] CHECK (ISJSON([profile_data])=1)
);
CREATE INDEX [ix_profile_action_root] ON [contacts].[contact_profile_action] ([contact_id],[dbrow_version],[action_ordinal]);
CREATE INDEX [ix_contact_relationship_target] ON [contacts].[contact_relationship] ([to_contact_id],[from_contact_id]);
