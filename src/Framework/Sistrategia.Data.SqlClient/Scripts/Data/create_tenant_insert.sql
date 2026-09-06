-- Trusted administrative constructor. The caller resolves/authorizes the actor in its own layer.
-- Kept separate from ordinary email commands; no application EXECUTE grant.
CREATE OR ALTER PROCEDURE [data].[tenant_insert]
    @name NVARCHAR(256), @public_key UNIQUEIDENTIFIER=NULL,
    @created DATETIME2=NULL, @actor_entity_id INT,
    @tenant_id INT=NULL OUTPUT, @dbrow_version BIGINT=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @owns BIT=0;
    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT=0 THROW 51008, 'A supplied version requires an enrolled transaction.',1;
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION; SET @owns=1;
            EXEC [data].[audit_unit_begin];
        END;
        EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
        IF @dbrow_version IS NOT NULL THROW 51503, 'Tenant creation requires a separate audit unit.',1;
        IF @public_key IS NULL SET @public_key=NEWID();
        IF @created IS NULL SET @created=SYSUTCDATETIME();
        INSERT [data].[tenant] ([public_key],[name]) VALUES (@public_key,@name);
        SET @tenant_id=CONVERT(INT,SCOPE_IDENTITY());
        EXEC [data].[dbrow_version_ensure] @tenant_id,@actor_entity_id,1,@created,@dbrow_version OUTPUT;
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        SET @tenant_id=NULL; SET @dbrow_version=NULL;
        THROW;
    END CATCH;
END;
