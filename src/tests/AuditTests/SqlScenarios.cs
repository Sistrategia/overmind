using static Overmind.AuditTests.AuditDatabase;

namespace Overmind.AuditTests;

// Ported verbatim SQL schedules/assertions from the maintained Python runners at efacebb.
internal static class SqlScenarios
{
    internal const string actor = "71F092F4-3A35-463D-9589-E5EE1373F7D5";
    private const string root2 = "E0000000-0000-0000-0000-000000000002";
    private const string root3 = "E0000000-0000-0000-0000-000000000003";
    internal static async Task NativeConcurrency(AuditDatabase db) {
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            EXEC contacts.email_update @contact_public_key='{{root2}}',@modified_by='{{actor}}',@expected_entity_version=1,@ordinal=1,@email_address=N'winner@example.test';
            {{Signal("email_writer_ready")}}
            {{WaitSignal("email_contender_ready")}}
            COMMIT;
            """,
            $$"""
            SET NOCOUNT ON;
            {{WaitSignal("email_writer_ready")}}
            {{Signal("email_contender_ready")}}
            EXEC dbo.expect_email_error N'EXEC contacts.email_update @contact_public_key=''{{root2}}'',@modified_by=''{{actor}}'',@expected_entity_version=1,@ordinal=1,@email_address=N''loser@example.test'';',51206;
            """);
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            DECLARE @v BIGINT;
            EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
            {{Signal("email_low_ready")}}
            {{WaitSignal("email_high_done")}}
            BEGIN TRY
                EXEC contacts.email_update @contact_public_key='{{root3}}',@modified_by='{{actor}}',@expected_entity_version=1,@ordinal=1,@email_address=N'out_of_order@example.test',@dbrow_version=@v OUTPUT;
                THROW 52000,'Lower allocation changed a later root.',1;
            END TRY BEGIN CATCH
                IF ERROR_NUMBER()<>51204 THROW;
                IF XACT_STATE()<>0 ROLLBACK;
            END CATCH;
            {{Signal("email_low_done")}}
            WAITFOR DELAY '00:00:00.200';
            """,
            $$"""
            SET NOCOUNT ON;
            {{WaitSignal("email_low_ready")}}
            EXEC contacts.email_update @contact_public_key='{{root3}}',@modified_by='{{actor}}',@expected_entity_version=1,@ordinal=1,@email_address=N'later_commit@example.test';
            {{Signal("email_high_done")}}
            {{WaitSignal("email_low_done")}}
            """);
        await db.ConcurrentAsync(new[] { root2, root3 }.Select(root => $$"""
            EXEC contacts.contact_email_insert @contact_public_key='{{root}}',@created_by='{{actor}}',@expected_entity_version=2,
                @email_address=N'shared_miss@example.test',@location_name=N'Shared location';
            """).ToArray());
        await db.ExecuteAsync($$"""
            IF (SELECT COUNT(*) FROM contacts.email WHERE email_address=N'shared_miss@example.test')<>1 THROW 52000,'Catalog miss race duplicated a value.',1;
            """);
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            EXEC contacts.email_update @contact_public_key='{{root2}}',@modified_by='{{actor}}',@expected_entity_version=3,@ordinal=1,@email_address=N'shared_miss@example.test',@location_name=N'Shared location';
            {{Signal("email_hit_ready")}}
            {{WaitSignal("email_hit_committed")}}
            COMMIT;
            {{Signal("email_hit_finished")}}
            WAITFOR DELAY '00:00:00.200';
            """,
            $$"""
            SET NOCOUNT ON;
            {{WaitSignal("email_hit_ready")}}
            EXEC contacts.email_update @contact_public_key='{{root3}}',@modified_by='{{actor}}',@expected_entity_version=3,@ordinal=1,@email_address=N'shared_miss@example.test',@location_name=N'Shared location';
            {{Signal("email_hit_committed")}}
            {{WaitSignal("email_hit_finished")}}
            """);
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            DECLARE @root INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{root2}}'), @v BIGINT, @revision INT;
            EXEC entities.entity_write_lock @root,1,4,@v OUTPUT,@revision OUTPUT;
            {{Signal("email_read_guard_ready")}}
            {{WaitSignal("email_read_guard_checked")}}
            COMMIT;
            {{Signal("email_read_guard_finished")}}
            WAITFOR DELAY '00:00:00.200';
            """,
            $$"""
            SET NOCOUNT ON; SET LOCK_TIMEOUT 500;
            {{WaitSignal("email_read_guard_ready")}}
            DECLARE @read_error INT=0;
            BEGIN TRY
                EXEC contacts.contact_email_read @contact_public_key='{{root2}}',@actor='{{actor}}',@entity_version=4;
            END TRY BEGIN CATCH
                SET @read_error=ERROR_NUMBER();
            END CATCH;
            {{Signal("email_read_guard_checked")}}
            {{WaitSignal("email_read_guard_finished")}}
            IF @read_error<>1222 THROW 52000,'Historical reader entered between root lock and child mutation.',1;
            SET LOCK_TIMEOUT -1;
            EXEC contacts.contact_email_read @contact_public_key='{{root2}}',@actor='{{actor}}',@entity_version=4;
            """);
    }

    internal static async Task DistinctCatalogMisses(AuditDatabase db) {
        string[] roots = ["E0000000-0000-0000-0000-000000000021", "E0000000-0000-0000-0000-000000000022"];
        foreach (var root in roots)
        await db.ExecuteAsync($$"""
            EXEC contacts.contact_insert @public_key='{{root}}',@created_by='{{actor}}',@full_name=N'Gap regression';
            """);
        await db.ExecuteAsync($$"""
            INSERT contacts.email (email_address) VALUES (N'review-gap-m@example.test'); INSERT contacts.email_location (location_name) VALUES (N'review-gap-m');
            """);
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; EXECUTE AS USER='email_app'; BEGIN TRAN; EXEC data.audit_unit_begin;
            EXEC contacts.contact_email_insert @contact_public_key='{{roots[0]}}',@created_by='{{actor}}',@expected_entity_version=1,
                @email_address=N'review-gap-a@example.test',@location_name=N'review-gap-a';
            {{Signal("review_gap_ready")}}
            {{WaitSignal("review_gap_other_done")}}
            COMMIT; REVERT;
            {{Signal("review_gap_finished")}}
            WAITFOR DELAY '00:00:00.200';
            """,
            $$"""
            SET NOCOUNT ON; SET LOCK_TIMEOUT 2000;
            {{WaitSignal("review_gap_ready")}}
            EXECUTE AS USER='email_app';
            EXEC contacts.contact_email_insert @contact_public_key='{{roots[1]}}',@created_by='{{actor}}',@expected_entity_version=1,
                @email_address=N'review-gap-b@example.test',@location_name=N'review-gap-b';
            REVERT;
            {{Signal("review_gap_other_done")}}
            {{WaitSignal("review_gap_finished")}}
            """);
    }

    internal static async Task ReaderFootprint(AuditDatabase db) {
        var lock_check_literal = $$"""
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
            """.Replace("'", "''");
        await db.ExecuteAsync($$"""
            SET NOCOUNT ON;
            DECLARE @i INT=0,@key UNIQUEIDENTIFIER,@target UNIQUEIDENTIFIER;
            WHILE @i<200
            BEGIN
                SET @key=NEWID();
                EXEC contacts.contact_insert @public_key=@key,@created_by='{{actor}}',@full_name=N'Footprint regression',@email_address=N'footprint-regression@example.test';
                IF @i=0 SET @target=@key;
                SET @i+=1;
            END;
            EXEC contacts.email_update @contact_public_key=@target,@modified_by='{{actor}}',@expected_entity_version=1,@ordinal=1,@email_address=N'footprint-updated@example.test';
            DECLARE @definition NVARCHAR(MAX)=OBJECT_DEFINITION(OBJECT_ID('contacts.contact_email_read'));
            -- SQL Server can store CREATE followed by padding in place of OR ALTER.
            -- Preserve the body/comments, changing only the declaration verb for instrumentation/restoration.
            DECLARE @create INT=CHARINDEX(N'CREATE',@definition),@proc INT=CHARINDEX(N'PROCEDURE [contacts].[contact_email_read]',@definition);
            IF @proc=0 THROW 52000,'Reader declaration not found.',1;
            IF @create>0 AND @create<@proc SET @definition=STUFF(@definition,@create,@proc-@create,N'ALTER ');
            DECLARE @instrumented NVARCHAR(MAX)=REPLACE(@definition,N'        COMMIT;',N'{{lock_check_literal}}');
            IF @instrumented=@definition THROW 52000,'Reader lock observation point not found.',1;
            EXEC (@instrumented);
            BEGIN TRY
                EXEC contacts.contact_email_read @contact_public_key=@target,@actor='{{actor}}',@entity_version=2;
            END TRY
            BEGIN CATCH
                EXEC (@definition);
                THROW;
            END CATCH;
            EXEC (@definition);
            """);
    }

    internal static async Task IsolationRejection(AuditDatabase db) {
        await db.ExecuteAsync($$"""
            ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;
            """);
        await db.ExecuteAsync($$"""
            EXEC dbo.expect_email_error N'SET TRANSACTION ISOLATION LEVEL SNAPSHOT; BEGIN TRAN; EXEC data.audit_unit_begin;',51106;
            """);
        await db.ExecuteAsync($$"""
            BEGIN TRY
                EXEC sys.sp_executesql N'BEGIN TRAN; EXEC data.audit_unit_begin; SET TRANSACTION ISOLATION LEVEL SNAPSHOT; DECLARE @v BIGINT; EXEC data.audit_unit_assert @v OUTPUT;';
                THROW 52000,'Post-enrollment SNAPSHOT switch was accepted.',1;
            END TRY
            BEGIN CATCH
                DECLARE @error INT=ERROR_NUMBER();
                IF XACT_STATE()<>0 ROLLBACK;
                IF @error NOT IN (3951,51106) THROW;
            END CATCH;
            """);
    }

    internal static async Task CompetingPromotions(AuditDatabase db) {
        const string root = "E0000000-0000-0000-0000-000000000041";
        await db.ExecuteAsync($$"""
            EXEC contacts.contact_insert @public_key='{{root}}',@created_by='{{actor}}',@full_name=N'Promotion contention';
            """);
        await db.ConcurrentAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            EXEC security.user_insert @public_key='{{root}}',@created_by='{{actor}}',@expected_entity_version=1,
                @login_name=N'promotion-winner',@full_name=NULL;
            {{Signal("promotion_ready")}}
            {{WaitSignal("promotion_contender")}}
            WAITFOR DELAY '00:00:00.500';
            COMMIT;
            """,
            $$"""
            SET NOCOUNT ON;
            {{WaitSignal("promotion_ready")}}
            {{Signal("promotion_contender")}}
            EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''{{root}}'',@created_by=''{{actor}}'',@expected_entity_version=1,
                @login_name=N''promotion-loser'',@full_name=N''Promotion contention'';',51206;
            """);
        await db.ExecuteAsync($$"""
            DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{root}}');
            IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN security.[user] u ON u.user_id=e.entity_id
                WHERE e.entity_id=@id AND e.entity_version=2 AND e.entity_type_id=4 AND u.login_name=N'promotion-winner')
                OR (SELECT COUNT(*) FROM security.user_history WHERE user_id=@id)<>1
                OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>2
                THROW 52000,'Competing promotions produced duplicate account/type history or lost the winner.',1;
            """);
    }

    internal static async Task ConcurrentAllocation(AuditDatabase db) {
        var worker = $$"""
            SET NOCOUNT ON;
            DECLARE @i INT = 0, @v BIGINT;
            WHILE @i < 20
            BEGIN
                BEGIN TRANSACTION;
                EXEC data.audit_unit_begin;
                SET @v = NULL;
                EXEC data.dbrow_version_ensure 1, 1, 1, '20010101', @v OUTPUT;
                COMMIT;
                SET @i += 1;
            END;
            """;
        await db.ConcurrentAsync(worker, worker, worker, worker);
        await db.ExecuteAsync($$"""
            IF (SELECT COUNT(*) FROM data.dbrow_version WHERE modified = '20010101') <> 80
                THROW 52000, 'Concurrent allocation lost ledger entries.', 1;
            IF (SELECT COUNT(DISTINCT dbrow_version) FROM data.dbrow_version WHERE modified = '20010101') <> 80
                THROW 52000, 'Concurrent allocations were not unique.', 1;
            """);
    }

    internal static async Task BootstrapAndCrossDatabaseOwnership(AuditDatabase db) {
        var other_database = await db.CreateAsync();
        await db.LoadSchemaAsync(other_database);
        await db.ExecuteAsync($$"""
            INSERT data.dboperation_type VALUES (1,'INSERT'),(2,'UPDATE'),(3,'DELETE');
            INSERT contacts.contact_type VALUES (1,'person');
            INSERT entities.entity_type VALUES (1,'contact','contacts','contact','contact_view');
            INSERT entities.event_type (code_name) VALUES ('contacts.contact.new'),('security.user.new');
            INSERT data.tenant (public_key,name) VALUES ('F0000000-0000-0000-0000-000000000001',N'Existing unrelated tenant');
            """, other_database);
        BootstrapCases.Run(db.OwnedConnectionString(other_database));
        await db.ExecuteAsync($$"""
            IF NOT EXISTS (SELECT 1 FROM entities.entity WHERE entity_id=1 AND entity_type_id=4 AND tenant_id=2 AND is_system=1)
                THROW 52000,'Bootstrap assumed tenant ID 1 or lost the System identity.',1;
            IF (SELECT COUNT(*) FROM data.dbrow_version)<>1 THROW 52000,'Bootstrap retry allocated another unit.',1;
            EXEC data.tenant_insert @name=N'Another tenant',@actor_entity_id=1;
            EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000001',@created_by='{{actor}}',@full_name=N'Bootstrapped contact',@email_address=N'bootstrap@example.test';
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_history h JOIN entities.entity e ON e.entity_id=h.contact_id WHERE e.tenant_id=2 AND e.entity_version=1)
                THROW 52000,'First email after real bootstrap did not join creation history.',1;
            IF (SELECT COUNT(*) FROM data.dbrow_version)<>3 THROW 52000,'Bootstrap/tenant/business allocation diverged.',1;
            """, other_database);
        await db.ExecuteAsync($$"""
            SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
            DECLARE @v BIGINT;
            EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
            INSERT [{{other_database}}].data.dbrow_version (tenant_id,dbrow_version,dboperation_type_id,modified,modified_by,allocation_transaction_id)
            VALUES (2,@v,2,'20260905',1,CURRENT_TRANSACTION_ID());
            EXEC [{{other_database}}].data.audit_unit_begin;
            BEGIN TRY
                EXEC [{{other_database}}].data.dbrow_version_ensure 2,1,2,'20260905',@v OUTPUT;
                THROW 52000,'Cross-database reuse accepted forged matching hints.',1;
            END TRY BEGIN CATCH
                IF ERROR_NUMBER()<>51103 THROW;
                IF XACT_STATE()<>0 ROLLBACK;
            END CATCH;
            """);
    }
}
