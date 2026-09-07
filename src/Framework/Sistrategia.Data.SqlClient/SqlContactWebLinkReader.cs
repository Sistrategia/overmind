using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record ContactWebLinkState(int Ordinal, int WebLinkId, string Url, string? Location,
    string? LinkType, string? DisplayText, bool IsPublic, long DbrowVersion, int DisplayOrder)
{
    public bool IsPrincipal => DisplayOrder == 1;
}
public sealed record ContactWebLinkDifference(int Ordinal, string Operation, string? OldUrl, string? Url,
    string? OldLocation, string? Location, string? OldLinkType, string? LinkType,
    string? OldDisplayText, string? DisplayText, bool? OldIsPublic, bool? IsPublic, int? OldDisplayOrder, int? DisplayOrder);
public sealed record ContactWebLinkAction(long DbrowVersion, int ActionOrdinal, int Ordinal, string Operation,
    string Url, string? Location, string? LinkType, string? DisplayText, bool IsPublic, bool ShowInTimeline,
    int PayloadVersion, DateTime RecordedAtUtc, int ActorEntityId, int? PreviousDisplayOrder, int? DisplayOrder);
public sealed record ContactWebLinkRevision(int EntityVersion, long DbrowVersion, string DisplayName, string FullName,
    string? Summary, bool IsPrivate, DateTime? Deleted, DateTime RecordedAtUtc, int ActorEntityId, int EntityTypeId,
    IReadOnlyList<ContactWebLinkState> WebLinks, IReadOnlyList<ContactWebLinkDifference> Differences,
    IReadOnlyList<ContactWebLinkAction> Actions);

/// <summary>Web-link history under the same root barrier as the composed contact reader.</summary>
public sealed class SqlContactWebLinkReader(string connectionString)
{
    public async Task<ContactWebLinkRevision> ReadAsync(Guid contact, Guid authenticatedActor, int entityVersion,
        Guid? tenant = null, int? compareEntityVersion = null, CancellationToken cancellationToken = default) {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        using var command = new SqlCommand("contacts.contact_web_link_read", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
        command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = authenticatedActor;
        command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
        command.Parameters.Add("@entity_version", SqlDbType.Int).Value = entityVersion;
        command.Parameters.Add("@compare_entity_version", SqlDbType.Int).Value = (object?)compareEntityVersion ?? DBNull.Value;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Missing historical root payload.");
        var version = reader.GetInt32(0);
        var stamp = reader.GetInt64(1);
        var displayName = reader.GetString(2);
        var summary = Text(reader, 3);
        var isPrivate = reader.GetBoolean(4);
        DateTime? deleted = reader.IsDBNull(5) ? null : reader.GetDateTime(5);
        var fullName = reader.GetString(6);
        var recordedAt = DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc);
        var actorId = reader.GetInt32(8);
        var typeId = reader.GetInt32(9);
        await reader.NextResultAsync(cancellationToken);
        var rows = await ReadRowsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);
        return new(version, stamp, displayName, fullName, summary, isPrivate, deleted, recordedAt, actorId, typeId,
            rows.States, rows.Differences, rows.Actions);
    }

    internal static async Task<(IReadOnlyList<ContactWebLinkState> States, IReadOnlyList<ContactWebLinkDifference> Differences,
        IReadOnlyList<ContactWebLinkAction> Actions)> ReadRowsAsync(SqlDataReader reader, CancellationToken cancellationToken) {
        var states = new List<ContactWebLinkState>();
        while (await reader.ReadAsync(cancellationToken))
            states.Add(new(reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2), Text(reader, 4), Text(reader, 8),
                Text(reader, 9), reader.GetBoolean(5), reader.GetInt64(6), reader.GetInt32(7)));
        await reader.NextResultAsync(cancellationToken);
        var differences = new List<ContactWebLinkDifference>();
        while (await reader.ReadAsync(cancellationToken))
            differences.Add(new(reader.GetInt32(0), reader.GetString(1), Text(reader, 2), Text(reader, 3), Text(reader, 4),
                Text(reader, 5), Text(reader, 10), Text(reader, 11), Text(reader, 12), Text(reader, 13),
                Flag(reader, 6), Flag(reader, 7), Position(reader, 8), Position(reader, 9)));
        await reader.NextResultAsync(cancellationToken);
        var actions = new List<ContactWebLinkAction>();
        while (await reader.ReadAsync(cancellationToken))
            actions.Add(new(reader.GetInt64(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetString(3), reader.GetString(4),
                Text(reader, 5), Text(reader, 13), Text(reader, 14), reader.GetBoolean(6), reader.GetBoolean(7), reader.GetInt32(8),
                DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc), reader.GetInt32(10), Position(reader, 11), Position(reader, 12)));
        return (states, differences, actions);
    }

    private static string? Text(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
    private static bool? Flag(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetBoolean(i);
    private static int? Position(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetInt32(i);
}
