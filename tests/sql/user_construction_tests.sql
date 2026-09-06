-- Ordinary construction and promotion, after email fixtures have supplied expect_email_error.
SET NOCOUNT ON;
DECLARE @system UNIQUEIDENTIFIER='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @new UNIQUEIDENTIFIER='E0000000-0000-0000-0000-000000000031',@v BIGINT,@r INT,@id INT,@before DATETIME2=SYSUTCDATETIME();
EXEC security.user_insert @public_key=@new,@created_by=@system,@login_name=N'ordinary-creator',@full_name=N'Ordinary creator',
    @email=N'account-original@example.test',@created='20070101',@password_hash=N'test-only-hash',@password_salt=N'test-only-salt',
    @dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT,@user_id=@id OUTPUT;
IF @r<>1 OR NOT EXISTS (SELECT 1 FROM entities.entity e
    JOIN entities.entity_history h ON h.entity_id=e.entity_id AND h.dbrow_version=e.dbrow_version
    JOIN security.user_history u ON u.user_id=e.entity_id AND u.dbrow_version=e.dbrow_version
    JOIN data.dbrow_version v ON v.dbrow_version=e.dbrow_version AND v.tenant_id=e.tenant_id
    WHERE e.entity_id=@id AND e.public_key=@new AND e.entity_type_id=4 AND h.entity_type_id=4 AND h.dboperation_type_id=1
        AND u.email=N'account-original@example.test' AND u.email_confirmed=0 AND u.dboperation_type_id=1
        AND v.modified_by=1 AND v.modified='20070101' AND v.recorded_at>=@before)
    THROW 52000,'Ordinary user creation lost final type, history, actor or recording time.',1;
IF (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id)<>1
    OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>1
    THROW 52000,'New user emitted a fictitious committed contact revision.',1;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('security.user_history')
    AND name IN ('password_hash','password_salt','security_stamp','concurrency_stamp'))
    THROW 52000,'General account history copied credentials/security tokens.',1;
-- Once creation commits, this ordinary user can act through the strict email boundary.
SET @v=NULL;
EXECUTE AS USER='email_app';
EXEC contacts.email_update @contact_public_key=@new,@modified_by=@new,@expected_entity_version=1,@ordinal=1,
    @email_address=N'contact-edited@example.test',@dbrow_version=@v OUTPUT;
REVERT;
IF NOT EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v AND modified_by=@id)
    OR NOT EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@id AND email=N'account-original@example.test' AND email_confirmed=0)
    THROW 52000,'Ordinary actor attribution or account/contact email separation failed.',1;
-- A validated ordinary user can create another account through the administrative boundary.
SET @v=NULL;
EXEC security.user_insert @public_key='E0000000-0000-0000-0000-000000000032',@created_by=@new,
    @login_name=N'created-by-ordinary-user',@full_name=N'Nested constructor actor',@dbrow_version=@v OUTPUT;
IF NOT EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v AND modified_by=@id)
    THROW 52000,'Administrative construction silently replaced the ordinary actor.',1;
PRINT 'PASS user: final type at revision 1, non-secret account history, strict ordinary actor and separate account email';
GO

DECLARE @system UNIQUEIDENTIFIER='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @key UNIQUEIDENTIFIER='E0000000-0000-0000-0000-000000000033',@id INT,@birth BIGINT,@v BIGINT,@r INT;
EXEC contacts.contact_insert @public_key=@key,@created_by=@system,@full_name=N'Original contact payload',
    @email_address=N'preserved-contact@example.test',@dbrow_version=@birth OUTPUT;
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@key);
EXEC security.user_insert @public_key=@key,@created_by=@system,@expected_entity_version=1,
    @login_name=N'promoted-contact',@full_name=N'Must not replace contact payload',@email=N'new-account@example.test',
    @dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
IF @r<>2 OR NOT EXISTS (SELECT 1 FROM entities.entity_history h JOIN entities.entity_type t ON t.entity_type_id=h.entity_type_id
    WHERE h.entity_id=@id AND h.dbrow_version=@birth AND t.code_name=N'contact' AND h.dboperation_type_id=1)
    OR NOT EXISTS (SELECT 1 FROM entities.entity_history WHERE entity_id=@id AND dbrow_version=@v AND entity_type_id=4 AND dboperation_type_id=2)
    OR NOT EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id AND dbrow_version=@v AND dboperation_type_id=1 AND email=N'new-account@example.test')
    THROW 52000,'Promotion failed to distinguish earlier contact history from user construction.',1;
IF NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=@id AND full_name=N'Original contact payload')
    OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id)<>1
    OR NOT EXISTS (SELECT 1 FROM contacts.contact_email c JOIN contacts.email e ON e.email_id=c.email_id
        WHERE c.contact_id=@id AND e.email_address=N'preserved-contact@example.test')
    THROW 52000,'Promotion overwrote existing contact fields or contact email.',1;
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000033'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=2,@login_name=N''duplicate'',@full_name=N''Duplicate'';',51601;
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000033'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=1,@login_name=N''stale'',@full_name=N''Stale'';',51206;
PRINT 'PASS user: promotion preserves identity/contact payload, records historical type and bumps the root once';
GO

-- Fresh fixtures for rejected promotion paths; privileged setup is not a public lifecycle API.
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000034',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name=N'Locked promotion';
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000035',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@full_name=N'Foreign promotion',@tenant='908E5A8C-0372-4EDC-ADDF-011E059091EE';
EXEC entities.entity_insert @public_key='E0000000-0000-0000-0000-000000000036',@entity_type_id=1,@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@display_name=N'Not a contact';
UPDATE entities.entity SET locked=SYSUTCDATETIME() WHERE public_key='E0000000-0000-0000-0000-000000000034';
DECLARE @before INT=(SELECT COUNT(*) FROM data.dbrow_version);
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000034'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=1,@login_name=N''locked'',@full_name=N''Locked'';',51203;
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000035'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=1,@login_name=N''foreign'',@full_name=N''Foreign'';',51202;
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000036'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@expected_entity_version=1,@login_name=N''type'',@full_name=N''Type'';',51600;
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''E0000000-0000-0000-0000-000000000036'',@login_name=N''non-user actor'',@full_name=N''Invalid'';',51201;
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000037'',@created_by=''E0000000-0000-0000-0000-000000000037'',@login_name=N''implicit self'',@full_name=N''Invalid'';',51201;
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@tenant=''FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'',@login_name=N''bad tenant'',@full_name=N''Invalid'';',51200;
IF (SELECT COUNT(*) FROM data.dbrow_version)<>@before THROW 52000,'Rejected construction left audit allocations.',1;
PRINT 'PASS user: wrong tenant/type, locked root, invalid actor and implicit self-registration fail without System fallback';
GO

-- One audit actor per unit; constructor and later email commands cannot rebind attribution.
DECLARE @system UNIQUEIDENTIFIER='71F092F4-3A35-463D-9589-E5EE1373F7D5',@v BIGINT,@r INT,@id INT,
    @key UNIQUEIDENTIFIER='E0000000-0000-0000-0000-000000000038';
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.contact_insert @public_key=@key,@created_by=@system,@full_name=N'Composed promotion',@dbrow_version=@v OUTPUT;
EXEC security.user_insert @public_key=@key,@created_by=@system,@expected_entity_version=0,
    @login_name=N'composed-promotion',@full_name=N'Composed promotion',@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT,@user_id=@id OUTPUT;
EXEC contacts.contact_email_insert @contact_public_key=@key,@created_by=@system,@expected_entity_version=0,@email_address=N'composed-user@example.test';
IF @@TRANCOUNT<>1 OR @r<>1 OR (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id)<>1
    OR NOT EXISTS (SELECT 1 FROM entities.entity_history WHERE entity_id=@id AND entity_type_id=4 AND dboperation_type_id=1)
    THROW 52000,'Composed creation changed ownership or introduced another root revision.',1;
ROLLBACK;
IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@key) OR EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id)
    THROW 52000,'Rollback left a user/type/history fragment.',1;
EXEC dbo.expect_email_error N'BEGIN TRAN; EXEC data.audit_unit_begin;
 EXEC security.user_insert @public_key=''E0000000-0000-0000-0000-000000000038'',@created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''provisional actor'',@full_name=N''Provisional actor'';
 EXEC contacts.contact_email_insert @contact_public_key=''E0000000-0000-0000-0000-000000000038'',@created_by=''E0000000-0000-0000-0000-000000000038'',@expected_entity_version=0,@email_address=N''must-rollback@example.test'';',51005;
IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key=@key) THROW 52000,'Actor mismatch committed provisional user creation.',1;
PRINT 'PASS user: composed create/promote/email bumps once, rollback removes all layers, same-unit actor rebinding rejected';
GO

-- A child edit can bump an existing contact before promotion in the same unit.
DECLARE @key UNIQUEIDENTIFIER='E0000000-0000-0000-0000-000000000040',@system UNIQUEIDENTIFIER='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @v BIGINT,@r INT,@id INT,@attempt INT=0,@birth BIGINT;
EXEC contacts.contact_insert @public_key=@key,@created_by=@system,@full_name=N'Existing composition',@email_address=N'before-promotion@example.test',@dbrow_version=@birth OUTPUT;
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@key);
WHILE @attempt<2
BEGIN
    SET @v=NULL;
    BEGIN TRAN; EXEC data.audit_unit_begin;
    EXEC contacts.email_update @contact_public_key=@key,@modified_by=@system,@expected_entity_version=1,@ordinal=1,@email_address=N'after-promotion@example.test',@dbrow_version=@v OUTPUT;
    EXEC security.user_insert @public_key=@key,@created_by=@system,@expected_entity_version=1,@login_name=N'existing-composition',@full_name=N'Ignored',@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
    IF @r<>2 OR (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id AND dbrow_version=@v)<>1
        THROW 52000,'Promotion after an earlier child edit bumped again.',1;
    IF @attempt=0
    BEGIN
        ROLLBACK;
        IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN entities.entity_type t ON t.entity_type_id=e.entity_type_id
            WHERE e.entity_id=@id AND t.code_name=N'contact' AND e.entity_version=1 AND e.dbrow_version=@birth)
            OR EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id)
            OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>1
            THROW 52000,'Rollback changed committed contact type/history or left account history.',1;
    END
    ELSE COMMIT;
    SET @attempt+=1;
END;
PRINT 'PASS user: promotion after a child edit shares one revision, and rollback preserves earlier committed history';
GO

-- The optional constructor company lookup cannot link an unrelated tenant's name match.
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000042',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @contact_type_id=2,@tenant='908E5A8C-0372-4EDC-ADDF-011E059091EE',@full_name=N'Constructor scoped company';
DECLARE @v BIGINT,@id INT,@company INT;
EXEC security.user_insert @public_key='E0000000-0000-0000-0000-000000000043',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @login_name=N'company user',@full_name=N'Company user',@person_company=N'Constructor scoped company',@dbrow_version=@v OUTPUT,@user_id=@id OUTPUT;
SET @company=(SELECT to_contact_id FROM contacts.contact_relationship WHERE from_contact_id=@id);
IF @company IS NULL OR NOT EXISTS (SELECT 1 FROM entities.entity e JOIN contacts.contact c ON c.contact_id=e.entity_id
    JOIN contacts.contact_history h ON h.contact_id=e.entity_id AND h.dbrow_version=e.dbrow_version
    WHERE e.entity_id=@company AND e.tenant_id=1 AND c.contact_type_id=2 AND h.full_name=N'Constructor scoped company' AND e.dbrow_version=@v)
    THROW 52000,'User construction linked another tenant or omitted the new company payload history.',1;
IF (SELECT COUNT(*) FROM entities.entity_version_history WHERE dbrow_version=@v)<>2
    THROW 52000,'User/company creation did not share one audit unit.',1;
UPDATE entities.entity SET locked=SYSUTCDATETIME() WHERE entity_id=@company;
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''locked company user'',@full_name=N''Invalid'',@person_company=N''Constructor scoped company'';',51203;
UPDATE entities.entity SET locked=NULL WHERE entity_id=@company;
EXEC contacts.contact_insert @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@contact_type_id=2,@full_name=N'Constructor scoped company';
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''ambiguous company user'',@full_name=N''Invalid'',@person_company=N''Constructor scoped company'';',51313;
PRINT 'PASS user: tenant-scoped company reference, company creation history, inactive/ambiguous company rejection';
GO

-- Role selection is scoped and unambiguous; construction preserves the initial assignment evidence.
INSERT security.[role] (tenant_id,role_name,display_name,description) VALUES
 (NULL,N'Creation global',N'Global',N'Test'),(1,N'Creation local',N'Local',N'Test'),
 (2,N'Creation foreign',N'Foreign',N'Test'),(NULL,N'Creation ambiguous',N'Global duplicate',N'Test'),
 (1,N'Creation ambiguous',N'Local duplicate',N'Test');
DECLARE @v BIGINT,@id INT,@role INT=(SELECT role_id FROM security.[role] WHERE role_name=N'Creation global');
EXEC security.user_insert @public_key='E0000000-0000-0000-0000-000000000039',@created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',
    @login_name=N'global role user',@full_name=N'Global role',@user_primary_role=N'Creation global',@dbrow_version=@v OUTPUT,@user_id=@id OUTPUT;
IF NOT EXISTS (SELECT 1 FROM security.user_role WHERE user_id=@id AND role_id=@role)
    OR NOT EXISTS (SELECT 1 FROM entities.event WHERE subject_id=@id AND dbrow_version=@v AND TRY_CONVERT(INT,JSON_VALUE(event_args,'$.initial_role_id'))=@role)
    THROW 52000,'Initial global role assignment lost its creation evidence.',1;
EXEC security.user_insert @created_by='71F092F4-3A35-463D-9589-E5EE1373F7D5',@login_name=N'local role user',@full_name=N'Local role',@user_primary_role=N'Creation local';
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''foreign role user'',@full_name=N''Invalid'',@user_primary_role=N''Creation foreign'';',51602;
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''ambiguous role user'',@full_name=N''Invalid'',@user_primary_role=N''Creation ambiguous'';',51602;
EXEC dbo.expect_email_error N'EXEC security.user_insert @created_by=''71F092F4-3A35-463D-9589-E5EE1373F7D5'',@login_name=N''unknown role user'',@full_name=N''Invalid'',@user_primary_role=N''Missing creation role'';',51602;
IF EXISTS (SELECT 1 FROM security.[user] WHERE login_name IN (N'foreign role user',N'ambiguous role user',N'unknown role user'))
    THROW 52000,'Invalid initial role left an account behind.',1;
EXECUTE AS USER='email_app';
BEGIN TRY EXEC entities.entity_history_snapshot 1,1,1; THROW 52000,'Runtime can rewrite root history.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
BEGIN TRY EXEC security.user_history_create 1,1,1; THROW 52000,'Runtime can write private account history.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>229 THROW; END CATCH;
REVERT;
PRINT 'PASS user: eligible global/local role, ambiguous/foreign/unknown role rejection and private history permissions';
