using Sistrategia.Data.SqlClient;

internal static class OrderingCases
{
    public static async Task RunAsync(string connectionString, Guid actor) {
        var reader = new SqlContactEmailReader(connectionString);
        var contact = Guid.Parse("E0000000-0000-0000-0000-000000000020");
        var moved = await reader.ReadAsync(contact, actor, 4, compareEntityVersion: 3);
        if (!moved.Emails.Select(e => e.Ordinal).SequenceEqual([3, 1, 2]) || moved.Emails.Count(e => e.IsPrincipal) != 1
            || moved.Differences.Count != 3 || moved.Differences.Any(d => d.Operation != "move")
            || moved.Actions.Single().PreviousDisplayOrder != 3 || moved.Actions.Single().DisplayOrder != 1)
            throw new Exception("C# reader lost ordered state, moved-row differences or action positions.");
        var reverted = await reader.ReadAsync(contact, actor, 5, compareEntityVersion: 4);
        if (reverted.Differences.Count != 0 || reverted.Actions.Count != 5 || reverted.Actions.Any(a => a.PayloadVersion != 2))
            throw new Exception("Reorder/revert lost intermediate actions or invented a net difference.");
        var deleted = await reader.ReadAsync(contact, actor, 9, compareEntityVersion: 8);
        if (!deleted.Emails.Select(e => e.Ordinal).SequenceEqual([2, 4, 3]) || deleted.Emails[0].DisplayOrder != 1)
            throw new Exception("Deletion/restoration did not preserve the new saved order.");
        await using (var unit = await SqlAuditUnit.BeginAsync(connectionString, actor)) {
            var promoted = await unit.MakeEmailPrincipalAsync(contact, 11, 3);
            var movedBack = await unit.MoveEmailAsync(contact, 11, 3, 3);
            if (promoted.DisplayOrder != 1 || movedBack.DisplayOrder != 3 || promoted.EntityVersion != movedBack.EntityVersion)
                throw new Exception("C# move/promote API failed to compose positions in one revision.");
            await unit.CommitAsync();
        }
        if ((await reader.ReadAsync(contact, actor, 12, compareEntityVersion: 11)).Differences.Count != 0)
            throw new Exception("C# order change/revert did not reconstruct the entry order.");
        Console.WriteLine("PASS C#: saved order, principal selection, position diffs/actions and composed promote/move");
    }
}
