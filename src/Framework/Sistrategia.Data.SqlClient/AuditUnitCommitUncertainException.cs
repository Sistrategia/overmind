namespace Sistrategia.Data.SqlClient;

/// <summary>The commit was attempted but its outcome could not be confirmed. Do not retry blindly.</summary>
public sealed class AuditUnitCommitUncertainException(long? dbrowVersion, Exception innerException)
    : Exception("The audit unit commit outcome is unknown. Reconcile the outcome before retrying.", innerException)
{
    // Correlation hint only, not proof of commit or a durable idempotency receipt.
    public long? DbrowVersion { get; } = dbrowVersion;
}
