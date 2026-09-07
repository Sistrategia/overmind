-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_web_link_write.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

-- Internal primitive shared by public web-link commands and new-contact construction.
-- Caller owns transaction/enrollment and actor authorization. No public EXECUTE grant.
-- Replacement semantics for update: NULL location clears it; is_public is explicit.
CREATE OR ALTER PROCEDURE [contacts].[contact_web_link_write]
    @operation VARCHAR(10),
    @contact_id INT,
    @tenant_id INT,
    @actor_entity_id INT,
    @expected_entity_version INT,
    @url NVARCHAR(MAX)=NULL,
    @location_name NVARCHAR(MAX)=NULL,
    @is_public BIT=0,
    @ordinal INT=NULL OUTPUT,
    @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT,
    @web_link_id INT=NULL OUTPUT,
    @show_in_timeline BIT=1,
    @display_order INT=NULL OUTPUT,
    @display_text NVARCHAR(MAX)=NULL,
    @link_type NVARCHAR(MAX)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @operation IS NULL OR @operation NOT IN ('insert','update','delete','restore','move')
    BEGIN
        THROW 51802, 'Unknown web link operation.', 1;
    END
    IF @is_public IS NULL OR @show_in_timeline IS NULL
    BEGIN
        THROW 51803, 'Visibility flags must be explicit.', 1;
    END
    EXEC [entities].[entity_write_lock]
        @entity_id = @contact_id,
        @tenant_id = @tenant_id,
        @expected_entity_version = @expected_entity_version,
        @dbrow_version = @dbrow_version OUTPUT,
        @entity_version = @entity_version OUTPUT;
    IF NOT EXISTS (SELECT 1 FROM [contacts].[contact] WHERE [contact_id]=@contact_id)
    BEGIN
        THROW 51804, 'The target entity is not a contact.', 1;
    END
    -- Assert unit attribution even for a no-op; never silently accept a wrong supplied context.
    IF @dbrow_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [data].[dbrow_version]
        WHERE [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version AND [modified_by]=@actor_entity_id)
    BEGIN
        THROW 51005, 'The audit unit has a different tenant or actor.', 1;
    END

    IF @link_type IS NOT NULL AND (DATALENGTH(@link_type) NOT BETWEEN 2 AND 100
        OR @link_type COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-z0-9_-]%')
    BEGIN
        THROW 51819, 'Link type must be 1 to 50 lowercase ASCII letters, digits, underscores or hyphens.', 1;
    END
    DECLARE @old_type NVARCHAR(50), @old_display_text NVARCHAR(256);
    IF DATALENGTH(@display_text)>512
    BEGIN
        THROW 51817, 'Web link display text exceeds 256 UTF-16 units.', 1;
    END
    DECLARE @old_web_link INT=NULL, @old_location INT=NULL, @old_public BIT, @born BIGINT=NULL,
        @old_order INT=NULL, @count INT;
    SELECT @count=COUNT(*) FROM [contacts].[contact_web_link] WHERE contact_id=@contact_id;
    IF @operation<>'move' AND @display_order IS NOT NULL
    BEGIN
        THROW 51810, 'Supply a position only to move a web link; insert and restore append.',1;
    END
    SET @web_link_id=NULL;
    IF @operation <> 'insert'
    BEGIN
        IF @ordinal IS NULL OR @ordinal <= 0
        BEGIN
            THROW 51805, 'A positive child ordinal is required.', 1;
        END
        SELECT @old_web_link=[web_link_id],@old_location=[location_id],@old_type=[link_type],@old_display_text=[display_text],@old_public=[is_public],@old_order=[display_order]
        FROM [contacts].[contact_web_link] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        SELECT @born=[created_version] FROM [contacts].[contact_web_link_identity]
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        IF @operation IN ('update','delete','move') AND @old_web_link IS NULL
        BEGIN
            THROW 51806, 'The requested web link association does not exist.', 1;
        END
        IF @operation='restore' AND (@born IS NULL OR @old_web_link IS NOT NULL)
        BEGIN
            THROW 51807, 'Restore requires an existing, currently absent child identity.', 1;
        END
    END
    ELSE IF @ordinal IS NOT NULL
    BEGIN
        THROW 51808, 'New web link ordinals are allocated, not supplied. Use restore for an existing identity.', 1;
    END

    DECLARE @location_id INT=NULL, @recorded_at DATETIME2=SYSUTCDATETIME();
    IF @operation IN ('delete','move')
    BEGIN
        SET @link_type=@old_type; SET @display_text=@old_display_text;
        SET @web_link_id=@old_web_link; SET @location_id=@old_location; SET @is_public=@old_public;
        IF @operation='move'
        BEGIN
            IF @display_order IS NULL OR @display_order<1 OR @display_order>@count
            BEGIN
                THROW 51810, 'Move requires a position within the live web link list.',1;
            END
            IF @display_order=@old_order
            BEGIN
                RETURN;
            END
        END;
    END
    ELSE
    BEGIN
        EXEC [contacts].[web_link_values_ensure]
            @url = @url,
            @location_name = @location_name,
            @web_link_id = @web_link_id OUTPUT,
            @location_id = @location_id OUTPUT;
        IF @operation='update' AND ((CONVERT(VARBINARY(MAX),@old_type)=CONVERT(VARBINARY(MAX),@link_type) AND DATALENGTH(@old_type)=DATALENGTH(@link_type)) OR (@old_type IS NULL AND @link_type IS NULL))
            AND (CONVERT(VARBINARY(MAX),@old_display_text)=CONVERT(VARBINARY(MAX),@display_text) AND DATALENGTH(@old_display_text)=DATALENGTH(@display_text)
                OR (@old_display_text IS NULL AND @display_text IS NULL)) AND @old_web_link=@web_link_id AND @old_public=@is_public
            AND (@old_location=@location_id OR (@old_location IS NULL AND @location_id IS NULL))
        BEGIN
            SET @display_order=@old_order;
            RETURN;
        END;
    END;

    -- Root is locked before the first allocation; late roots were validated above.
    EXEC [data].[dbrow_version_ensure]
        @tenant_id = @tenant_id,
        @actor_entity_id = @actor_entity_id,
        @dboperation_type_id = 2,
        @modified = @recorded_at,
        @dbrow_version = @dbrow_version OUTPUT,
        @recorded_at = @recorded_at OUTPUT;
    IF @operation='insert'
    BEGIN
        -- Retained identities are the high-water mark. Safe only under the owning root lock.
        SELECT @ordinal=COALESCE(MAX([ordinal]),0)+1 FROM [contacts].[contact_web_link_identity] WHERE [contact_id]=@contact_id;
        INSERT [contacts].[contact_web_link_identity] ([contact_id],[ordinal],[tenant_id],[created_version])
        VALUES (@contact_id,@ordinal,@tenant_id,@dbrow_version);
        SET @born=@dbrow_version;
    END;

    IF @operation IN ('insert','restore')
    BEGIN
        SET @display_order=@count+1;
        INSERT [contacts].[contact_web_link] ([contact_id],[tenant_id],[ordinal],[web_link_id],[location_id],[link_type],[display_text],[is_public],[dbrow_version],[display_order])
        VALUES (@contact_id,@tenant_id,@ordinal,@web_link_id,@location_id,@link_type,@display_text,@is_public,@dbrow_version,@display_order);
    END
    ELSE IF @operation='update'
    BEGIN
        SET @display_order=@old_order;
        UPDATE [contacts].[contact_web_link] SET [web_link_id]=@web_link_id,[location_id]=@location_id,[link_type]=@link_type,[display_text]=@display_text,[is_public]=@is_public,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
    END
    ELSE IF @operation='move'
    BEGIN
        UPDATE [contacts].[contact_web_link] SET [display_order]=CASE WHEN [ordinal]=@ordinal THEN @display_order
            WHEN @old_order<@display_order THEN [display_order]-1 ELSE [display_order]+1 END,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [display_order] BETWEEN
            CASE WHEN @old_order<@display_order THEN @old_order ELSE @display_order END AND
            CASE WHEN @old_order>@display_order THEN @old_order ELSE @display_order END;
    END
    ELSE
    BEGIN
        DELETE [contacts].[contact_web_link] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        UPDATE [contacts].[contact_web_link] SET [display_order]=[display_order]-1,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [display_order]>@old_order;
        SET @display_order=NULL;
    END;

    -- Was this logical child present at unit entry? Restoring across units is INSERT presence;
    -- restoring after a same-unit deletion of an existing row is UPDATE final state.
    IF @operation='delete'
    BEGIN
        DECLARE @prior_op INT=NULL;
        SELECT TOP (1) @prior_op=[dboperation_type_id] FROM [contacts].[contact_web_link_history]
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]<@dbrow_version
        ORDER BY [dbrow_version] DESC;
        DECLARE @present_at_entry BIT=CASE WHEN @prior_op IN (1,2) THEN 1 ELSE 0 END;
        IF @born<>@dbrow_version AND @prior_op IS NULL
        BEGIN
            -- A committed insert/delete has an identity and actions, but deliberately no row snapshot.
            DECLARE @creation_final_action VARCHAR(10)=NULL;
            SELECT TOP(1) @creation_final_action=[operation] FROM [contacts].[contact_web_link_action]
            WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@born ORDER BY [action_ordinal] DESC;
            IF @creation_final_action IS NULL OR @creation_final_action<>'delete'
            BEGIN
                THROW 51809, 'Web link identity has incomplete prior history.', 1;
            END
        END;
        IF @present_at_entry=0
        BEGIN
            DELETE [contacts].[contact_web_link_history] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@dbrow_version;
        END
        ELSE
        BEGIN
            UPDATE [contacts].[contact_web_link_history] SET [dboperation_type_id]=3,
                [web_link_id]=@web_link_id,[location_id]=@location_id,[link_type]=@link_type,[display_text]=@display_text,[is_public]=@is_public,[display_order]=@old_order
            WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@dbrow_version AND [tenant_id]=@tenant_id;
            IF @@ROWCOUNT=0
            BEGIN
                INSERT [contacts].[contact_web_link_history] ([dbrow_version],[tenant_id],[dboperation_type_id],[contact_id],[ordinal],[web_link_id],[location_id],[link_type],[display_text],[is_public],[display_order])
                VALUES (@dbrow_version,@tenant_id,3,@contact_id,@ordinal,@web_link_id,@location_id,@link_type,@display_text,@is_public,@old_order);
            END
        END;
    END;

    IF EXISTS (SELECT 1 FROM [contacts].[contact_web_link] WHERE [contact_id]=@contact_id
        HAVING COUNT(*)<>COUNT(DISTINCT [display_order]) OR COUNT(*)<>COALESCE(MAX([display_order]),0))
    BEGIN
        THROW 51811, 'Web link order is not a dense unique list.',1;
    END
    EXEC [contacts].[contact_web_link_history_sync]
        @contact_id = @contact_id,
        @tenant_id = @tenant_id,
        @dbrow_version = @dbrow_version;

    EXEC [entities].[entity_version_bump]
        @entity_id = @contact_id,
        @tenant_id = @tenant_id,
        @actor_entity_id = @actor_entity_id,
        @dbrow_version = @dbrow_version,
        @recorded_at = @recorded_at,
        @entity_version = @entity_version OUTPUT;
    DECLARE @action INT;
    EXEC [data].[audit_action_next]
        @tenant_id = @tenant_id,
        @dbrow_version = @dbrow_version,
        @action_ordinal = @action OUTPUT;
    INSERT [contacts].[contact_web_link_action] ([tenant_id],[dbrow_version],[action_ordinal],[contact_id],[ordinal],
        [operation],[web_link_id],[location_id],[link_type],[display_text],[is_public],[show_in_timeline],[previous_display_order],[display_order])
    VALUES (@tenant_id,@dbrow_version,@action,@contact_id,@ordinal,@operation,@web_link_id,@location_id,@link_type,@display_text,@is_public,@show_in_timeline,@old_order,@display_order);
END;
