using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record ContactAddressState(int Ordinal, int AddressId, AddressValue Address, string? Location,
    bool IsPublic, long DbrowVersion, int DisplayOrder)
{
    public bool IsPrincipal => DisplayOrder == 1;
}
public sealed record ContactAddressDifference(int Ordinal, string Operation, AddressValue? OldAddress, AddressValue? Address,
    string? OldLocation, string? Location, bool? OldIsPublic, bool? IsPublic, int? OldDisplayOrder, int? DisplayOrder);
public sealed record ContactAddressAction(long DbrowVersion, int ActionOrdinal, int Ordinal, string Operation,
    AddressValue Address, string? Location, bool IsPublic, bool ShowInTimeline,
    int PayloadVersion, DateTime RecordedAtUtc, int ActorEntityId, int? PreviousDisplayOrder, int? DisplayOrder);
public sealed record ContactAddressRevision(int EntityVersion, long DbrowVersion, string DisplayName, string FullName,
    string? Summary, bool IsPrivate, DateTime? Deleted, DateTime RecordedAtUtc, int ActorEntityId, int EntityTypeId,
    IReadOnlyList<ContactAddressState> Addresses, IReadOnlyList<ContactAddressDifference> Differences,
    IReadOnlyList<ContactAddressAction> Actions);

/// <summary>Address history under the same root barrier as the composed contact reader.</summary>
public sealed class SqlContactAddressReader(string connectionString)
{
    public async Task<ContactAddressRevision> ReadAsync(Guid contact, Guid authenticatedActor, int entityVersion,
        Guid? tenant = null, int? compareEntityVersion = null, CancellationToken cancellationToken = default) {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        using var command = new SqlCommand("contacts.contact_address_read", connection) { CommandType = CommandType.StoredProcedure };
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

    internal static async Task<(IReadOnlyList<ContactAddressState> States, IReadOnlyList<ContactAddressDifference> Differences,
        IReadOnlyList<ContactAddressAction> Actions)> ReadRowsAsync(SqlDataReader reader, CancellationToken cancellationToken) {
        var states = new List<ContactAddressState>();
        while (await reader.ReadAsync(cancellationToken))
            states.Add(new(reader.GetInt32(0), reader.GetInt32(1), AddressInput.ReadValue(reader.GetString(2)), Text(reader, 4),
                reader.GetBoolean(5), reader.GetInt64(6), reader.GetInt32(7)));
        await reader.NextResultAsync(cancellationToken);
        var differences = new List<ContactAddressDifference>();
        while (await reader.ReadAsync(cancellationToken))
            differences.Add(new(reader.GetInt32(0), reader.GetString(1), Value(reader, 2), Value(reader, 3), Text(reader, 4),
                Text(reader, 5), Flag(reader, 6), Flag(reader, 7), Position(reader, 8), Position(reader, 9)));
        await reader.NextResultAsync(cancellationToken);
        var actions = new List<ContactAddressAction>();
        while (await reader.ReadAsync(cancellationToken))
            actions.Add(new(reader.GetInt64(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetString(3), AddressInput.ReadValue(reader.GetString(4)),
                Text(reader, 5), reader.GetBoolean(6), reader.GetBoolean(7), reader.GetInt32(8),
                DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc), reader.GetInt32(10), Position(reader, 11), Position(reader, 12)));
        return (states, differences, actions);
    }

    private static AddressValue? Value(SqlDataReader r, int i) => r.IsDBNull(i) ? null : AddressInput.ReadValue(r.GetString(i));
    private static string? Text(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
    private static bool? Flag(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetBoolean(i);
    private static int? Position(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetInt32(i);
}
