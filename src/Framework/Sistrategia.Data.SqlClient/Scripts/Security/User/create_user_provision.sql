-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_user_provision.sql
-- Part of the Sistrategia.Security Framework.
-- Last Update: 2026-Sep-07
-- Created: 2026-Sep-07
-- Version: 8.0.0.0

-- Public trusted-backend capability. Service authorizes provisioning and the exact role ID.
-- Only promotes an existing root, including one created earlier in this same audit unit.
CREATE OR ALTER PROCEDURE [security].[user_provision]
    @contact_public_key UNIQUEIDENTIFIER,
    @actor UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER,
    @expected_entity_version INT,
    @login_name NVARCHAR(MAX),
    @password_hash NVARCHAR(MAX),
    @email NVARCHAR(MAX) = NULL,
    @initial_role_id INT = NULL,
    @dbrow_version BIGINT = NULL OUTPUT,
    @entity_version INT = NULL OUTPUT,
    @user_id INT = NULL OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @actor IS NULL OR @tenant IS NULL OR @contact_public_key IS NULL
    BEGIN
        THROW 51200, 'Explicit actor, tenant and contact context are required.', 1;
    END
    IF @password_hash IS NULL OR DATALENGTH(@password_hash) = 0 OR DATALENGTH(@password_hash) > 512
    BEGIN
        THROW 51608, 'A supported password hash is required.', 1;
    END

    EXEC [security].[user_insert]
        @public_key = @contact_public_key,
        @tenant = @tenant,
        @created_by = @actor,
        @login_name = @login_name,
        @full_name = NULL,
        @password_hash = @password_hash,
        @email = @email,
        @expected_entity_version = @expected_entity_version,
        @initial_role_id = @initial_role_id,
        @require_existing_contact = 1,
        @dbrow_version = @dbrow_version OUTPUT,
        @entity_version = @entity_version OUTPUT,
        @user_id = @user_id OUTPUT
    ;
END;
