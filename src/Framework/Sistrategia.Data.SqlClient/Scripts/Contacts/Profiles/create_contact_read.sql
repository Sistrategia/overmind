-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_read.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Complete declared profile and all four channel families, one read transaction.
-- Explicit NULL @entity_version selects current while holding the coordinator's root barrier (ADR 0014).
CREATE OR ALTER PROCEDURE [contacts].[contact_read]
    @contact_public_key UNIQUEIDENTIFIER,
    @actor UNIQUEIDENTIFIER,
    @entity_version INT,
    @tenant UNIQUEIDENTIFIER,
    @compare_entity_version INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @tenant IS NULL
    BEGIN
        THROW 52003, 'Contact reads require an explicitly resolved tenant.', 1;
    END
    EXEC [contacts].[contact_channels_read_core]
        @contact_public_key=@contact_public_key,
        @actor=@actor,
        @entity_version=@entity_version,
        @tenant=@tenant,
        @compare_entity_version=@compare_entity_version,
        @include_email=1,
        @include_phone=1,
        @include_web_link=1,
        @include_address=1,
        @include_profile=1;
END;
