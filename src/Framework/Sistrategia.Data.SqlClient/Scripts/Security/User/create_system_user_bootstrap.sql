-- Trusted schema/bootstrap operation only; never grant to the email application principal.
-- Reserves the existing compatibility identity 1 explicitly and creates all available base history.
CREATE OR ALTER PROCEDURE [security].[system_user_bootstrap]
    @tenant UNIQUEIDENTIFIER, @tenant_name NVARCHAR(256), @created DATETIME2
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @owns BIT=0,@identity_on BIT=0,@tenant_id INT,@v BIGINT,@lock_result INT;
    BEGIN TRY
        IF @@TRANCOUNT=0
        BEGIN
            BEGIN TRANSACTION; SET @owns=1;
            EXEC [data].[audit_unit_begin];
        END;
        EXEC [data].[audit_unit_assert] @v OUTPUT;
        IF @v IS NOT NULL THROW 51500, 'Bootstrap requires a unit with no existing business allocation.', 1;
        EXEC @lock_result=sys.sp_getapplock @Resource='overmind:system-bootstrap',@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=10000;
        IF @lock_result<0 THROW 51501, 'Could not lock System bootstrap.', 1;
        SET @tenant_id=(SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key]=@tenant);
        IF EXISTS (SELECT 1 FROM [entities].[entity])
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [entities].[entity] e
                JOIN [contacts].[contact] c ON c.[contact_id]=e.[entity_id]
                JOIN [security].[user] u ON u.[user_id]=e.[entity_id]
                JOIN [entities].[entity_version_history] h ON h.[entity_id]=e.[entity_id] AND h.[entity_version]=1
                JOIN [entities].[entity_history] eh ON eh.[entity_id]=e.[entity_id] AND eh.[dbrow_version]=h.[dbrow_version] AND eh.[tenant_id]=e.[tenant_id]
                JOIN [contacts].[contact_history] ch ON ch.[contact_id]=e.[entity_id] AND ch.[dbrow_version]=h.[dbrow_version] AND ch.[tenant_id]=e.[tenant_id]
                WHERE e.[entity_id]=1 AND e.[public_key]='71F092F4-3A35-463D-9589-E5EE1373F7D5'
                  AND e.[entity_type_id]=4 AND e.[tenant_id]=@tenant_id AND u.[login_name]=N'system'
                  AND e.[is_system]=1 AND e.[deleted] IS NULL AND e.[locked] IS NULL)
                THROW 51502, 'Conflicting or incomplete System identity; bootstrap will not repair it implicitly.', 1;
            IF @owns=1 COMMIT;
            RETURN;
        END;
        IF @tenant_id IS NULL
        BEGIN
            INSERT [data].[tenant] ([public_key],[name]) VALUES (@tenant,@tenant_name);
            SET @tenant_id=CONVERT(INT,SCOPE_IDENTITY());
        END;
        EXEC [data].[dbrow_version_ensure] @tenant_id,1,1,@created,@v OUTPUT;
        SET IDENTITY_INSERT [entities].[entity] ON; SET @identity_on=1;
        INSERT [entities].[entity] ([entity_id],[entity_type_id],[public_key],[tenant_id],[logical_key],[display_name],
            [created],[created_by],[modified],[modified_by],[summary],[is_private],[is_system],[entity_version],[dbrow_version])
        VALUES (1,4,'71F092F4-3A35-463D-9589-E5EE1373F7D5',@tenant_id,N'system',N'System User',
            @created,1,@created,1,N'System User',0,1,1,@v);
        SET IDENTITY_INSERT [entities].[entity] OFF; SET @identity_on=0;
        INSERT [entities].[entity_version_history] ([tenant_id],[dbrow_version],[entity_id],[entity_version]) VALUES (@tenant_id,@v,1,1);
        INSERT [entities].[entity_history] ([dbrow_version],[tenant_id],[entity_id],[dboperation_type_id],[logical_key],[display_name],[summary],[is_private])
        VALUES (@v,@tenant_id,1,1,N'system',N'System User',N'System User',0);
        INSERT [contacts].[contact] ([contact_id],[contact_type_id],[full_name]) VALUES (1,1,N'System User');
        INSERT [contacts].[contact_history] ([dbrow_version],[tenant_id],[contact_id],[full_name],[do_not_contact],[open_to_work],[recruiting],[is_deceased])
        VALUES (@v,@tenant_id,1,N'System User',0,0,0,0);
        INSERT [security].[user] ([user_id],[login_name]) VALUES (1,N'system');
        IF @owns=1 COMMIT;
    END TRY
    BEGIN CATCH
        IF @identity_on=1 SET IDENTITY_INSERT [entities].[entity] OFF;
        IF @owns=1 AND XACT_STATE()<>0 ROLLBACK;
        THROW;
    END CATCH;
END;
