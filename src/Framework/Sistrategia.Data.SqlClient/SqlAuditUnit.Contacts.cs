using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record ContactWriteResult(Guid PublicKey, int ContactId, int EntityVersion, long? DbrowVersion);

public sealed partial class SqlAuditUnit
{
    /// <summary>Create at revision 1. Compose initial child collections with expected version zero in this same unit.</summary>
    public Task<ContactWriteResult> CreateContactAsync(ContactProfileInput profile, Guid? publicKey = null,
        CancellationToken cancellationToken = default) =>
        ChangeContactAsync("create", publicKey ?? Guid.NewGuid(), 0, profile, cancellationToken);

    public Task<ContactWriteResult> UpdateContactAsync(Guid contact, int expectedEntityVersion, ContactProfileInput profile,
        CancellationToken cancellationToken = default) =>
        ChangeContactAsync("update", contact, expectedEntityVersion, profile, cancellationToken);

    public Task<ContactWriteResult> DeleteContactAsync(Guid contact, int expectedEntityVersion,
        CancellationToken cancellationToken = default) =>
        ChangeContactAsync("delete", contact, expectedEntityVersion, null, cancellationToken);

    public Task<ContactWriteResult> RestoreContactAsync(Guid contact, int expectedEntityVersion,
        CancellationToken cancellationToken = default) =>
        ChangeContactAsync("restore", contact, expectedEntityVersion, null, cancellationToken);

    private async Task<ContactWriteResult> ChangeContactAsync(string operation, Guid contact, int expected,
        ContactProfileInput? profile, CancellationToken cancellationToken) {
        await EnterAsync(cancellationToken);
        try {
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            if (tenant is null) throw new ArgumentException("Contact operations require an explicitly resolved tenant.");
            var prepared = profile?.PrepareForDatabase();
            using var command = new SqlCommand("contacts.contact_change", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@operation", SqlDbType.VarChar, 10).Value = operation;
            var key = command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier);
            key.Value = contact;
            key.Direction = ParameterDirection.InputOutput;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = tenant.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expected;
            command.Parameters.Add("@profile_data", SqlDbType.NVarChar, -1).Value = (object?)prepared ?? DBNull.Value;
            var stamp = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var id = Output(command, "@contact_id", SqlDbType.Int, null);
            await command.ExecuteNonQueryAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            DbrowVersion = stamp.Value is DBNull ? null : (long)stamp.Value;
            return new((Guid)key.Value, (int)id.Value, (int)revision.Value, DbrowVersion);
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }
}
