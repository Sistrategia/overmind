-- Owns a short serializable read transaction: works without database SNAPSHOT configuration.
-- Reads the root first; writers retain that root's exclusive lock through outer commit.
-- No ambient transaction accepted (avoids mixing caller isolation/lifetimes).
-- Result sets: historical root/contact payload; emails at requested version; optional diff;
-- ordered email action evidence for the requested revision.
CREATE OR ALTER PROCEDURE [contacts].[contact_email_read]
    @contact_public_key UNIQUEIDENTIFIER, @actor UNIQUEIDENTIFIER,
    @entity_version INT, @tenant UNIQUEIDENTIFIER=NULL, @compare_entity_version INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT<>0 THROW 51400, 'Historical reader requires its own read transaction.', 1;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @actor_id INT,@tenant_id INT,@contact_id INT,@bound BIGINT,@compare BIGINT,@root_stamp BIGINT;
        EXEC [entities].[actor_resolve] @actor,@tenant,@actor_id OUTPUT,@tenant_id OUTPUT;
        SET @contact_id=(SELECT e.[entity_id] FROM [entities].[entity] e
            JOIN [contacts].[contact] c ON c.[contact_id]=e.[entity_id]
            WHERE e.[public_key]=@contact_public_key AND e.[tenant_id]=@tenant_id);
        IF @contact_id IS NULL THROW 51202, 'Target contact does not exist in this tenant.', 1;
        -- Lock the same clustered key as entity_write_lock, even if another index covers
        -- the identity lookup. Hold the shared barrier before reading any history.
        SET @root_stamp=(SELECT [dbrow_version] FROM [entities].[entity] WITH (HOLDLOCK,INDEX([px_entities_entity]))
            WHERE [entity_id]=@contact_id AND [tenant_id]=@tenant_id);
        IF @root_stamp IS NULL THROW 51202, 'Target contact does not exist in this tenant.', 1;
        SET @bound=(SELECT [dbrow_version] FROM [entities].[entity_version_history]
            WHERE [entity_id]=@contact_id AND [entity_version]=@entity_version AND [tenant_id]=@tenant_id);
        IF @bound IS NULL THROW 51401, 'Requested entity revision does not exist.', 1;
        IF @compare_entity_version IS NOT NULL
        BEGIN
            SET @compare=(SELECT [dbrow_version] FROM [entities].[entity_version_history]
                WHERE [entity_id]=@contact_id AND [entity_version]=@compare_entity_version AND [tenant_id]=@tenant_id);
            IF @compare IS NULL THROW 51401, 'Comparison revision does not exist.', 1;
        END;
        -- TOP(1)'s row goal can prefer a backwards global-clock scan even with a root index,
        -- taking ranges on unrelated roots. This locking reader requires root-leading seeks.
        IF NOT EXISTS (SELECT 1 FROM [entities].[entity_history] WITH (FORCESEEK,INDEX([ix_entity_history_root]))
            WHERE [entity_id]=@contact_id AND [dbrow_version]<=@bound)
            OR NOT EXISTS (SELECT 1 FROM [contacts].[contact_history] WITH (FORCESEEK,INDEX([ix_contact_history_root]))
                WHERE [contact_id]=@contact_id AND [dbrow_version]<=@bound)
            THROW 51402, 'Historical root payload is unavailable for this revision.', 1;
        SELECT @entity_version AS [entity_version],@bound AS [revision_dbrow_version],
            e.[display_name],e.[summary],e.[is_private],e.[deleted],c.[full_name],v.[recorded_at],v.[modified_by],e.[entity_type_id]
        FROM (SELECT TOP(1) * FROM [entities].[entity_history] WITH (FORCESEEK,INDEX([ix_entity_history_root]))
            WHERE [entity_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) e
        CROSS JOIN (SELECT TOP(1) * FROM [contacts].[contact_history] WITH (FORCESEEK,INDEX([ix_contact_history_root]))
            WHERE [contact_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) c
        JOIN [data].[dbrow_version] v ON v.[tenant_id]=@tenant_id AND v.[dbrow_version]=@bound;

        SELECT * FROM [contacts].[contact_emails_as_of](@contact_id,@bound) ORDER BY [display_order],[ordinal];
        -- Compare revision -> requested revision; compare NULL deliberately yields an empty diff.
        SELECT COALESCE(n.[ordinal],o.[ordinal]) AS [ordinal],
            CASE WHEN o.[ordinal] IS NULL THEN 'insert' WHEN n.[ordinal] IS NULL THEN 'delete'
                WHEN o.[email_id]=n.[email_id] AND o.[is_public]=n.[is_public]
                    AND (o.[location_id]=n.[location_id] OR (o.[location_id] IS NULL AND n.[location_id] IS NULL))
                THEN 'move' ELSE 'update' END AS [operation],
            o.[email_address] AS [old_email_address],n.[email_address] AS [email_address],
            o.[location_name] AS [old_location_name],n.[location_name] AS [location_name],
            o.[is_public] AS [old_is_public],n.[is_public] AS [is_public],
            o.[display_order] AS [old_display_order],n.[display_order] AS [display_order]
        FROM [contacts].[contact_emails_as_of](@contact_id,@compare) o
        FULL JOIN [contacts].[contact_emails_as_of](@contact_id,@bound) n ON n.[ordinal]=o.[ordinal]
        WHERE @compare IS NOT NULL AND (o.[ordinal] IS NULL OR n.[ordinal] IS NULL OR o.[email_id]<>n.[email_id]
            OR o.[is_public]<>n.[is_public] OR o.[location_id]<>n.[location_id]
            OR o.[display_order]<>n.[display_order]
            OR (o.[location_id] IS NULL AND n.[location_id] IS NOT NULL) OR (o.[location_id] IS NOT NULL AND n.[location_id] IS NULL))
        ORDER BY COALESCE(n.[ordinal],o.[ordinal]);

        SELECT a.[dbrow_version],a.[action_ordinal],a.[ordinal],a.[operation],e.[email_address],
            l.[location_name],a.[is_public],a.[show_in_timeline],a.[payload_version],v.[recorded_at],v.[modified_by],
            a.[previous_display_order],a.[display_order]
        FROM [contacts].[contact_email_action] a
        JOIN [contacts].[email] e ON e.[email_id]=a.[email_id]
        LEFT JOIN [contacts].[email_location] l ON l.[location_id]=a.[location_id]
        JOIN [data].[dbrow_version] v ON v.[tenant_id]=a.[tenant_id] AND v.[dbrow_version]=a.[dbrow_version]
        WHERE a.[tenant_id]=@tenant_id AND a.[contact_id]=@contact_id AND a.[dbrow_version]=@bound
        ORDER BY a.[dbrow_version],a.[action_ordinal];
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        THROW;
    END CATCH;
END;
