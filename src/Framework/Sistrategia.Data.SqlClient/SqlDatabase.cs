// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Data;
using System.Reflection;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

public class SqlDatabase : Database
{
    public SqlDatabase(string connectionString, ILogger<Database> logger)
        : base(connectionString, SqlClientFactory.Instance, logger) { }

    public override void RunLocalStoredCommands(TextReader textReader) => RunBatch(textReader, enrollAuditUnit: false);

    /// <summary>Runs one business seed/import batch as one explicitly enrolled, owned transaction.</summary>
    public void RunLocalStoredAuditCommands(Assembly assembly, string resourceName) {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new ArgumentException("Embedded business batch was not found.", nameof(resourceName));
        using var reader = new StreamReader(stream);
        RunLocalStoredAuditCommands(reader);
    }

    public void RunLocalStoredAuditCommands(TextReader textReader) => RunBatch(textReader, enrollAuditUnit: true);

    private void RunBatch(TextReader textReader, bool enrollAuditUnit) {
        using var connection = (SqlConnection)CreateConnection();
        using var command = CreateCommand() as SqlCommand
            ?? throw new InvalidOperationException("The SQL provider did not create a command.");
        command.CommandType = CommandType.Text;
        command.CommandText = textReader.ReadToEnd();
        connection.Open();
        using var transaction = connection.BeginTransaction(IsolationLevel.ReadCommitted);
        command.Connection = connection;
        command.Transaction = transaction;
        try {
            if (enrollAuditUnit) {
                // Missing enrollment support is an installation error, never silently skipped.
                using var enrollment = new SqlCommand("data.audit_unit_begin", connection, transaction) {
                    CommandType = CommandType.StoredProcedure
                };
                enrollment.ExecuteNonQuery();
            }
            command.ExecuteNonQuery();
            transaction.Commit();
        } catch {
            try { transaction.Rollback(); }
            catch (Exception) { /* Preserve the original failure; disposal closes the owned connection. */ }
            throw;
        }
    }
}
