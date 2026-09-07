using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class DeadlockCases
{
    internal static async Task RunAsync(AuditDatabase db, Guid actor) {
        Guid[] roots = [Guid.Parse("E0000000-0000-0000-0000-000000000052"), Guid.Parse("E0000000-0000-0000-0000-000000000053")];
        string[] values = ["deadlock-left@example.test", "deadlock-right@example.test"];
        foreach (var root in roots)
            await db.ExecuteAsync($$"""
                EXEC contacts.contact_insert @public_key='{{root}}',@created_by='{{actor}}',
                    @full_name=N'Deadlock regression',@email_address=N'deadlock-base@example.test';
                """);
        // Existing dictionary values isolate the intended root cycle from catalog miss contention.
        await db.ExecuteAsync("INSERT contacts.email(email_address) VALUES (N'deadlock-left@example.test'),(N'deadlock-right@example.test');");
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        await using var left = await SqlAuditUnit.BeginAsync(db.ConnectionString, actor, cancellationToken: timeout.Token);
        await using var right = await SqlAuditUnit.BeginAsync(db.ConnectionString, actor, cancellationToken: timeout.Token);
        SqlAuditUnit[] units = [left, right];
        var firstLeft = await left.UpdateEmailAsync(roots[0], 1, 1, values[0], cancellationToken: timeout.Token);
        var firstRight = await right.UpdateEmailAsync(roots[1], 1, 1, values[1], cancellationToken: timeout.Token);
        long[] provisional = [firstLeft.DbrowVersion!.Value, firstRight.DbrowVersion!.Value];
        Assert.AreNotEqual(provisional[0], provisional[1]);

        // Both first writes have returned, so each transaction retains a DIFFERENT root X lock.
        // Neither commits until its opposite-root command returns. No sleeps or chosen victim.
        async Task<Exception?> Finish(int index) {
            try {
                var second = await units[index].UpdateEmailAsync(roots[1-index], 1, 1, values[index], cancellationToken: timeout.Token);
                Assert.AreEqual(provisional[index], second.DbrowVersion);
                Assert.AreEqual(2, second.EntityVersion);
                await units[index].CommitAsync(timeout.Token);
                return null;
            } catch (Exception error) { return error; }
        }
        // Capture and observe every result, including unexpected errors/cancellations.
        var outcomes = await Task.WhenAll(Finish(0), Finish(1));
        Assert.AreEqual(1, outcomes.Count(error => error is null), Describe(outcomes));
        Assert.AreEqual(1, outcomes.Count(error => error is SqlException { Number: 1205 }), Describe(outcomes));
        var victim = Array.FindIndex(outcomes, error => error is SqlException { Number: 1205 });
        var winner = 1-victim;
        Assert.IsNull(units[victim].DbrowVersion, "Failed unit retained a provisional version.");
        await RejectInactive(units[victim].UpdateEmailAsync(roots[0], 2, 1, values[victim], cancellationToken: timeout.Token));
        await RejectInactive(units[victim].CommitAsync(timeout.Token));
        await CheckCommitted(db, roots, 2, provisional[winner], provisional[victim]);
        await CheckHistory(db, roots, actor, 2, provisional[winner], values[winner]);

        // Application retry is explicit: a NEW unit, refreshed committed entry versions, new allocation.
        var reader = new SqlContactEmailReader(db.ConnectionString);
        var entry = new[] {
            await reader.ReadAsync(roots[0], actor, 2, cancellationToken: timeout.Token),
            await reader.ReadAsync(roots[1], actor, 2, cancellationToken: timeout.Token)
        };
        await using var retry = await SqlAuditUnit.BeginAsync(db.ConnectionString, actor, cancellationToken: timeout.Token);
        var retried = await retry.UpdateEmailAsync(roots[victim], entry[victim].EntityVersion, 1, values[victim], cancellationToken: timeout.Token);
        var other = await retry.UpdateEmailAsync(roots[winner], entry[winner].EntityVersion, 1, values[victim], cancellationToken: timeout.Token);
        Assert.AreEqual(retried.DbrowVersion, other.DbrowVersion);
        Assert.AreEqual(3, retried.EntityVersion);
        Assert.AreEqual(3, other.EntityVersion);
        Assert.IsTrue(retried.DbrowVersion > provisional.Max(), "Fresh unit reused a previous allocation.");
        await retry.CommitAsync(timeout.Token);
        await CheckCommitted(db, roots, 3, retried.DbrowVersion!.Value, provisional[victim]);
        await CheckHistory(db, roots, actor, 2, provisional[winner], values[winner]);
        await CheckHistory(db, roots, actor, 3, retried.DbrowVersion.Value, values[victim]);
        Console.WriteLine($"PASS C#: actual SQL 1205 victim {victim+1}; whole rollback, surviving history, inactive victim, explicit fresh retry");
    }

    private static string Describe(Exception?[] outcomes) => string.Join("; ", outcomes.Select((error, index) => $"Participant {index+1}: {error?.ToString() ?? "committed"}"));

    private static async Task RejectInactive(Task task) {
        try { await task; }
        catch (InvalidOperationException) { return; }
        Assert.Fail("A deadlock victim accepted another command/commit.");
    }

    private static Task CheckCommitted(AuditDatabase db, Guid[] roots, int revision, long version, long rolledBack) => db.ExecuteAsync($$"""
        IF EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version={{rolledBack}})
            OR EXISTS (SELECT 1 FROM entities.entity_version_history WHERE dbrow_version={{rolledBack}})
            OR EXISTS (SELECT 1 FROM entities.entity_history WHERE dbrow_version={{rolledBack}})
            OR EXISTS (SELECT 1 FROM contacts.contact_history WHERE dbrow_version={{rolledBack}})
            OR EXISTS (SELECT 1 FROM contacts.contact_email_history WHERE dbrow_version={{rolledBack}})
            OR EXISTS (SELECT 1 FROM contacts.contact_email_action WHERE dbrow_version={{rolledBack}})
            THROW 52000,'Deadlock victim left provisional ledger/history/actions.',1;
        IF (SELECT COUNT(*) FROM entities.entity WHERE public_key IN ('{{roots[0]}}','{{roots[1]}}') AND entity_version={{revision}} AND dbrow_version={{version}})<>2
            OR (SELECT COUNT(*) FROM data.dbrow_version WHERE dbrow_version={{version}})<>1
            OR (SELECT COUNT(*) FROM entities.entity_version_history WHERE dbrow_version={{version}})<>2
            OR (SELECT COUNT(*) FROM contacts.contact_email_history WHERE dbrow_version={{version}} AND dboperation_type_id=2)<>2
            OR (SELECT COUNT(*) FROM contacts.contact_email_action WHERE dbrow_version={{version}} AND operation='update')<>2
            THROW 52000,'Committed multi-root unit lost current rows, spine or final email evidence.',1;
        """);

    private static async Task CheckHistory(AuditDatabase db, Guid[] roots, Guid actor, int revision, long version, string value) {
        var reader = new SqlContactEmailReader(db.ConnectionString);
        foreach (var root in roots) {
            var state = await reader.ReadAsync(root, actor, revision, compareEntityVersion: revision-1);
            Assert.AreEqual(version, state.DbrowVersion);
            Assert.AreEqual(value, state.Emails.Single().Email);
            Assert.AreEqual(value, state.Actions.Single().Email);
            Assert.AreEqual(version, state.Actions.Single().DbrowVersion);
            Assert.AreEqual("update", state.Differences.Single().Operation);
            var birth = await reader.ReadAsync(root, actor, 1);
            Assert.AreEqual("deadlock-base@example.test", birth.Emails.Single().Email);
        }
    }
}
