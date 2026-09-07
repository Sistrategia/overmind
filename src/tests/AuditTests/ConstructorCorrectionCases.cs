using System.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Overmind.AuditTests;

internal static class ConstructorCorrectionCases
{
    private const string Actor = SqlScenarios.actor;

    internal static async Task EligibilityAndPromotion(AuditDatabase db) {
        // The minimal fixtures deliberately omit group metadata; add the real supported category.
        await db.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM contacts.contact_type WHERE contact_type_id=3)
                INSERT contacts.contact_type (contact_type_id,code_name) VALUES (3,N'group');
            """);
        foreach (var category in new[] { 2, 3 }) {
            var key = Guid.NewGuid();
            await db.ExecuteAsync($$"""
                DECLARE @before BIGINT=(SELECT COUNT_BIG(*) FROM data.dbrow_version);
                EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''{{key}}'',
                    @created_by=''{{Actor}}'',@login_name=N''nonperson'',@full_name=N''Nonperson'',
                    @contact_type_id={{category}};',51605;
                IF EXISTS (SELECT 1 FROM entities.entity WHERE public_key='{{key}}')
                    OR (SELECT COUNT_BIG(*) FROM data.dbrow_version)<>@before
                    THROW 52000,'Rejected nonperson construction left committed state.',1;
                EXEC contacts.contact_insert @public_key='{{key}}',@created_by='{{Actor}}',
                    @contact_type_id={{category}},@full_name=N'Nonperson party';
                DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{key}}');
                SET @before=(SELECT COUNT_BIG(*) FROM data.dbrow_version);
                EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''{{key}}'',
                    @created_by=''{{Actor}}'',@login_name=N''nonperson'',@full_name=NULL,
                    @expected_entity_version=1;',51605;
                IF EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@id)
                    OR EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id)
                    OR EXISTS (SELECT 1 FROM entities.entity WHERE entity_id=@id AND (entity_version<>1 OR entity_type_id=4))
                    OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>1
                    OR (SELECT COUNT_BIG(*) FROM data.dbrow_version)<>@before
                    THROW 52000,'Rejected nonperson promotion changed the party or its history.',1;
                """);
        }

        var person = Guid.NewGuid();
        await db.ExecuteAsync($$"""
            EXEC contacts.contact_insert @public_key='{{person}}',@created_by='{{Actor}}',
                @full_name=N'Original person',@email_address=N'original-person@example.test';
            """);
        // Test each unsupported input independently, including empty strings and nondefault switches.
        (string Name, string Value)[] inputs = [
            ("full_name", "N'Changed'"), ("full_name", "N''"),
            ("logical_key", "N'changed'"), ("display_name", "N'Changed'"), ("summary", "N'changed'"),
            ("image_url", "N'image'"), ("thumbnail_url", "N'thumb'"), ("is_private", "1"),
            ("person_title", "N'Dr'"), ("person_first_name", "N'Changed'"),
            ("person_last_name1", "N'Changed'"), ("person_last_name2", "N'Changed'"),
            ("person_suffix", "N'Jr'"), ("person_alias", "N'alias'"),
            ("person_job_title", "N'job'"), ("person_company", "N'Ghost Company'"),
            ("person_gender_code", "'F'"), ("person_birth_date", "'20000101'"),
            ("person_marital_status", "'S'"), ("email_location_name", "N'Work'"),
            ("phone_location_name", "N'Home'"), ("phone_number", "N'1234567'"),
            ("phone_area_code", "N'777'"), ("phone_extension", "N'99'"),
            ("numbers_only", "N'7771234567'"), ("full_phone", "N'777 1234567'"),
            ("address_location_name", "N'Home'"), ("address1", "N'Line 1'"), ("address2", "N'Line 2'"),
            ("zip_code", "N'12345'"), ("city", "N'City'"), ("state", "N'State'"), ("country", "N'Country'"),
            ("auto_create_person_company", "0"), ("auto_create_person_company", "NULL")
        ];
        foreach (var (name, value) in inputs) {
            var fullName = name == "full_name" ? value : "NULL";
            var extra = name == "full_name" ? "" : $",@{name}={value}";
            var call = $"EXEC security.user_insert @public_key='{person}',@created_by='{Actor}'," +
                $"@expected_entity_version=1,@login_name=N'promotion',@full_name={fullName}{extra};";
            // Make a successful child change first, then prove rejected promotion rolls back the unit.
            var batch = $"BEGIN TRAN; EXEC data.audit_unit_begin; " +
                $"EXEC contacts.email_update @contact_public_key='{person}',@modified_by='{Actor}'," +
                "@expected_entity_version=1,@ordinal=1,@email_address=N'rolled-back@example.test'; " + call;
            await db.ExecuteAsync($$"""
                DECLARE @before BIGINT=(SELECT COUNT_BIG(*) FROM data.dbrow_version);
                EXEC dbo.expect_email_error N'{{batch.Replace("'", "''")}}',51606;
                DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{{person}}');
                IF (SELECT COUNT_BIG(*) FROM data.dbrow_version)<>@before
                    OR EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@id)
                    OR EXISTS (SELECT 1 FROM security.user_history WHERE user_id=@id)
                    OR NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=@id AND full_name=N'Original person')
                    OR NOT EXISTS (SELECT 1 FROM entities.entity WHERE entity_id=@id AND entity_version=1)
                    OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>1
                    OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id)<>1
                    OR (SELECT COUNT(*) FROM contacts.contact_email_action WHERE contact_id=@id)<>1
                    OR NOT EXISTS (SELECT 1 FROM contacts.contact_email c JOIN contacts.email e ON e.email_id=c.email_id
                        WHERE c.contact_id=@id AND e.email_address=N'original-person@example.test')
                    THROW 52000,'Rejected promotion failed to roll back earlier contact work.',1;
                """);
        }

        await db.ExecuteAsync($$"""
            DECLARE @v BIGINT,@r INT,@id INT;
            EXEC security.user_insert @public_key='{{person}}',@created_by='{{Actor}}',
                @expected_entity_version=1,@login_name=N'valid-promotion',@full_name=NULL,
                @email=N'account-only@example.test',@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT,@user_id=@id OUTPUT;
            IF @r<>2 OR NOT EXISTS (SELECT 1 FROM security.[user] WHERE user_id=@id AND email=N'account-only@example.test' AND email_confirmed=0)
                OR NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=@id AND full_name=N'Original person')
                OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE contact_id=@id)<>1
                THROW 52000,'Valid account-only promotion changed the contact or failed.',1;

            DECLARE @new UNIQUEIDENTIFIER=NEWID(),@start DATETIME2=SYSUTCDATETIME();
            SET @v=NULL;
            EXEC security.user_insert @public_key=@new,@created_by='{{Actor}}',@login_name=N'name-default',@full_name=NULL,
                @created='20070615',@dbrow_version=@v OUTPUT,@user_id=@id OUTPUT;
            IF NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=@id AND full_name=N'name-default' AND contact_type_id=1)
                OR NOT EXISTS (SELECT 1 FROM entities.entity WHERE entity_id=@id AND entity_type_id=4 AND entity_version=1)
                OR NOT EXISTS (SELECT 1 FROM entities.event ev JOIN data.dbrow_version v ON v.dbrow_version=ev.dbrow_version
                    WHERE ev.subject_id=@id AND ev.dbrow_version=@v AND ev.created='20070615'
                        AND v.modified='20070615' AND v.recorded_at>=@start)
                THROW 52000,'New person defaults or occurrence/recording clocks are incorrect.',1;
            """);
        Console.WriteLine($"PASS constructor: persons only, {inputs.Length} individual promotion inputs, whole rollback and occurrence clocks.");
    }

    internal static async Task CompanyConcurrency(AuditDatabase db) {
        // Assertions derive equality from this database's actual collation, not .NET comparison rules.
        foreach (var (left, right) in new[] {
            ("Iteration Equal", "Iteration Equal"), ("Iteration Case", "ITERATION CASE"),
            ("Iteration Space", "Iteration Space   "), ("Iteration Café", "Iteration Cafe"),
            ("Iteration Distinct A", "Iteration Distinct B"),
            ("Iteration Dash", "Iteration D-ash") // CHECKSUM collision must not merge different names.
        }) {
            await CompanyPair(db, left, right);
        }
        await db.ExecuteAsync("""
            EXECUTE AS USER='email_app';
            BEGIN TRY
                DECLARE @company INT;
                EXEC contacts.contact_company_lookup 1,N'private',@company OUTPUT;
                THROW 52000,'Runtime can call the private company helper.',1;
            END TRY
            BEGIN CATCH
                IF ERROR_NUMBER()<>229 THROW;
            END CATCH;
            REVERT;
            """);
    }

    private static async Task CompanyPair(AuditDatabase db, string left, string right) {
        await using var holder = new SqlConnection(db.ConnectionString);
        await using var contender = new SqlConnection(db.ConnectionString);
        await using var observer = new SqlConnection(db.ConnectionString);
        await holder.OpenAsync();
        await contender.OpenAsync();
        await observer.OpenAsync();
        using var compare = new SqlCommand("""
            SELECT CASE WHEN @left=@right THEN 1 ELSE 0 END,
                CASE WHEN CHECKSUM(@left)=CHECKSUM(@right) THEN 1 ELSE 0 END;
            """, observer);
        compare.Parameters.Add("@left", System.Data.SqlDbType.NVarChar, 256).Value = left;
        compare.Parameters.Add("@right", System.Data.SqlDbType.NVarChar, 256).Value = right;
        bool equal, collision;
        await using (var row = await compare.ExecuteReaderAsync()) {
            await row.ReadAsync();
            equal = row.GetInt32(0) == 1;
            collision = row.GetInt32(1) == 1;
        }
        using var sidA = new SqlCommand("SELECT @@SPID;", holder);
        using var sidB = new SqlCommand("SELECT @@SPID;", contender);
        var holderId = Convert.ToInt32(await sidA.ExecuteScalarAsync());
        var contenderId = Convert.ToInt32(await sidB.ExecuteScalarAsync());
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        using var begin = new SqlCommand("BEGIN TRAN; EXEC data.audit_unit_begin;", holder);
        await begin.ExecuteNonQueryAsync();
        using var firstCommand = CreateCompanyUser(holder, first, left);
        using var secondCommand = CreateCompanyUser(contender, second, right);
        await firstCommand.ExecuteNonQueryAsync();
        Task<int>? secondTask = null;
        var watch = Stopwatch.StartNew();
        try {
            secondTask = secondCommand.ExecuteNonQueryAsync();
            if (equal || collision) {
                using var blocked = new SqlCommand("SELECT COUNT(*) FROM sys.dm_exec_requests WHERE session_id=@b AND blocking_session_id=@a;", observer);
                blocked.Parameters.AddWithValue("@a", holderId);
                blocked.Parameters.AddWithValue("@b", contenderId);
                var observed = false;
                while (watch.Elapsed < TimeSpan.FromSeconds(5)) {
                    if (Convert.ToInt32(await blocked.ExecuteScalarAsync()) == 1) { observed = true; break; }
                    if (secondTask.IsCompleted) break;
                    await Task.Delay(25);
                }
                Assert.IsTrue(observed, $"Expected company-name serialization for {left} / {right}.");
            } else {
                // The second distinct name must commit while the first transaction remains open.
                try {
                    await secondTask.WaitAsync(TimeSpan.FromSeconds(5));
                } catch (TimeoutException) {
                    using var diagnostic = new SqlCommand("""
                        SELECT r.wait_type,r.wait_resource,t.text
                        FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
                        WHERE r.session_id=@session;
                        """, observer);
                    diagnostic.Parameters.AddWithValue("@session", contenderId);
                    await using var waiting = await diagnostic.ExecuteReaderAsync();
                    while (await waiting.ReadAsync())
                        Console.WriteLine($"Unexpected wait for {left} / {right}: {waiting.GetValue(0)} / {waiting.GetValue(1)} / {waiting.GetValue(2)}");
                    throw;
                }
            }
            using var commit = new SqlCommand("COMMIT;", holder);
            await commit.ExecuteNonQueryAsync();
            await secondTask;
        } finally {
            using var rollback = new SqlCommand("IF XACT_STATE()<>0 ROLLBACK;", holder);
            await rollback.ExecuteNonQueryAsync();
            if (secondTask is not null) await secondTask;
        }
        using var check = new SqlCommand("""
            SELECT r.to_contact_id
            FROM contacts.contact_relationship r
            JOIN entities.entity e ON e.entity_id=r.from_contact_id
            WHERE e.public_key IN (@first,@second)
            ORDER BY e.public_key;
            """, observer);
        check.Parameters.AddWithValue("@first", first);
        check.Parameters.AddWithValue("@second", second);
        var companies = new List<int>();
        await using (var rows = await check.ExecuteReaderAsync()) {
            while (await rows.ReadAsync()) companies.Add(rows.GetInt32(0));
        }
        Assert.AreEqual(2, companies.Count);
        Assert.AreEqual(equal ? 1 : 2, companies.Distinct().Count(), "Lock collisions must never define company identity.");

        // A third caller must still succeed; the old race poisoned subsequent construction with 51313.
        using var third = CreateCompanyUser(observer, Guid.NewGuid(), left);
        await third.ExecuteNonQueryAsync();
        Console.WriteLine($"Company pair {left} / {right}: equal={equal}, bucketEqual={collision}, elapsed={watch.ElapsedMilliseconds}ms; completedBeforeHolderCommit={!equal && !collision}.");
    }

    private static SqlCommand CreateCompanyUser(SqlConnection connection, Guid key, string company) {
        var command = new SqlCommand($$"""
            EXEC security.user_insert @public_key=@key,@created_by='{{Actor}}',
                @login_name=@login,@full_name=N'Company concurrency user',@person_company=@company;
            """, connection) { CommandTimeout = 15 };
        command.Parameters.AddWithValue("@key", key);
        command.Parameters.Add("@login", System.Data.SqlDbType.NVarChar, 256).Value = key.ToString("N");
        command.Parameters.Add("@company", System.Data.SqlDbType.NVarChar, 256).Value = company;
        return command;
    }
}
