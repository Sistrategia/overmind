using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record PhoneWriteResult(int Ordinal, int PhoneId, int EntityVersion, long? DbrowVersion, int? DisplayOrder);

public sealed partial class SqlAuditUnit
{
    public Task<PhoneWriteResult> InsertPhoneAsync(Guid contact, int expectedEntityVersion, PhoneInput phone,
        string? location = null, string? extension = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangePhoneAsync("insert", contact, expectedEntityVersion, null, phone, location, isPublic, cancellationToken, extension: extension);

    /// <summary>Replaces phone, location and visibility. A null location explicitly clears it.</summary>
    public Task<PhoneWriteResult> UpdatePhoneAsync(Guid contact, int expectedEntityVersion, int ordinal, PhoneInput phone,
        string? location = null, string? extension = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangePhoneAsync("update", contact, expectedEntityVersion, ordinal, phone, location, isPublic, cancellationToken, extension: extension);

    public Task<PhoneWriteResult> DeletePhoneAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) =>
        ChangePhoneAsync("delete", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken);

    public Task<PhoneWriteResult> RestorePhoneAsync(Guid contact, int expectedEntityVersion, int ordinal, PhoneInput phone,
        string? location = null, string? extension = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangePhoneAsync("restore", contact, expectedEntityVersion, ordinal, phone, location, isPublic, cancellationToken, extension: extension);

    public Task<PhoneWriteResult> MovePhoneAsync(Guid contact, int expectedEntityVersion, int ordinal, int displayOrder,
        CancellationToken cancellationToken = default) =>
        ChangePhoneAsync("move", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken, displayOrder);

    public Task<PhoneWriteResult> MakePhonePrincipalAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) => MovePhoneAsync(contact, expectedEntityVersion, ordinal, 1, cancellationToken);

    private async Task<PhoneWriteResult> ChangePhoneAsync(string operation, Guid contact, int expected, int? ordinal,
        PhoneInput? phone, string? location, bool isPublic, CancellationToken cancellationToken, int? displayOrder = null, string? extension = null) {
        await EnterAsync(cancellationToken);
        try {
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            // Parse inside command admission: failure invalidates all earlier work in this unit.
            var prepared = phone is null ? null : PhoneParser.Parse(phone);
            if (extension?.Length > 25) throw new ArgumentException("Extension exceeds 25 UTF-16 units.", nameof(extension));
            using var command = new SqlCommand("contacts.contact_phone_change", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@operation", SqlDbType.VarChar, 10).Value = operation;
            command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expected;
            command.Parameters.Add("@phone_data", SqlDbType.NVarChar, -1).Value = prepared is null ? DBNull.Value : PhoneParser.Serialize(prepared);
            command.Parameters.Add("@location_name", SqlDbType.NVarChar, -1).Value = (object?)location ?? DBNull.Value;
            command.Parameters.Add("@is_public", SqlDbType.Bit).Value = isPublic;
            command.Parameters.Add("@extension", SqlDbType.NVarChar, -1).Value = (object?)extension ?? DBNull.Value;
            var child = Output(command, "@ordinal", SqlDbType.Int, ordinal);
            var version = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var phoneId = Output(command, "@phone_id", SqlDbType.Int, null);
            var position = Output(command, "@display_order", SqlDbType.Int, displayOrder);
            await command.ExecuteNonQueryAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive(); // A queued cancellation/disposal may have invalidated this unit while SQL ran.
            DbrowVersion = version.Value is DBNull ? null : (long)version.Value;
            return new PhoneWriteResult((int)child.Value, (int)phoneId.Value, (int)revision.Value, DbrowVersion,
                position.Value is DBNull ? null : (int)position.Value);
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }

}
