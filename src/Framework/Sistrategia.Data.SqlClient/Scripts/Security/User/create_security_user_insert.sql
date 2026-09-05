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

    ,@email_location_name           NVARCHAR(25) = NULL
	,@email 						NVARCHAR(256) = NULL
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
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- NULL INOUT creates an audit entry; non-NULL joins the caller's SAME active transaction.
    -- Supplied versions must match tenant/actor. Never reuse after commit or failure.
    -- Only the transaction owner commits/rolls back; an ambient owner MUST roll back on error.

    DECLARE @tenant_id INT

    DECLARE @TranStarted   BIT
	SET @TranStarted = 0

    IF @created IS NULL SET @created = GETUTCDATE()
    IF @public_key IS NULL SET @public_key = NEWID()    
    IF @tenant IS NULL SET @tenant_id = (SELECT [tenant_id] FROM [entities].[entity] WHERE [public_key] = @created_by)
    ELSE SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant)

    IF @tenant_id IS NULL SET @tenant_id = (SELECT MAX([tenant_id]) FROM [data].[tenant])

    IF @tenant IS NULL SET @tenant = (SELECT [public_key] FROM [data].[tenant] WHERE [tenant_id] = @tenant_id)

    IF @full_name IS NULL SET @full_name = @login_name
    IF @display_name IS NULL SET @display_name = @full_name
    -- IF @summary IS NULL SET @summary = @full_name

    IF @contact_type_id IS NULL SET @contact_type_id = 1
    IF @is_private IS NULL SET @is_private = 0    

    --IF @security_stamp IS NULL SET @security_stamp = LOWER(NEWID())

    --IF @email_confirmed IS NULL SET @email_confirmed = 0
    --IF @phone_number_confirmed IS NULL SET @phone_number_confirmed = 0
    --IF @two_factor_enabled IS NULL SET @two_factor_enabled = 0
    ----IF @lockout_end_date_utc IS NULL SET @lockout_end_date_utc = NULL
    --IF @lockout_enabled IS NULL SET @lockout_enabled = 1
    --IF @access_failed_count IS NULL SET @access_failed_count = 0

    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT = 0
            THROW 51008, 'A supplied audit version requires the caller''s active transaction.', 1;

        IF( @@TRANCOUNT = 0 )
		BEGIN
			BEGIN TRANSACTION SecurityUserInsert
			SET @TranStarted = 1
		END
		ELSE
    		SET @TranStarted = 0        

        DECLARE @audit_actor_id INT = COALESCE(
            (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1);
        EXEC [data].[dbrow_version_ensure]
             @tenant_id = @tenant_id
            ,@actor_entity_id = @audit_actor_id
            ,@dboperation_type_id = 1
            ,@modified = @created
            ,@dbrow_version = @dbrow_version OUTPUT;

        DECLARE @entity_id INT
        DECLARE @contact_id INT
		SET @contact_id = (SELECT c.[contact_id] FROM [contacts].[contact] AS c
            INNER JOIN [entities].[entity] AS e ON (c.[contact_id] = e.[entity_id])
            WHERE e.[public_key] = @public_key)

        IF (@contact_id IS NULL AND EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'contacts' AND TABLE_NAME = 'contact'))
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
            
            -- @contact_type_id, @public_key, @tenant, @logical_key, @display_name
            --     , @created, @created_by
            --     , @summary, @image_url
            --     , @thumbnail_url, @is_private

            --     ,@full_name,@person_title,@person_first_name -- ,@person_last_name
            --     ,@person_last_name1,@person_last_name2,@person_suffix,@person_alias
            --     ,@person_job_title,@person_company
            --     ,@person_gender_code,@person_birth_date
            --     ,@person_marital_status
            --     ,@email_location_name,@email
            --     ,@phone_location_name,@phone_number,@phone_area_code,@phone_extension,@numbers_only,@full_phone
            --     ,@address_location_name,@address1,@address2,@zip_code,@city,@state,@country
            --     ,@dbrow_version
            --     ,@auto_create_person_company
            --     ,1 -- @supress_event_message

            --SET @contact_id = SCOPE_IDENTITY()

            SET @contact_id = (
                SELECT c.[contact_id] FROM [contacts].[contact] AS c
                INNER JOIN [entities].[entity] AS e ON (c.[contact_id] = e.[entity_id])
                WHERE e.[public_key] = @public_key)

        END

   --     IF (@contact_id IS NULL AND EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'contacts' AND TABLE_NAME = 'contact'))
   --     BEGIN
   --         INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id]            
   --         , [full_name]-- ,[email],[email_confirmed],[phone_number],[phone_number_confirmed]
   --         -- , [person_title]
   --         , [person_first_name], [person_last_name], [person_last_name1], [person_last_name2]
   --         -- , [person_alias], [person_gender_code], [person_birth_date]
			--, [person_job_title], [person_company]
			--)
   --         VALUES (@entity_id, @contact_type_id
   --         , @full_name -- , @email, @email_confirmed, @phone_number, @phone_number_confirmed
   --         , @person_first_name, @person_last_name, @person_last_name1, @person_last_name2
			--, @person_job_title, @person_company			
   --         ) 

			--SET @contact_id = @entity_id
   --     END

        INSERT INTO [security].[user] ([user_id]
            ,[login_name] -- ,[full_name]
            ,[password_hash] -- ,[security_stamp]
            ,[password_salt]
            -- ,[email],[email_confirmed],[phone_number],[phone_number_confirmed]
            -- ,[two_factor_enabled],[lockout_end_date_utc],[lockout_enabled],[access_failed_count],[mature_content_accepted]
            -- ,[dbrow_version]
            ) VALUES (@contact_id			
            , @login_name -- , @full_name
            , @password_hash -- , @security_stamp
            , @password_salt
            -- , @email, @email_confirmed, @phone_number, @phone_number_confirmed
            -- , @two_factor_enabled, @lockout_end_date_utc, @lockout_enabled, @access_failed_count, @mature_content_accepted
            -- , @dbrow_version
            ) 

        IF (@user_primary_role IS NOT NULL)
        BEGIN
            DECLARE @role_id INT
            SELECT @role_id = [role_id] FROM [security].[role] WHERE [role_name] = @user_primary_role
            IF (@role_id IS NOT NULL)
            BEGIN
                INSERT INTO [security].[user_role] ([user_id], [role_id]) VALUES (@contact_id, @role_id)
            END
        END

        IF (@contact_id IS NOT NULL AND EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'entities' AND TABLE_NAME = 'event'))
        BEGIN
            -- Title/summary now resolved at read time from [entities].[event_type_localized]
            -- templates via [[Author.FullName]] / [[Subject.Name]] placeholders.
            EXECUTE [entities].[event_create]
                 @tenant             = @tenant
                ,@event_code         = 'security.user.new'
                ,@author             = @created_by
                ,@subject_type_code  = 'user'
                ,@subject_public_key = @public_key
                ,@subject_id         = @contact_id
                ,@event_args         = NULL
                ,@when_ocurred       = @created
                ,@is_system          = 0
                ,@dbrow_version      = @dbrow_version
        END

        IF( @TranStarted = 1 )
		BEGIN
			COMMIT TRANSACTION SecurityUserInsert;
            SET @TranStarted = 0
		END

    END TRY

    BEGIN CATCH
        IF @TranStarted = 1 AND XACT_STATE() <> 0
            ROLLBACK TRANSACTION SecurityUserInsert;

        -- OUTPUT is not a commit receipt. Callers discard all context on failure.
        SET @dbrow_version = NULL;
        THROW;
    END CATCH;
END
