-- Shared allocation/reuse boundary. ADR 0005 upgrades the original ADR 0001 ownership contract.
-- NULL INOUT joins this enrolled unit or allocates; non-NULL asserts active ownership.
-- The caller owns the active transaction and must roll it back on failure.
-- See ADR 0005 for native SQL enrollment, private guards and API transition.
CREATE OR ALTER PROCEDURE [data].[dbrow_version_ensure] (
     @tenant_id             INT
    ,@actor_entity_id       INT
    ,@dboperation_type_id   INT
    ,@modified              DATETIME2
    ,@dbrow_version         BIGINT = NULL OUTPUT
    ,@recorded_at           DATETIME2 = NULL OUTPUT
)
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    IF XACT_STATE() <> 1
        THROW 51001, 'dbrow_version_ensure requires an active, committable caller transaction.', 1;

    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;

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
        SELECT @recorded_at = [recorded_at] FROM [data].[dbrow_version]
        WHERE [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version;
        RETURN;
    END;

    IF @modified IS NULL
        THROW 51006, 'An audit timestamp is required for a new audit transaction.', 1;

    IF @dboperation_type_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM [data].[dboperation_type] WHERE [dboperation_type_id] = @dboperation_type_id
    )
        THROW 51007, 'An existing operation type is required for a new audit transaction.', 1;

    DECLARE @allocated_version BIGINT = NEXT VALUE FOR [data].[dbrow_version_seq];
    DECLARE @resource NVARCHAR(255) = N'overmind:version:' + CONVERT(NVARCHAR(20), @allocated_version), @result INT;
    EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive',
        @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=0;
    IF @result < 0 THROW 51104, 'Could not guard the new audit allocation.', 1;
    SET @recorded_at = SYSUTCDATETIME();
    INSERT INTO [data].[dbrow_version]
        ([tenant_id], [dbrow_version], [dboperation_type_id], [modified], [modified_by], [recorded_at], [allocation_transaction_id])
    VALUES (@tenant_id, @allocated_version, @dboperation_type_id, @modified, @actor_entity_id, @recorded_at, CURRENT_TRANSACTION_ID());

    SET @dbrow_version = @allocated_version;
END;
