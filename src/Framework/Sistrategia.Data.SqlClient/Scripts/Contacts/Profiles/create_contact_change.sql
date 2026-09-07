-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_change.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Public profile/lifecycle boundary. Actor and tenant come from trusted application context.
-- Ambient callers enroll and must roll back the entire unit on any error.
CREATE OR ALTER PROCEDURE [contacts].[contact_change]
    @operation VARCHAR(10),
    @contact_public_key UNIQUEIDENTIFIER OUTPUT,
    @actor UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER,
    @expected_entity_version INT,
    @profile_data NVARCHAR(MAX)=NULL,
    @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT,
    @contact_id INT=NULL OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @contact_entity_type INT=(SELECT [entity_type_id] FROM [entities].[entity_type] WHERE [code_name]=N'contact');
    DECLARE @owns BIT=0,@tenant_id INT,@actor_id INT,@deleted DATETIME2,@recorded_at DATETIME2=SYSUTCDATETIME();
    BEGIN TRY
        IF @contact_entity_type IS NULL
        BEGIN
            THROW 52004, 'Contact entity type definition is required.', 1;
        END
        IF @tenant IS NULL
        BEGIN
            THROW 52003, 'Contact operations require an explicitly resolved tenant.', 1;
        END
        IF @operation IS NULL OR @operation NOT IN ('create','update','delete','restore')
        BEGIN
            THROW 52005, 'Unsupported contact operation.', 1;
        END
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT=0
        BEGIN
            THROW 51008, 'Supplied versions require an enrolled caller transaction.', 1;
        END
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION;
            SET @owns=1;
            EXEC [data].[audit_unit_begin];
        END
        EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
        EXEC [entities].[actor_resolve]
            @actor=@actor,@tenant=@tenant,@actor_entity_id=@actor_id OUTPUT,@tenant_id=@tenant_id OUTPUT;
        IF @dbrow_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [data].[dbrow_version]
            WHERE [dbrow_version]=@dbrow_version AND [tenant_id]=@tenant_id AND [modified_by]=@actor_id)
        BEGIN
            THROW 51005, 'The audit unit has a different tenant or actor.', 1;
        END
        IF @operation IN ('create','update')
        BEGIN
            EXEC [contacts].[contact_profile_prepare] @profile_data OUTPUT;
        END
        ELSE IF @profile_data IS NOT NULL
        BEGIN
            THROW 52005, 'Lifecycle commands do not accept profile fields.', 1;
        END
    DECLARE @contact_type_id INT;
    DECLARE @full_name NVARCHAR(256);
    DECLARE @display_name NVARCHAR(256);
    DECLARE @logical_key NVARCHAR(256);
    DECLARE @summary NVARCHAR(MAX);
    DECLARE @image_url NVARCHAR(1024);
    DECLARE @thumbnail_url NVARCHAR(1024);
    DECLARE @is_private BIT;
    DECLARE @do_not_contact BIT;
    DECLARE @person_title NVARCHAR(256);
    DECLARE @person_first_name NVARCHAR(256);
    DECLARE @person_last_name NVARCHAR(256);
    DECLARE @person_last_name1 NVARCHAR(256);
    DECLARE @person_last_name2 NVARCHAR(256);
    DECLARE @person_suffix NVARCHAR(256);
    DECLARE @person_alias NVARCHAR(256);
    DECLARE @person_job_title NVARCHAR(256);
    DECLARE @person_gender_code CHAR(1);
    DECLARE @person_birth_date DATE;
    DECLARE @person_marital_status CHAR(1);
    DECLARE @open_to_work BIT;
    DECLARE @recruiting BIT;
    DECLARE @is_deceased BIT;
    SELECT @contact_type_id=[contact_type_id],
        @full_name=[full_name],
        @display_name=[display_name],
        @logical_key=[logical_key],
        @summary=[summary],
        @image_url=[image_url],
        @thumbnail_url=[thumbnail_url],
        @is_private=[is_private],
        @do_not_contact=[do_not_contact],
        @person_title=[person_title],
        @person_first_name=[person_first_name],
        @person_last_name=[person_last_name],
        @person_last_name1=[person_last_name1],
        @person_last_name2=[person_last_name2],
        @person_suffix=[person_suffix],
        @person_alias=[person_alias],
        @person_job_title=[person_job_title],
        @person_gender_code=[person_gender_code],
        @person_birth_date=[person_birth_date],
        @person_marital_status=[person_marital_status],
        @open_to_work=[open_to_work],
        @recruiting=[recruiting],
        @is_deceased=[is_deceased]
    FROM OPENJSON(@profile_data) WITH (
        [contact_type_id] INT '$.contact_type_id',
        [full_name] NVARCHAR(256) '$.full_name',
        [display_name] NVARCHAR(256) '$.display_name',
        [logical_key] NVARCHAR(256) '$.logical_key',
        [summary] NVARCHAR(MAX) '$.summary',
        [image_url] NVARCHAR(1024) '$.image_url',
        [thumbnail_url] NVARCHAR(1024) '$.thumbnail_url',
        [is_private] BIT '$.is_private',
        [do_not_contact] BIT '$.do_not_contact',
        [person_title] NVARCHAR(256) '$.person_title',
        [person_first_name] NVARCHAR(256) '$.person_first_name',
        [person_last_name] NVARCHAR(256) '$.person_last_name',
        [person_last_name1] NVARCHAR(256) '$.person_last_name1',
        [person_last_name2] NVARCHAR(256) '$.person_last_name2',
        [person_suffix] NVARCHAR(256) '$.person_suffix',
        [person_alias] NVARCHAR(256) '$.person_alias',
        [person_job_title] NVARCHAR(256) '$.person_job_title',
        [person_gender_code] CHAR(1) '$.person_gender_code',
        [person_birth_date] DATE '$.person_birth_date',
        [person_marital_status] CHAR(1) '$.person_marital_status',
        [open_to_work] BIT '$.open_to_work',
        [recruiting] BIT '$.recruiting',
        [is_deceased] BIT '$.is_deceased');
        SET @contact_id=NULL;
        IF @operation='create'
        BEGIN
            IF @expected_entity_version IS NULL OR @expected_entity_version<>0
            BEGIN
                THROW 51206, 'Creation requires absent-root expected version zero.', 1;
            END
            SET @contact_public_key=COALESCE(@contact_public_key,NEWID());
            IF EXISTS (SELECT 1 FROM [entities].[entity] WHERE [public_key]=@contact_public_key)
            BEGIN
                THROW 52006, 'Contact public key already exists.', 1;
            END
            EXEC [entities].[entity_insert]
                @entity_type_id=@contact_entity_type,@public_key=@contact_public_key,@tenant=@tenant,
                @logical_key=@logical_key,@display_name=@display_name,@created_by=@actor,
                @summary=@summary,@image_url=@image_url,@thumbnail_url=@thumbnail_url,@is_private=@is_private,
                @dbrow_version=@dbrow_version OUTPUT,@entity_id=@contact_id OUTPUT;
            INSERT [contacts].[contact] ([contact_id],
                [contact_type_id],
                [full_name],
                [do_not_contact],
                [person_job_title],
                [person_gender_code],
                [person_birth_date],
                [person_marital_status],
                [open_to_work],
                [recruiting],
                [is_deceased])
            VALUES (@contact_id,
                @contact_type_id,
                @full_name,
                @do_not_contact,
                @person_job_title,
                @person_gender_code,
                @person_birth_date,
                @person_marital_status,
                @open_to_work,
                @recruiting,
                @is_deceased);
            SET @entity_version=1;
        END
        ELSE
        BEGIN
            SET @contact_id=(SELECT [entity_id] FROM [entities].[entity]
                WHERE [public_key]=@contact_public_key AND [tenant_id]=@tenant_id);
            DECLARE @allow_deleted BIT=CASE WHEN @operation IN ('delete','restore') THEN 1 ELSE 0 END;
            EXEC [entities].[entity_write_lock]
                @entity_id=@contact_id,@tenant_id=@tenant_id,@expected_entity_version=@expected_entity_version,
                @dbrow_version=@dbrow_version OUTPUT,@entity_version=@entity_version OUTPUT,@allow_deleted=@allow_deleted;
            IF NOT EXISTS (SELECT 1 FROM [contacts].[contact] WHERE [contact_id]=@contact_id AND [contact_type_id] IN (1,2))
                OR EXISTS (SELECT 1 FROM [entities].[entity] WHERE [entity_id]=@contact_id AND [is_system]=1)
            BEGIN
                THROW 52004, 'Only ordinary person and organization contacts support these operations.', 1;
            END
            SET @deleted=(SELECT [deleted] FROM [entities].[entity] WHERE [entity_id]=@contact_id);
            IF @operation='update'
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM [contacts].[contact] WHERE [contact_id]=@contact_id AND [contact_type_id]=@contact_type_id)
                BEGIN
                    THROW 52004, 'Contact category conversion is not supported.', 1;
                END
                DECLARE @old NVARCHAR(MAX)=(SELECT c.[contact_type_id],
                    c.[full_name],
                    e.[display_name],
                    e.[logical_key],
                    e.[summary],
                    e.[image_url],
                    e.[thumbnail_url],
                    e.[is_private],
                    c.[do_not_contact],
                    n1.[name] AS [person_title],
                    n2.[name] AS [person_first_name],
                    n3.[name] AS [person_last_name],
                    n4.[name] AS [person_last_name1],
                    n5.[name] AS [person_last_name2],
                    n6.[name] AS [person_suffix],
                    n7.[name] AS [person_alias],
                    c.[person_job_title],
                    c.[person_gender_code],
                    c.[person_birth_date],
                    c.[person_marital_status],
                    c.[open_to_work],
                    c.[recruiting],
                    c.[is_deceased]
                    FROM [contacts].[contact] c JOIN [entities].[entity] e ON e.[entity_id]=c.[contact_id]
        LEFT JOIN [contacts].[contact_person_name] p1 ON p1.[contact_id]=c.[contact_id] AND p1.[person_name_type_id]=1
        LEFT JOIN [contacts].[person_name] n1 ON n1.[person_name_id]=p1.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p2 ON p2.[contact_id]=c.[contact_id] AND p2.[person_name_type_id]=2
        LEFT JOIN [contacts].[person_name] n2 ON n2.[person_name_id]=p2.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p3 ON p3.[contact_id]=c.[contact_id] AND p3.[person_name_type_id]=3
        LEFT JOIN [contacts].[person_name] n3 ON n3.[person_name_id]=p3.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p4 ON p4.[contact_id]=c.[contact_id] AND p4.[person_name_type_id]=4
        LEFT JOIN [contacts].[person_name] n4 ON n4.[person_name_id]=p4.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p5 ON p5.[contact_id]=c.[contact_id] AND p5.[person_name_type_id]=5
        LEFT JOIN [contacts].[person_name] n5 ON n5.[person_name_id]=p5.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p6 ON p6.[contact_id]=c.[contact_id] AND p6.[person_name_type_id]=6
        LEFT JOIN [contacts].[person_name] n6 ON n6.[person_name_id]=p6.[person_name_id]
        LEFT JOIN [contacts].[contact_person_name] p7 ON p7.[contact_id]=c.[contact_id] AND p7.[person_name_type_id]=7
        LEFT JOIN [contacts].[person_name] n7 ON n7.[person_name_id]=p7.[person_name_id]
                    WHERE c.[contact_id]=@contact_id FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER);
                IF CONVERT(VARBINARY(MAX),@old)=CONVERT(VARBINARY(MAX),@profile_data) AND DATALENGTH(@old)=DATALENGTH(@profile_data)
                BEGIN
                    IF @owns=1 COMMIT;
                    RETURN;
                END
            END
            ELSE IF (@operation='delete' AND @deleted IS NOT NULL) OR (@operation='restore' AND @deleted IS NULL)
            BEGIN
                IF @owns=1 COMMIT;
                RETURN;
            END
            IF @operation='delete' AND (EXISTS (SELECT 1 FROM [entities].[entity] WHERE [entity_id]=@contact_id AND [entity_type_id]<>@contact_entity_type)
                OR EXISTS (SELECT 1 FROM [security].[user] WHERE [user_id]=@contact_id)
                OR EXISTS (SELECT 1 FROM [contacts].[contact_relationship] WITH (HOLDLOCK) WHERE [from_contact_id]=@contact_id)
                OR EXISTS (SELECT 1 FROM [contacts].[contact_relationship] WITH (HOLDLOCK,
                    INDEX([ix_contact_relationship_target])) WHERE [to_contact_id]=@contact_id))
            BEGIN
                THROW 52007, 'Contact deletion requires explicit resolution of accounts and relationships.', 1;
            END
            EXEC [data].[dbrow_version_ensure]
                @tenant_id=@tenant_id,@actor_entity_id=@actor_id,@dboperation_type_id=2,
                @modified=@recorded_at,@dbrow_version=@dbrow_version OUTPUT,@recorded_at=@recorded_at OUTPUT;
            EXEC [entities].[entity_version_bump]
                @entity_id=@contact_id,@tenant_id=@tenant_id,@actor_entity_id=@actor_id,
                @dbrow_version=@dbrow_version,@recorded_at=@recorded_at,@entity_version=@entity_version OUTPUT;
            IF @operation='update'
            BEGIN
                UPDATE [entities].[entity] SET [logical_key]=@logical_key,
                    [display_name]=@display_name,
                    [summary]=@summary,
                    [image_url]=@image_url,
                    [thumbnail_url]=@thumbnail_url,
                    [is_private]=@is_private
                WHERE [entity_id]=@contact_id;
                UPDATE [contacts].[contact] SET [contact_type_id]=@contact_type_id,
                    [full_name]=@full_name,
                    [do_not_contact]=@do_not_contact,
                    [person_job_title]=@person_job_title,
                    [person_gender_code]=@person_gender_code,
                    [person_birth_date]=@person_birth_date,
                    [person_marital_status]=@person_marital_status,
                    [open_to_work]=@open_to_work,
                    [recruiting]=@recruiting,
                    [is_deceased]=@is_deceased
                WHERE [contact_id]=@contact_id;
            END
            ELSE IF @operation='delete'
            BEGIN
                UPDATE [entities].[entity] SET [deleted]=@recorded_at,[deleted_by]=@actor_id WHERE [entity_id]=@contact_id;
            END
            ELSE
            BEGIN
                UPDATE [entities].[entity] SET [deleted]=NULL,[deleted_by]=NULL WHERE [entity_id]=@contact_id;
            END
        END
        IF @operation IN ('create','update')
        BEGIN
            EXEC [contacts].[contact_names_replace]
                @contact_id=@contact_id,
                @person_title=@person_title,
                @person_first_name=@person_first_name,
                @person_last_name=@person_last_name,
                @person_last_name1=@person_last_name1,
                @person_last_name2=@person_last_name2,
                @person_suffix=@person_suffix,
                @person_alias=@person_alias;
        END
        DECLARE @snapshot_operation INT=CASE WHEN @operation='delete' THEN 3 WHEN @operation='restore' THEN 5 WHEN @operation='create' THEN 1 ELSE 2 END;
        EXEC [entities].[entity_history_snapshot]
            @entity_id=@contact_id,@tenant_id=@tenant_id,@dbrow_version=@dbrow_version,@operation=@snapshot_operation;
        EXEC [contacts].[contact_history_snapshot]
            @contact_id=@contact_id,@tenant_id=@tenant_id,@dbrow_version=@dbrow_version;
        DECLARE @action INT;
        EXEC [data].[audit_action_next]
            @tenant_id=@tenant_id,@dbrow_version=@dbrow_version,@action_ordinal=@action OUTPUT;
        INSERT [contacts].[contact_profile_action] ([tenant_id],[dbrow_version],[action_ordinal],[contact_id],[operation],[profile_data])
        SELECT @tenant_id,@dbrow_version,@action,@contact_id,@operation,[profile_data]
        FROM [contacts].[contact_profile_as_of](@contact_id,@dbrow_version);
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        SET @dbrow_version=NULL;
        SET @entity_version=NULL;
        SET @contact_id=NULL;
        THROW;
    END CATCH;
END;
