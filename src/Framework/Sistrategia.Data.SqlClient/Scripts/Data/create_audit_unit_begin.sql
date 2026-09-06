-- Explicit enrollment of an existing transaction. Never begins/commits a transaction.
-- dbo application-lock namespace is private to owner-executed modules.
CREATE OR ALTER PROCEDURE [data].[audit_unit_begin]
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_isolation_assert];
    IF XACT_STATE() <> 1
        THROW 51100, 'Audit unit enrollment requires a committable caller transaction.', 1;
    DECLARE @resource NVARCHAR(255) = N'overmind:unit:' + CONVERT(NVARCHAR(20), CURRENT_TRANSACTION_ID());
    IF APPLOCK_MODE(N'dbo', @resource, N'Transaction') = N'Exclusive' RETURN;
    DECLARE @result INT;
    EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive',
        @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=0;
    IF @result < 0 THROW 51101, 'Could not enroll the audit unit.', 1;
END;
