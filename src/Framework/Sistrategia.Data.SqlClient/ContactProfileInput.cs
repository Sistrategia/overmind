using System.Text.Json;

namespace Sistrategia.Data.SqlClient;

/// <summary>Replacement of the declared profile fields. FullName is explicit; null DisplayName uses FullName.</summary>
public sealed record ContactProfileInput(
    int ContactTypeId,
    string FullName,
    string? DisplayName = null,
    string? LogicalKey = null,
    string? Summary = null,
    string? ImageUrl = null,
    string? ThumbnailUrl = null,
    bool IsPrivate = false,
    bool DoNotContact = false,
    string? PersonTitle = null,
    string? PersonFirstName = null,
    string? PersonLastName = null,
    string? PersonLastName1 = null,
    string? PersonLastName2 = null,
    string? PersonSuffix = null,
    string? PersonAlias = null,
    string? PersonJobTitle = null,
    string? PersonGenderCode = null,
    DateOnly? PersonBirthDate = null,
    string? PersonMaritalStatus = null,
    bool OpenToWork = false,
    bool Recruiting = false,
    bool IsDeceased = false)
{
    public void Validate() {
        if (ContactTypeId is not (1 or 2)) throw new ArgumentException("Only person (1) and organization (2) profiles are supported.");
        if (string.IsNullOrWhiteSpace(FullName) || DisplayName is not null && string.IsNullOrWhiteSpace(DisplayName))
            throw new ArgumentException("Full name and any supplied display name must be nonblank.");
        Check(FullName, 256, nameof(FullName));
        Check(DisplayName, 256, nameof(DisplayName));
        Check(LogicalKey, 256, nameof(LogicalKey));
        Check(Summary, 4096, nameof(Summary));
        Check(ImageUrl, 1024, nameof(ImageUrl));
        Check(ThumbnailUrl, 1024, nameof(ThumbnailUrl));
        Check(PersonTitle, 256, nameof(PersonTitle));
        Check(PersonFirstName, 256, nameof(PersonFirstName));
        Check(PersonLastName, 256, nameof(PersonLastName));
        Check(PersonLastName1, 256, nameof(PersonLastName1));
        Check(PersonLastName2, 256, nameof(PersonLastName2));
        Check(PersonSuffix, 256, nameof(PersonSuffix));
        Check(PersonAlias, 256, nameof(PersonAlias));
        Check(PersonJobTitle, 256, nameof(PersonJobTitle));
        Check(PersonGenderCode, 1, nameof(PersonGenderCode));
        Check(PersonMaritalStatus, 1, nameof(PersonMaritalStatus));

        foreach (var code in new[] { PersonGenderCode, PersonMaritalStatus })
            if (code is not null && (code.Length != 1 || code[0] is < 'A' or > 'Z'))
                throw new ArgumentException("Supplied gender/marital codes must be one uppercase ASCII letter.");
        if (ContactTypeId == 2 && (new[] { PersonTitle, PersonFirstName, PersonLastName, PersonLastName1,
            PersonLastName2, PersonSuffix, PersonAlias, PersonJobTitle, PersonGenderCode, PersonMaritalStatus }.Any(v => v is not null)
            || PersonBirthDate is not null || OpenToWork || IsDeceased) || ContactTypeId == 1 && Recruiting)
            throw new ArgumentException("Person and organization fields must match the contact category.");
    }

    private static void Check(string? value, int limit, string field) {
        if (value?.Length > limit) throw new ArgumentException($"{field} exceeds {limit} UTF-16 units.", field);
        if (value is null) return;
        for (var i = 0; i < value.Length; i++) {
            if (!char.IsSurrogate(value[i])) continue;
            if (!char.IsHighSurrogate(value[i]) || i + 1 == value.Length || !char.IsLowSurrogate(value[i + 1]))
                throw new ArgumentException("Profile text contains an unpaired UTF-16 surrogate.", field);
            i++;
        }
    }

    public string PrepareForDatabase() {
        Validate();
        return JsonSerializer.Serialize(this, JsonOptions);
    }
    internal static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
}

/// <summary>Historical profile including preserved legacy data; relationships themselves are outside this payload.</summary>
public sealed record ContactProfileState(
    int ContactTypeId,
    string FullName,
    string? DisplayName = null,
    string? LogicalKey = null,
    string? Summary = null,
    string? ImageUrl = null,
    string? ThumbnailUrl = null,
    bool IsPrivate = false,
    bool DoNotContact = false,
    string? PersonTitle = null,
    string? PersonFirstName = null,
    string? PersonLastName = null,
    string? PersonLastName1 = null,
    string? PersonLastName2 = null,
    string? PersonSuffix = null,
    string? PersonAlias = null,
    string? PersonJobTitle = null,
    string? PersonGenderCode = null,
    DateOnly? PersonBirthDate = null,
    string? PersonMaritalStatus = null,
    bool? OpenToWork = false,
    bool? Recruiting = false,
    bool? IsDeceased = false,
    string? PersonCompany = null,
    int? PersonBirthCityId = null,
    int? PersonBirthStateId = null,
    int? PersonBirthCountryId = null,
    DateTime? Deleted = null,
    int? DeletedBy = null,
    DateTime? Locked = null,
    int? LockedBy = null,
    DateTime? Validated = null,
    int? ValidatedBy = null);
