using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record AddressWriteResult(int Ordinal, int AddressId, int EntityVersion, long? DbrowVersion, int? DisplayOrder);

public sealed partial class SqlAuditUnit
{
    public Task<AddressWriteResult> InsertAddressAsync(Guid contact, int expectedEntityVersion, AddressInput address,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeAddressAsync("insert", contact, expectedEntityVersion, null, address, location, isPublic, cancellationToken);

    /// <summary>Replaces the complete immutable address reference and all association metadata. Null optional values explicitly clear them.</summary>
    public Task<AddressWriteResult> UpdateAddressAsync(Guid contact, int expectedEntityVersion, int ordinal, AddressInput address,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeAddressAsync("update", contact, expectedEntityVersion, ordinal, address, location, isPublic, cancellationToken);

    public Task<AddressWriteResult> DeleteAddressAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) =>
        ChangeAddressAsync("delete", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken);

    public Task<AddressWriteResult> RestoreAddressAsync(Guid contact, int expectedEntityVersion, int ordinal, AddressInput address,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeAddressAsync("restore", contact, expectedEntityVersion, ordinal, address, location, isPublic, cancellationToken);

    public Task<AddressWriteResult> MoveAddressAsync(Guid contact, int expectedEntityVersion, int ordinal, int displayOrder,
        CancellationToken cancellationToken = default) =>
        ChangeAddressAsync("move", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken, displayOrder);

    public Task<AddressWriteResult> MakeAddressPrincipalAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) => MoveAddressAsync(contact, expectedEntityVersion, ordinal, 1, cancellationToken);

    private async Task<AddressWriteResult> ChangeAddressAsync(string operation, Guid contact, int expected, int? ordinal,
        AddressInput? address, string? location, bool isPublic, CancellationToken cancellationToken, int? displayOrder = null) {
        await EnterAsync(cancellationToken);
        try {
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            // Validate inside command admission: failure invalidates all earlier work in this unit.
            var prepared = address?.PrepareForDatabase();
            using var command = new SqlCommand("contacts.contact_address_change", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@operation", SqlDbType.VarChar, 10).Value = operation;
            command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expected;
            command.Parameters.Add("@address_data", SqlDbType.NVarChar, -1).Value = (object?)prepared ?? DBNull.Value;
            command.Parameters.Add("@location_name", SqlDbType.NVarChar, -1).Value = (object?)location ?? DBNull.Value;
            command.Parameters.Add("@is_public", SqlDbType.Bit).Value = isPublic;
            var child = Output(command, "@ordinal", SqlDbType.Int, ordinal);
            var version = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var addressId = Output(command, "@address_id", SqlDbType.Int, null);
            var position = Output(command, "@display_order", SqlDbType.Int, displayOrder);
            await command.ExecuteNonQueryAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive(); // A queued cancellation/disposal may have invalidated this unit while SQL ran.
            DbrowVersion = version.Value is DBNull ? null : (long)version.Value;
            return new AddressWriteResult((int)child.Value, (int)addressId.Value, (int)revision.Value, DbrowVersion,
                position.Value is DBNull ? null : (int)position.Value);
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }

}
