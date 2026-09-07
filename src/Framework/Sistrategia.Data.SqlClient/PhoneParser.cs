using System.Text.Json;
using System.Text.RegularExpressions;
using PhoneNumbers;

namespace Sistrategia.Data.SqlClient;

/// <summary>Country context is explicit for national/split input; it never comes from an address.</summary>
public sealed record PhoneInput(string Number, string? DefaultRegion = null, string? AreaCode = null);

/// <summary>Immutable interpretation snapshot. Geography describes numbering, not contact location.</summary>
public sealed record PhoneInterpretation(string E164, string CountryCallingCode, string NationalNumber,
    string RawInput, string? DefaultRegion, string? AreaInput, string? NumberingRegion,
    string? AreaCode, string? SubscriberNumber, string? GeographicDescription, string ParserVersion);

public static class PhoneParser
{
    public const string MetadataVersion = "libphonenumber-csharp-9.0.38/overmind-1";
    internal static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
    private static readonly PhoneNumberUtil Utility = PhoneNumberUtil.GetInstance();

    public static PhoneInterpretation Parse(PhoneInput input) {
        ArgumentNullException.ThrowIfNull(input);
        if (string.IsNullOrWhiteSpace(input.Number) || input.Number.Length > 256)
            throw new ArgumentException("Phone input must contain 1 to 256 UTF-16 units.", nameof(input));
        var number = input.Number.Trim();
        if (!Regex.IsMatch(number, @"^\+?[0-9 ()\.\-]+$", RegexOptions.CultureInvariant))
            throw new ArgumentException("Enter one phone number; put extensions in the extension field.", nameof(input));
        var region = input.DefaultRegion?.Trim().ToUpperInvariant();
        if (region is not null && !Utility.GetSupportedRegions().Contains(region))
            throw new ArgumentException("Unknown phone parsing region.", nameof(input));
        if (!number.StartsWith('+') && region is null)
            throw new ArgumentException("National phone input requires an explicit parsing country.", nameof(input));
        if (input.AreaCode is not null) {
            if (number.StartsWith('+') || region is null ||
                !Regex.IsMatch(input.AreaCode, "^[0-9]{1,15}$", RegexOptions.CultureInvariant))
                throw new ArgumentException("Split input requires country context and an ASCII area code, without an international number.", nameof(input));
            number = input.AreaCode + " " + number;
        }
        PhoneNumber parsed;
        try { parsed = Utility.Parse(number, region); }
        catch (NumberParseException error) { throw new ArgumentException("Phone input cannot be parsed.", nameof(input), error); }
        if (!Utility.IsValidNumber(parsed) || parsed.HasExtension)
            throw new ArgumentException("Enter a complete number valid under the selected numbering plan.", nameof(input));
        var e164 = Utility.Format(parsed, PhoneNumberFormat.E164);
        if (e164.Length > 16 || (number.StartsWith('+') && "+" + Digits(number) != e164))
            throw new ArgumentException("Phone input requires correction; international digits are never silently removed.", nameof(input));
        var national = Utility.GetNationalSignificantNumber(parsed);
        var numberingRegion = Utility.GetRegionCodeForNumber(parsed);
        if (numberingRegion == "001") numberingRegion = null; // Nongeographic international service.
        var areaLength = Utility.GetLengthOfGeographicalAreaCode(parsed);
        // Mexican destination grouping is retained as a hint, not a current city assertion.
        if (areaLength == 0 && numberingRegion == "MX") areaLength = Utility.GetLengthOfNationalDestinationCode(parsed);
        string? area = areaLength > 0 && areaLength < national.Length ? national[..areaLength] : null;
        if (input.AreaCode is not null && (area is not null ? area != input.AreaCode : !national.StartsWith(input.AreaCode, StringComparison.Ordinal)))
            throw new ArgumentException("Supplied area code disagrees with the parsed national number.", nameof(input));
        area ??= input.AreaCode;
        var description = PhoneNumberOfflineGeocoder.GetInstance().GetDescriptionForNumber(parsed, Locale.English);
        return new(e164, parsed.CountryCode.ToString(System.Globalization.CultureInfo.InvariantCulture), national,
            input.Number, region, input.AreaCode, numberingRegion, area, area is null ? null : national[area.Length..],
            string.IsNullOrEmpty(description) ? null : description, MetadataVersion);
    }

    /// <summary>Prepared SQL input for trusted constructor/import adapters; rejects unresolved input.</summary>
    public static string PrepareForDatabase(PhoneInput input) => Serialize(Parse(input));

    internal static string Serialize(PhoneInterpretation phone) => JsonSerializer.Serialize(phone, JsonOptions);
    internal static PhoneInterpretation Deserialize(string json) => JsonSerializer.Deserialize<PhoneInterpretation>(json, JsonOptions)
        ?? throw new InvalidOperationException("Missing phone interpretation.");
    private static string Digits(string value) => new(value.Where(c => c is >= '0' and <= '9').ToArray());
}
