-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_profile_prepare.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Trusted adapters also validate Unicode. SQL validates shape/types before bounded assignment.
CREATE OR ALTER PROCEDURE [contacts].[contact_profile_prepare]
    @profile_data NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF @profile_data IS NULL OR DATALENGTH(@profile_data)>131072 OR ISJSON(@profile_data,OBJECT)<>1
    BEGIN
        THROW 52000, 'Supply a profile JSON object of at most 65536 UTF-16 units.', 1;
    END
    DECLARE @input TABLE ([key] NVARCHAR(4000) COLLATE Latin1_General_100_BIN2,[value] NVARCHAR(MAX),[type] INT);
    INSERT @input SELECT [key],[value],[type] FROM OPENJSON(@profile_data);
    IF EXISTS (SELECT 1 FROM @input WHERE [key] NOT IN (N'contact_type_id',
        N'full_name',
        N'display_name',
        N'logical_key',
        N'summary',
        N'image_url',
        N'thumbnail_url',
        N'is_private',
        N'do_not_contact',
        N'person_title',
        N'person_first_name',
        N'person_last_name',
        N'person_last_name1',
        N'person_last_name2',
        N'person_suffix',
        N'person_alias',
        N'person_job_title',
        N'person_gender_code',
        N'person_birth_date',
        N'person_marital_status',
        N'open_to_work',
        N'recruiting',
        N'is_deceased')
        OR DATALENGTH([key])<>DATALENGTH(RTRIM([key])))
        OR EXISTS (SELECT 1 FROM @input GROUP BY [key] HAVING COUNT(*)>1)
    BEGIN
        THROW 52000, 'Profile fields must be recognized and unique.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'contact_type_id' AND [type]<>0 AND ([type]<>2 OR [value] NOT IN (N'1',
        N'2') OR DATALENGTH([value])<>2))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: contact_type_id.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'full_name' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: full_name.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'display_name' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: display_name.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'logical_key' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: logical_key.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'summary' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>8192))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: summary.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'image_url' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>2048))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: image_url.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'thumbnail_url' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>2048))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: thumbnail_url.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'is_private' AND [type]<>0 AND ([type]<>3))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: is_private.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'do_not_contact' AND [type]<>0 AND ([type]<>3))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: do_not_contact.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_title' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_title.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_first_name' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_first_name.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_last_name' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_last_name.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_last_name1' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_last_name1.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_last_name2' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_last_name2.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_suffix' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_suffix.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_alias' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_alias.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_job_title' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])>512))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_job_title.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_gender_code' AND [type]<>0 AND ([type]<>1
        OR DATALENGTH([value])<>2
        OR UNICODE([value]) NOT BETWEEN 65 AND 90))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_gender_code.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_birth_date' AND [type]<>0 AND ([type]<>1 OR DATALENGTH([value])<>20 OR TRY_CONVERT(DATE,
        [value],
        23) IS NULL OR CONVERT(NVARCHAR(10),
        TRY_CONVERT(DATE,
        [value],
        23),
        23)<>[value]))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_birth_date.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'person_marital_status' AND [type]<>0 AND ([type]<>1
        OR DATALENGTH([value])<>2
        OR UNICODE([value]) NOT BETWEEN 65 AND 90))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: person_marital_status.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'open_to_work' AND [type]<>0 AND ([type]<>3))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: open_to_work.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'recruiting' AND [type]<>0 AND ([type]<>3))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: recruiting.', 1;
    END
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'is_deceased' AND [type]<>0 AND ([type]<>3))
    BEGIN
        THROW 52000, 'Invalid profile field type or width: is_deceased.', 1;
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
    IF @contact_type_id IS NULL OR @full_name IS NULL OR LEN(LTRIM(RTRIM(@full_name)))=0
    BEGIN
        THROW 52000, 'Person/organization category and a nonblank full name are required.', 1;
    END
    SET @display_name=COALESCE(@display_name,@full_name);
    IF LEN(LTRIM(RTRIM(@display_name)))=0
    BEGIN
        THROW 52000, 'Display name cannot be blank.', 1;
    END
    SET @is_private=COALESCE(@is_private,0);
    SET @do_not_contact=COALESCE(@do_not_contact,0);
    SET @open_to_work=COALESCE(@open_to_work,0);
    SET @recruiting=COALESCE(@recruiting,0);
    SET @is_deceased=COALESCE(@is_deceased,0);
    IF (@contact_type_id=2 AND (@person_title IS NOT NULL
        OR @person_first_name IS NOT NULL
        OR @person_last_name IS NOT NULL
        OR @person_last_name1 IS NOT NULL
        OR @person_last_name2 IS NOT NULL
        OR @person_suffix IS NOT NULL
        OR @person_alias IS NOT NULL
        OR @person_job_title IS NOT NULL
        OR @person_gender_code IS NOT NULL
        OR @person_birth_date IS NOT NULL
        OR @person_marital_status IS NOT NULL
        OR @open_to_work=1
        OR @is_deceased=1))
        OR (@contact_type_id=1 AND @recruiting=1)
    BEGIN
        THROW 52004, 'Person and organization profile fields must match the contact category.', 1;
    END
    SET @profile_data=(SELECT @contact_type_id AS [contact_type_id],
        @full_name AS [full_name],
        @display_name AS [display_name],
        @logical_key AS [logical_key],
        @summary AS [summary],
        @image_url AS [image_url],
        @thumbnail_url AS [thumbnail_url],
        @is_private AS [is_private],
        @do_not_contact AS [do_not_contact],
        @person_title AS [person_title],
        @person_first_name AS [person_first_name],
        @person_last_name AS [person_last_name],
        @person_last_name1 AS [person_last_name1],
        @person_last_name2 AS [person_last_name2],
        @person_suffix AS [person_suffix],
        @person_alias AS [person_alias],
        @person_job_title AS [person_job_title],
        @person_gender_code AS [person_gender_code],
        @person_birth_date AS [person_birth_date],
        @person_marital_status AS [person_marital_status],
        @open_to_work AS [open_to_work],
        @recruiting AS [recruiting],
        @is_deceased AS [is_deceased]
        FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER);
END;
