-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_phone_numbering_schema.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Optional administrative, versioned prefix catalog. No inferred place becomes contact location.
CREATE TABLE [contacts].[phone_numbering_area] (
    [area_id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [pk_phone_numbering_area] PRIMARY KEY,
    [international_prefix] VARCHAR(15) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [source] NVARCHAR(100) NOT NULL,
    [source_version] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(256) NOT NULL,
    CONSTRAINT [ck_phone_numbering_prefix] CHECK (DATALENGTH(international_prefix)>0 AND international_prefix NOT LIKE '%[^0-9]%' AND LEFT(international_prefix,1)<>'0')
);
CREATE INDEX [ix_phone_numbering_prefix] ON [contacts].[phone_numbering_area](international_prefix);
CREATE TABLE [contacts].[phone_numbering_area_place] (
    [area_id] INT NOT NULL CONSTRAINT [fk_phone_area_place_area] REFERENCES [contacts].[phone_numbering_area](area_id),
    [place_ordinal] INT NOT NULL,
    [country_id] INT NOT NULL CONSTRAINT [fk_phone_area_country] REFERENCES [contacts].[country](country_id),
    [state_id] INT NULL CONSTRAINT [fk_phone_area_state] REFERENCES [contacts].[state](state_id),
    [city_id] INT NULL CONSTRAINT [fk_phone_area_city] REFERENCES [contacts].[city](city_id),
    CONSTRAINT [pk_phone_numbering_area_place] PRIMARY KEY (area_id,place_ordinal),
    CONSTRAINT [ck_phone_area_place_ordinal] CHECK (place_ordinal>0)
);
