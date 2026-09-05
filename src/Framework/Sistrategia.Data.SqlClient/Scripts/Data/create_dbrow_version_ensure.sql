-- Shared allocation/reuse boundary. See docs/adr/0001-dbrow-version-allocation-helper.md.
-- NULL INOUT allocates; non-NULL validates tenant/actor and preserves ledger metadata.
-- The caller owns the active transaction and must roll it back on failure.
-- Ledger existence does NOT prove that a supplied version belongs to this transaction.
CREATE OR ALTER PROCEDURE [data].[dbrow_version_ensure] (
     @tenant_id             INT
    ,@actor_entity_id       INT
    ,@dboperation_type_id   INT
    ,@modified              DATETIME2
    ,@dbrow_version         BIGINT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF XACT_STATE() <> 1
        THROW 51001, 'dbrow_version_ensure requires an active, committable caller transaction.', 1;

    IF @tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM [data].[tenant] WHERE [tenant_id] = @tenant_id)
        THROW 51002, 'An existing tenant is required for an audit transaction.', 1;

    -- Actor resolution belongs to the entity/security layers; no reverse layer dependency here.
    IF @actor_entity_id IS NULL
        THROW 51003, 'An actor entity ID is required for an audit transaction.', 1;

    IF @dbrow_version IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM [data].[dbrow_version]
            WHERE [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version
        )
            THROW 51004, 'The supplied audit version does not exist for this tenant.', 1;

        IF NOT EXISTS (
            SELECT 1 FROM [data].[dbrow_version]
            WHERE [tenant_id] = @tenant_id AND [dbrow_version] = @dbrow_version
              AND [modified_by] = @actor_entity_id
        )
            THROW 51005, 'The supplied audit version belongs to a different actor.', 1;

        -- Nested row operations must not overwrite the enclosing business operation/time.
        RETURN;
    END;

    IF @modified IS NULL
        THROW 51006, 'An audit timestamp is required for a new audit transaction.', 1;

    IF @dboperation_type_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM [data].[dboperation_type] WHERE [dboperation_type_id] = @dboperation_type_id
    )
        THROW 51007, 'An existing operation type is required for a new audit transaction.', 1;

    DECLARE @allocated_version BIGINT = NEXT VALUE FOR [data].[dbrow_version_seq];
    INSERT INTO [data].[dbrow_version]
        ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by])
    VALUES (@tenant_id, @allocated_version, @dboperation_type_id, @modified, @actor_entity_id);

    SET @dbrow_version = @allocated_version;
END;
