using Microsoft.Data.SqlClient;
using Microsoft.VisualStudio.TestTools.UnitTesting;

[assembly: DoNotParallelize]

namespace Overmind.AuditTests;

[TestClass, TestCategory("FullAudit"), TestCategory("RCSI_Off")]
public sealed class ReadCommittedTests : AuditScenarios
{
    protected override bool Rcsi => false;
}

[TestClass, TestCategory("FullAudit"), TestCategory("RCSI_On")]
public sealed class ReadCommittedSnapshotTests : AuditScenarios
{
    protected override bool Rcsi => true;
}

// Inherited named tests are discovered for BOTH database profiles. Every invocation
// owns its database(s); prerequisite scripts execute explicitly, never via test order.
public abstract class AuditScenarios
{
    public TestContext TestContext { get; set; } = null!;
    protected abstract bool Rcsi { get; }
    private static readonly Guid Actor = Guid.Parse(SqlScenarios.actor);

    private Task Run(Func<AuditDatabase, Task> scenario) => AuditDatabase.RunAsync(Rcsi, TestContext, scenario);

    [TestMethod]
    public Task AllocationCompositionAndGuards() => Run(db => db.SeedAsync(1));

    [TestMethod]
    public Task RolledBackSavepointCannotReuseAllocation() => Run(async db => {
        await db.SeedAsync(1);
        await ReviewProbeCases.SavepointOwnership(db);
    });

    [TestMethod]
    public Task OppositeRootDeadlockRollsBackAndRequiresFreshUnit() => Run(async db => {
        await db.SeedAsync();
        await DeadlockCases.RunAsync(db, Actor);
    });

    [TestMethod]
    public Task PromotionThenEmailSharesRevisionAndRollsBackTogether() => Run(async db => {
        await db.SeedAsync();
        await ReviewProbeCases.PromotionThenEmail(db);
    });

    [TestMethod]
    public Task EmailLifecycleIdentityHistoryAndPermissions() => Run(db => db.SeedAsync());

    [TestMethod]
    public Task SavedOrderSqlAndHistoricalReader() => Run(async db => {
        await db.SeedAsync(3);
        await OrderingCases.RunAsync(db.ConnectionString, Actor);
    });

    [TestMethod]
    public Task OrdinaryUserConstructionPromotionAndHistoricalType() => Run(async db => {
        await db.SeedAsync(4);
        await UserConstructionCases.RunAsync(db.ConnectionString);
    });

    [TestMethod]
    public Task NativeRootCatalogAndReaderConcurrency() => Run(async db => {
        await db.SeedAsync();
        await SqlScenarios.NativeConcurrency(db);
    });

    [TestMethod]
    public Task DistinctCatalogMissesUnderRestrictedRole() => Run(async db => {
        await db.SeedAsync();
        await SqlScenarios.DistinctCatalogMisses(db);
    });

    [TestMethod]
    public Task HistoricalReaderBoundedLockFootprint() => Run(async db => {
        await db.SeedAsync();
        await SqlScenarios.ReaderFootprint(db);
    });

    [TestMethod]
    public Task UnsupportedIsolationBeforeAndAfterEnrollment() => Run(async db => {
        await db.SeedAsync();
        await SqlScenarios.IsolationRejection(db);
    });

    [TestMethod]
    public Task CompetingPromotionsRetainOneWinner() => Run(async db => {
        await db.SeedAsync();
        await SqlScenarios.CompetingPromotions(db);
    });

    [TestMethod]
    public Task EightyAllocationsAcrossFourConnections() => Run(async db => {
        await db.SeedAsync(1);
        await SqlScenarios.ConcurrentAllocation(db);
    });

    [TestMethod]
    public Task SharedUnitHistoryDiffActionsAndRollback() => Run(async db => {
        await db.SeedAsync();
        await SharedUnitCases.RunAsync(db.ConnectionString);
    });

    [TestMethod]
    public Task CancellationDisposalAndUncertainCommitRaces() => Run(async db => {
        await db.SeedAsync();
        await LifetimeCases.RunAsync(db.ConnectionString, Actor);
    });

    [TestMethod]
    public Task SystemBootstrapAndCrossDatabaseOwnership() => Run(async db => {
        await db.SeedAsync(1);
        await SqlScenarios.BootstrapAndCrossDatabaseOwnership(db);
    });

    [TestMethod]
    public Task ApplicationSchemaCycleSeedsAndDeploymentRole() => Run(db => SchemaCycle.RunAsync(db.ConnectionString));

    [TestMethod]
    public Task SqlExecutorPreservesBatchesSessionsAndErrors() => Run(async db => {
        await db.ExecuteAsync("""
            SET XACT_ABORT ON;
            SET LOCK_TIMEOUT 1234;
            CREATE TABLE #session_state (value int);
            BEGIN TRAN;
            INSERT #session_state VALUES (1);
            GO -- keep the connection and transaction
            IF @@TRANCOUNT<>1 OR @@LOCK_TIMEOUT<>1234 OR (16384 & @@OPTIONS)=0
                THROW 52000,'GO lost session SET/transaction state.',1;
            IF (SELECT COUNT(*) FROM #session_state)<>1 THROW 52000,'GO lost temporary objects.',1;
            ROLLBACK;
            GO
            IF EXISTS (SELECT 1 FROM #session_state) THROW 52000,'Batch transaction did not roll back.',1;
            """);
        await db.ExecuteAsync("""
            IF OBJECT_ID('tempdb..#session_state') IS NOT NULL OR @@TRANCOUNT<>0 OR @@LOCK_TIMEOUT<>-1
                THROW 52000,'A separate invocation reused SQL session state.',1;
            CREATE TABLE dbo.executor_error_guard (value int);
            """);
        try {
            await db.ExecuteAsync("THROW 52087,'Controlled executor failure.',1;\nGO\nINSERT dbo.executor_error_guard VALUES (1);");
            Assert.Fail("SQL exception was swallowed.");
        } catch (SqlException error) when (error.Number == 52087) { }
        await db.ExecuteAsync("IF EXISTS (SELECT 1 FROM dbo.executor_error_guard) THROW 52000,'Executor continued after a failed batch.',1;");
    });
}
