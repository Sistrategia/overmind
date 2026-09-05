-- Public ordinary-command boundary. Supplied actor comes from the authenticated service,
-- not an untrusted request body. Only this boundary and its wrappers receive EXECUTE grants.
CREATE OR ALTER PROCEDURE [contacts].[contact_email_change]
    @operation VARCHAR(10), @contact_public_key UNIQUEIDENTIFIER, @actor UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER=NULL, @expected_entity_version INT=NULL,
    @email_address NVARCHAR(MAX)=NULL, @location_name NVARCHAR(MAX)=NULL, @is_public BIT=0,
    @ordinal INT=NULL OUTPUT, @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT, @email_id INT=NULL OUTPUT, @supress_event_message BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @owns BIT=0, @tenant_id INT, @actor_id INT, @contact_id INT;
    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT=0 THROW 51008, 'Supplied versions require an enrolled caller transaction.', 1;
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION;
            SET @owns=1;
            EXEC [data].[audit_unit_begin];
        END;
        EXEC [entities].[actor_resolve] @actor,@tenant,@actor_id OUTPUT,@tenant_id OUTPUT;
        SET @contact_id=(SELECT [entity_id] FROM [entities].[entity] WHERE [public_key]=@contact_public_key AND [tenant_id]=@tenant_id);
        IF @contact_id IS NULL THROW 51202, 'Target contact does not exist in this tenant.', 1;
        IF @supress_event_message IS NULL THROW 51303, 'Timeline visibility must be explicit.', 1;
        DECLARE @show BIT=1-@supress_event_message;
        EXEC [contacts].[contact_email_write] @operation,@contact_id,@tenant_id,@actor_id,@expected_entity_version,
            @email_address,@location_name,@is_public,@ordinal OUTPUT,@dbrow_version OUTPUT,@entity_version OUTPUT,@email_id OUTPUT,@show;
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        SET @dbrow_version=NULL; SET @entity_version=NULL; SET @email_id=NULL; SET @ordinal=NULL;
        THROW;
    END CATCH;
END;
