/*************************************************************************************************************
* create_contact_insert.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE OR ALTER PROCEDURE [contacts].[contact_insert] (
     @contact_type_id               INT = 1 -- person
    ,@public_key                    UNIQUEIDENTIFIER = NULL	
    ,@tenant                        UNIQUEIDENTIFIER = NULL	
    ,@logical_key                   NVARCHAR(256) = NULL    
    ,@display_name                  NVARCHAR(256) = NULL
    ,@created                       DATETIME2 = NULL
    ,@created_by                    UNIQUEIDENTIFIER 
    ,@summary                       NVARCHAR(MAX) = NULL
    ,@image_url                     NVARCHAR(1024) = NULL
    ,@thumbnail_url                 NVARCHAR(1024) = NULL
    ,@is_private                    BIT = 0	
    
    ,@full_name                     NVARCHAR(256)
    
    ,@person_title                  NVARCHAR(256) = NULL
    ,@person_first_name             NVARCHAR(256) = NULL
--  ,@person_last_name              NVARCHAR(256) = NULL
    ,@person_last_name1             NVARCHAR(256) = NULL
    ,@person_last_name2             NVARCHAR(256) = NULL
    ,@person_suffix                 NVARCHAR(256) = NULL
    ,@person_alias                  NVARCHAR(256) = NULL
    
    ,@person_job_title              NVARCHAR(256) = NULL
    ,@person_company                NVARCHAR(256) = NULL
    
    ,@person_gender_code            CHAR(1) = NULL
    ,@person_birth_date             DATE = NULL

    ,@person_marital_status         CHAR(1) = NULL

    ,@email_location_name           NVARCHAR(MAX) = NULL
    ,@email_address                 NVARCHAR(MAX) = NULL

    ,@phone_location_name           NVARCHAR(25) = NULL
    ,@phone_number                  NVARCHAR(25) = NULL
    ,@phone_area_code               NVARCHAR(16) = NULL
    ,@phone_extension               NVARCHAR(25) = NULL
    ,@numbers_only                  NVARCHAR(15) = NULL
    ,@full_phone                    NVARCHAR(20) = NULL

    ,@address_location_name         NVARCHAR(50) = NULL
    ,@address1                      NVARCHAR(256) = NULL
    ,@address2                      NVARCHAR(256) = NULL
    ,@zip_code                      NVARCHAR(256) = NULL
    ,@city                          NVARCHAR(256) = NULL
    ,@state                         NVARCHAR(256) = NULL
    ,@country                       NVARCHAR(256) = NULL

    ,@do_not_contact                BIT = 0
    ,@line_of_business              NVARCHAR(256) = NULL 

    ,@dbrow_version                 BIGINT = NULL OUTPUT

    ,@auto_create_person_company    BIT = 1	 
    ,@supress_event_message         BIT = 0	 
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- NULL INOUT creates an audit entry; non-NULL joins the caller's SAME active transaction.
    -- Supplied versions must match tenant/actor. Never reuse after commit or failure.
    -- Only the transaction owner commits/rolls back; an ambient owner MUST roll back on error.
    
    DECLARE @contact_id INT
    DECLARE @tenant_id INT
    DECLARE @contact_entity_type_id INT
    
    DECLARE @TranStarted   BIT
    SET @TranStarted = 0       

    IF @created IS NULL SET @created = GETUTCDATE()
    IF @public_key IS NULL SET @public_key = NEWID()    
    IF @tenant IS NULL SET @tenant_id = (SELECT [tenant_id] FROM [entities].[entity] WHERE [public_key] = @created_by)
    ELSE SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant)

    IF @display_name IS NULL SET @display_name = @full_name
    -- IF @summary IS NULL SET @summary = @full_name    
    IF @contact_type_id IS NULL SET @contact_type_id = 1
    IF @is_private IS NULL SET @is_private = 0    

    SET @contact_entity_type_id = COALESCE( (SELECT [entity_type_id] FROM [entities].[entity_type] WHERE [code_name] = 'contact'), 1) 

--  IF @custom_display_name IS NULL SET @custom_display_name = 0

    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT = 0
            THROW 51008, 'A supplied audit version requires the caller''s active transaction.', 1;
    
        IF( @@TRANCOUNT = 0 )
        BEGIN
            BEGIN TRANSACTION ContactInsert
            SET @TranStarted = 1
            EXEC [data].[audit_unit_begin];
        END
        ELSE
            SET @TranStarted = 0
        
        -- ---------------------------------------------------------------------
        
        IF @public_key IS NULL SET @public_key = NEWID()
        
        DECLARE @audit_actor_id INT = COALESCE(
            (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1);
        EXEC [data].[dbrow_version_ensure]
             @tenant_id = @tenant_id
            ,@actor_entity_id = @audit_actor_id
            ,@dboperation_type_id = 1
            ,@modified = @created
            ,@dbrow_version = @dbrow_version OUTPUT;

        DECLARE @RC INT
        EXECUTE @RC = [entities].[entity_insert]
             @entity_type_id = @contact_entity_type_id
            ,@public_key     = @public_key
            ,@tenant         = @tenant
            ,@logical_key    = @logical_key
            ,@display_name   = @display_name
            ,@created        = @created
            ,@created_by     = @created_by
            ,@summary        = @summary
            ,@image_url      = @image_url
            ,@thumbnail_url  = @thumbnail_url
            ,@is_private     = @is_private
            ,@dbrow_version  = @dbrow_version OUTPUT

        SET @contact_id = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @public_key)

        -- -- UPSERT line_of_business
        -- DECLARE @line_of_business_id INT = NULL
        -- IF @line_of_business IS NOT NULL
        -- BEGIN            
        --     SET @line_of_business_id = (SELECT [line_of_business_id] FROM [contacts].[line_of_business] WHERE [display_name] = @line_of_business)
        --     IF @line_of_business_id IS NULL
        --     BEGIN
        --         INSERT INTO [contacts].[line_of_business] ([display_name]) VALUES (@line_of_business)
        --         SET @line_of_business_id = SCOPE_IDENTITY()
        --     END
        --     -- UPDATE [contacts].[contact] SET [line_of_business_id] = @line_of_business_id WHERE [contact_id] = @contact_id
        -- END
        
        INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id]            
            , [full_name]
            , [person_job_title], [person_company]
            , [person_gender_code], [person_birth_date]
            , [person_marital_status]
            -- , [line_of_business_id]
            )
            VALUES (@contact_id, @contact_type_id
            , @full_name
            , @person_job_title, @person_company
            , @person_gender_code, @person_birth_date
            , @person_marital_status
            -- , (SELECT [line_of_business_id] FROM [contacts].[line_of_business] WHERE [display_name] = @line_of_business)
            -- , @line_of_business_id
            )

        INSERT INTO [contacts].[contact_history] ([dbrow_version], [tenant_id]
            , [contact_id] -- , [contact_type_id]            
            , [full_name]
            , [person_job_title], [person_company]
            , [person_gender_code], [person_birth_date]
            , [person_marital_status]
            -- , [line_of_business_id]
            , [do_not_contact]
            )
            VALUES ( @dbrow_version, @tenant_id
            , @contact_id -- , @contact_type_id            
            , @full_name
            , @person_job_title, @person_company
            , @person_gender_code, @person_birth_date
            , @person_marital_status
            -- , (SELECT [line_of_business_id] FROM [contacts].[line_of_business] WHERE [display_name] = @line_of_business)
            -- , @line_of_business_id
            , @do_not_contact -- default 0
            )  

        IF @person_title IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_title)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_title)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 1, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_title))
        END

        IF @person_first_name IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_first_name)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_first_name)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 2, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_first_name))
        END

        --IF @person_last_name IS NOT NULL
        --BEGIN
        --    IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name)
        --        INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_last_name)
        --    INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        --        VALUES (@contact_id, 3, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name))
        --END

        IF @person_last_name1 IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name1)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_last_name1)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 4, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name1))
        END

        IF @person_last_name2 IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name2)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_last_name2)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 5, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_last_name2))
        END

        IF @person_suffix IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_suffix)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_suffix)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 6, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_suffix))
        END

        IF @person_alias IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_alias)
                INSERT INTO [contacts].[person_name] ([name]) VALUES (@person_alias)
            INSERT INTO [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
                VALUES (@contact_id, 7, (SELECT [person_name_id] FROM [contacts].[person_name] WHERE [name] = @person_alias))
        END
            
        -- IF @email_address IS NOT NULL
        -- BEGIN
        --     DECLARE @email_id   INT
        --     SET @email_id = (SELECT [email_id] FROM [contacts].[email] WHERE [email_address] = @email_address)
        --     IF @email_id IS NULL
        --     BEGIN
        --         EXEC [contacts].[email_insert]
        --             @email_id = @email_id OUTPUT
        --             ,@email_address = @email_address
        --     END
        --     INSERT INTO [contacts].[contact_email] ([contact_id],[ordinal],[email_id])
        --     VALUES (@contact_id, 1, @email_id)
        -- END        

        IF @email_address IS NOT NULL
        BEGIN
            IF @email_location_name IS NULL
                SET @email_location_name = 'Primary'
            -- New contact was absent at unit entry (expected version 0). Use its existing unit.
            -- Legacy self-creation may have rebound the actor during entity insertion.
            SET @audit_actor_id=(SELECT [modified_by] FROM [data].[dbrow_version]
                WHERE [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version);
            EXEC [contacts].[contact_email_write]
                @operation='insert', @contact_id=@contact_id, @tenant_id=@tenant_id,
                @actor_entity_id=@audit_actor_id, @expected_entity_version=0,
                @email_address=@email_address, @location_name=@email_location_name,
                @dbrow_version=@dbrow_version OUTPUT, @show_in_timeline=0;
		END

        -- IF (@address1 IS NOT NULL OR @country IS NOT NULL)
        -- IF (@address1 IS NOT NULL)
        IF (@address1 IS NOT NULL OR @state IS NOT NULL OR @city IS NOT NULL)
        BEGIN
            -- ================================================================
            -- Use centralized location upsert to ensure proper hierarchy
            -- Country → State → City with correct parent-child relationships
            -- ================================================================
            DECLARE @city_id INT = NULL
            DECLARE @state_id INT = NULL            
            DECLARE @country_id INT = NULL
            DECLARE @address_id INT = NULL

            EXEC [contacts].[ensure_address_location_upsert]
                @country_id = NULL,
                @country_name = @country,
                @state_id = NULL,
                @state_name = @state,
                @city_id = NULL,
                @city_name = @city,
                @out_country_id = @country_id OUTPUT,
                @out_state_id = @state_id OUTPUT,
                @out_city_id = @city_id OUTPUT;

            SET @address_id = (SELECT TOP 1 [address_id] FROM [contacts].[address] 
                    WHERE COALESCE([country_id], 0) = COALESCE(@country_id, 0)
                    AND COALESCE([state_id], 0) = COALESCE(@state_id, 0)
                    AND COALESCE([city_id], 0) = COALESCE(@city_id, 0)
                    AND COALESCE([zip_code], '') = COALESCE(@zip_code, '')
                    AND COALESCE([address2], '') = COALESCE(@address2, '')
                    AND COALESCE([address1], '') = COALESCE(@address1, '')
                    ORDER BY [address_id] ASC
                )
            IF (@address_id IS NULL AND (
                @address1 IS NOT NULL OR @address2 IS NOT NULL OR @zip_code IS NOT NULL
                OR @city_id IS NOT NULL OR @state_id IS NOT NULL OR @country_id IS NOT NULL
                ) )
            BEGIN
                INSERT INTO [contacts].[address] ([address1],[address2],[zip_code],[city_id],[state_id],[country_id])
                VALUES (@address1, @address2, @zip_code, @city_id, @state_id, @country_id)
                SET @address_id = SCOPE_IDENTITY()
            END

            IF @address_location_name IS NULL
                SET @address_location_name = 'Primary'

            DECLARE @address_location_id INT
            SET @address_location_id = (SELECT [location_id] FROM [contacts].[address_location] WHERE [location_name] = @address_location_name)
            IF @address_location_id IS NULL
            BEGIN
                INSERT INTO [contacts].[address_location] ([location_name]) VALUES (@address_location_name)
                SET @address_location_id = SCOPE_IDENTITY()
            END

            INSERT INTO [contacts].[contact_address] ([contact_id],[ordinal],[address_id],[location_id])
            VALUES (@contact_id, 1, @address_id, @address_location_id)
        END

        IF @phone_number IS NOT NULL
        BEGIN
            DECLARE @phone_id INT
            --DECLARE @numbers_only NVARCHAR(15)
            --DECLARE @full_phone NVARCHAR(20)
            
            --SET @full_phone = COALESCE(@phone_area_code + ' ' + @phone_number, @phone_number)            

            --SET @numbers_only = (SELECT LEFT(SUBSTRING(@full_phone, PATINDEX('%[0-9.-]%', @full_phone), 8000),
            --    PATINDEX('%[^0-9.-]%', SUBSTRING(@full_phone, PATINDEX('%[0-9.-]%', @full_phone), 8000) + 'X') -1))

            SET @phone_id = (SELECT [phone_id] FROM [contacts].[phone] WHERE [phone_number] = @phone_number)
            IF @phone_id IS NULL
            BEGIN
                INSERT INTO [contacts].[phone] ([phone_number], [area_code],[numbers_only],[city_id],[state_id],[country_id])
                VALUES (@phone_number, @phone_area_code, @numbers_only, @city_id, @state_id, @country_id)
                SET @phone_id = SCOPE_IDENTITY()
                --EXEC [contacts].[phone_insert]
                --        @email_id = @email_id OUTPUT
                --    ,@email_address = @email_address
            END

            IF @phone_location_name IS NULL
                SET @phone_location_name = 'Primary'

            DECLARE @phone_location_id INT
            SET @phone_location_id = (SELECT [location_id] FROM [contacts].[phone_location] WHERE [location_name] = @phone_location_name)
            IF @phone_location_id IS NULL
            BEGIN
                INSERT INTO [contacts].[phone_location] ([location_name]) VALUES (@phone_location_name)
                SET @phone_location_id = SCOPE_IDENTITY()
            END

            INSERT INTO [contacts].[contact_phone] ([contact_id],[ordinal],[phone_id],[location_id],[extension])
            VALUES (@contact_id, 1, @phone_id, @phone_location_id, @phone_extension)
        END

        IF @auto_create_person_company = 1 AND @person_company IS NOT NULL
        BEGIN

            DECLARE @company_public_key UNIQUEIDENTIFIER
            DECLARE @company_contact_id INT = NULL

            SET @company_contact_id = (SELECT [contact_id] FROM [contacts].[contact] WHERE [full_name] = @person_company)

            IF @company_contact_id IS NULL
            BEGIN
                IF @company_public_key IS NULL SET @company_public_key = NEWID()
                EXECUTE @RC = [entities].[entity_insert]
                     @entity_type_id = @contact_entity_type_id
                    ,@public_key     = @company_public_key
                    ,@tenant         = @tenant
                    ,@logical_key    = NULL
                    ,@display_name   = @person_company
                    ,@created        = @created
                    ,@created_by     = @created_by
                    ,@summary        = NULL
                    ,@image_url      = NULL
                    ,@thumbnail_url  = NULL
                    ,@is_private     = @is_private
                    ,@dbrow_version  = @dbrow_version OUTPUT

                SET @company_contact_id = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @company_public_key)
        
                INSERT INTO [contacts].[contact] ([contact_id], [contact_type_id], [full_name])
                    VALUES (@company_contact_id, 2, @person_company) 

                INSERT INTO [contacts].[contact_relationship] ([contact_relationship_type_id],[from_contact_id],[to_contact_id]) 
                VALUES ((SELECT [contact_relationship_type_id] FROM [contacts].[contact_relationship_type] WHERE [code_name] = 'worksfor'), @contact_id, @company_contact_id)                
            END
            ELSE 
            BEGIN
                INSERT INTO [contacts].[contact_relationship] ([contact_relationship_type_id],[from_contact_id],[to_contact_id]) 
                VALUES ((SELECT [contact_relationship_type_id] FROM [contacts].[contact_relationship_type] WHERE [code_name] = 'worksfor'), @contact_id, @company_contact_id)
            END
            SET @company_contact_id = NULL            
        END

        IF (@supress_event_message = 0 AND @contact_id IS NOT NULL AND EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'entities' AND TABLE_NAME = 'event'))
        BEGIN
            -- Title/summary now resolved at read time from [entities].[event_type_localized]
            -- templates via [[Author.FullName]] / [[Subject.Name]] placeholders.
            EXECUTE [entities].[event_create]
                 @tenant             = @tenant
                ,@event_code         = 'contacts.contact.new'
                ,@author             = @created_by
                ,@subject_type_code  = 'contact'
                ,@subject_public_key = @public_key
                ,@subject_id         = @contact_id
                ,@event_args         = NULL
                ,@when_ocurred       = @created
                ,@is_system          = 0
                ,@dbrow_version      = @dbrow_version
        END

        IF( @TranStarted = 1 )
        BEGIN
            COMMIT TRANSACTION ContactInsert;
            SET @TranStarted = 0
        END

    END TRY
    BEGIN CATCH
        IF @TranStarted = 1 AND XACT_STATE() <> 0
            ROLLBACK TRANSACTION ContactInsert;

        -- OUTPUT is not a commit receipt. Callers discard all context on failure.
        SET @dbrow_version = NULL;
        THROW;
    END CATCH;
END
