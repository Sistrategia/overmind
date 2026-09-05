/*************************************************************************************************************
* create_entity_insert.sql is part of the Sistrategia Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2025-Jul-14
* Created:          2010-Sep-08
* Version:			8.0.0.0
*************************************************************************************************************/

CREATE OR ALTER PROCEDURE [entities].[entity_insert] (
     @entity_type_id    INT    
    ,@public_key        UNIQUEIDENTIFIER = NULL
    ,@tenant            UNIQUEIDENTIFIER = NULL
    ,@logical_key       NVARCHAR(256)    = NULL
    ,@display_name      NVARCHAR(256)
    ,@created           DATETIME2        = NULL     
    ,@created_by        UNIQUEIDENTIFIER        -- actor entity_id (resolved by caller)
    ,@summary           NVARCHAR(MAX)    = NULL
    ,@image_url         NVARCHAR(1024)   = NULL
    ,@thumbnail_url     NVARCHAR(1024)   = NULL
    ,@is_private        BIT              = 0
    ,@is_system         BIT              = 0
    ,@dbrow_version     BIGINT           = NULL OUTPUT
    ,@entity_id         INT              = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- NULL INOUT creates an audit entry; non-NULL joins the caller's SAME active transaction.
    -- Supplied versions must match tenant/actor. Never reuse after commit or failure.
    -- Only the transaction owner commits/rolls back; an ambient owner MUST roll back on error.

    DECLARE @TranStarted   BIT
    SET @TranStarted = 0
    DECLARE @tenant_id INT = NULL
    DECLARE @created_by_id INT = 1

    IF @created IS NULL SET @created = SYSUTCDATETIME()
    IF @public_key IS NULL SET @public_key = NEWID()    
    IF @tenant IS NULL SET @tenant_id = (SELECT [tenant_id] FROM [entities].[entity] WHERE [public_key] = @created_by)
    ELSE SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant)
--  IF @entity_type_id IS NULL SET @entity_type_id = 1
    IF @is_private IS NULL SET @is_private = 0

    IF @created_by IS NOT NULL AND @created_by = @public_key SET @created_by_id = 1 ELSE 
        SET @created_by_id = COALESCE((SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by), 1)
    
    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT = 0
            THROW 51008, 'A supplied audit version requires the caller''s active transaction.', 1;
    
        IF( @@TRANCOUNT = 0 )
        BEGIN
            BEGIN TRANSACTION EntityInsert
            SET @TranStarted = 1
        END
        ELSE
            SET @TranStarted = 0

        EXEC [data].[dbrow_version_ensure]
             @tenant_id = @tenant_id
            ,@actor_entity_id = @created_by_id
            ,@dboperation_type_id = 1
            ,@modified = @created
            ,@dbrow_version = @dbrow_version OUTPUT;

        INSERT INTO [entities].[entity] ([entity_type_id], [public_key]
            , [tenant_id], [logical_key], [display_name]
            , [created],[created_by],[modified],[modified_by]
            , [summary],[image_url],[thumbnail_url],[is_private],[is_system]
            , [entity_version], [dbrow_version])
            VALUES (@entity_type_id, @public_key
            , @tenant_id, @logical_key, @display_name
            , @created, @created_by_id
            , @created, @created_by_id
            , @summary, @image_url, @thumbnail_url, @is_private, @is_system
            , 1, @dbrow_version) 

        SET @entity_id = SCOPE_IDENTITY()

        -- Self-creation bootstrap (first user of a tenant creates itself)
        IF (@created_by = @public_key)
        BEGIN
            SET @created_by_id = @entity_id
            UPDATE [entities].[entity] SET [created_by] = [entity_id], [modified_by] = [entity_id] WHERE [entity_id] = @entity_id
            UPDATE [data].[dbrow_version] SET [modified_by] = @entity_id WHERE [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version;
        END

         -- Spine (version 1) + payload history (insert changed payload → snapshot due, op 1)
        INSERT INTO [entities].[entity_version_history]
            ([tenant_id],[dbrow_version],[entity_id],[entity_version])
        VALUES (@tenant_id, @dbrow_version, @entity_id, 1);

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
            COMMIT TRANSACTION EntityInsert;
            SET @TranStarted = 0
        END
        
    END TRY
    
    BEGIN CATCH
        IF @TranStarted = 1 AND XACT_STATE() <> 0
            ROLLBACK TRANSACTION EntityInsert;

        -- OUTPUT is not a commit receipt. Callers discard all context on failure.
        SET @dbrow_version = NULL;
        THROW;
    END CATCH;
END
