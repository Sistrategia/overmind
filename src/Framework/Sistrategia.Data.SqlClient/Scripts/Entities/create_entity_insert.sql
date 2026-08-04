/*************************************************************************************************************
* create_entity_insert.sql is part of the Sistrategia Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE OR ALTER PROCEDURE [entities].[entity_insert] (
     @entity_type_id    INT    
    -- ,@public_key        UNIQUEIDENTIFIER = NULL
    ,@tenant            UNIQUEIDENTIFIER = NULL
    -- ,@logical_key       NVARCHAR(256) = NULL
    -- ,@display_name      NVARCHAR(256) = NULL
    -- ,@created           DATETIME2 = NULL
    ,@created_by        UNIQUEIDENTIFIER
    -- ,@summary           NVARCHAR(MAX) = NULL
    -- ,@image_url         NVARCHAR(1024) = NULL
    -- ,@thumbnail_url     NVARCHAR(1024) = NULL
    -- ,@is_private        BIT = 0
    
    -- ,@dbrow_version     BIGINT = NULL
    -- ,@tenant_id        INT
    -- ,@created_by       INT                        -- actor entity_id (resolved by caller)
    ,@display_name     NVARCHAR(256)
    ,@public_key       UNIQUEIDENTIFIER = NULL
    ,@logical_key      NVARCHAR(256)    = NULL
    ,@summary          NVARCHAR(MAX)    = NULL
    ,@image_url        NVARCHAR(1024)   = NULL
    ,@thumbnail_url    NVARCHAR(1024)   = NULL
    ,@is_private       BIT              = 0
    ,@is_system        BIT              = 0
    ,@created          DATETIME2        = NULL
    ,@dbrow_version    BIGINT           = NULL OUTPUT
    ,@entity_id        INT              = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TranStarted   BIT
    SET @TranStarted = 0
    DECLARE @tenant_id INT

    IF @created IS NULL SET @created = SYSUTCDATETIME()
    IF @public_key IS NULL SET @public_key = NEWID()    
    IF @tenant IS NULL SET @tenant_id = (SELECT [tenant_id] FROM [entities].[entity] WHERE [public_key] = @created_by)
    ELSE SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant)
--  IF @summary IS NULL SET @summary = @display_name
--  IF @entity_type_id IS NULL SET @entity_type_id = 1
    IF @is_private IS NULL SET @is_private = 0
    
    BEGIN TRY
    
        IF( @@TRANCOUNT = 0 )
        BEGIN
            SET XACT_ABORT ON;
            BEGIN TRANSACTION EntityInsert
            SET @TranStarted = 1
        END
        ELSE
            SET @TranStarted = 0

        IF @dbrow_version IS NULL
        BEGIN
            -- SET @dbrow_version = COALESCE((SELECT MAX(dbrow_version) + 1 FROM [data].[dbrow_version] WHERE [tenant_id] = 1), 1)
            SET @dbrow_version = NEXT VALUE FOR [data].[dbrow_version_seq];
            INSERT INTO [data].[dbrow_version] ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by]) 
            VALUES (@tenant_id, @dbrow_version
            , 1
            , @created, COALESCE( (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1) )
            --SET @dbrow_version = SCOPE_IDENTITY()
        END
        
        -- DECLARE @entity_id INT

        INSERT INTO [entities].[entity] ([entity_type_id], [public_key]
            , [tenant_id], [logical_key], [display_name]
            , [created],[created_by],[modified],[modified_by]
            , [summary],[image_url],[thumbnail_url],[is_private],[is_system]
            , [entity_version], [dbrow_version])
            VALUES (@entity_type_id, @public_key
            , @tenant_id, @logical_key, @display_name
            , @created, COALESCE( (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1) 
            , @created, COALESCE( (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1)
            , @summary, @image_url, @thumbnail_url, @is_private, @is_system
            , 1, @dbrow_version) 

        SET @entity_id = SCOPE_IDENTITY()

        -- Self-creation bootstrap (first user of a tenant creates itself)
        IF (@created_by = @public_key)
        BEGIN
            UPDATE [entities].[entity] SET [created_by] = [entity_id], [modified_by] = [entity_id] WHERE [entity_id] = @entity_id
            UPDATE [data].[dbrow_version] SET [modified_by] = @entity_id WHERE [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version;
        END

         -- Spine (version 1) + payload history (insert changed payload → snapshot due, op 1)
        INSERT INTO [entities].[entity_version_history]
            ([tenant_id],[dbrow_version],[entity_id],[entity_version])
        VALUES (@tenant_id, @dbrow_version, @entity_id, 1);

        -- INSERT INTO [entities].[entity_history] ([dbrow_version],[tenant_id],[entity_id],[logical_key],[display_name],[summary]
        --     ,[image_url],[thumbnail_url],[is_private])
        --     SELECT [dbrow_version],[tenant_id],[entity_id],[logical_key],[display_name],[summary]
        --     ,[image_url],[thumbnail_url],[is_private] FROM [entities].[entity] WHERE [entity_id] = @entity_id
        INSERT INTO [entities].[entity_history] (
             [dbrow_version],[tenant_id],[entity_id],[dboperation_type_id],[logical_key],[display_name]
            ,[deleted],[deleted_by],[locked],[locked_by],[validated],[validated_by]
            ,[summary],[image_url],[thumbnail_url],[is_private] -- ,[is_system]
            )
        SELECT @dbrow_version, @tenant_id, [entity_id], 1, [logical_key],[display_name]
            ,[deleted],[deleted_by],[locked],[locked_by],[validated],[validated_by]
            ,[summary],[image_url],[thumbnail_url],[is_private] -- ,[is_system]
        FROM [entities].[entity] WHERE [entity_id] = @entity_id;
    
        IF( @TranStarted = 1 )
        BEGIN
            SET @TranStarted = 0
            COMMIT TRANSACTION EntityInsert
        END
        
    END TRY
    
    BEGIN CATCH
    
        DECLARE @ErrorNo int,
        @Severity tinyint,
        @State smallint,
        @LineNo int,
        @Message nvarchar(4000);
        
        SELECT
            @ErrorNo = ERROR_NUMBER(),
            @Severity = ERROR_SEVERITY(),
            @State = ERROR_STATE(),
            @LineNo = ERROR_LINE (),
            @Message = ERROR_MESSAGE();

        -- Rollback any active or uncommittable transactions before
        -- inserting information in the ErrorLog
        IF (@TranStarted = 1 AND @@TRANCOUNT > 0)
        BEGIN
            SET @TranStarted = 0
            ROLLBACK TRANSACTION EntityInsert
        END
        
        BEGIN
            RAISERROR(@Message, 16, 1 );
        END
        
    END CATCH;
    
END
