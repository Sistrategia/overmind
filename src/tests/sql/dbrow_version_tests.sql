SET NOCOUNT ON;
SET XACT_ABORT OFF;
INSERT data.tenant (public_key, name) VALUES
 ('908E5A8C-0372-4EDC-ADDF-011E059091ED', 'Test'),
 ('908E5A8C-0372-4EDC-ADDF-011E059091EE', 'Other');
INSERT data.dboperation_type VALUES (1, 'INSERT'), (2, 'UPDATE');
INSERT entities.entity_type VALUES (1, 'entity', 'entities', 'entity', 'entity_view'),
 (2, 'contact', 'contacts', 'contact', 'contact_view');
INSERT contacts.contact_type VALUES (1, 'person'), (2, 'company');
INSERT contacts.contact_relationship_type (code_name, display_name, display_name_es)
 VALUES ('worksfor', 'Works for', 'Trabaja para');
INSERT entities.event_type (code_name) VALUES ('contacts.contact.new'), ('security.user.new');
GO

-- Helper never opens its own transaction.
DECLARE @v BIGINT;
BEGIN TRY
    EXEC data.dbrow_version_ensure 1, 1, 1, '20260101', @v OUTPUT;
    THROW 52000, 'Helper accepted autocommit allocation.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51001 THROW;
END CATCH;
IF @@TRANCOUNT <> 0 THROW 52000, 'Helper changed transaction ownership.', 1;

-- Allocation/reuse preserves enclosing metadata and transaction count; rollback removes it.
BEGIN TRANSACTION;
EXEC data.audit_unit_begin;
EXEC data.dbrow_version_ensure 1, 1, 2, '20260101', @v OUTPUT;
DECLARE @original BIGINT = @v;
EXEC data.dbrow_version_ensure 1, 1, 1, '20260201', @v OUTPUT;
IF @v <> @original OR @@TRANCOUNT <> 1 THROW 52000, 'Reuse changed version or transaction count.', 1;
IF NOT EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version = @v AND dboperation_type_id = 2 AND modified = '20260101')
    THROW 52000, 'Reuse overwrote metadata.', 1;
ROLLBACK;
IF EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version = @original)
    THROW 52000, 'Helper committed independently.', 1;
PRINT 'PASS: active transaction, reuse, metadata, rollback';
GO

-- Bootstrap and standalone optional OUTPUT. Procedure-scoped SET options are restored.
SET XACT_ABORT OFF;
DECLARE @v BIGINT, @id INT;
EXEC entities.entity_insert @entity_type_id=4,
 @public_key='71F092F4-3A35-463D-9589-E5EE1373F7D5',
 @tenant='908E5A8C-0372-4EDC-ADDF-011E059091ED', @display_name='System',
 @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @dbrow_version=@v OUTPUT, @entity_id=@id OUTPUT;
IF @v IS NULL OR @id <> 1 OR @@TRANCOUNT <> 0 THROW 52000, 'Standalone entity contract failed.', 1;
IF (@@OPTIONS & 16384) <> 0 THROW 52000, 'XACT_ABORT leaked out of procedure scope.', 1;
IF NOT EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v AND modified_by=@id)
    THROW 52000, 'Bootstrap actor mismatch.', 1;
BEGIN TRY
    EXEC entities.entity_insert @entity_type_id=1, @display_name='Invalid reuse',
     @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @dbrow_version=@v OUTPUT;
    THROW 52000, 'Version reused without ambient transaction.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51008 THROW;
END CATCH;
PRINT 'PASS: standalone entity, bootstrap, SET scope, reuse guard';
GO

-- Both user paths must allocate and return a ledger entry, and event must share it.
DECLARE @v BIGINT, @public UNIQUEIDENTIFIER=NEWID(), @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
EXEC security.user_insert @public_key=@public, @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
 @login_name='new-user', @full_name='New user', @dbrow_version=@v OUTPUT;
IF @v IS NULL OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before+1
    THROW 52000, 'New user chain did not allocate exactly once.', 1;
IF NOT EXISTS (SELECT 1 FROM entities.event WHERE subject_public_key=@public AND dbrow_version=@v)
    THROW 52000, 'User event lost audit version.', 1;
IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN contacts.contact_history h ON h.contact_id=e.entity_id
 WHERE e.public_key=@public AND e.dbrow_version=@v AND h.dbrow_version=@v)
    THROW 52000, 'Nested history lost audit version.', 1;

SET @public=NEWID(); SET @v=NULL;
EXEC contacts.contact_insert @public_key=@public, @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @full_name='Existing contact';
SET @before=(SELECT COUNT(*) FROM data.dbrow_version);
EXEC security.user_insert @public_key=@public, @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
 @login_name='existing-contact-user', @full_name=NULL, @expected_entity_version=1, @dbrow_version=@v OUTPUT;
IF @v IS NULL OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before+1
    THROW 52000, 'Existing-contact user failed to allocate.', 1;
IF NOT EXISTS (SELECT 1 FROM entities.event WHERE subject_public_key=@public AND dbrow_version=@v)
    THROW 52000, 'Existing-contact event lost audit version.', 1;
PRINT 'PASS: new-user chain, existing-contact path, caller omitting OUTPUT';
GO

-- Ambient composition, second entity/company creation, and rollback of the entire chain.
DECLARE @v BIGINT, @public UNIQUEIDENTIFIER=NEWID(), @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
BEGIN TRANSACTION;
EXEC data.audit_unit_begin;
EXEC contacts.contact_insert @public_key=@public, @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
 @full_name='Employee', @person_company='Test Company', @dbrow_version=@v OUTPUT;
EXEC entities.entity_insert @entity_type_id=1, @display_name='Additional entity',
 @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @dbrow_version=@v OUTPUT;
IF @@TRANCOUNT <> 1 OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before+1
    THROW 52000, 'Nested composition changed ownership or allocated twice.', 1;
IF (SELECT COUNT(*) FROM entities.entity_version_history WHERE dbrow_version=@v) <> 3
    THROW 52000, 'Company/employee/additional entity did not share version.', 1;
ROLLBACK;
IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@public) OR EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v)
    THROW 52000, 'Ambient rollback left business/audit rows.', 1;
PRINT 'PASS: shared ambient allocation and company creation';
GO

-- Reuse checks and invalid allocation input (helper does not own rollback).
DECLARE @v BIGINT;
BEGIN TRANSACTION;
EXEC data.audit_unit_begin;
EXEC data.dbrow_version_ensure 1, 1, 1, '20260101', @v OUTPUT;
BEGIN TRY
    EXEC data.dbrow_version_ensure 2, 1, 1, '20260101', @v OUTPUT;
    THROW 52000, 'Cross-tenant version accepted.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51004 THROW;
END CATCH;
BEGIN TRY
    EXEC data.dbrow_version_ensure 1, 999, 1, '20260101', @v OUTPUT;
    THROW 52000, 'Conflicting actor accepted.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51005 THROW;
END CATCH;
SET @v=-1;
BEGIN TRY
    EXEC data.dbrow_version_ensure 1, 1, 1, '20260101', @v OUTPUT;
    THROW 52000, 'Missing ledger accepted.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51103 THROW;
END CATCH;
SET @v=NULL;
BEGIN TRY
    EXEC data.dbrow_version_ensure NULL, 1, 1, '20260101', @v OUTPUT;
    THROW 52000, 'NULL tenant accepted.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 51002 THROW;
END CATCH;
ROLLBACK;
PRINT 'PASS: tenant/actor/missing-ledger validation';
GO

-- Inject a real late failure: contact entity insert succeeds, contact FK fails.
DECLARE @public UNIQUEIDENTIFIER=NEWID(), @v BIGINT, @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
BEGIN TRY
    EXEC contacts.contact_insert @public_key=@public, @contact_type_id=999,
     @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @full_name='Failure', @dbrow_version=@v OUTPUT;
    THROW 52000, 'Expected contact FK failure.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH;
IF @@TRANCOUNT <> 0 OR EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@public)
 OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before
    THROW 52000, 'Owned transaction did not roll back fully.', 1;

SET @v=NULL;
BEGIN TRANSACTION;
EXEC data.audit_unit_begin;
BEGIN TRY
    EXEC contacts.contact_insert @public_key=@public, @contact_type_id=999,
     @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5', @full_name='Failure', @dbrow_version=@v OUTPUT;
    THROW 52000, 'Expected ambient contact FK failure.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    IF @@TRANCOUNT <> 1 OR XACT_STATE() <> -1 THROW 52000, 'Ambient failure ownership/state incorrect.', 1;
    ROLLBACK;
END CATCH;
IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@public)
 OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before
    THROW 52000, 'Ambient rollback left partial writes.', 1;
PRINT 'PASS: late failure, native error metadata, owned/ambient rollback';
GO

-- Self-creation beyond System User: company creation resolves the newly created actor.
DECLARE @public UNIQUEIDENTIFIER=NEWID(), @v BIGINT, @actor INT;
EXEC contacts.contact_insert @public_key=@public, @created_by=@public,
 @tenant='908E5A8C-0372-4EDC-ADDF-011E059091ED', @full_name='Self-created actor',
 @person_company='Bootstrap Company', @dbrow_version=@v OUTPUT;
SET @actor=(SELECT entity_id FROM entities.entity WHERE public_key=@public);
IF @actor IS NULL OR @actor=1 OR NOT EXISTS (
 SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v AND modified_by=@actor)
    THROW 52000, 'Non-System bootstrap actor was not preserved.', 1;
IF (SELECT COUNT(*) FROM entities.entity_version_history WHERE dbrow_version=@v) <> 2
    THROW 52000, 'Bootstrap company did not reuse the same ledger.', 1;

-- User failure after nested contact success must roll back every layer.
SET @public=NEWID(); SET @v=NULL;
DECLARE @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
BEGIN TRY
    EXEC security.user_insert @public_key=@public, @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
     @login_name=NULL, @full_name='Failed user', @dbrow_version=@v OUTPUT;
    THROW 52000, 'Expected user NOT NULL failure.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 515 THROW;
END CATCH;
IF @@TRANCOUNT <> 0 OR EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@public)
 OR (SELECT COUNT(*) FROM data.dbrow_version) <> @before
    THROW 52000, 'Failed user left committed contact/entity/audit data.', 1;
PRINT 'PASS: non-System bootstrap with company, late user rollback';
