using Microsoft.Data.SqlClient;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

internal static class SharedUnitCases
{
    internal static async Task RunAsync(string connectionString) {
        var actor = Guid.Parse("71F092F4-3A35-463D-9589-E5EE1373F7D5");
        var contact = Guid.Parse("E0000000-0000-0000-0000-000000000004");
        var reader = new SqlContactEmailReader(connectionString);
        static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
        
        EmailWriteResult inserted;
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            inserted = await unit.InsertEmailAsync(contact, 1, "first@example.test", "Home");
            var changed = await unit.UpdateEmailAsync(contact, 1, inserted.Ordinal, "second@example.test", isPublic: true);
            Check(changed.DbrowVersion == inserted.DbrowVersion && changed.EntityVersion == 2, "Unit did not compose.");
            await unit.CommitAsync();
            try { await unit.DeleteEmailAsync(contact, 1, inserted.Ordinal); throw new Exception("Completed unit accepted another command."); }
            catch (InvalidOperationException) { }
        }
        var revision = await reader.ReadAsync(contact, actor, 2, compareEntityVersion: 1);
        Check(revision.DisplayName == "Csharp email" && revision.Emails.Single().Email == "second@example.test", "Historical payload mismatch.");
        Check(revision.Emails.Single().Location is null && revision.Emails.Single().IsPublic, "Replacement/visibility mismatch.");
        Check(revision.Differences.Single().Operation == "insert", "Revision diff failed.");
        Check(revision.Actions.Count == 2 && revision.Actions[0].Email == "first@example.test", "Intermediate action values missing.");
        Check(revision.ActorEntityId == 1 && revision.RecordedAtUtc.Kind == DateTimeKind.Utc && revision.Actions.All(a => a.ActorEntityId == 1), "Audit attribution/time missing from reader.");
        Check((await reader.ReadAsync(contact, actor, 1)).Emails.Count == 0, "Older revision contains later email.");
        
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.UpdateEmailAsync(contact, 2, inserted.Ordinal, "discarded@example.test");
            // No commit: disposal is the owner's rollback.
        }
        Check((await reader.ReadAsync(contact, actor, 2)).Emails.Single().Email == "second@example.test", "Dispose did not roll back.");
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.UpdateEmailAsync(contact, 2, inserted.Ordinal, "also-discarded@example.test");
            try { await unit.DeleteEmailAsync(contact, 2, 999); throw new Exception("Missing child accepted."); }
            catch (SqlException ex) when (ex.Number == 51306) { }
            try { await unit.CommitAsync(); throw new Exception("Failed unit could commit."); }
            catch (InvalidOperationException) { }
        }
        Check((await reader.ReadAsync(contact, actor, 2)).Emails.Single().Email == "second@example.test", "Failure did not roll back whole unit.");
        
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.UpdateEmailAsync(contact, 2, inserted.Ordinal, "cancelled@example.test");
            using var cancellation = new CancellationTokenSource();
            cancellation.Cancel();
            try { await unit.DeleteEmailAsync(contact, 2, inserted.Ordinal, cancellation.Token); throw new Exception("Cancelled command ran."); }
            catch (OperationCanceledException) { }
            try { await unit.CommitAsync(); throw new Exception("Cancelled unit could commit prior work."); }
            catch (InvalidOperationException) { }
        }
        Check((await reader.ReadAsync(contact, actor, 2)).Emails.Single().Email == "second@example.test", "Cancellation retained provisional work.");
        
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            await unit.DeleteEmailAsync(contact, 2, inserted.Ordinal);
            await unit.CommitAsync();
        }
        var deleted = await reader.ReadAsync(contact, actor, 3, compareEntityVersion: 2);
        Check(deleted.Emails.Count == 0 && deleted.Differences.Single().Operation == "delete", "Delete reconstruction/diff failed.");
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            var restored = await unit.RestoreEmailAsync(contact, 3, inserted.Ordinal, "restored@example.test", "Office");
            Check(restored.Ordinal == inserted.Ordinal, "Restore changed child identity.");
            await unit.CommitAsync();
        }
        Check((await reader.ReadAsync(contact, actor, 4)).Emails.Single().Email == "restored@example.test", "Committed restore failed.");
        try { await reader.ReadAsync(contact, actor, 999); throw new Exception("Unknown revision looked empty."); }
        catch (SqlException ex) when (ex.Number == 51401) { }
        
        var olderContact = Guid.Parse("E0000000-0000-0000-0000-000000000001");
        var original = await reader.ReadAsync(olderContact, actor, 1);
        var later = await reader.ReadAsync(olderContact, actor, 8, compareEntityVersion: 7);
        Check(original.DisplayName == "Email reference" && original.Deleted is null, "Historical view substituted current root fields.");
        Check(later.DisplayName == "Later renamed contact" && later.Deleted is not null && later.Emails.Count == 3 && later.Differences.Count == 0,
            "Root deletion/unchanged child reconstruction failed.");
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            try { await unit.DeleteEmailAsync(olderContact, 8, 1); throw new Exception("Deleted root accepted an ordinary child write."); }
            catch (SqlException ex) when (ex.Number == 51203) { }
        }
        
        Console.WriteLine("PASS C#: shared unit, provisional outputs, historical reader/diff/actions, disposal, failed-unit lifetime, delete/restore, unknown revision");
    }
}
