-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_security_user_insert.sql
-- Part of the Sistrategia.Contacts Framework.
-- Last Update: 2026-Sep-07
-- Created: 2010-Sep-08
-- Version: 8.0.0.0

-- Administrative person-account construction or promotion by an existing authorized actor.
-- Only the transaction owner completes the enrolled audit unit.
-- Promotion preserves contact payload and rejects unsupported construction inputs.
CREATE OR ALTER PROCEDURE [security].[user_insert]
    @public_key UNIQUEIDENTIFIER = NULL,
    @tenant UNIQUEIDENTIFIER = NULL,
    @logical_key NVARCHAR(256) = NULL,
    @display_name NVARCHAR(256) = NULL,
    @created DATETIME2 = NULL,
    @created_by UNIQUEIDENTIFIER,
    @summary NVARCHAR(MAX) = NULL,
    @image_url NVARCHAR(1024) = NULL,
    @thumbnail_url NVARCHAR(1024) = NULL,
    @is_private BIT = 0,
    @login_name NVARCHAR(256),
    @full_name NVARCHAR(256),
    @contact_type_id INT = 1,
    @person_title NVARCHAR(256) = NULL,
    @person_first_name NVARCHAR(256) = NULL,
    @person_last_name1 NVARCHAR(256) = NULL,
    @person_last_name2 NVARCHAR(256) = NULL,
    @person_suffix NVARCHAR(256) = NULL,
    @person_alias NVARCHAR(256) = NULL,
    @person_job_title NVARCHAR(256) = NULL,
    @person_company NVARCHAR(256) = NULL,
    @person_gender_code CHAR(1) = NULL,
    @person_birth_date DATE = NULL,
    @person_marital_status CHAR(1) = NULL,
    @password_hash NVARCHAR(256) = NULL,
    @password_salt NVARCHAR(128) = NULL,
    @email_location_name NVARCHAR(MAX) = NULL,
    @email NVARCHAR(MAX) = NULL,
    @phone_location_name NVARCHAR(MAX) = NULL,
    @phone_number NVARCHAR(25) = NULL,
    @phone_area_code NVARCHAR(16) = NULL,
    @phone_extension NVARCHAR(MAX) = NULL,
    @numbers_only NVARCHAR(15) = NULL,
    @full_phone NVARCHAR(20) = NULL,
    @address_location_name NVARCHAR(MAX) = NULL,
    @address1 NVARCHAR(MAX) = NULL,
    @address2 NVARCHAR(MAX) = NULL,
    @zip_code NVARCHAR(MAX) = NULL,
    @city NVARCHAR(MAX) = NULL,
    @state NVARCHAR(MAX) = NULL,
    @country NVARCHAR(MAX) = NULL,
    @user_primary_role NVARCHAR(100) = NULL,
    @dbrow_version BIGINT = NULL OUTPUT,
    @auto_create_person_company BIT = 1,
    @expected_entity_version INT = NULL,
    @entity_version INT = NULL OUTPUT,
    @phone_data NVARCHAR(MAX) = NULL,
    @user_id INT = NULL OUTPUT,
    @web_link_url NVARCHAR(MAX) = NULL,
    @web_link_type NVARCHAR(MAX) = NULL,
    @web_link_location_name NVARCHAR(MAX) = NULL,
    @web_link_display_text NVARCHAR(MAX) = NULL,
    @web_link_is_public BIT = NULL,
    @address_data NVARCHAR(MAX) = NULL,
    @address_is_public BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @owns BIT = 0;
    DECLARE @tenant_id INT, @actor_id INT, @contact_id INT, @recorded_at DATETIME2;
    DECLARE @user_type INT = (SELECT [entity_type_id] FROM [entities].[entity_type] WHERE [code_name] = N'user');
    DECLARE @contact_type INT = (SELECT [entity_type_id] FROM [entities].[entity_type] WHERE [code_name] = N'contact');

    SET @entity_version = NULL;
    SET @user_id = NULL;

    IF @created IS NULL
    BEGIN
        SET @created = SYSUTCDATETIME();
    END

    IF @public_key IS NULL
    BEGIN
        SET @public_key = NEWID();
    END

    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT = 0
        BEGIN
            THROW 51008, 'A supplied audit version requires an enrolled caller transaction.', 1;
        END

        IF @@TRANCOUNT = 0
        BEGIN
            BEGIN TRANSACTION;
            SET @owns = 1;
            EXEC [data].[audit_unit_begin];
        END

        EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
        EXEC [entities].[actor_resolve]
            @actor = @created_by,
            @tenant = @tenant,
            @actor_entity_id = @actor_id OUTPUT,
            @tenant_id = @tenant_id OUTPUT
        ;
        SET @tenant = (SELECT [public_key] FROM [data].[tenant] WHERE [tenant_id] = @tenant_id);

        IF @user_type IS NULL OR @contact_type IS NULL
        BEGIN
            THROW 51600, 'User/contact type definitions are required.', 1;
        END

        IF @email IS NOT NULL AND (DATALENGTH(@email) = 0 OR DATALENGTH(@email) > 512)
        BEGIN
            THROW 51300, 'Account email must contain 1 to 256 UTF-16 code units.', 1;
        END

        -- Resolve by public key, then validate the actual root's tenant under its write lock.
        SELECT @contact_id = [entity_id] FROM [entities].[entity] WHERE [public_key] = @public_key;
        IF @contact_id IS NOT NULL
        BEGIN
            EXEC [entities].[entity_write_lock]
                @entity_id = @contact_id,
                @tenant_id = @tenant_id,
                @expected_entity_version = @expected_entity_version,
                @dbrow_version = @dbrow_version OUTPUT,
                @entity_version = @entity_version OUTPUT
            ;

            IF EXISTS (SELECT 1 FROM [security].[user] WHERE [user_id] = @contact_id)
            BEGIN
                THROW 51601, 'This contact already has a user account.', 1;
            END

            IF NOT EXISTS (
                SELECT 1
                FROM [entities].[entity] e
                JOIN [contacts].[contact] c ON c.[contact_id] = e.[entity_id]
                WHERE e.[entity_id] = @contact_id AND e.[entity_type_id] = @contact_type
            )
            BEGIN
                THROW 51600, 'Only an ordinary contact can be promoted to a user.', 1;
            END

            IF NOT EXISTS (
                SELECT 1
                FROM [contacts].[contact]
                WHERE [contact_id] = @contact_id AND [contact_type_id] = 1
            ) OR COALESCE(@contact_type_id, 1) <> 1
            BEGIN
                THROW 51605, 'Ordinary user accounts require a human person contact.', 1;
            END

            -- Check caller inputs before applying new-contact defaults. Account email is allowed.
            -- Legacy default-valued switches carry no presence information; nondefault values fail.
            IF @logical_key IS NOT NULL OR @display_name IS NOT NULL OR @summary IS NOT NULL
                OR @image_url IS NOT NULL OR @thumbnail_url IS NOT NULL OR COALESCE(@is_private, 0) <> 0
                OR @full_name IS NOT NULL OR @person_title IS NOT NULL OR @person_first_name IS NOT NULL
                OR @person_last_name1 IS NOT NULL OR @person_last_name2 IS NOT NULL
                OR @person_suffix IS NOT NULL OR @person_alias IS NOT NULL
                OR @person_job_title IS NOT NULL OR @person_company IS NOT NULL
                OR @person_gender_code IS NOT NULL OR @person_birth_date IS NOT NULL
                OR @person_marital_status IS NOT NULL OR @email_location_name IS NOT NULL
                OR @web_link_url IS NOT NULL OR @web_link_type IS NOT NULL OR @web_link_location_name IS NOT NULL
                OR @web_link_display_text IS NOT NULL OR @web_link_is_public IS NOT NULL
                OR @phone_data IS NOT NULL OR @phone_location_name IS NOT NULL OR @phone_number IS NOT NULL
                OR @phone_area_code IS NOT NULL OR @phone_extension IS NOT NULL
                OR @numbers_only IS NOT NULL OR @full_phone IS NOT NULL
                OR @address_data IS NOT NULL OR @address_is_public IS NOT NULL OR @address_location_name IS NOT NULL OR @address1 IS NOT NULL OR @address2 IS NOT NULL
                OR @zip_code IS NOT NULL OR @city IS NOT NULL OR @state IS NOT NULL OR @country IS NOT NULL
                OR @auto_create_person_company IS NULL OR @auto_create_person_company <> 1
            BEGIN
                THROW 51606, 'Promotion does not modify contact details; use explicit contact operations.', 1;
            END
        END
        ELSE
        BEGIN
            IF @expected_entity_version IS NOT NULL AND @expected_entity_version <> 0
            BEGIN
                THROW 51603, 'New user construction accepts only an absent-root version (0 or omitted).', 1;
            END

            IF COALESCE(@contact_type_id, 1) <> 1
            BEGIN
                THROW 51605, 'Ordinary user accounts require a human person contact.', 1;
            END

            IF @full_name IS NULL
            BEGIN
                SET @full_name = @login_name;
            END

            IF @display_name IS NULL
            BEGIN
                SET @display_name = @full_name;
            END
        END

        -- Existing roots were locked before first allocation; new roots will be inserted in this unit.
        EXEC [data].[dbrow_version_ensure]
            @tenant_id = @tenant_id,
            @actor_entity_id = @actor_id,
            @dboperation_type_id = 1,
            @modified = @created,
            @dbrow_version = @dbrow_version OUTPUT,
            @recorded_at = @recorded_at OUTPUT
        ;
        IF @contact_id IS NULL
        BEGIN
            EXEC [contacts].[contact_insert]
                @contact_type_id = @contact_type_id,
                @public_key = @public_key,
                @tenant = @tenant,
                @logical_key = @logical_key,
                @display_name = @display_name,
                @created = @created,
                @created_by = @created_by,
                @summary = @summary,
                @image_url = @image_url,
                @thumbnail_url = @thumbnail_url,
                @is_private = @is_private,
                @full_name = @full_name,
                @person_title = @person_title,
                @person_first_name = @person_first_name,
                @person_last_name1 = @person_last_name1,
                @person_last_name2 = @person_last_name2,
                @person_suffix = @person_suffix,
                @person_alias = @person_alias,
                @person_job_title = @person_job_title,
                @person_company = @person_company,
                @person_gender_code = @person_gender_code,
                @person_birth_date = @person_birth_date,
                @person_marital_status = @person_marital_status,
                @email_location_name = @email_location_name,
                @email_address = @email,
                @phone_location_name = @phone_location_name,
                @phone_data = @phone_data,
                @web_link_url = @web_link_url,
                @web_link_type = @web_link_type,
                @web_link_location_name = @web_link_location_name,
                @web_link_display_text = @web_link_display_text,
                @web_link_is_public = @web_link_is_public,
                @phone_number = @phone_number,
                @phone_area_code = @phone_area_code,
                @phone_extension = @phone_extension,
                @numbers_only = @numbers_only,
                @full_phone = @full_phone,
                @address_location_name = @address_location_name,
                @address_data = @address_data,
                @address_is_public = @address_is_public,
                @address1 = @address1,
                @address2 = @address2,
                @zip_code = @zip_code,
                @city = @city,
                @state = @state,
                @country = @country,
                @dbrow_version = @dbrow_version OUTPUT,
                @auto_create_person_company = @auto_create_person_company,
                @supress_event_message = 1
            ;
            SET @contact_id = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @public_key AND [tenant_id] = @tenant_id);
            EXEC [entities].[entity_write_lock]
                @entity_id = @contact_id,
                @tenant_id = @tenant_id,
                @expected_entity_version = 0,
                @dbrow_version = @dbrow_version OUTPUT,
                @entity_version = @entity_version OUTPUT
            ;
        END

        DECLARE @role_id INT = NULL, @role_matches INT;
        IF @user_primary_role IS NOT NULL
        BEGIN
            -- Hold the eligible definition while assigning it; no cross-tenant or silent name fallback.
            SELECT @role_matches = COUNT(*), @role_id = MAX([role_id])
            FROM [security].[role] WITH (HOLDLOCK)
            WHERE [role_name] = @user_primary_role AND ([tenant_id] = @tenant_id OR [tenant_id] IS NULL);

            IF @role_matches <> 1
            BEGIN
                THROW 51602, 'Initial role name must identify exactly one eligible definition.', 1;
            END
        END

        INSERT [security].[user] ([user_id], [login_name], [password_hash], [password_salt], [email])
        VALUES (@contact_id, @login_name, @password_hash, @password_salt, @email);

        IF @role_id IS NOT NULL
        BEGIN
            INSERT [security].[user_role] ([user_id], [role_id]) VALUES (@contact_id, @role_id);
        END

        -- A new contact has only provisional type 1; its committed creation snapshot is user type.
        -- An existing contact gets one new root revision and keeps its earlier contact-type history.
        UPDATE [entities].[entity] SET [entity_type_id] = @user_type
        WHERE [entity_id] = @contact_id AND [tenant_id] = @tenant_id;

        EXEC [entities].[entity_version_bump]
            @entity_id = @contact_id,
            @tenant_id = @tenant_id,
            @actor_entity_id = @actor_id,
            @dbrow_version = @dbrow_version,
            @recorded_at = @recorded_at,
            @entity_version = @entity_version OUTPUT
        ;
        EXEC [entities].[entity_history_snapshot]
            @entity_id = @contact_id, @tenant_id = @tenant_id, @dbrow_version = @dbrow_version;
        EXEC [security].[user_history_create]
            @user_id = @contact_id, @tenant_id = @tenant_id, @dbrow_version = @dbrow_version;

        -- Retain the initial assignment choice; later role lifecycle/history is a separate capability.
        DECLARE @event_args NVARCHAR(MAX) = (
            SELECT 1 AS [payload_version], @role_id AS [initial_role_id]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
        );
        EXEC [entities].[event_create]
            @tenant = @tenant,
            @event_code = 'security.user.new',
            @author = @created_by,
            @subject_type_code = 'user',
            @subject_public_key = @public_key,
            @subject_id = @contact_id,
            @event_args = @event_args,
            @when_ocurred = @created,
            @is_system = 0,
            @dbrow_version = @dbrow_version
        ;

        SET @user_id = @contact_id;
        IF @owns = 1
        BEGIN
            COMMIT;
        END
    END TRY
    BEGIN CATCH
        IF @owns = 1 AND XACT_STATE() <> 0
        BEGIN
            ROLLBACK;
        END

        SET @dbrow_version = NULL;
        SET @entity_version = NULL;
        SET @user_id = NULL;
        THROW;
    END CATCH;
END;
