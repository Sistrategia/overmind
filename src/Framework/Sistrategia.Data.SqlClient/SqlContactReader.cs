using System.Text.Json;

namespace Sistrategia.Data.SqlClient;

public sealed record ContactProfileDifference(ContactProfileState OldProfile, ContactProfileState Profile);
public sealed record ContactProfileAction(int ActionOrdinal, string Operation, ContactProfileState Profile,
    int PayloadVersion, DateTime RecordedAtUtc, int ActorEntityId);
public sealed record ContactAction(string Family, int ActionOrdinal, int? Ordinal, string Operation,
    ContactChannelAction? Channel, ContactProfileAction? Profile);
public sealed record ContactRevision(ContactChannelsRevision Channels, ContactProfileState Profile,
    IReadOnlyList<ContactProfileDifference> ProfileDifferences, IReadOnlyList<ContactProfileAction> ProfileActions)
{
    public int EntityVersion => Channels.EntityVersion;
    public long DbrowVersion => Channels.DbrowVersion;
    public IReadOnlyList<ContactAction> Actions => Channels.Actions
        .Select(a => new ContactAction(a.Family, a.ActionOrdinal, a.Ordinal, a.Operation, a, null))
        .Concat(ProfileActions.Select(a => new ContactAction("contact", a.ActionOrdinal, null, a.Operation, null, a)))
        .OrderBy(a => a.ActionOrdinal).ToArray();
}
internal sealed record ContactReadParts(ContactChannelsRevision Channels, ContactProfileState? Profile,
    IReadOnlyList<ContactProfileDifference> Differences, IReadOnlyList<ContactProfileAction> Actions);

/// <summary>Declared profile plus all child families under one server-owned root barrier.</summary>
public sealed class SqlContactReader(string connectionString)
{
    public async Task<ContactRevision> ReadAsync(Guid contact, Guid authenticatedActor, int entityVersion, Guid tenant,
        int? compareEntityVersion = null, CancellationToken cancellationToken = default) {
        var result = await new SqlContactChannelsReader(connectionString).ReadCoreAsync(contact, authenticatedActor,
            entityVersion, tenant, compareEntityVersion, cancellationToken, includeProfile: true);
        return new(result.Channels, result.Profile ?? throw new InvalidOperationException("Missing complete profile history."),
            result.Differences, result.Actions);
    }
    internal static ContactProfileState Parse(string json) {
        var profile = JsonSerializer.Deserialize<ContactProfileState>(json, ContactProfileInput.JsonOptions)
            ?? throw new InvalidOperationException("Missing profile payload.");
        return profile with { Deleted = Utc(profile.Deleted), Locked = Utc(profile.Locked), Validated = Utc(profile.Validated) };
    }
    private static DateTime? Utc(DateTime? value) => value is null ? null : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
}
