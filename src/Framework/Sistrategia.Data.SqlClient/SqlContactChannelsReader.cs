using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record ContactPhoneState(int Ordinal, int PhoneId, PhoneInterpretation Phone, string? Location,
    string? Extension, bool IsPublic, long DbrowVersion, int DisplayOrder)
{
    public bool IsPrincipal => DisplayOrder == 1;
}
public sealed record ContactPhoneDifference(int Ordinal, string Operation, PhoneInterpretation? OldPhone,
    PhoneInterpretation? Phone, string? OldLocation, string? Location, string? OldExtension, string? Extension,
    bool? OldIsPublic, bool? IsPublic, int? OldDisplayOrder, int? DisplayOrder);
public sealed record ContactPhoneAction(long DbrowVersion, int ActionOrdinal, int Ordinal, string Operation,
    PhoneInterpretation Phone, string? Location, string? Extension, bool IsPublic, bool ShowInTimeline,
    int PayloadVersion, DateTime RecordedAtUtc, int ActorEntityId, int? PreviousDisplayOrder, int? DisplayOrder);
public sealed record ContactChannelAction(string Family, int ActionOrdinal, int Ordinal, string Operation,
    ContactEmailAction? Email, ContactPhoneAction? Phone);
public sealed record ContactChannelsRevision(ContactEmailRevision EmailRevision,
    IReadOnlyList<ContactPhoneState> Phones, IReadOnlyList<ContactPhoneDifference> PhoneDifferences,
    IReadOnlyList<ContactPhoneAction> PhoneActions)
{
    public int EntityVersion => EmailRevision.EntityVersion;
    public long DbrowVersion => EmailRevision.DbrowVersion;
    public IReadOnlyList<ContactChannelAction> Actions => EmailRevision.Actions
        .Select(a => new ContactChannelAction("email", a.ActionOrdinal, a.Ordinal, a.Operation, a, null))
        .Concat(PhoneActions.Select(a => new ContactChannelAction("phone", a.ActionOrdinal, a.Ordinal, a.Operation, null, a)))
        .OrderBy(a => a.ActionOrdinal).ToArray();
}

/// <summary>One server-owned read boundary for historical email and phone state, differences and actions.</summary>
public sealed class SqlContactChannelsReader(string connectionString)
{
    public async Task<ContactChannelsRevision> ReadAsync(Guid contact, Guid authenticatedActor, int entityVersion,
        Guid? tenant = null, int? compareEntityVersion = null, CancellationToken cancellationToken = default) {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        using var command = new SqlCommand("contacts.contact_channels_read", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
        command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = authenticatedActor;
        command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
        command.Parameters.Add("@entity_version", SqlDbType.Int).Value = entityVersion;
        command.Parameters.Add("@compare_entity_version", SqlDbType.Int).Value = (object?)compareEntityVersion ?? DBNull.Value;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var email = await SqlContactEmailReader.ReadRowsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);
        var phones = new List<ContactPhoneState>();
        while (await reader.ReadAsync(cancellationToken))
            phones.Add(new(reader.GetInt32(0), reader.GetInt32(1), PhoneParser.Deserialize(reader.GetString(9)),
                Text(reader, 4), Text(reader, 10), reader.GetBoolean(5), reader.GetInt64(6), reader.GetInt32(7)));
        await reader.NextResultAsync(cancellationToken);
        var differences = new List<ContactPhoneDifference>();
        while (await reader.ReadAsync(cancellationToken))
            differences.Add(new(reader.GetInt32(0), reader.GetString(1), Phone(reader, 10), Phone(reader, 11),
                Text(reader, 4), Text(reader, 5), Text(reader, 12), Text(reader, 13), Flag(reader, 6), Flag(reader, 7),
                Position(reader, 8), Position(reader, 9)));
        await reader.NextResultAsync(cancellationToken);
        var actions = new List<ContactPhoneAction>();
        while (await reader.ReadAsync(cancellationToken))
            actions.Add(new(reader.GetInt64(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetString(3),
                PhoneParser.Deserialize(reader.GetString(13)), Text(reader, 5), Text(reader, 14), reader.GetBoolean(6),
                reader.GetBoolean(7), reader.GetInt32(8), DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc),
                reader.GetInt32(10), Position(reader, 11), Position(reader, 12)));
        await reader.NextResultAsync(cancellationToken); // Observe server completion/errors, not only delivered rows.
        return new(email, phones, differences, actions);
    }

    private static string? Text(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
    private static bool? Flag(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetBoolean(i);
    private static int? Position(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetInt32(i);
    private static PhoneInterpretation? Phone(SqlDataReader r, int i) => r.IsDBNull(i) ? null : PhoneParser.Deserialize(r.GetString(i));
}
