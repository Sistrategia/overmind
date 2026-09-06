-- Private final root payload snapshot. Caller already owns the root's write lock and bump.
-- Repeated writes may replace only this active unit's snapshot, never committed history.
CREATE OR ALTER PROCEDURE [entities].[entity_history_snapshot]
    @entity_id INT, @tenant_id INT, @dbrow_version BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    DECLARE @revision INT;
    SELECT @revision=e.entity_version FROM [entities].[entity] e
    JOIN [entities].[entity_version_history] h ON h.entity_id=e.entity_id AND h.tenant_id=e.tenant_id
        AND h.entity_version=e.entity_version AND h.dbrow_version=e.dbrow_version
    WHERE e.entity_id=@entity_id AND e.tenant_id=@tenant_id AND e.dbrow_version=@dbrow_version;
    IF @revision IS NULL THROW 51205,'Root snapshot requires this unit''s stamped root and audit spine.',1;
    DECLARE @operation INT=CASE WHEN @revision=1 THEN 1 ELSE 2 END;
    UPDATE h SET entity_type_id=e.entity_type_id,dboperation_type_id=@operation,
        logical_key=e.logical_key,display_name=e.display_name,deleted=e.deleted,deleted_by=e.deleted_by,
        locked=e.locked,locked_by=e.locked_by,validated=e.validated,validated_by=e.validated_by,
        summary=e.summary,image_url=e.image_url,thumbnail_url=e.thumbnail_url,is_private=e.is_private
    FROM [entities].[entity_history] h JOIN [entities].[entity] e ON e.entity_id=h.entity_id AND e.tenant_id=h.tenant_id
    WHERE h.entity_id=@entity_id AND h.tenant_id=@tenant_id AND h.dbrow_version=@dbrow_version;
    IF @@ROWCOUNT=0
        INSERT [entities].[entity_history] (dbrow_version,tenant_id,entity_id,entity_type_id,dboperation_type_id,
            logical_key,display_name,deleted,deleted_by,locked,locked_by,validated,validated_by,
            summary,image_url,thumbnail_url,is_private)
        SELECT @dbrow_version,@tenant_id,entity_id,entity_type_id,@operation,
            logical_key,display_name,deleted,deleted_by,locked,locked_by,validated,validated_by,
            summary,image_url,thumbnail_url,is_private
        FROM [entities].[entity] WHERE entity_id=@entity_id AND tenant_id=@tenant_id;
END;
