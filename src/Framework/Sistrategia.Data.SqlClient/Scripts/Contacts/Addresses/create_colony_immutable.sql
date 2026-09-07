-- Copyright (c) Sistrategia. All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_colony_immutable.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER TRIGGER [contacts].[colony_immutable]
ON [contacts].[colony]
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
    BEGIN
        THROW 51922, 'Address and geographic catalog values are immutable; select or create a replacement.', 1;
    END
END;
