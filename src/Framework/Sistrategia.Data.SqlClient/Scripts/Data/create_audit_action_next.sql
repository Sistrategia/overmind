CREATE OR ALTER PROCEDURE [data].[audit_action_next]
    @tenant_id INT, @dbrow_version BIGINT, @action_ordinal INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    SET @action_ordinal=NULL;
    UPDATE [data].[dbrow_version] SET @action_ordinal=[last_action_ordinal]=[last_action_ordinal]+1
    WHERE [tenant_id]=@tenant_id AND [dbrow_version]=@dbrow_version;
    IF @action_ordinal IS NULL THROW 51105, 'Action does not belong to this audit unit.', 1;
END;
