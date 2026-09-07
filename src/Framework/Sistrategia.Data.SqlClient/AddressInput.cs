using System.Text.Json;

namespace Sistrategia.Data.SqlClient;

/// <summary>Exact complete value; omitted components remain unknown, not inferred from phone data.</summary>
public sealed record AddressValue(
    string? Address1 = null,
    string? Address2 = null,
    string? StreetName = null,
    string? ExtNumber = null,
    string? IntNumber = null,
    string? ZipCode = null,
    string? References = null,
    int? CountryId = null,
    int? StateId = null,
    int? CountyId = null,
    int? CityId = null,
    int? ColonyId = null,
    string? Country = null,
    string? State = null,
    string? County = null,
    string? City = null,
    string? Colony = null);

/// <summary>Input by exact geographic names and/or IDs, resolved consistently by SQL.</summary>
public sealed record AddressInput(
    string? Address1 = null,
    string? Address2 = null,
    string? StreetName = null,
    string? ExtNumber = null,
    string? IntNumber = null,
    string? ZipCode = null,
    string? References = null,
    int? CountryId = null,
    int? StateId = null,
    int? CountyId = null,
    int? CityId = null,
    int? ColonyId = null,
    string? Country = null,
    string? State = null,
    string? County = null,
    string? City = null,
    string? Colony = null)
{
    public void Validate() {
        Check(Address1, 256, nameof(Address1));
        Check(Address2, 256, nameof(Address2));
        Check(StreetName, 256, nameof(StreetName));
        Check(ExtNumber, 25, nameof(ExtNumber));
        Check(IntNumber, 25, nameof(IntNumber));
        Check(ZipCode, 32, nameof(ZipCode));
        Check(References, 256, nameof(References));
        if (CountryId is <= 0) throw new ArgumentException("Geographic IDs must be positive.", nameof(CountryId));
        if (StateId is <= 0) throw new ArgumentException("Geographic IDs must be positive.", nameof(StateId));
        if (CountyId is <= 0) throw new ArgumentException("Geographic IDs must be positive.", nameof(CountyId));
        if (CityId is <= 0) throw new ArgumentException("Geographic IDs must be positive.", nameof(CityId));
        if (ColonyId is <= 0) throw new ArgumentException("Geographic IDs must be positive.", nameof(ColonyId));
        Check(Country, 256, nameof(Country));
        Check(State, 256, nameof(State));
        Check(County, 256, nameof(County));
        Check(City, 256, nameof(City));
        Check(Colony, 256, nameof(Colony));
        if (Country is not null && string.IsNullOrWhiteSpace(Country)) throw new ArgumentException("Geographic names cannot be blank.", nameof(Country));
        if (State is not null && string.IsNullOrWhiteSpace(State)) throw new ArgumentException("Geographic names cannot be blank.", nameof(State));
        if (County is not null && string.IsNullOrWhiteSpace(County)) throw new ArgumentException("Geographic names cannot be blank.", nameof(County));
        if (City is not null && string.IsNullOrWhiteSpace(City)) throw new ArgumentException("Geographic names cannot be blank.", nameof(City));
        if (Colony is not null && string.IsNullOrWhiteSpace(Colony)) throw new ArgumentException("Geographic names cannot be blank.", nameof(Colony));
        if (((Address1 is not null || Address2 is not null) && (StreetName is not null || ExtNumber is not null || IntNumber is not null))
            || ((ExtNumber is not null || IntNumber is not null) && string.IsNullOrWhiteSpace(StreetName)))
            throw new ArgumentException("Use address lines or structured street/number fields; numbers require a street.");
        if (new[] { Address1, Address2, StreetName, ZipCode, Country, State, County, City, Colony }.All(string.IsNullOrWhiteSpace)
            && CountryId is null && StateId is null && CountyId is null && CityId is null && ColonyId is null)
            throw new ArgumentException("An address requires at least one postal component or geographic reference.");
    }

    private static void Check(string? value, int limit, string field) {
        if (value?.Length > limit) throw new ArgumentException($"{field} exceeds {limit} UTF-16 units.", field);
        if (value is null) return;
        for (var i = 0; i < value.Length; i++) {
            if (!char.IsSurrogate(value[i])) continue;
            if (!char.IsHighSurrogate(value[i]) || i + 1 == value.Length || !char.IsLowSurrogate(value[i + 1]))
                throw new ArgumentException("Address text contains an unpaired UTF-16 surrogate.", field);
            i++;
        }
    }

    /// <summary>Validates and serializes the native SQL/constructor contract without rewriting fields.</summary>
    public string PrepareForDatabase() {
        Validate();
        return JsonSerializer.Serialize(this, JsonOptions);
    }
    internal static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
    internal static AddressValue ReadValue(string json) => JsonSerializer.Deserialize<AddressValue>(json, JsonOptions)
        ?? throw new InvalidOperationException("Missing address value payload.");
}
