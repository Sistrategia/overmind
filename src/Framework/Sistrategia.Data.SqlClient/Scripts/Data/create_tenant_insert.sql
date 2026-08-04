/*************************************************************************************************************
* create_tenant_insert.sql is part of the Sistrategia.Data Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

CREATE PROCEDURE [data].[tenant_insert] (	 
     @name                  NVARCHAR(256) = NULL        
    ,@public_key            UNIQUEIDENTIFIER = NULL	
    ,@logical_key           NVARCHAR(256) = NULL
    ,@created               DATETIME2 = NULL
    ,@created_by            UNIQUEIDENTIFIER = NULL -- INT
--  ,@thumbnail_url         NVARCHAR(1024) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @tenant_id INT
    DECLARE @dbrow_version INT
    DECLARE @created_by_id INT

    IF @public_key IS NULL
        SET @public_key = NEWID()

    IF @created IS NULL SET @created = GETUTCDATE()    
    IF @created_by IS NULL 
        SET @created_by_id = 1 -- System user
    ELSE
        SET @created_by_id = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @created_by)

    DECLARE @TranStarted   BIT
    SET @TranStarted = 0

    BEGIN TRY

        IF( @@TRANCOUNT = 0 )
        BEGIN
            SET XACT_ABORT ON;
            BEGIN TRANSACTION TenantInsert
            SET @TranStarted = 1
        END
        ELSE
            SET @TranStarted = 0        

        INSERT INTO [data].[tenant] ([public_key], [name]) VALUES (@public_key, @name) 
        SET @tenant_id = SCOPE_IDENTITY()
        INSERT INTO [data].[dbrow_version] ([tenant_id], [dbrow_version], [dboperation_type_id],
            [modified], [modified_by]) VALUES (@tenant_id, 1, 1, @created, @created_by_id)

        IF( @TranStarted = 1 )
        BEGIN
            SET @TranStarted = 0
            COMMIT TRANSACTION TenantInsert
        END
    
    END TRY

    BEGIN CATCH
        DECLARE @ErrorNo int,
        @Severity tinyint,
        @ErrorState smallint,
        @LineNo int,
        @Message nvarchar(4000);

        SELECT
            @ErrorNo = ERROR_NUMBER(),
            @Severity = ERROR_SEVERITY(),
            @ErrorState = ERROR_STATE(),
            @LineNo = ERROR_LINE (),
            @Message = ERROR_MESSAGE();

        -- Rollback any active or uncommittable transactions before
        -- inserting information in the ErrorLog
        IF (@TranStarted = 1 AND @@TRANCOUNT > 0)
        BEGIN
            SET @TranStarted = 0
            ROLLBACK TRANSACTION TenantInsert
        END

        BEGIN
            RAISERROR(@Message, 16, 1 );
        END
    END CATCH;
END