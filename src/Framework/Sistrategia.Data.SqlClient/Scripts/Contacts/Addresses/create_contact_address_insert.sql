-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_address_insert.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0012.
-- Version: 8.0.0.0.

CREATE OR ALTER PROCEDURE [contacts].[contact_address_insert]
    @contact_public_key UNIQUEIDENTIFIER,
    @actor UNIQUEIDENTIFIER,
    @expected_entity_version INT,
    @tenant UNIQUEIDENTIFIER=NULL,
    @address_data NVARCHAR(MAX)=NULL,
    @location_name NVARCHAR(MAX)=NULL,
    @is_public BIT=0,
    @ordinal INT=NULL OUTPUT,
    @display_order INT=NULL OUTPUT,
    @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT,
    @address_id INT=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [contacts].[contact_address_change]
        @operation = 'insert',
        @contact_public_key = @contact_public_key,
        @actor = @actor,
        @expected_entity_version = @expected_entity_version,
        @tenant = @tenant,
        @address_data = @address_data,
        @location_name = @location_name,
        @is_public = @is_public,
        @ordinal = @ordinal OUTPUT,
        @display_order = @display_order OUTPUT,
        @dbrow_version = @dbrow_version OUTPUT,
        @entity_version = @entity_version OUTPUT,
        @address_id = @address_id OUTPUT;
END;
