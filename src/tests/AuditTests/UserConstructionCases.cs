using Sistrategia.Data.SqlClient;

internal static class UserConstructionCases
{
    public static async Task RunAsync(string connectionString) {
        var actor = Guid.Parse("E0000000-0000-0000-0000-000000000031");
        var promoted = Guid.Parse("E0000000-0000-0000-0000-000000000033");
        var reader = new SqlContactEmailReader(connectionString);
        var before = await reader.ReadAsync(promoted, actor, 1);
        var after = await reader.ReadAsync(promoted, actor, 2, compareEntityVersion: 1);
        if (before.EntityTypeId == 4 || after.EntityTypeId != 4 || before.FullName != after.FullName
            || after.Differences.Count != 0 || after.Emails.Single().Email != "preserved-contact@example.test")
            throw new Exception("Promotion replaced historical type/contact state with current payload.");

        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, promoted)) {
            await unit.InsertEmailAsync(promoted, 2, "promoted-actor@example.test");
            await unit.CommitAsync();
        }
        var edited = await reader.ReadAsync(promoted, promoted, 3);
        if (edited.EntityTypeId != 4 || edited.Emails.Count != 2 || edited.ActorEntityId != edited.Actions.Single().ActorEntityId)
            throw new Exception("Promoted ordinary user cannot perform attributed C# email operations.");
        Console.WriteLine("PASS C#: historical type before/after promotion and ordinary promoted actor without System substitution");
    }
}
