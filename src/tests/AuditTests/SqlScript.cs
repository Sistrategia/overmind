using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Overmind.AuditTests;

// The repository uses standalone GO (case insensitive), not sqlcmd directives or GO n.
// Track lexical state so GO inside a multiline string/comment/identifier is SQL text.
internal static class SqlScript
{
    internal static IReadOnlyList<string> Batches(string sql) {
        var batches = new List<string>();
        var batch = new StringBuilder();
        var quote = '\0';
        var comments = 0;
        using var lines = new StringReader(sql);
        while (lines.ReadLine() is { } line) {
            if (quote == '\0' && comments == 0 && Regex.IsMatch(line, @"^\s*GO\s*(?:--.*)?$", RegexOptions.IgnoreCase)) {
                if (!string.IsNullOrWhiteSpace(batch.ToString())) batches.Add(batch.ToString());
                batch.Clear();
                continue;
            }
            if (quote == '\0' && comments == 0 && Regex.IsMatch(line, @"^\s*(?:GO\s+\d|:|!!)", RegexOptions.IgnoreCase))
                throw new FormatException("Unsupported SQL command directive; use standalone GO batches.");
            batch.AppendLine(line);
            for (var i = 0; i < line.Length; i++) {
                var c = line[i];
                var next = i + 1 < line.Length ? line[i + 1] : '\0';
                if (comments > 0) {
                    if (c == '/' && next == '*') { comments++; i++; }
                    else if (c == '*' && next == '/') { comments--; i++; }
                } else if (quote != '\0') {
                    if (c == quote) {
                        if (next == quote) i++;
                        else quote = '\0';
                    }
                } else if (c == '-' && next == '-') break;
                else if (c == '/' && next == '*') { comments++; i++; }
                else if (c is '\'' or '"') quote = c;
                else if (c == '[') quote = ']';
            }
        }
        if (!string.IsNullOrWhiteSpace(batch.ToString())) batches.Add(batch.ToString());
        return batches;
    }

    // One connection per invocation, retained across every GO batch. No pooled SET state.
    internal static async Task ExecuteAsync(string connectionString, string sql, string source,
        CancellationToken cancellationToken = default, Func<Task>? connected = null) {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        if (connected is not null) await connected();
        connection.InfoMessage += (_, e) => Console.WriteLine(e.Message);
        using (var settings = new SqlCommand("SET QUOTED_IDENTIFIER ON; SET TRANSACTION ISOLATION LEVEL READ COMMITTED;", connection))
            await settings.ExecuteNonQueryAsync(cancellationToken);
        var index = 0;
        foreach (var batch in Batches(sql)) {
            using var command = new SqlCommand(batch, connection) { CommandTimeout = 60 };
            try { await command.ExecuteNonQueryAsync(cancellationToken); }
            catch (SqlException error) {
                // Keep the actual exception and SQL error number; add location without dumping SQL/secrets.
                Console.WriteLine($"SQL failure in {source}, batch {index + 1}, number {error.Number}, line {error.LineNumber}.");
                throw;
            }
            index++;
        }
    }
}
