using System.Data;
using System.Reflection;
using Microsoft.Data.SqlClient;
using Sistrategia.Data.SqlClient;

internal static class LifetimeCases
{
    private static readonly Guid Root = Guid.Parse("E0000000-0000-0000-0000-000000000023");
    private static readonly Guid BlockedRoot = Guid.Parse("E0000000-0000-0000-0000-000000000024");

    public static async Task RunAsync(string connectionString, Guid actor) {
        await using var probe = new SqlConnection(connectionString);
        await probe.OpenAsync();
        foreach (var root in new[] { Root, BlockedRoot }) {
            using var create = new SqlCommand("contacts.contact_insert", probe) { CommandType = CommandType.StoredProcedure };
            create.Parameters.AddWithValue("@public_key", root);
            create.Parameters.AddWithValue("@created_by", actor);
            create.Parameters.AddWithValue("@full_name", "Lifetime regression");
            create.Parameters.AddWithValue("@email_address", "lifetime-base@example.test");
            await create.ExecuteNonQueryAsync();
        }

        // Deterministic scheduler control only. Production never exposes the gate/connection.
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.UpdateEmailAsync(Root, 1, 1, "must-rollback@example.test");
            var gate = Field<SemaphoreSlim>(unit, "gate");
            await gate.WaitAsync();
            using var cancellation = new CancellationTokenSource();
            var queued = unit.MoveEmailAsync(Root, 1, 1, 1, cancellation.Token);
            var commit = unit.CommitAsync();
            cancellation.Cancel(); // Must mark failure before commit can acquire the released gate.
            gate.Release();
            await Fails<OperationCanceledException>(queued);
            await Fails<InvalidOperationException>(commit);
        }
        await AssertBaseAsync(probe);

        // Real executing command blocked in SQL: both cancellation and disposal must abort earlier work.
        foreach (var cancel in new[] { true, false }) {
            await using var unit = await SqlAuditUnit.BeginAsync(connectionString, actor);
            await unit.UpdateEmailAsync(Root, 1, 1, "must-rollback@example.test");
            await using var blocker = new SqlConnection(connectionString);
            await blocker.OpenAsync();
            using var blockingTransaction = blocker.BeginTransaction();
            using var hold = new SqlCommand("UPDATE entities.entity SET display_name=display_name WHERE public_key=@root; SELECT @@SPID;", blocker, blockingTransaction);
            hold.Parameters.AddWithValue("@root", BlockedRoot);
            var blockerId = Convert.ToInt32(await hold.ExecuteScalarAsync());
            using var cancellation = new CancellationTokenSource();
            var executing = unit.UpdateEmailAsync(BlockedRoot, 1, 1, "blocked-change@example.test", cancellationToken: cancellation.Token);
            await WaitForBlockAsync(probe, blockerId);
            if (cancel) {
                cancellation.Cancel();
                try { await executing.WaitAsync(TimeSpan.FromSeconds(10)); throw new Exception("Executing command ignored cancellation."); }
                catch (OperationCanceledException) { }
                catch (SqlException) when (cancellation.IsCancellationRequested) { }
                await Fails<InvalidOperationException>(unit.CommitAsync());
                blockingTransaction.Rollback();
            } else {
                var dispose = unit.DisposeAsync().AsTask();
                blockingTransaction.Rollback();
                await Fails<InvalidOperationException>(executing);
                await dispose.WaitAsync(TimeSpan.FromSeconds(10));
            }
            await AssertBaseAsync(probe);
        }

        // Terminate only this unit's own disposable-DB session before provider commit.
        // This is not a lost-commit-ack simulation; classification is deliberately conservative.
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            var provisional = await unit.UpdateEmailAsync(Root, 1, 1, "must-rollback@example.test");
            using var identify = new SqlCommand("SELECT @@SPID;",
                Field<SqlConnection>(unit, "connection"), Field<SqlTransaction>(unit, "transaction"));
            var session = Convert.ToInt32(await identify.ExecuteScalarAsync());
            using var terminate = new SqlCommand($"""
                IF NOT EXISTS (SELECT 1 FROM sys.dm_exec_sessions WHERE session_id={session} AND database_id=DB_ID())
                    THROW 52000,'Commit fixture session is outside the disposable database.',1;
                KILL {session};
                """, probe);
            await terminate.ExecuteNonQueryAsync();
            try { await unit.CommitAsync(); throw new Exception("Terminated session accepted commit."); }
            catch (AuditUnitCommitUncertainException error) {
                if (error.DbrowVersion != provisional.DbrowVersion || error.InnerException is not SqlException)
                    throw new Exception("Commit outcome exception lost correlation/original error.");
            }
            await Fails<InvalidOperationException>(unit.CommitAsync());
        }
        await AssertBaseAsync(probe);

        // Commit admitted before a later queued command wins; that command cannot mutate the committed unit.
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.UpdateEmailAsync(Root, 1, 1, "committed-winner@example.test");
            var gate = Field<SemaphoreSlim>(unit, "gate");
            await gate.WaitAsync();
            var commit = unit.CommitAsync();
            var afterCommit = unit.MoveEmailAsync(Root, 1, 1, 1);
            gate.Release();
            await commit.WaitAsync(TimeSpan.FromSeconds(10));
            await Fails<InvalidOperationException>(afterCommit);
        }
        var reader = new SqlContactEmailReader(connectionString);
        if ((await reader.ReadAsync(Root, actor, 2)).Emails.Single().Email != "committed-winner@example.test")
            throw new Exception("Post-commit rejection undid successful prior commit.");
        Console.WriteLine("PASS C#: queued cancellation/commit race, cancellation/disposal during SQL, commit outcome classification and commit-first lifetime");
    }

    private static T Field<T>(SqlAuditUnit unit, string name) =>
        (T)typeof(SqlAuditUnit).GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(unit)!;

    private static async Task Fails<T>(Task task) where T : Exception {
        try { await task.WaitAsync(TimeSpan.FromSeconds(10)); }
        catch (T) { return; }
        throw new Exception($"Expected {typeof(T).Name}.");
    }

    private static async Task WaitForBlockAsync(SqlConnection probe, int blockerId) {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline) {
            using var command = new SqlCommand("SELECT COUNT(*) FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id=@blocker;", probe);
            command.Parameters.AddWithValue("@blocker", blockerId);
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) > 0) return;
            await Task.Delay(20);
        }
        throw new TimeoutException("SQL command did not reach the controlled root lock.");
    }

    private static async Task AssertBaseAsync(SqlConnection probe) {
        using var check = new SqlCommand("""
            IF EXISTS (SELECT 1 FROM entities.entity e JOIN contacts.contact_email c ON c.contact_id=e.entity_id
                JOIN contacts.email v ON v.email_id=c.email_id WHERE e.public_key IN (@root,@blocked)
                AND (e.entity_version<>1 OR v.email_address<>N'lifetime-base@example.test'))
                THROW 52000,'Failed unit left provisional work committed.',1;
            """, probe);
        check.Parameters.AddWithValue("@root", Root);
        check.Parameters.AddWithValue("@blocked", BlockedRoot);
        await check.ExecuteNonQueryAsync();
    }
}
