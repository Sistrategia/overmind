/*************************************************************************************************************
* create_security_user_insert.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

CREATE OR ALTER PROCEDURE [security].[user_insert] (
     @public_key					UNIQUEIDENTIFIER = NULL	
    ,@tenant                        UNIQUEIDENTIFIER = NULL	
    ,@logical_key					NVARCHAR(256) = NULL
	,@display_name					NVARCHAR(256) = NULL
 	,@created 						DATETIME2 = NULL
	,@created_by 					UNIQUEIDENTIFIER -- INT
    ,@summary 						NVARCHAR(MAX) = NULL
	,@image_url 					NVARCHAR(1024) = NULL
	,@thumbnail_url 				NVARCHAR(1024) = NULL
	,@is_private 					BIT = 0

    ,@login_name 					NVARCHAR(256)
	,@full_name 					NVARCHAR(256)

--	,@role_name 					NVARCHAR(100) = NULL

	,@contact_type_id				INT = 1 -- person
	,@person_title					NVARCHAR(256) = NULL
	,@person_first_name				NVARCHAR(256) = NULL
--  ,@person_last_name				NVARCHAR(256) = NULL
	,@person_last_name1				NVARCHAR(256) = NULL
	,@person_last_name2				NVARCHAR(256) = NULL
    ,@person_suffix                 NVARCHAR(256) = NULL
    ,@person_alias                  NVARCHAR(256) = NULL

	,@person_job_title				NVARCHAR(256) = NULL
	,@person_company				NVARCHAR(256) = NULL

    ,@person_gender_code            CHAR(1) = NULL
	,@person_birth_date		        DATE = NULL	

    ,@person_marital_status         CHAR(1) = NULL

	,@password_hash 				NVARCHAR(256) = NULL
--	,@security_stamp 				NVARCHAR(128) = NULL
    ,@password_salt                 NVARCHAR(128) = NULL

    ,@email_location_name           NVARCHAR(MAX) = NULL
	,@email 						NVARCHAR(MAX) = NULL
--	,@email_confirmed 				BIT = 0
--	,@email_label                   NVARCHAR(256) = 'Primary'

    ,@phone_location_name           NVARCHAR(25) = NULL
	,@phone_number 					NVARCHAR(25) = NULL
    ,@phone_area_code               NVARCHAR(16) = NULL
    ,@phone_extension               NVARCHAR(10) = NULL
    ,@numbers_only                  NVARCHAR(15) = NULL
    ,@full_phone                    NVARCHAR(20) = NULL
--	,@phone_number_confirmed 		BIT = 0
--	,@phone_number_label            NVARCHAR(256) = 'Primary'

    ,@address_location_name         NVARCHAR(50) = NULL
    ,@address1                      NVARCHAR(256) = NULL
    ,@address2                      NVARCHAR(256) = NULL
    ,@zip_code                      NVARCHAR(256) = NULL
    ,@city                          NVARCHAR(256) = NULL
    ,@state                         NVARCHAR(256) = NULL
    ,@country                       NVARCHAR(256) = NULL

--	,@two_factor_enabled 			BIT = 0
--	,@lockout_end_date_utc 			DATETIME = NULL
--	,@lockout_enabled 				BIT = 1
--	,@access_failed_count 			INT = 0

	--,@contact_list_info_card1		NVARCHAR(256) = NULL
	--,@contact_list_info_card2		NVARCHAR(256) = NULL

    ,@user_primary_role             NVARCHAR(100) = NULL

	,@dbrow_version                 BIGINT = NULL OUTPUT

    ,@auto_create_person_company    BIT = 1
    ,@expected_entity_version       INT = NULL
    ,@entity_version                INT = NULL OUTPUT
    ,@user_id                       INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- Administrative construction by an existing authorized actor. No implicit self-registration.
    -- Optional INOUT joins only this enrolled unit; the outer transaction owner completes it.
    -- Existing contacts require the unit-entry optimistic token and retain their contact payload.
    DECLARE @owns BIT=0,@tenant_id INT,@actor_id INT,@contact_id INT,@recorded_at DATETIME2,
        @user_type INT=(SELECT entity_type_id FROM entities.entity_type WHERE code_name=N'user'),
        @contact_type INT=(SELECT entity_type_id FROM entities.entity_type WHERE code_name=N'contact');
    SET @entity_version=NULL; SET @user_id=NULL;
    IF @created IS NULL SET @created=SYSUTCDATETIME();
    IF @public_key IS NULL SET @public_key=NEWID();
    IF @full_name IS NULL SET @full_name=@login_name;
    IF @display_name IS NULL SET @display_name=@full_name;
    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT=0
            THROW 51008,'A supplied audit version requires an enrolled caller transaction.',1;
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION; SET @owns=1;
            EXEC data.audit_unit_begin;
        END;
        EXEC data.audit_unit_assert @dbrow_version OUTPUT;
        EXEC entities.actor_resolve @created_by,@tenant,@actor_id OUTPUT,@tenant_id OUTPUT;
        SET @tenant=(SELECT public_key FROM data.tenant WHERE tenant_id=@tenant_id);
        IF @user_type IS NULL OR @contact_type IS NULL THROW 51600,'User/contact type definitions are required.',1;
        IF @email IS NOT NULL AND (DATALENGTH(@email)=0 OR DATALENGTH(@email)>512)
            THROW 51300,'Account email must contain 1 to 256 UTF-16 code units.',1;

        -- Resolve by public key, then validate the actual root's tenant under its write lock.
        SELECT @contact_id=entity_id FROM entities.entity WHERE public_key=@public_key;
        IF @contact_id IS NOT NULL
        BEGIN
            EXEC entities.entity_write_lock @contact_id,@tenant_id,@expected_entity_version,
                @dbrow_version OUTPUT,@entity_version OUTPUT;
            IF EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@contact_id)
                THROW 51601,'This contact already has a user account.',1;
            IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN contacts.contact c ON c.contact_id=e.entity_id
                WHERE e.entity_id=@contact_id AND e.entity_type_id=@contact_type)
                THROW 51600,'Only an ordinary contact can be promoted to a user.',1;
        END
        ELSE IF @expected_entity_version IS NOT NULL AND @expected_entity_version<>0
            THROW 51603,'New user construction accepts only an absent-root version (0 or omitted).',1;

        -- Existing roots were locked before first allocation; new roots will be inserted in this unit.
        EXEC data.dbrow_version_ensure @tenant_id,@actor_id,1,@created,@dbrow_version OUTPUT,@recorded_at OUTPUT;
        IF @contact_id IS NULL
        BEGIN
            DECLARE @RC INT
            EXECUTE @RC = [contacts].[contact_insert] 
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
            -- @person_last_name = @person_last_name,
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
            @phone_number = @phone_number,
            @phone_area_code = @phone_area_code,
            @phone_extension = @phone_extension,
            @numbers_only = @numbers_only,
            @full_phone = @full_phone,
            @address_location_name = @address_location_name,
            @address1 = @address1,
            @address2 = @address2,
            @zip_code = @zip_code,
            @city = @city,
            @state = @state,
            @country = @country,
            @dbrow_version = @dbrow_version OUTPUT,
            @auto_create_person_company = @auto_create_person_company,
            @supress_event_message = 1
            SET @contact_id=(SELECT entity_id FROM entities.entity WHERE public_key=@public_key AND tenant_id=@tenant_id);
            EXEC entities.entity_write_lock @contact_id,@tenant_id,0,@dbrow_version OUTPUT,@entity_version OUTPUT;
        END;

        DECLARE @role_id INT=NULL,@role_matches INT;
        IF @user_primary_role IS NOT NULL
        BEGIN
            -- Hold the eligible definition while assigning it; no cross-tenant or silent name fallback.
            SELECT @role_matches=COUNT(*),@role_id=MAX(role_id) FROM security.[role] WITH (HOLDLOCK)
            WHERE role_name=@user_primary_role AND (tenant_id=@tenant_id OR tenant_id IS NULL);
            IF @role_matches<>1 THROW 51602,'Initial role name must identify exactly one eligible definition.',1;
        END;
        INSERT security.[user] (user_id,login_name,password_hash,password_salt,email)
        VALUES (@contact_id,@login_name,@password_hash,@password_salt,@email);
        IF @role_id IS NOT NULL INSERT security.user_role (user_id,role_id) VALUES (@contact_id,@role_id);

        -- A new contact has only provisional type 1; its committed creation snapshot is user type.
        -- An existing contact gets one new root revision and keeps its earlier contact-type history.
        UPDATE entities.entity SET entity_type_id=@user_type WHERE entity_id=@contact_id AND tenant_id=@tenant_id;
        EXEC entities.entity_version_bump @contact_id,@tenant_id,@actor_id,@dbrow_version,@recorded_at,@entity_version OUTPUT;
        EXEC entities.entity_history_snapshot @contact_id,@tenant_id,@dbrow_version;
        EXEC security.user_history_create @contact_id,@tenant_id,@dbrow_version;

        -- Retain the initial assignment choice; later role lifecycle/history is a separate capability.
        DECLARE @event_args NVARCHAR(MAX)=(SELECT 1 AS payload_version,@role_id AS initial_role_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
        EXEC entities.event_create @tenant=@tenant,@event_code='security.user.new',@author=@created_by,
            @subject_type_code='user',@subject_public_key=@public_key,@subject_id=@contact_id,
            @event_args=@event_args,@when_ocurred=@recorded_at,@is_system=0,@dbrow_version=@dbrow_version;
        SET @user_id=@contact_id;
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        SET @dbrow_version=NULL; SET @entity_version=NULL; SET @user_id=NULL;
        THROW;
    END CATCH;
END;
