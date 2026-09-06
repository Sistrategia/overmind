-- Internal primitive shared by public email commands and new-contact construction.
-- Caller owns transaction/enrollment and actor authorization. No public EXECUTE grant.
-- Replacement semantics for update: NULL location clears it; is_public is explicit.
CREATE OR ALTER PROCEDURE [contacts].[contact_email_write]
    @operation VARCHAR(10), @contact_id INT, @tenant_id INT, @actor_entity_id INT,
    @expected_entity_version INT, @email_address NVARCHAR(MAX)=NULL, @location_name NVARCHAR(MAX)=NULL,
    @is_public BIT=0, @ordinal INT=NULL OUTPUT, @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT, @email_id INT=NULL OUTPUT, @show_in_timeline BIT=1,
    @display_order INT=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @operation IS NULL OR @operation NOT IN ('insert','update','delete','restore','move')
        THROW 51302, 'Unknown email operation.', 1;
    IF @is_public IS NULL OR @show_in_timeline IS NULL THROW 51303, 'Visibility flags must be explicit.', 1;
    EXEC [entities].[entity_write_lock] @contact_id,@tenant_id,@expected_entity_version,@dbrow_version OUTPUT,@entity_version OUTPUT;
    IF NOT EXISTS (SELECT 1 FROM [contacts].[contact] WHERE [contact_id]=@contact_id)
        THROW 51304, 'The target entity is not a contact.', 1;
    -- Assert unit attribution even for a no-op; never silently accept a wrong supplied context.
    IF @dbrow_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [data].[dbrow_version]
        WHERE [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version AND [modified_by]=@actor_entity_id)
        THROW 51005, 'The audit unit has a different tenant or actor.', 1;

    DECLARE @old_email INT=NULL, @old_location INT=NULL, @old_public BIT, @born BIGINT=NULL,
        @old_order INT=NULL, @count INT;
    SELECT @count=COUNT(*) FROM [contacts].[contact_email] WHERE contact_id=@contact_id;
    IF @operation<>'move' AND @display_order IS NOT NULL
        THROW 51310, 'Supply a position only to move an email; insert and restore append.',1;
    SET @email_id=NULL;
    IF @operation <> 'insert'
    BEGIN
        IF @ordinal IS NULL OR @ordinal <= 0 THROW 51305, 'A positive child ordinal is required.', 1;
        SELECT @old_email=[email_id],@old_location=[location_id],@old_public=[is_public],@old_order=[display_order]
        FROM [contacts].[contact_email] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        SELECT @born=[created_version] FROM [contacts].[contact_email_identity]
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        IF @operation IN ('update','delete','move') AND @old_email IS NULL
            THROW 51306, 'The requested email association does not exist.', 1;
        IF @operation='restore' AND (@born IS NULL OR @old_email IS NOT NULL)
            THROW 51307, 'Restore requires an existing, currently absent child identity.', 1;
    END
    ELSE IF @ordinal IS NOT NULL THROW 51308, 'New email ordinals are allocated, not supplied. Use restore for an existing identity.', 1;

    DECLARE @location_id INT=NULL, @recorded_at DATETIME2=SYSUTCDATETIME();
    IF @operation IN ('delete','move')
    BEGIN
        SET @email_id=@old_email; SET @location_id=@old_location; SET @is_public=@old_public;
        IF @operation='move'
        BEGIN
            IF @display_order IS NULL OR @display_order<1 OR @display_order>@count
                THROW 51310, 'Move requires a position within the live email list.',1;
            IF @display_order=@old_order RETURN;
        END;
    END
    ELSE
    BEGIN
        EXEC [contacts].[email_values_ensure] @email_address,@location_name,@email_id OUTPUT,@location_id OUTPUT;
        IF @operation='update' AND @old_email=@email_id AND @old_public=@is_public
            AND (@old_location=@location_id OR (@old_location IS NULL AND @location_id IS NULL))
        BEGIN SET @display_order=@old_order; RETURN; END;
    END;

    -- Root is locked before the first allocation; late roots were validated above.
    EXEC [data].[dbrow_version_ensure] @tenant_id,@actor_entity_id,2,@recorded_at,@dbrow_version OUTPUT,@recorded_at OUTPUT;
    IF @operation='insert'
    BEGIN
        -- Retained identities are the high-water mark. Safe only under the owning root lock.
        SELECT @ordinal=COALESCE(MAX([ordinal]),0)+1 FROM [contacts].[contact_email_identity] WHERE [contact_id]=@contact_id;
        INSERT [contacts].[contact_email_identity] ([contact_id],[ordinal],[tenant_id],[created_version])
        VALUES (@contact_id,@ordinal,@tenant_id,@dbrow_version);
        SET @born=@dbrow_version;
    END;

    IF @operation IN ('insert','restore')
    BEGIN
        SET @display_order=@count+1;
        INSERT [contacts].[contact_email] ([contact_id],[tenant_id],[ordinal],[email_id],[location_id],[is_public],[dbrow_version],[display_order])
        VALUES (@contact_id,@tenant_id,@ordinal,@email_id,@location_id,@is_public,@dbrow_version,@display_order);
    END
    ELSE IF @operation='update'
    BEGIN
        SET @display_order=@old_order;
        UPDATE [contacts].[contact_email] SET [email_id]=@email_id,[location_id]=@location_id,[is_public]=@is_public,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
    END
    ELSE IF @operation='move'
        UPDATE [contacts].[contact_email] SET [display_order]=CASE WHEN [ordinal]=@ordinal THEN @display_order
            WHEN @old_order<@display_order THEN [display_order]-1 ELSE [display_order]+1 END,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [display_order] BETWEEN
            CASE WHEN @old_order<@display_order THEN @old_order ELSE @display_order END AND
            CASE WHEN @old_order>@display_order THEN @old_order ELSE @display_order END;
    ELSE
    BEGIN
        DELETE [contacts].[contact_email] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal;
        UPDATE [contacts].[contact_email] SET [display_order]=[display_order]-1,[dbrow_version]=@dbrow_version
        WHERE [contact_id]=@contact_id AND [display_order]>@old_order;
        SET @display_order=NULL;
    END;

    -- Was this logical child present at unit entry? Restoring across units is INSERT presence;
    -- restoring after a same-unit deletion of an existing row is UPDATE final state.
    IF @operation='delete'
    BEGIN
        DECLARE @prior_op INT=NULL;
        SELECT TOP (1) @prior_op=[dboperation_type_id] FROM [contacts].[contact_email_history]
        WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]<@dbrow_version
        ORDER BY [dbrow_version] DESC;
        DECLARE @present_at_entry BIT=CASE WHEN @prior_op IN (1,2) THEN 1 ELSE 0 END;
        IF @born<>@dbrow_version AND @prior_op IS NULL
        BEGIN
            -- A committed insert/delete has an identity and actions, but deliberately no row snapshot.
            DECLARE @creation_final_action VARCHAR(10)=NULL;
            SELECT TOP(1) @creation_final_action=[operation] FROM [contacts].[contact_email_action]
            WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@born ORDER BY [action_ordinal] DESC;
            IF @creation_final_action IS NULL OR @creation_final_action<>'delete'
                THROW 51309, 'Email identity has incomplete prior history.', 1;
        END;
        IF @present_at_entry=0
            DELETE [contacts].[contact_email_history] WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@dbrow_version;
        ELSE
        BEGIN
            UPDATE [contacts].[contact_email_history] SET [dboperation_type_id]=3,
                [email_id]=@email_id,[location_id]=@location_id,[is_public]=@is_public,[display_order]=@old_order
            WHERE [contact_id]=@contact_id AND [ordinal]=@ordinal AND [dbrow_version]=@dbrow_version AND [tenant_id]=@tenant_id;
            IF @@ROWCOUNT=0
                INSERT [contacts].[contact_email_history] ([dbrow_version],[tenant_id],[dboperation_type_id],[contact_id],[ordinal],[email_id],[location_id],[is_public],[display_order])
                VALUES (@dbrow_version,@tenant_id,3,@contact_id,@ordinal,@email_id,@location_id,@is_public,@old_order);
        END;
    END;

    IF EXISTS (SELECT 1 FROM [contacts].[contact_email] WHERE [contact_id]=@contact_id
        HAVING COUNT(*)<>COUNT(DISTINCT [display_order]) OR COUNT(*)<>COALESCE(MAX([display_order]),0))
        THROW 51311, 'Email order is not a dense unique list.',1;
    EXEC [contacts].[contact_email_history_sync] @contact_id,@tenant_id,@dbrow_version;

    EXEC [entities].[entity_version_bump] @contact_id,@tenant_id,@actor_entity_id,@dbrow_version,@recorded_at,@entity_version OUTPUT;
    DECLARE @action INT;
    EXEC [data].[audit_action_next] @tenant_id,@dbrow_version,@action OUTPUT;
    INSERT [contacts].[contact_email_action] ([tenant_id],[dbrow_version],[action_ordinal],[contact_id],[ordinal],
        [operation],[email_id],[location_id],[is_public],[show_in_timeline],[previous_display_order],[display_order])
    VALUES (@tenant_id,@dbrow_version,@action,@contact_id,@ordinal,@operation,@email_id,@location_id,@is_public,@show_in_timeline,@old_order,@display_order);
END;
