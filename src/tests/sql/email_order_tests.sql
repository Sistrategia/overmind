-- Independent roots: preserve existing lifecycle fixtures and exercise user-visible saved order.
SET NOCOUNT ON;
IF OBJECT_ID('entities.entity_child_sequence') IS NOT NULL THROW 52000,'Redundant child counter remains.',1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('entities.entity_history') AND name='ix_entity_history_root')
    OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('contacts.contact_history') AND name='ix_contact_history_root')
    THROW 52000,'Root payload reconstruction indexes are missing.',1;
-- Baseline fixtures use an entity-only System; the real application views join its contact/user.
IF NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=1)
    INSERT contacts.contact (contact_id,contact_type_id,full_name) VALUES (1,1,N'System');
IF NOT EXISTS (SELECT 1 FROM security.[user] WHERE user_id=1)
    INSERT security.[user] (user_id,login_name) VALUES (1,N'system');
DECLARE @actor UNIQUEIDENTIFIER='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @key UNIQUEIDENTIFIER='E0000000-0000-0000-0000-000000000020', @id INT, @o INT, @v BIGINT;
EXEC contacts.contact_insert @public_key=@key,@created_by=@actor,@full_name=N'Ordered emails',@email_address=N'order-a@example.test';
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@key);
EXEC contacts.contact_email_insert @contact_public_key=@key,@created_by=@actor,@expected_entity_version=1,@email_address=N'order-b@example.test';
EXEC contacts.contact_email_insert @contact_public_key=@key,@created_by=@actor,@expected_entity_version=2,@email_address=N'order-c@example.test';
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=3,@ordinal=3,@display_order=1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@key AND email_address=N'order-c@example.test')
    THROW 52000,'Contact card did not follow saved order.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email WHERE contact_id=@id AND ordinal=3 AND display_order=1)
    OR NOT EXISTS (SELECT 1 FROM contacts.contact_email WHERE contact_id=@id AND ordinal=1 AND display_order=2)
    THROW 52000,'Move changed identity or lost a shifted row.',1;

BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=4,@ordinal=3,@display_order=3,@dbrow_version=@v OUTPUT;
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=4,@ordinal=2,@display_order=1;
EXEC contacts.email_delete @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=4,@ordinal=2;
EXEC contacts.email_restore @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=4,@ordinal=2,@email_address=N'order-b@example.test';
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=4,@ordinal=3,@display_order=1;
COMMIT;
IF (SELECT entity_version FROM entities.entity WHERE entity_id=@id)<>5
    OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id AND dbrow_version=@v)<>3
    OR (SELECT COUNT(*) FROM contacts.contact_email_action WHERE contact_id=@id AND dbrow_version=@v)<>5
    THROW 52000,'Composed order changes lost final state, actions, or bump-once behavior.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_action WHERE contact_id=@id AND dbrow_version=@v
    AND action_ordinal=1 AND operation='move' AND previous_display_order=1 AND display_order=3 AND payload_version=2)
    THROW 52000,'Move action lost its actual prior/result positions.',1;
DECLARE @bound BIGINT=(SELECT dbrow_version FROM entities.entity_version_history WHERE entity_id=@id AND entity_version=4);
IF EXISTS (SELECT ordinal,display_order,email_id FROM contacts.contact_emails_as_of(@id,@v)
    EXCEPT SELECT ordinal,display_order,email_id FROM contacts.contact_emails_as_of(@id,@bound))
    THROW 52000,'Change/revert failed to reconstruct the original saved order.',1;
EXEC contacts.email_delete @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=5,@ordinal=3;
SET @o=NULL;
EXEC contacts.contact_email_insert @contact_public_key=@key,@created_by=@actor,@expected_entity_version=6,@email_address=N'order-d@example.test',@ordinal=@o OUTPUT;
IF @o<>4 THROW 52000,'A committed child identity was reused.',1;
EXEC contacts.email_restore @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=7,@ordinal=3,@email_address=N'order-c@example.test';
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email WHERE contact_id=@id AND ordinal=3 AND display_order=4)
    THROW 52000,'Restore replaced the current principal instead of appending.',1;
EXEC contacts.email_delete @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=8,@ordinal=1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@key AND email_address=N'order-b@example.test')
    THROW 52000,'Deleting identity 1 removed the contact card email despite remaining rows.',1;
DECLARE @ledgers INT=(SELECT COUNT(*) FROM data.dbrow_version);
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=9,@ordinal=2,@display_order=1;
IF (SELECT COUNT(*) FROM data.dbrow_version)<>@ledgers THROW 52000,'A no-op move allocated audit evidence.',1;
EXEC dbo.expect_email_error N'EXEC contacts.email_move @contact_public_key=''E0000000-0000-0000-0000-000000000020'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=9,@ordinal=2,@display_order=0;',51310;
EXEC dbo.expect_email_error N'EXEC contacts.email_move @contact_public_key=''E0000000-0000-0000-0000-000000000020'',@modified_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=8,@ordinal=2,@display_order=2;',51206;
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=9,@ordinal=4,@display_order=1;
ROLLBACK;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@key AND email_address=N'order-b@example.test')
    THROW 52000,'Rollback left a new default or partial positions.',1;

EXECUTE AS USER='email_app';
BEGIN TRY
    EXEC contacts.contact_email_history_sync 1,1,1;
    THROW 52000,'Application can execute the private history finalizer.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
BEGIN TRY
    DECLARE @private_email INT,@private_location INT;
    EXEC contacts.email_values_ensure N'private@example.test',NULL,@private_email OUTPUT,@private_location OUTPUT;
    THROW 52000,'Application can execute the owner-context catalog helper directly.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
EXEC contacts.email_move @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=9,@ordinal=4,@display_order=1;
-- A new exact catalog value requires the private dbo lock while entered through the real role.
EXEC contacts.email_update @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=10,@ordinal=4,
    @email_address=N'order-role@example.test',@location_name=N'Order role location';
REVERT;
IF NOT EXISTS (SELECT 1 FROM contacts.contact_view WHERE public_key=@key AND email_address=N'order-role@example.test')
    THROW 52000,'Runtime role did not reach the ordered writer/private catalog allocator.',1;
PRINT 'PASS order: append, promote, shift history, move/revert, deletion, restoration, retained identity, no-op, rollback and runtime role';
GO
-- Check every boundary, including a caller changing isolation AFTER successful enrollment.
EXEC dbo.expect_email_error N'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRAN; EXEC data.audit_unit_begin;',51106;
EXEC dbo.expect_email_error N'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; BEGIN TRAN; EXEC data.audit_unit_begin;',51106;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; DECLARE @v BIGINT; EXEC data.audit_unit_assert @v OUTPUT;',51106;
-- Local recording time is distinct from a supplied occurrence/source timestamp.
BEGIN TRAN; EXEC data.audit_unit_begin;
DECLARE @v BIGINT,@recorded DATETIME2,@before DATETIME2=SYSUTCDATETIME();
EXEC data.dbrow_version_ensure 1,1,2,'20000101',@v OUTPUT,@recorded OUTPUT;
IF NOT EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v AND modified='20000101' AND recorded_at>=@before)
    THROW 52000,'Caller time replaced server recording time.',1;
ROLLBACK;
PRINT 'PASS review: isolation profile/revalidation and separate occurrence/recording time';
