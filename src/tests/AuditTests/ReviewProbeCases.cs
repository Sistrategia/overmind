using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

// Supported invariants extracted from historical email A and user P5; see testing-handoff.md.
internal static class ReviewProbeCases
{
    internal static Task SavepointOwnership(AuditDatabase db) => db.ExecuteAsync("""
        SET NOCOUNT ON;
        DECLARE @before INT=(SELECT COUNT(*) FROM data.dbrow_version),@v BIGINT,@found BIGINT,
            @resource NVARCHAR(255),@unit NVARCHAR(255),@error INT=0;
        BEGIN TRAN; EXEC data.audit_unit_begin;
        SET @unit=N'overmind:unit:'+CONVERT(NVARCHAR(20),CURRENT_TRANSACTION_ID());
        SAVE TRAN allocation_savepoint;
        EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
        SET @resource=N'overmind:version:'+CONVERT(NVARCHAR(20),@v);
        IF @v IS NULL OR APPLOCK_MODE(N'dbo',@resource,N'Transaction')<>N'Exclusive'
            THROW 52000,'Savepoint fixture never owned an allocation.',1;
        ROLLBACK TRAN allocation_savepoint;
        IF EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v)
            OR APPLOCK_MODE(N'dbo',@resource,N'Transaction')<>N'NoLock'
            OR APPLOCK_MODE(N'dbo',@unit,N'Transaction')<>N'Exclusive'
            THROW 52000,'Savepoint rollback retained allocation evidence or lost outer enrollment.',1;
        EXEC data.audit_unit_assert @found OUTPUT;
        IF @found IS NOT NULL THROW 52000,'Discovery revived a rolled-back allocation.',1;
        BEGIN TRY
            EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
        END TRY BEGIN CATCH
            SET @error=ERROR_NUMBER();
        END CATCH;
        -- Whole-unit failure: do not allocate again or commit partial work after rejection.
        IF XACT_STATE()<>0 ROLLBACK;
        IF @error<>51103 THROW 52000,'Rolled-back version was not rejected as unowned.',1;
        IF @@TRANCOUNT<>0 OR (SELECT COUNT(*) FROM data.dbrow_version)<>@before
            THROW 52000,'Failed savepoint probe left a transaction or ledger fragment.',1;
        """);

    internal static async Task PromotionThenEmail(AuditDatabase db) {
        const string root = "E0000000-0000-0000-0000-000000000051";
        await db.ExecuteAsync($$"""
            SET NOCOUNT ON;
            DECLARE @key UNIQUEIDENTIFIER='{{root}}',@actor UNIQUEIDENTIFIER='{{SqlScenarios.actor}}',
                @birth BIGINT,@v BIGINT,@emailVersion BIGINT,@id INT,@r INT,@emailRevision INT,@attempt INT=0;
            EXEC contacts.contact_insert @public_key=@key,@created_by=@actor,@full_name=N'Promotion first',
                @email_address=N'promotion-before@example.test',@dbrow_version=@birth OUTPUT;
            SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@key);
            WHILE @attempt<2
            BEGIN
                SET @v=NULL; SET @emailVersion=NULL;
                BEGIN TRAN; EXEC data.audit_unit_begin;
                -- Only account inputs; the legacy required @full_name argument is explicitly NULL (P2).
                EXEC security.user_insert @public_key=@key,@created_by=@actor,@expected_entity_version=1,
                    @login_name=N'promotion-first',@full_name=NULL,@email=N'promotion-account@example.test',
                    @dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
                EXEC contacts.email_update @contact_public_key=@key,@modified_by=@actor,@expected_entity_version=1,
                    @ordinal=1,@email_address=N'promotion-after@example.test',
                    @dbrow_version=@emailVersion OUTPUT,@entity_version=@emailRevision OUTPUT;
                IF @v IS NULL OR @emailVersion IS NULL OR @r IS NULL OR @emailRevision IS NULL
                    OR @v<>@emailVersion OR @r<>2 OR @emailRevision<>2 OR @@TRANCOUNT<>1
                    OR (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id AND dbrow_version=@v)<>1
                    OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id AND dbrow_version=@v AND entity_type_id=4 AND dboperation_type_id=2)<>1
                    OR (SELECT COUNT(*) FROM security.user_history WHERE user_id=@id AND dbrow_version=@v AND email=N'promotion-account@example.test')<>1
                    OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id AND dbrow_version=@v AND dboperation_type_id=2)<>1
                    OR (SELECT COUNT(*) FROM contacts.contact_email_action WHERE contact_id=@id AND dbrow_version=@v)<>1
                    THROW 52000,'Promotion then email lost one-unit revision, history or ownership.',1;
                IF @attempt=0
                BEGIN
                    ROLLBACK;
                    IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN entities.entity_type t ON t.entity_type_id=e.entity_type_id
                        WHERE e.entity_id=@id AND t.code_name=N'contact' AND e.entity_version=1 AND e.dbrow_version=@birth)
                        OR EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@id)
                        OR EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id)
                        OR EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v)
                        OR (SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id)<>1
                        OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>1
                        OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id)<>1
                        OR (SELECT COUNT(*) FROM contacts.contact_email_action WHERE contact_id=@id)<>1
                        OR NOT EXISTS (SELECT 1 FROM contacts.contact_email c JOIN contacts.email e ON e.email_id=c.email_id
                            WHERE c.contact_id=@id AND e.email_address=N'promotion-before@example.test')
                        THROW 52000,'Rollback retained a promotion/email fragment or changed prior state.',1;
                END
                ELSE COMMIT;
                SET @attempt+=1;
            END;
            """);
        var reader = new SqlContactEmailReader(db.ConnectionString);
        var before = await reader.ReadAsync(Guid.Parse(root), Guid.Parse(SqlScenarios.actor), 1);
        var after = await reader.ReadAsync(Guid.Parse(root), Guid.Parse(SqlScenarios.actor), 2, compareEntityVersion: 1);
        Assert.AreEqual(2, before.EntityTypeId);
        Assert.AreEqual(4, after.EntityTypeId);
        Assert.AreEqual("Promotion first", after.FullName);
        Assert.AreEqual("promotion-before@example.test", before.Emails.Single().Email);
        Assert.AreEqual("promotion-after@example.test", after.Emails.Single().Email);
        Assert.AreEqual("update", after.Differences.Single().Operation);
        Assert.AreEqual(after.DbrowVersion, after.Actions.Single().DbrowVersion);
    }
}
