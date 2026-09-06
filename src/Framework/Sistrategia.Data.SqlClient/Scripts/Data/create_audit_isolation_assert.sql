-- The native writer profile uses statement-consistent READ COMMITTED, with or without RCSI.
-- Rechecked on every ownership assertion, so changing isolation after enrollment is rejected.
CREATE OR ALTER PROCEDURE [data].[audit_isolation_assert]
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    IF COALESCE((SELECT [transaction_isolation_level] FROM sys.dm_exec_sessions WHERE [session_id]=@@SPID),0)<>2
        THROW 51106, 'Audit writes require READ COMMITTED isolation (RCSI may be enabled).', 1;
END;
