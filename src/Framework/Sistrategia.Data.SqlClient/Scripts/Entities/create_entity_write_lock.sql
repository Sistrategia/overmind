-- Locks and validates before child mutation/allocation. Internal: no application EXECUTE grant.
CREATE OR ALTER PROCEDURE [entities].[entity_write_lock]
    @entity_id INT, @tenant_id INT, @expected_entity_version INT,
    @dbrow_version BIGINT = NULL OUTPUT, @entity_version INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    DECLARE @stamp BIGINT=NULL, @deleted DATETIME2, @locked DATETIME2;
    SET @entity_version = NULL;
    SELECT @entity_version=[entity_version], @stamp=[dbrow_version], @deleted=[deleted], @locked=[locked]
    -- Match the historical reader's clustered-key barrier. An initial U lock would
    -- admit its S lock before child writes, then risk deadlock when the root bumps to X.
    FROM [entities].[entity] WITH (XLOCK,HOLDLOCK,INDEX([px_entities_entity]))
    WHERE [entity_id]=@entity_id AND [tenant_id]=@tenant_id;
    IF @entity_version IS NULL THROW 51202, 'Target entity does not exist in this tenant.', 1;
    IF @deleted IS NOT NULL OR @locked IS NOT NULL THROW 51203, 'Target entity is deleted or locked.', 1;
    IF @dbrow_version IS NOT NULL AND @stamp > @dbrow_version
        THROW 51204, 'A later unit has changed this root; roll back and retry the whole operation.', 1;
    DECLARE @entry INT = @entity_version;
    IF @stamp=@dbrow_version
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM [entities].[entity_version_history]
            WHERE [entity_id]=@entity_id AND [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version AND [entity_version]=@entity_version)
            THROW 51205, 'Root stamp has no matching audit spine.', 1;
        SET @entry = @entity_version - 1;
    END;
    IF @expected_entity_version IS NULL OR @expected_entity_version <> @entry
        THROW 51206, 'The expected entity version is stale or missing.', 1;
END;
