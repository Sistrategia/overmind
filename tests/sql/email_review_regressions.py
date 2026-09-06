"""Bounded regression schedules for review findings, run only inside the main disposable runner."""


def run(sql, concurrent, signal, wait_signal, actor):
    roots = ["E0000000-0000-0000-0000-000000000021", "E0000000-0000-0000-0000-000000000022"]
    for root in roots:
        sql(f"EXEC contacts.contact_insert @public_key='{root}',@created_by='{actor}',@full_name=N'Gap regression';")
    sql("INSERT contacts.email (email_address) VALUES (N'review-gap-m@example.test'); INSERT contacts.email_location (location_name) VALUES (N'review-gap-m');")
    # Different new email AND location values in the same gaps must commit independently.
    # The actual non-owner runtime role exercises the private namespace execution context.
    concurrent(f"""
SET NOCOUNT ON; EXECUTE AS USER='email_app'; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.contact_email_insert @contact_public_key='{roots[0]}',@created_by='{actor}',@expected_entity_version=1,
    @email_address=N'review-gap-a@example.test',@location_name=N'review-gap-a';
{signal('review_gap_ready')}
{wait_signal('review_gap_other_done')}
COMMIT; REVERT;
{signal('review_gap_finished')}
WAITFOR DELAY '00:00:00.200';
""", f"""
SET NOCOUNT ON; SET LOCK_TIMEOUT 2000;
{wait_signal('review_gap_ready')}
EXECUTE AS USER='email_app';
EXEC contacts.contact_email_insert @contact_public_key='{roots[1]}',@created_by='{actor}',@expected_entity_version=1,
    @email_address=N'review-gap-b@example.test',@location_name=N'review-gap-b';
REVERT;
{signal('review_gap_other_done')}
{wait_signal('review_gap_finished')}
""")
    print("PASS review: distinct email/location misses in the same gaps commit independently under the runtime role", flush=True)

    # Observe locks just before the REAL reader commits, without rewriting its queries.
    # Instrumentation is confined to this disposable DB and the exact definition is restored.
    lock_check = """
DECLARE @keys INT=(SELECT COUNT(*) FROM sys.dm_tran_locks l JOIN sys.partitions p ON p.hobt_id=l.resource_associated_entity_id
    WHERE l.request_session_id=@@SPID AND l.resource_type='KEY' AND p.object_id IN (OBJECT_ID('entities.entity_history'),OBJECT_ID('contacts.contact_history')));
-- Allow lookup/range-boundary keys; do not encode one exact plan/lock count as a requirement.
IF @keys>16
BEGIN
    SELECT OBJECT_NAME(p.object_id) AS history_table,i.name AS index_name,l.request_mode,COUNT(*) AS lock_count
    FROM sys.dm_tran_locks l JOIN sys.partitions p ON p.hobt_id=l.resource_associated_entity_id
    JOIN sys.indexes i ON i.object_id=p.object_id AND i.index_id=p.index_id
    WHERE l.request_session_id=@@SPID AND l.resource_type='KEY'
        AND p.object_id IN (OBJECT_ID('entities.entity_history'),OBJECT_ID('contacts.contact_history'))
    GROUP BY p.object_id,i.name,l.request_mode;
    THROW 52000,'Root payload reads locked history proportional to unrelated roots.',1;
END;
IF EXISTS (SELECT 1 FROM sys.dm_tran_locks WHERE request_session_id=@@SPID AND resource_type='OBJECT'
    AND resource_associated_entity_id IN (OBJECT_ID('entities.entity_history'),OBJECT_ID('contacts.contact_history')) AND request_mode IN ('S','SIX','X'))
    THROW 52000,'Root payload reads took a blocking whole-table lock.',1;
        COMMIT;
"""
    lock_check_literal = lock_check.replace("'", "''")
    sql(f"""
SET NOCOUNT ON;
DECLARE @i INT=0,@key UNIQUEIDENTIFIER,@target UNIQUEIDENTIFIER;
WHILE @i<200
BEGIN
    SET @key=NEWID();
    EXEC contacts.contact_insert @public_key=@key,@created_by='{actor}',@full_name=N'Footprint regression',@email_address=N'footprint-regression@example.test';
    IF @i=0 SET @target=@key;
    SET @i+=1;
END;
EXEC contacts.email_update @contact_public_key=@target,@modified_by='{actor}',@expected_entity_version=1,@ordinal=1,@email_address=N'footprint-updated@example.test';
DECLARE @definition NVARCHAR(MAX)=OBJECT_DEFINITION(OBJECT_ID('contacts.contact_email_read'));
-- SQL Server can store CREATE followed by padding in place of OR ALTER.
-- Preserve the body/comments, changing only the declaration verb for instrumentation/restoration.
DECLARE @create INT=CHARINDEX(N'CREATE',@definition),@proc INT=CHARINDEX(N'PROCEDURE [contacts].[contact_email_read]',@definition);
IF @proc=0 THROW 52000,'Reader declaration not found.',1;
IF @create>0 AND @create<@proc SET @definition=STUFF(@definition,@create,@proc-@create,N'ALTER ');
DECLARE @instrumented NVARCHAR(MAX)=REPLACE(@definition,N'        COMMIT;',N'{lock_check_literal}');
IF @instrumented=@definition THROW 52000,'Reader lock observation point not found.',1;
EXEC (@instrumented);
BEGIN TRY
    EXEC contacts.contact_email_read @contact_public_key=@target,@actor='{actor}',@entity_version=2;
END TRY
BEGIN CATCH
    EXEC (@definition);
    THROW;
END CATCH;
EXEC (@definition);
""")
    print("PASS review: historical root payload reads keep a bounded lock footprint amid 200 unrelated roots", flush=True)

    # Enrollment must not accept a SNAPSHOT caller, either before or after enrollment.
    sql("ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;")
    sql("EXEC dbo.expect_email_error N'SET TRANSACTION ISOLATION LEVEL SNAPSHOT; BEGIN TRAN; EXEC data.audit_unit_begin;',51106;")
    # Depending on when the engine establishes its snapshot, either our profile check (51106)
    # or SQL Server's own non-SNAPSHOT-to-SNAPSHOT switch rejection (3951) occurs first.
    sql("""
BEGIN TRY
    EXEC sys.sp_executesql N'BEGIN TRAN; EXEC data.audit_unit_begin; SET TRANSACTION ISOLATION LEVEL SNAPSHOT; DECLARE @v BIGINT; EXEC data.audit_unit_assert @v OUTPUT;';
    THROW 52000,'Post-enrollment SNAPSHOT switch was accepted.',1;
END TRY
BEGIN CATCH
    DECLARE @error INT=ERROR_NUMBER();
    IF XACT_STATE()<>0 ROLLBACK;
    IF @error NOT IN (3951,51106) THROW;
END CATCH;
""")
    print("PASS review: SNAPSHOT enrollment and post-enrollment isolation changes are rejected", flush=True)
