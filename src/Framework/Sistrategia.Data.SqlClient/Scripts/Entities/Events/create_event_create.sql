/*************************************************************************************************************
* create_event_create.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- PROCEDURE [entities].[event_create]
-- -----------------------------------------------------------------------------------------------------------
CREATE PROCEDURE [entities].[event_create] (
    -- @public_key				UNIQUEIDENTIFIER = NULL
     @tenant                    UNIQUEIDENTIFIER = NULL
    ,@event_code				NVARCHAR(50)

    ,@author	 				UNIQUEIDENTIFIER 
    ,@subject_type_code			NVARCHAR(50) = NULL
    ,@subject_public_key		UNIQUEIDENTIFIER = NULL
    ,@subject_id                INT = NULL
    -- ,@subject_name				NVARCHAR(256) = NULL

    -- ,@title						NVARCHAR(256) -- = NULL
    -- ,@summary					NVARCHAR(MAX) = NULL

    ,@event_args                NVARCHAR(MAX) = NULL      -- JSON

    ,@when_ocurred              DATETIME2 = NULL
    ,@is_system                 BIT = 0
    ,@dbrow_version 			BIGINT -- = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @event_type_id INT
    SET @event_type_id = (SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = @event_code)
    IF @event_type_id IS NULL THROW 53404, 'Unknown event_code — seed it in the owning module migration.', 1;

	DECLARE @subject_type_id INT
    DECLARE @public_key UNIQUEIDENTIFIER = NEWID()   
    DECLARE @tenant_id INT
    -- IF @public_key IS NULL SET @public_key = NEWID()
    IF @when_ocurred IS NULL SET @when_ocurred = GETUTCDATE()
    IF @tenant IS NULL SET @tenant_id = (SELECT [tenant_id] FROM [entities].[entity] WHERE [public_key] = @subject_public_key) ELSE SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant)
    IF @subject_id IS NULL SET @subject_id = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @subject_public_key)
    IF @subject_type_code IS NOT NULL
	BEGIN
		SELECT @subject_type_id = [entity_type_id] FROM [entities].[entity_type] WHERE [code_name] = @subject_type_code
		--SET @subject_type_id = 1
	END
    -- IF @subject_name IS NULL SET @subject_name = (SELECT [display_name] FROM [entities].[entity] WHERE [public_key] = @subject_public_key)

    -- DECLARE @UserFullName NVARCHAR(256)
	-- DECLARE @UserIndexOnTitle INT
	-- SET @UserIndexOnTitle = CHARINDEX('[[Author.FullName]]', @title)
	-- IF @UserIndexOnTitle > 0
	-- BEGIN		
	-- 	SET @UserFullName = (SELECT u.[display_name] FROM [security].[user_view] AS u WHERE u.[user_id] = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @author) ) 
	-- 	SET @title = REPLACE(@title,'[[Author.FullName]]',@UserFullName); 
	-- END

    -- DECLARE @SubjectNameOnTitle INT
	-- SET @SubjectNameOnTitle = CHARINDEX('[[Subject.Name]]', @title)
	-- IF @SubjectNameOnTitle > 0
	-- BEGIN		
	-- 	SET @title = REPLACE(@title,'[[Subject.Name]]',@subject_name); 
	-- END

    -- DECLARE @UserIndexOnSummary INT
	-- SET @UserIndexOnSummary = CHARINDEX('[[Author.FullName]]', @summary)
	-- IF @UserIndexOnSummary > 0
	-- BEGIN
	-- 	IF @UserFullName IS NULL
	-- 	BEGIN
	-- 	SET @UserFullName = (SELECT u.[display_name] FROM [security].[user_view] AS u WHERE u.[user_id] = (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @author) ) 
	-- 	END
	-- 	SET @summary = REPLACE(@summary,'[[Author.FullName]]',@UserFullName); 
	-- END

    -- DECLARE @SubjectNameOnSummary INT
	-- SET @SubjectNameOnSummary = CHARINDEX('[[Subject.Name]]', @summary)
	-- IF @SubjectNameOnSummary > 0
	-- BEGIN		
	-- 	SET @summary = REPLACE(@summary,'[[Subject.Name]]',@subject_name); 
	-- END

    INSERT INTO [entities].[event] ([event_type_id],[tenant_id],[public_key]
			,[created],[created_by]
			-- ,[display_name]
			-- ,[summary]
            ,[subject_type_id],[subject_public_key],[subject_id]
            ,[event_args]
            ,[is_system]
            ,[dbrow_version])
		SELECT @event_type_id AS [event_type_id]
            ,@tenant_id
			,@public_key AS [public_key]
            ,@when_ocurred AS [created]
			,(SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @author) AS [created_by]			
			-- ,@title AS [display_name]
			-- ,@summary AS [summary]			
			,@subject_type_id AS [subject_type_id] --             
			,@subject_public_key AS [subject_public_key]
            ,@subject_id AS [subject_id]
            ,@event_args AS [event_args]
            ,@is_system
			,@dbrow_version AS [dbrow_version]
END    

    --  [event_id]             INT                 NOT NULL    IDENTITY(1,1)    
    -- ,[event_type_id]        INT                 NOT NULL
    -- ,[tenant_id]            INT                 NOT NULL
    -- ,[public_key]           UNIQUEIDENTIFIER    NOT NULL    CONSTRAINT [def_event_public_key] DEFAULT (NEWID())
    -- ,[display_name]         NVARCHAR(256)       NOT NULL
    -- ,[created]              DATETIME2           NOT NULL    CONSTRAINT [def_event_created] DEFAULT (GETUTCDATE())
    -- ,[created_by]           INT                 NOT NULL
    -- ,[subject_type_id]      INT                 NOT NULL
    -- ,[subject_id]           INT                 NOT NULL
    -- ,[subject_public_key]   UNIQUEIDENTIFIER    NOT NULL
    -- ,[summary]              NVARCHAR(MAX)           NULL    
    -- ,[is_system]            BIT                 NOT NULL    CONSTRAINT [def_event_is_system] DEFAULT ((0))	
    -- ,[dbrow_version]        BIGINT              NOT NULL

  