-- Uses the actual fresh schema/procedures loaded by run_dbrow_version_tests.py.
-- Dbo fixture writes are intentional; application permissions are tested separately below.
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM entities.entity_type WHERE entity_type_id=4)
    INSERT entities.entity_type VALUES (4,'user','security','user','user_view');
UPDATE entities.entity SET entity_type_id=4 WHERE entity_id=1;
INSERT data.dboperation_type VALUES (3,'DELETE');
GO
CREATE PROCEDURE dbo.expect_email_error @statement NVARCHAR(MAX), @number INT AS
BEGIN
    BEGIN TRY
        EXEC sys.sp_executesql @statement;
        THROW 52000, 'Expected error did not occur.', 1;
    END TRY
    BEGIN CATCH
        DECLARE @actual INT=ERROR_NUMBER();
        IF XACT_STATE()<>0 ROLLBACK;
        IF @actual<>@number THROW;
    END CATCH;
END;
GO
DECLARE @v BIGINT;
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000001',
    @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @full_name='Email reference',
    @email_address=N'initial@example.test', @email_location_name=N'Primary', @dbrow_version=@v OUTPUT;
DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000001');
IF (SELECT entity_version FROM entities.entity WHERE entity_id=@id)<>1 THROW 52000,'Initial email bumped creation twice.',1;
IF (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id AND dbrow_version=@v)<>1 THROW 52000,'Constructor bypassed email history.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_action WHERE contact_id=@id AND dbrow_version=@v AND show_in_timeline=0)
    THROW 52000,'Constructor lost machine-readable email action.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_emails_as_of(@id,@v) WHERE email_address=N'initial@example.test' AND is_public=0)
    THROW 52000,'Creation reconstruction failed.',1;
PRINT 'PASS email: constructor, version 1, history, action, restrictive visibility';
GO

-- Three changes inside one unit, one spine row, final row state and intermediate action values.
DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000001'), @v BIGINT, @r INT;
BEGIN TRANSACTION;
EXEC data.audit_unit_begin;
EXEC contacts.email_update @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=1,@ordinal=1,@email_address=N'intermediate@example.test',@is_public=1,@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
DECLARE @first BIGINT=@v;
-- Clearing caller output/session hints cannot allocate a second version.
SET @v=NULL;
EXEC sys.sp_set_session_context @key=N'dbrow_version',@value=NULL;
EXEC contacts.email_delete @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=1,@ordinal=1,@dbrow_version=@v OUTPUT;
EXEC contacts.email_restore @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=1,@ordinal=1,@email_address=N'initial@example.test',@location_name=N'Primary',@dbrow_version=@v OUTPUT;
IF @v<>@first OR @r<>2 OR @@TRANCOUNT<>1 THROW 52000,'Repeated composition changed allocation/version/ownership.',1;
IF (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id AND dbrow_version=@v)<>1 THROW 52000,'Repeated root bump.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_history WHERE contact_id=@id AND dbrow_version=@v AND dboperation_type_id=2 AND is_public=0)
    THROW 52000,'Delete/restore final snapshot is wrong.',1;
IF (SELECT COUNT(*) FROM contacts.contact_email_action WHERE contact_id=@id AND dbrow_version=@v)<>3 THROW 52000,'Intermediate evidence was lost.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_action a JOIN contacts.email e ON e.email_id=a.email_id
    WHERE a.contact_id=@id AND a.dbrow_version=@v AND a.action_ordinal=1 AND e.email_address=N'intermediate@example.test')
    THROW 52000,'Action does not preserve its actual value.',1;
COMMIT;
DECLARE @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
SET @v=NULL;
EXEC contacts.email_update @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=2,@ordinal=1,@email_address=N'initial@example.test',@location_name=N'Primary',@dbrow_version=@v OUTPUT;
IF @v IS NOT NULL OR (SELECT COUNT(*) FROM data.dbrow_version)<>@before THROW 52000,'No-op allocated audit state.',1;
PRINT 'PASS email: repeated updates, delete/restore, change/revert, NULL auto-join and no-op';
GO

-- New identity cancellation retains action evidence and never reuses a committed ordinal.
DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000001'),@v BIGINT,@o INT;
BEGIN TRANSACTION; EXEC data.audit_unit_begin;
EXEC contacts.contact_email_insert @contact_public_key='E0000000-0000-0000-0000-000000000001',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=2,@email_address=N'transient@example.test',@ordinal=@o OUTPUT,@dbrow_version=@v OUTPUT;
EXEC contacts.email_delete @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=2,@ordinal=@o,@dbrow_version=@v OUTPUT;
IF EXISTS (SELECT 1 FROM contacts.contact_email_history WHERE contact_id=@id AND ordinal=@o AND dbrow_version=@v)
    THROW 52000,'Insert/delete left a fictitious committed child.',1;
EXEC contacts.email_restore @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=2,@ordinal=@o,@email_address=N'restored@example.test',@dbrow_version=@v OUTPUT;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_history WHERE contact_id=@id AND ordinal=@o AND dbrow_version=@v AND dboperation_type_id=1)
    THROW 52000,'Insert/delete/recreate was not an INSERT final state.',1;
COMMIT;
SET @v=NULL;
EXEC contacts.email_delete @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=3,@ordinal=@o,@dbrow_version=@v OUTPUT;
DECLARE @old INT=@o;
SET @o=NULL; SET @v=NULL;
EXEC contacts.contact_email_insert @contact_public_key='E0000000-0000-0000-0000-000000000001',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=4,@email_address=N'next@example.test',@ordinal=@o OUTPUT,@dbrow_version=@v OUTPUT;
IF @o<=@old THROW 52000,'Committed deleted identity was reused.',1;
PRINT 'PASS email: insert/delete/recreate, committed deletion, stable ordinals';
GO

-- Negative paths must preserve all prior committed data.
EXEC dbo.expect_email_error N'EXEC contacts.email_update @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=1,@email_address=N''bad'';',51206;
EXEC dbo.expect_email_error N'EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=999,@expected_entity_version=5;',51306;
EXEC dbo.expect_email_error N'EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''00000000-0000-0000-0000-000000000000'',@ordinal=1,@expected_entity_version=5;',51201;
EXEC dbo.expect_email_error N'EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@tenant=''00000000-0000-0000-0000-000000000000'',@ordinal=1,@expected_entity_version=5;',51200;
EXEC dbo.expect_email_error N'EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@tenant=''908E5A8C-0372-4EDC-ADDF-011E059091EE'',@ordinal=1,@expected_entity_version=5;',51201;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5;',51102;
EXEC dbo.expect_email_error N'DECLARE @v BIGINT=(SELECT dbrow_version FROM entities.entity WHERE public_key=''E0000000-0000-0000-0000-000000000001''); BEGIN TRAN; EXEC data.audit_unit_begin; EXEC sys.sp_set_session_context @key=N''dbrow_version'',@value=@v; EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5,@dbrow_version=@v OUTPUT;',51103;
EXEC dbo.expect_email_error N'DECLARE @long NVARCHAR(MAX)=REPLICATE(N''x'',257); EXEC contacts.email_update @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5,@email_address=@long;',51300;
PRINT 'PASS email: stale token, missing child, unknown actor/tenant, cross-tenant actor, raw ambient transaction, forged committed version and width';
GO

-- A later failed nested command rolls back the earlier success; nothing leaks across the boundary.
DECLARE @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin;
 EXEC contacts.email_update @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5,@email_address=N''rollback@example.test'';
 EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=999,@expected_entity_version=5;',51306;
IF (SELECT COUNT(*) FROM data.dbrow_version)<>@before OR EXISTS (SELECT 1 FROM contacts.email WHERE email_address=N'rollback@example.test')
    THROW 52000,'Failed unit left audit/catalog state.',1;
PRINT 'PASS email: full rollback after a successful nested write';
GO

-- Exact dictionaries, reused OUTPUT values and nontruncating inputs.
BEGIN TRAN; EXEC data.audit_unit_begin;
DECLARE @a INT=777,@b INT=777,@c INT,@location INT=777,@text NVARCHAR(MAX)=REPLICATE(N'X',256);
EXEC contacts.email_values_ensure N'Case@example.test',N'Home',@a OUTPUT,@location OUTPUT;
EXEC contacts.email_values_ensure N'case@example.test',NULL,@b OUTPUT,@location OUTPUT;
IF @a=@b OR @location IS NOT NULL THROW 52000,'Exact case or missing-output handling failed.',1;
EXEC contacts.email_values_ensure N'case@example.test ',NULL,@c OUTPUT,@location OUTPUT;
IF @b=@c THROW 52000,'Trailing space identity was lost.',1;
EXEC contacts.email_values_ensure @text,NULL,@c OUTPUT,@location OUTPUT;
IF (SELECT DATALENGTH(email_address) FROM contacts.email WHERE email_id=@c)<>512 THROW 52000,'Full-width value truncated.',1;
EXEC contacts.email_values_ensure N'A',N'L',@a OUTPUT,@location OUTPUT;
SET @text=N'A'+NCHAR(0);
DECLARE @zero_location NVARCHAR(MAX)=N'L'+NCHAR(0),@location_before INT=@location;
EXEC contacts.email_values_ensure @text,@zero_location,@b OUTPUT,@location OUTPUT;
IF @a=@b OR @location=@location_before THROW 52000,'Binary padding collapsed a distinct accepted value.',1;
ROLLBACK;
PRINT 'PASS email: exact case/trailing-space catalog identity and full-width values';
GO

-- Permission boundary under an actual non-owner database principal.
CREATE USER email_app WITHOUT LOGIN;
ALTER ROLE email_runtime ADD MEMBER email_app;
EXECUTE AS USER='email_app';
BEGIN TRY
    SELECT TOP(1) * FROM contacts.email;
    THROW 52000,'Application can enumerate the shared catalog.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
BEGIN TRY
    EXEC contacts.contact_email_write 'delete',1,1,1,1;
    THROW 52000,'Application can execute the internal writer.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
BEGIN TRAN;
DECLARE @lock_result INT;
BEGIN TRY
    EXEC @lock_result=sys.sp_getapplock @Resource='overmind:version:1',@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo';
    IF @lock_result>=0 THROW 52000,'Application forged a private allocation guard.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>1202 THROW; END CATCH;
IF XACT_STATE()<>0 ROLLBACK;
EXEC contacts.contact_email_change @operation='update',@contact_public_key='E0000000-0000-0000-0000-000000000001',@actor='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @expected_entity_version=5,@ordinal=1,@email_address=N'initial@example.test',@location_name=N'Primary';
REVERT;
PRINT 'PASS email: application entry works, private writer/catalog/guard unavailable';
GO

-- Valid target followed by missing target cannot reuse the prior contact; actor type/lifecycle matter.
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin;
 EXEC contacts.email_update @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5,@email_address=N''never-committed@example.test'';
 EXEC contacts.email_update @contact_public_key=''E0000000-0000-0000-0000-000000000099'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5,@email_address=N''wrong-parent@example.test'';',51202;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin; UPDATE entities.entity SET entity_type_id=1,is_system=1 WHERE entity_id=1;
 EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5;',51201;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin; UPDATE entities.entity SET deleted=SYSUTCDATETIME() WHERE entity_id=1;
 EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5;',51201;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin; UPDATE entities.entity SET locked=SYSUTCDATETIME() WHERE public_key=''E0000000-0000-0000-0000-000000000001'';
 EXEC contacts.email_delete @contact_public_key=''E0000000-0000-0000-0000-000000000001'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@ordinal=1,@expected_entity_version=5;',51203;
PRINT 'PASS email: missing lookup after success; System flag is not actor eligibility; deleted actor and locked root fail';
GO

-- A committed cancelled creation can later be explicitly restored as the same known identity.
DECLARE @v BIGINT,@o INT;
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.contact_email_insert @contact_public_key='E0000000-0000-0000-0000-000000000001',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@expected_entity_version=5,@email_address=N'cancel@example.test',@ordinal=@o OUTPUT,@dbrow_version=@v OUTPUT;
EXEC contacts.email_delete @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@expected_entity_version=5,@ordinal=@o,@dbrow_version=@v OUTPUT;
COMMIT;
SET @v=NULL;
EXEC contacts.email_restore @contact_public_key='E0000000-0000-0000-0000-000000000001',@modified_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@expected_entity_version=6,@ordinal=@o,@email_address=N'uncancel@example.test',@dbrow_version=@v OUTPUT;
PRINT 'PASS email: explicit restoration after committed insert/delete';
GO

-- Independent roots for concurrency and C# integration cases.
-- Fixture-only audited root rename/deletion: email reader must keep historical labels and retained children.
DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='E0000000-0000-0000-0000-000000000001'),@v BIGINT,@r INT,@now DATETIME2=SYSUTCDATETIME();
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC entities.entity_write_lock @id,1,7,@v OUTPUT,@r OUTPUT;
EXEC data.dbrow_version_ensure 1,1,2,@now,@v OUTPUT;
UPDATE entities.entity SET display_name=N'Later renamed contact',deleted=@now,deleted_by=1 WHERE entity_id=@id;
INSERT entities.entity_history (dbrow_version,tenant_id,entity_id,entity_type_id,dboperation_type_id,display_name,deleted,deleted_by,is_private)
SELECT @v,1,@id,entity_type_id,3,display_name,deleted,deleted_by,is_private FROM entities.entity WHERE entity_id=@id;
EXEC entities.entity_version_bump @id,1,1,@v,@now,@r OUTPUT;
COMMIT;
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000002',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name='Concurrent email',@email_address=N'concurrent@example.test';
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000003',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name='Late root',@email_address=N'late@example.test';
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000004',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name='Csharp email';
GO
