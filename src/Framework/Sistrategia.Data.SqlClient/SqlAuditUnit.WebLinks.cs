using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record WebLinkWriteResult(int Ordinal, int WebLinkId, int EntityVersion, long? DbrowVersion, int? DisplayOrder);

public sealed partial class SqlAuditUnit
{
    public Task<WebLinkWriteResult> InsertWebLinkAsync(Guid contact, int expectedEntityVersion, WebLinkInput webLink,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeWebLinkAsync("insert", contact, expectedEntityVersion, null, webLink, location, isPublic, cancellationToken);

    /// <summary>Replaces URL and all association metadata. Null optional values explicitly clear them.</summary>
    public Task<WebLinkWriteResult> UpdateWebLinkAsync(Guid contact, int expectedEntityVersion, int ordinal, WebLinkInput webLink,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeWebLinkAsync("update", contact, expectedEntityVersion, ordinal, webLink, location, isPublic, cancellationToken);

    public Task<WebLinkWriteResult> DeleteWebLinkAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) =>
        ChangeWebLinkAsync("delete", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken);

    public Task<WebLinkWriteResult> RestoreWebLinkAsync(Guid contact, int expectedEntityVersion, int ordinal, WebLinkInput webLink,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeWebLinkAsync("restore", contact, expectedEntityVersion, ordinal, webLink, location, isPublic, cancellationToken);

    public Task<WebLinkWriteResult> MoveWebLinkAsync(Guid contact, int expectedEntityVersion, int ordinal, int displayOrder,
        CancellationToken cancellationToken = default) =>
        ChangeWebLinkAsync("move", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken, displayOrder);

    public Task<WebLinkWriteResult> MakeWebLinkPrincipalAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) => MoveWebLinkAsync(contact, expectedEntityVersion, ordinal, 1, cancellationToken);

    private async Task<WebLinkWriteResult> ChangeWebLinkAsync(string operation, Guid contact, int expected, int? ordinal,
        WebLinkInput? webLink, string? location, bool isPublic, CancellationToken cancellationToken, int? displayOrder = null) {
        await EnterAsync(cancellationToken);
        try {
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            // Validate inside command admission: failure invalidates all earlier work in this unit.
            webLink?.Validate();
            using var command = new SqlCommand("contacts.contact_web_link_change", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@operation", SqlDbType.VarChar, 10).Value = operation;
            command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expected;
            command.Parameters.Add("@url", SqlDbType.NVarChar, -1).Value = (object?)webLink?.Url ?? DBNull.Value;
            command.Parameters.Add("@link_type", SqlDbType.NVarChar, -1).Value = (object?)webLink?.LinkType ?? DBNull.Value;
            command.Parameters.Add("@location_name", SqlDbType.NVarChar, -1).Value = (object?)location ?? DBNull.Value;
            command.Parameters.Add("@is_public", SqlDbType.Bit).Value = isPublic;
            command.Parameters.Add("@display_text", SqlDbType.NVarChar, -1).Value = (object?)webLink?.DisplayText ?? DBNull.Value;
            var child = Output(command, "@ordinal", SqlDbType.Int, ordinal);
            var version = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var webLinkId = Output(command, "@web_link_id", SqlDbType.Int, null);
            var position = Output(command, "@display_order", SqlDbType.Int, displayOrder);
            await command.ExecuteNonQueryAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive(); // A queued cancellation/disposal may have invalidated this unit while SQL ran.
            DbrowVersion = version.Value is DBNull ? null : (long)version.Value;
            return new WebLinkWriteResult((int)child.Value, (int)webLinkId.Value, (int)revision.Value, DbrowVersion,
                position.Value is DBNull ? null : (int)position.Value);
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }

}
