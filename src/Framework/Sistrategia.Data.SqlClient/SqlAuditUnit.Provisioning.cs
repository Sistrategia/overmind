using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record UserProvisionResult(Guid PublicKey, int UserId, int EntityVersion, long? DbrowVersion);

public sealed partial class SqlAuditUnit
{
    /// <summary>Trusted backend supplies a framework password hash, never plaintext. Outputs are provisional until commit.</summary>
    public async Task<UserProvisionResult> ProvisionUserAsync(Guid contact, int expectedEntityVersion, string loginName,
        string passwordHash, string? accountEmail = null, int? initialRoleId = null, CancellationToken cancellationToken = default) {
        await EnterAsync(cancellationToken);
        try {
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            if (tenant is null) throw new ArgumentException("Provisioning requires an explicitly resolved tenant.");
            using var command = new SqlCommand("security.user_provision", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = tenant.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expectedEntityVersion;
            command.Parameters.Add("@login_name", SqlDbType.NVarChar, -1).Value = (object?)loginName ?? DBNull.Value;
            command.Parameters.Add("@password_hash", SqlDbType.NVarChar, -1).Value = (object?)passwordHash ?? DBNull.Value;
            command.Parameters.Add("@email", SqlDbType.NVarChar, -1).Value = (object?)accountEmail ?? DBNull.Value;
            command.Parameters.Add("@initial_role_id", SqlDbType.Int).Value = (object?)initialRoleId ?? DBNull.Value;
            var stamp = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var id = Output(command, "@user_id", SqlDbType.Int, null);
            await command.ExecuteNonQueryAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            EnsureActive();
            DbrowVersion = stamp.Value is DBNull ? null : (long)stamp.Value;
            return new(contact, (int)id.Value, (int)revision.Value, DbrowVersion);
        } catch {
            await AbortAsync();
            throw;
        } finally { gate.Release(); }
    }
}
