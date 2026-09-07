-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_phone_restore.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

CREATE OR ALTER PROCEDURE [contacts].[phone_restore]
    @contact_public_key UNIQUEIDENTIFIER, @actor UNIQUEIDENTIFIER,
    @expected_entity_version INT, @tenant UNIQUEIDENTIFIER=NULL,
    @phone_data NVARCHAR(MAX)=NULL, @location_name NVARCHAR(MAX)=NULL,
    @extension NVARCHAR(MAX)=NULL, @is_public BIT=0,
    @ordinal INT=NULL OUTPUT, @display_order INT=NULL OUTPUT,
    @dbrow_version BIGINT=NULL OUTPUT, @entity_version INT=NULL OUTPUT, @phone_id INT=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [contacts].[contact_phone_change]
        @operation='restore', @contact_public_key=@contact_public_key, @actor=@actor,
        @expected_entity_version=@expected_entity_version, @tenant=@tenant,
        @phone_data=@phone_data, @location_name=@location_name, @extension=@extension, @is_public=@is_public,
        @ordinal=@ordinal OUTPUT, @display_order=@display_order OUTPUT,
        @dbrow_version=@dbrow_version OUTPUT, @entity_version=@entity_version OUTPUT, @phone_id=@phone_id OUTPUT;
END;
