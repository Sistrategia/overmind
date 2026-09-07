-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_address_read.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0012.
-- Version: 8.0.0.0.

CREATE OR ALTER PROCEDURE [contacts].[contact_address_read]
    @contact_public_key UNIQUEIDENTIFIER,
    @actor UNIQUEIDENTIFIER,
    @entity_version INT,
    @tenant UNIQUEIDENTIFIER=NULL,
    @compare_entity_version INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [contacts].[contact_channels_read_core]
        @contact_public_key = @contact_public_key,
        @actor = @actor,
        @entity_version = @entity_version,
        @tenant = @tenant,
        @compare_entity_version = @compare_entity_version,
        @include_email = 0,
        @include_phone = 0,
        @include_address = 1;
END;
