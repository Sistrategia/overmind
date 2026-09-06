using System.Runtime.ExceptionServices;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Overmind.AuditTests;

// Exact resources successfully created by this scenario, never a prefix scan.
internal sealed class AuditDatabase
{
    private readonly SqlConnectionStringBuilder settings;
    private readonly List<string> created = [];
    private readonly Dictionary<string, (int Id, DateTime Created)> identities = [];
    private readonly bool rcsi;
    private readonly string journal;
    internal string Name { get; private set; } = "";
    internal string ConnectionString => ForDatabase(Name);

    private AuditDatabase(bool rcsi, TestContext context) {
        this.rcsi = rcsi;
        var configured = Environment.GetEnvironmentVariable("OVERMIND_TEST_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(configured))
            throw new InvalidOperationException("Full audit tests require OVERMIND_TEST_CONNECTION_STRING for a dedicated SQL Server test instance. See docs/testing-handoff.md.");
        try { settings = new SqlConnectionStringBuilder(configured); }
        catch (ArgumentException) { throw new InvalidOperationException("Invalid OVERMIND_TEST_CONNECTION_STRING; its value is deliberately not logged."); }
        if (string.IsNullOrWhiteSpace(settings.DataSource) ||
            (settings.InitialCatalog.Length > 0 && !settings.InitialCatalog.Equals("master", StringComparison.OrdinalIgnoreCase)) ||
            settings.AttachDBFilename.Length > 0)
            throw new InvalidOperationException("Test configuration must name a SQL Server and use master (or omit Database); application databases/attached files are forbidden.");
        settings.InitialCatalog = "master";
        settings.Pooling = false;
        settings.Enlist = false;
        settings.MultipleActiveResultSets = false;
        settings.ConnectTimeout = 10;
        settings.ApplicationName = "OvermindAuditTests_" + Guid.NewGuid().ToString("N");
        var directory = Environment.GetEnvironmentVariable("OVERMIND_TEST_RESULTS") ??
            Path.Combine(context.TestRunDirectory!, "resources");
        Directory.CreateDirectory(directory);
        journal = Path.GetFullPath(Path.Combine(directory, settings.ApplicationName + ".jsonl"));
        Record("start", null);
        context.AddResultFile(journal);
        Console.WriteLine($"Resource journal: {journal}; RCSI {(rcsi ? "ON" : "OFF")}.");
    }

    internal static async Task RunAsync(bool rcsi, TestContext context, Func<AuditDatabase, Task> scenario) {
        var owner = new AuditDatabase(rcsi, context);
        Exception? failure = null;
        try {
            owner.Name = await owner.CreateAsync();
            await scenario(owner);
        } catch (Exception error) { failure = error; }
        var cleanup = await owner.CleanupAsync();
        if (cleanup.Count > 0) {
            if (failure is not null) cleanup.Insert(0, failure);
            throw new AggregateException("Audit scenario/cleanup failed. Inspect all errors and the exact resource journal.", cleanup);
        }
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }

    private string ForDatabase(string database) => new SqlConnectionStringBuilder(settings.ConnectionString) { InitialCatalog = database }.ConnectionString;

    internal async Task<string> CreateAsync() {
        var name = "OvermindAuditTest_" + Guid.NewGuid().ToString("N");
        Record("create-intent", name);
        // Do not add an already-existing name to cleanup if CREATE fails.
        await SqlScript.ExecuteAsync(ForDatabase("master"), $"CREATE DATABASE [{name}];", "create owned database");
        created.Add(name); // Before any subsequent setup can fail.
        Record("created", name);
        await using (var connection = new SqlConnection(ForDatabase("master"))) {
            await connection.OpenAsync();
            using var command = new SqlCommand("SELECT database_id,create_date,@@VERSION FROM sys.databases WHERE name=@name;", connection);
            command.Parameters.AddWithValue("@name", name);
            await using var row = await command.ExecuteReaderAsync();
            if (!await row.ReadAsync()) throw new InvalidOperationException("Created test database disappeared.");
            identities.Add(name, (row.GetInt32(0), row.GetDateTime(1)));
            Console.WriteLine(row.GetString(2));
        }
        var identity = identities[name];
        Record("identified", name, identity.Id, identity.Created);
        await SqlScript.ExecuteAsync(ForDatabase("master"),
            $"ALTER DATABASE [{name}] SET READ_COMMITTED_SNAPSHOT {(rcsi ? "ON" : "OFF")};", "configure isolation");
        await ExecuteAsync($"IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE database_id=DB_ID())<>{(rcsi ? 1 : 0)} THROW 52000,'Test RCSI profile mismatch.',1;", name);
        Console.WriteLine($"Created {name}; verified RCSI {(rcsi ? "ON" : "OFF")}.");
        return name;
    }

    internal Task ExecuteAsync(string sql, string? database = null, CancellationToken token = default) {
        var target = database ?? Name;
        if (!created.Contains(target)) throw new InvalidOperationException("SQL target is not owned by this scenario.");
        return SqlScript.ExecuteAsync(ForDatabase(target), sql, "scenario", token);
    }

    internal string OwnedConnectionString(string name) {
        if (!created.Contains(name)) throw new InvalidOperationException("Connection target is not owned by this scenario.");
        return ForDatabase(name);
    }

    internal async Task LoadSchemaAsync(string? database = null) {
        await ExecuteAsync("CREATE SCHEMA data;\nGO\nCREATE SCHEMA entities;\nGO\nCREATE SCHEMA contacts;\nGO\nCREATE SCHEMA security;", database);
        // Each file has a GO boundary in the former runner's combined setup. Retain the
        // SAME connection across files as well as internal batches (SET/temporary state).
        var batches = SchemaFiles.Paths.Select(path => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "ProductionSql", path)));
        await ExecuteAsync(string.Join("\nGO\n", batches), database);
    }

    internal async Task SeedAsync(int through = 2) {
        await LoadSchemaAsync();
        string[] scripts = ["dbrow_version_tests.sql", "email_family_tests.sql", "email_order_tests.sql", "user_construction_tests.sql"];
        foreach (var script in scripts.Take(through)) {
            Console.WriteLine($"Fixture: {script}");
            await SqlScript.ExecuteAsync(ConnectionString, File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", script)), script);
        }
    }

    internal async Task ConcurrentAsync(params string[] commands) {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        // All connections reach the client barrier before any SQL schedule starts.
        var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var arrivals = 0;
        var jobs = commands.Select(async (sql, index) => {
            try {
                await SqlScript.ExecuteAsync(ConnectionString, sql, $"concurrent participant {index + 1}", timeout.Token, async () => {
                    if (Interlocked.Increment(ref arrivals) == commands.Length) ready.TrySetResult();
                    await ready.Task.WaitAsync(timeout.Token);
                });
            } catch (Exception error) {
                throw new InvalidOperationException($"Concurrent participant {index + 1} failed.", error);
            }
        }).ToArray();
        try { await Task.WhenAll(jobs); }
        catch {
            // WhenAll observes completion of EVERY participant, including timeouts/errors.
            throw new AggregateException("Concurrent SQL schedule failed.", jobs.Where(j => j.IsFaulted).SelectMany(j => j.Exception!.InnerExceptions));
        }
    }

    internal static string Signal(string name) => $"""
        DECLARE @signal_{name} INT;
        EXEC @signal_{name}=sys.sp_getapplock @Resource=N'{name}',@LockMode='Exclusive',@LockOwner='Session',@LockTimeout=0;
        IF @signal_{name}<0 THROW 52000,'Concurrent test signal acquisition failed.',1;
        """;

    internal static string WaitSignal(string name) => $"""
        DECLARE @deadline_{name} DATETIME2=DATEADD(SECOND,15,SYSUTCDATETIME());
        WHILE APPLOCK_TEST('public',N'{name}','Exclusive','Session')=1
        BEGIN
            IF SYSUTCDATETIME()>@deadline_{name} THROW 52000,'Concurrent test rendezvous timed out.',1;
            WAITFOR DELAY '00:00:00.050';
        END;
        """;

    private async Task<List<Exception>> CleanupAsync() {
        var errors = new List<Exception>();
        foreach (var name in created.AsEnumerable().Reverse()) {
            try {
                // Successful CREATE is required. If setup obtained an engine identity, also
                // reject a same-name replacement. No pooled sessions remain to reconnect.
                var guard = identities.TryGetValue(name, out var identity)
                    ? $"IF EXISTS (SELECT 1 FROM sys.databases WHERE name=N'{name}' AND (database_id<>{identity.Id} OR create_date<>CONVERT(datetime,'{identity.Created:yyyy-MM-ddTHH:mm:ss.fff}',126))) THROW 52000,'Owned database identity changed; refusing cleanup.',1;"
                    : "";
                await SqlScript.ExecuteAsync(ForDatabase("master"), $"""
                    {guard}
                    IF DB_ID(N'{name}') IS NOT NULL
                    BEGIN
                        ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                        DROP DATABASE [{name}];
                    END;
                    IF DB_ID(N'{name}') IS NOT NULL THROW 52000,'Owned database still exists after cleanup.',1;
                    """, "cleanup owned database");
                Record("removed", name);
                Console.WriteLine($"Removed {name}");
            } catch (Exception error) {
                errors.Add(new InvalidOperationException($"Cleanup failed for owned database {name}; use its journal for recovery.", error));
                Console.WriteLine($"CLEANUP FAILED: {name}");
            }
        }
        return errors;
    }

    private void Record(string action, string? database, int? databaseId = null, DateTime? createdAt = null) =>
        File.AppendAllText(journal, JsonSerializer.Serialize(new { action, database, databaseId, createdAt,
            utc = DateTime.UtcNow, server = settings.DataSource, run = settings.ApplicationName, rcsi }) + Environment.NewLine);
}
