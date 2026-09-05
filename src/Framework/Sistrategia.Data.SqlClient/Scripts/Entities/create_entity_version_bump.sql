CREATE OR ALTER PROCEDURE [entities].[entity_version_bump]
    @entity_id INT, @tenant_id INT, @actor_entity_id INT,
    @dbrow_version BIGINT, @recorded_at DATETIME2, @entity_version INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    DECLARE @stamp BIGINT;
    SELECT @stamp=[dbrow_version], @entity_version=[entity_version]
    FROM [entities].[entity] WITH (UPDLOCK,HOLDLOCK) WHERE [entity_id]=@entity_id AND [tenant_id]=@tenant_id;
    IF @stamp IS NULL OR @stamp > @dbrow_version THROW 51204, 'Invalid aggregate ordering; retry the whole unit.', 1;
    IF @stamp=@dbrow_version RETURN;
    UPDATE [entities].[entity] SET [dbrow_version]=@dbrow_version, [entity_version]=[entity_version]+1,
        [modified]=@recorded_at, [modified_by]=@actor_entity_id
    WHERE [entity_id]=@entity_id AND [tenant_id]=@tenant_id AND [dbrow_version]<@dbrow_version;
    IF @@ROWCOUNT <> 1 THROW 51204, 'Aggregate ordering changed; retry the whole unit.', 1;
    SELECT @entity_version=[entity_version] FROM [entities].[entity] WHERE [entity_id]=@entity_id;
    INSERT [entities].[entity_version_history] ([tenant_id],[dbrow_version],[entity_id],[entity_version])
    VALUES (@tenant_id,@dbrow_version,@entity_id,@entity_version);
END;
