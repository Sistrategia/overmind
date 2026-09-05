using System.Data;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

public sealed record EmailWriteResult(int Ordinal, int EmailId, int EntityVersion, long? DbrowVersion);

/// <summary>
/// Owns one connection, transaction, tenant and authenticated actor. Do not construct actor
/// context from an untrusted request body. Dispose without CommitAsync rolls everything back.
/// Results remain provisional until commit. A failed/uncertain commit is never retried here.
/// </summary>
public sealed class SqlAuditUnit : IAsyncDisposable
{
    private readonly SqlConnection connection;
    private readonly SqlTransaction transaction;
    private readonly Guid actor;
    private readonly Guid? tenant;
    private readonly SemaphoreSlim gate = new(1, 1);
    private bool completed;
    private bool disposed;
    public long? DbrowVersion { get; private set; }

    private SqlAuditUnit(SqlConnection connection, SqlTransaction transaction, Guid actor, Guid? tenant) {
        this.connection = connection;
        this.transaction = transaction;
        this.actor = actor;
        this.tenant = tenant;
    }

    public static async Task<SqlAuditUnit> BeginAsync(string connectionString, Guid authenticatedActor,
        Guid? tenant = null, CancellationToken cancellationToken = default) {
        if (new SqlConnectionStringBuilder(connectionString).MultipleActiveResultSets)
            throw new ArgumentException("Audit units require MultipleActiveResultSets=false.", nameof(connectionString));
        var connection = new SqlConnection(connectionString);
        try {
            await connection.OpenAsync(cancellationToken);
            var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
            var unit = new SqlAuditUnit(connection, transaction, authenticatedActor, tenant);
            try {
                using var command = new SqlCommand("data.audit_unit_begin", connection, transaction) { CommandType = CommandType.StoredProcedure };
                await command.ExecuteNonQueryAsync(cancellationToken);
                return unit;
            } catch {
                await unit.DisposeAsync();
                throw;
            }
        } catch {
            await connection.DisposeAsync();
            throw;
        }
    }

    public Task<EmailWriteResult> InsertEmailAsync(Guid contact, int expectedEntityVersion, string email,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeEmailAsync("insert", contact, expectedEntityVersion, null, email, location, isPublic, cancellationToken);

    /// <summary>Replaces email, location and visibility. A null location explicitly clears it.</summary>
    public Task<EmailWriteResult> UpdateEmailAsync(Guid contact, int expectedEntityVersion, int ordinal, string email,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeEmailAsync("update", contact, expectedEntityVersion, ordinal, email, location, isPublic, cancellationToken);

    public Task<EmailWriteResult> DeleteEmailAsync(Guid contact, int expectedEntityVersion, int ordinal,
        CancellationToken cancellationToken = default) =>
        ChangeEmailAsync("delete", contact, expectedEntityVersion, ordinal, null, null, false, cancellationToken);

    public Task<EmailWriteResult> RestoreEmailAsync(Guid contact, int expectedEntityVersion, int ordinal, string email,
        string? location = null, bool isPublic = false, CancellationToken cancellationToken = default) =>
        ChangeEmailAsync("restore", contact, expectedEntityVersion, ordinal, email, location, isPublic, cancellationToken);

    private async Task<EmailWriteResult> ChangeEmailAsync(string operation, Guid contact, int expected, int? ordinal,
        string? email, string? location, bool isPublic, CancellationToken cancellationToken) {
        await EnterAsync(cancellationToken);
        try {
            EnsureActive();
            using var command = new SqlCommand("contacts.contact_email_change", connection, transaction) { CommandType = CommandType.StoredProcedure };
            command.Parameters.Add("@operation", SqlDbType.VarChar, 10).Value = operation;
            command.Parameters.Add("@contact_public_key", SqlDbType.UniqueIdentifier).Value = contact;
            command.Parameters.Add("@actor", SqlDbType.UniqueIdentifier).Value = actor;
            command.Parameters.Add("@tenant", SqlDbType.UniqueIdentifier).Value = (object?)tenant ?? DBNull.Value;
            command.Parameters.Add("@expected_entity_version", SqlDbType.Int).Value = expected;
            command.Parameters.Add("@email_address", SqlDbType.NVarChar, -1).Value = (object?)email ?? DBNull.Value;
            command.Parameters.Add("@location_name", SqlDbType.NVarChar, -1).Value = (object?)location ?? DBNull.Value;
            command.Parameters.Add("@is_public", SqlDbType.Bit).Value = isPublic;
            var child = Output(command, "@ordinal", SqlDbType.Int, ordinal);
            var version = Output(command, "@dbrow_version", SqlDbType.BigInt, DbrowVersion);
            var revision = Output(command, "@entity_version", SqlDbType.Int, null);
            var emailId = Output(command, "@email_id", SqlDbType.Int, null);
            await command.ExecuteNonQueryAsync(cancellationToken);
            DbrowVersion = version.Value is DBNull ? null : (long)version.Value;
            return new EmailWriteResult((int)child.Value, (int)emailId.Value, (int)revision.Value, DbrowVersion);
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }

    private static SqlParameter Output(SqlCommand command, string name, SqlDbType type, object? value) {
        var parameter = command.Parameters.Add(name, type);
        parameter.Direction = ParameterDirection.InputOutput;
        parameter.Value = value ?? DBNull.Value;
        return parameter;
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default) {
        await EnterAsync(cancellationToken);
        try {
            EnsureActive();
            await transaction.CommitAsync(cancellationToken);
            completed = true;
        } catch {
            await AbortAsync();
            throw;
        } finally {
            gate.Release();
        }
    }

    private void EnsureActive() {
        if (completed || disposed || transaction.Connection != connection)
            throw new InvalidOperationException("This audit unit is no longer active.");
    }

    private async Task EnterAsync(CancellationToken cancellationToken) {
        try {
            await gate.WaitAsync(cancellationToken);
        } catch (OperationCanceledException) {
            // Even cancellation while queued invalidates prior provisional work in this unit.
            await gate.WaitAsync(CancellationToken.None);
            try { await AbortAsync(); }
            finally { gate.Release(); }
            throw;
        }
    }

    private async Task AbortAsync() {
        if (completed) return;
        completed = true;
        DbrowVersion = null;
        try { await transaction.RollbackAsync(CancellationToken.None); }
        catch (Exception) { /* Preserve the original failure, including uncertain commit. Connection is disposed by owner. */ }
    }

    public async ValueTask DisposeAsync() {
        await gate.WaitAsync();
        try {
            if (disposed) return;
            await AbortAsync();
            await transaction.DisposeAsync();
            await connection.DisposeAsync();
            disposed = true;
        } finally {
            gate.Release();
        }
    }
}
