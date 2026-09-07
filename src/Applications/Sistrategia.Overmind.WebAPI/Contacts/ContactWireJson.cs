using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Sistrategia.Data.SqlClient.Contacts;

namespace Sistrategia.Overmind.WebAPI.Contacts;

public static class ContactWireJson
{
    public const int MaximumBodyBytes = 1024 * 1024;
    internal static readonly IReadOnlyDictionary<string, Type> CommandTypes = new System.Collections.ObjectModel.ReadOnlyDictionary<string, Type>(
        new Dictionary<string, Type> {
            ["profile.replace"] = typeof(ReplaceContactProfile),
            ["contact.delete"] = typeof(DeleteContact),
            ["contact.restore"] = typeof(RestoreContact),
            ["email.insert"] = typeof(InsertContactEmail),
            ["email.replace"] = typeof(ReplaceContactEmail),
            ["email.delete"] = typeof(DeleteContactEmail),
            ["email.restore"] = typeof(RestoreContactEmail),
            ["email.move"] = typeof(MoveContactEmail),
            ["phone.insert"] = typeof(InsertContactPhone),
            ["phone.replace"] = typeof(ReplaceContactPhone),
            ["phone.delete"] = typeof(DeleteContactPhone),
            ["phone.restore"] = typeof(RestoreContactPhone),
            ["phone.move"] = typeof(MoveContactPhone),
            ["web_link.insert"] = typeof(InsertContactWebLink),
            ["web_link.replace"] = typeof(ReplaceContactWebLink),
            ["web_link.delete"] = typeof(DeleteContactWebLink),
            ["web_link.restore"] = typeof(RestoreContactWebLink),
            ["web_link.move"] = typeof(MoveContactWebLink),
            ["address.insert"] = typeof(InsertContactAddress),
            ["address.replace"] = typeof(ReplaceContactAddress),
            ["address.delete"] = typeof(DeleteContactAddress),
            ["address.restore"] = typeof(RestoreContactAddress),
            ["address.move"] = typeof(MoveContactAddress),
        });
    public static JsonSerializerOptions Options { get; } = CreateOptions();
    private static JsonSerializerOptions CreateOptions() { var options = new JsonSerializerOptions(); Configure(options); return options; }
    public static void Configure(JsonSerializerOptions options) {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = false;
        options.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        options.NumberHandling = JsonNumberHandling.Strict;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        options.MaxDepth = 32;
        options.Converters.Add(new CommandConverter());
        options.Converters.Add(new Int64StringConverter());
    }

    public static async Task<T> ReadAsync<T>(HttpRequest request, CancellationToken cancellationToken) {
        if (!string.Equals(request.ContentType?.Split(';')[0].Trim(), "application/json", StringComparison.OrdinalIgnoreCase))
            throw new ContactHttpInputException(415, "json_required");
        if (request.ContentLength > MaximumBodyBytes) throw new ContactHttpInputException(413, "request_too_large");
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        while (true) {
            var count = await request.Body.ReadAsync(chunk, cancellationToken);
            if (count == 0) break;
            if (buffer.Length + count > MaximumBodyBytes) throw new ContactHttpInputException(413, "request_too_large");
            buffer.Write(chunk, 0, count);
        }
        try {
            using var document = JsonDocument.Parse(buffer.ToArray(), new JsonDocumentOptions { MaxDepth = 32 });
            CheckUniqueProperties(document.RootElement);
            return document.RootElement.Deserialize<T>(Options) ?? throw new JsonException();
        } catch (JsonException) { throw new ContactHttpInputException(400, "validation"); }
    }
    private static void CheckUniqueProperties(JsonElement element) {
        if (element.ValueKind == JsonValueKind.Object) {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject()) {
                if (!names.Add(property.Name)) throw new JsonException("Duplicate property.");
                CheckUniqueProperties(property.Value);
            }
        } else if (element.ValueKind == JsonValueKind.Array)
            foreach (var item in element.EnumerateArray()) CheckUniqueProperties(item);
    }

    private sealed class Int64StringConverter : JsonConverter<long>
    {
        public override long Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
            reader.TokenType == JsonTokenType.String && long.TryParse(reader.GetString(), NumberStyles.AllowLeadingSign,
                CultureInfo.InvariantCulture, out var value) ? value : throw new JsonException("Int64 requires a decimal string.");
        public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.ToString(CultureInfo.InvariantCulture));
    }

    private sealed class CommandConverter : JsonConverter<ContactCommand>
    {
        public override ContactCommand Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) {
            using var document = JsonDocument.ParseValue(ref reader);
            if (document.RootElement.ValueKind != JsonValueKind.Object ||
                !document.RootElement.TryGetProperty("kind", out var kind) || kind.ValueKind != JsonValueKind.String)
                throw new JsonException("Command kind is required.");
            if (!CommandTypes.TryGetValue(kind.GetString()!, out var commandType)) throw new JsonException("Unknown command kind.");
            using var buffer = new MemoryStream();
            using (var writer = new Utf8JsonWriter(buffer)) {
                writer.WriteStartObject();
                foreach (var property in document.RootElement.EnumerateObject()) if (property.Name != "kind") property.WriteTo(writer);
                writer.WriteEndObject();
            }
            return (ContactCommand?)JsonSerializer.Deserialize(buffer.ToArray(), commandType, options) ?? throw new JsonException();
        }
        public override void Write(Utf8JsonWriter writer, ContactCommand value, JsonSerializerOptions options) =>
            throw new NotSupportedException("Contact commands are request-only HTTP values.");
    }
}

public sealed record ContactHttpSave(int ExpectedEntityVersion, IReadOnlyList<ContactCommand> Commands);
