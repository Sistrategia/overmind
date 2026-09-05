-- Discover this transaction's allocation without trusting SESSION_CONTEXT or client numbers.
-- A recovered/reused engine transaction ID cannot revive a released per-version lock.
CREATE OR ALTER PROCEDURE [data].[audit_unit_assert]
    @dbrow_version BIGINT = NULL OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    IF XACT_STATE() <> 1 THROW 51001, 'An active, committable audit transaction is required.', 1;
    DECLARE @tx BIGINT = CURRENT_TRANSACTION_ID(), @actual BIGINT = NULL;
    DECLARE @resource NVARCHAR(255) = N'overmind:unit:' + CONVERT(NVARCHAR(20), @tx);
    IF COALESCE(APPLOCK_MODE(N'dbo', @resource, N'Transaction'), N'NoLock') <> N'Exclusive'
        THROW 51102, 'The ambient transaction is not enrolled. Call data.audit_unit_begin first.', 1;

    SELECT @actual = [dbrow_version]
    FROM [data].[dbrow_version]
    WHERE [allocation_transaction_id] = @tx
      AND APPLOCK_MODE(N'dbo', N'overmind:version:' + CONVERT(NVARCHAR(20), [dbrow_version]), N'Transaction') = N'Exclusive';
    IF @dbrow_version IS NOT NULL AND (@actual IS NULL OR @actual <> @dbrow_version)
        THROW 51103, 'The supplied audit version is not owned by this transaction and database.', 1;
    SET @dbrow_version = @actual;
END;
