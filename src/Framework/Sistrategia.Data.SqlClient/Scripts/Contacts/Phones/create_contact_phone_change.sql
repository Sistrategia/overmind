-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_phone_change.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Public ordinary-command boundary. Supplied actor comes from the authenticated service,
-- not an untrusted request body. Only this boundary and its wrappers receive EXECUTE grants.
CREATE OR ALTER PROCEDURE [contacts].[contact_phone_change]
    @operation VARCHAR(10), @contact_public_key UNIQUEIDENTIFIER, @actor UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER=NULL, @expected_entity_version INT=NULL,
    @phone_data NVARCHAR(MAX)=NULL, @location_name NVARCHAR(MAX)=NULL, @is_public BIT=0,
    @ordinal INT=NULL OUTPUT, @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT, @phone_id INT=NULL OUTPUT, @supress_event_message BIT=0,
    @display_order INT=NULL OUTPUT,
    @extension NVARCHAR(MAX)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @owns BIT=0, @tenant_id INT, @actor_id INT, @contact_id INT;
    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT=0
        BEGIN
            THROW 51008, 'Supplied versions require an enrolled caller transaction.', 1;
        END
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION;
            SET @owns=1;
            EXEC [data].[audit_unit_begin];
        END;
        EXEC [entities].[actor_resolve]
            @actor = @actor,
            @tenant = @tenant,
            @actor_entity_id = @actor_id OUTPUT,
            @tenant_id = @tenant_id OUTPUT;
        SET @contact_id=(SELECT [entity_id] FROM [entities].[entity] WHERE [public_key]=@contact_public_key AND [tenant_id]=@tenant_id);
        IF @contact_id IS NULL
        BEGIN
            THROW 51202, 'Target contact does not exist in this tenant.', 1;
        END
        IF @supress_event_message IS NULL
        BEGIN
            THROW 51703, 'Timeline visibility must be explicit.', 1;
        END
        DECLARE @show BIT=1-@supress_event_message;
        EXEC [contacts].[contact_phone_write]
            @operation = @operation,
            @contact_id = @contact_id,
            @tenant_id = @tenant_id,
            @actor_entity_id = @actor_id,
            @expected_entity_version = @expected_entity_version,
            @phone_data = @phone_data,
            @location_name = @location_name,
            @is_public = @is_public,
            @ordinal = @ordinal OUTPUT,
            @dbrow_version = @dbrow_version OUTPUT,
            @entity_version = @entity_version OUTPUT,
            @phone_id = @phone_id OUTPUT,
            @show_in_timeline = @show,
            @display_order = @display_order OUTPUT,
            @extension = @extension;
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        SET @dbrow_version=NULL; SET @entity_version=NULL; SET @phone_id=NULL; SET @ordinal=NULL;
        SET @display_order=NULL;
        THROW;
    END CATCH;
END;
