# Backend testing: .NET migration and return-session handoff

Maintained entry point, 2026-09-06. Backend tests use **MSTest 4.4.0, MSTest.TestAdapter 4.4.0 and Microsoft.NET.Test.Sdk 18.9.0**, targeting `net8.0` through conventional VSTest. The application SDK/framework and SqlClient 6.0.2 are unchanged. This replaces the maintained Python/sqlcmd orchestration and executable harness; no Python, Node.js, sqlcmd or Docker is required by the supported test commands.

The framework/adapter packages explicitly support .NET 8; VSTest works with the existing `Microsoft.NET.Sdk` test project. No MSTest SDK or Microsoft.Testing.Platform runner switch was needed. Compatibility was checked against [MSTest's package](https://www.nuget.org/packages/MSTest.TestFramework/4.4.0), [adapter](https://www.nuget.org/packages/MSTest.TestAdapter/4.4.0), [test SDK](https://www.nuget.org/packages/Microsoft.NET.Test.Sdk/18.9.0), and Microsoft's [VSTest command documentation](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test-vstest).

## What to run

Run from the **repository root**. [src/overmind.sln](../src/overmind.sln) is the single application and test solution. Its lowercase `tests` solution folder matches the physical `src/tests` directory, beside `Applications`, `Data`, `Domain` and `Framework`, and contains [src/tests/AuditTests/AuditTests.csproj](../src/tests/AuditTests/AuditTests.csproj). SQL fixtures, historical probes and runsettings also live under `src/tests`. Solution-wide builds include the WebAPI, backend libraries and tests.

```powershell
# Local dedicated SQL Server: Windows integrated authentication; explicit LOCAL certificate bypass.
$env:OVERMIND_TEST_CONNECTION_STRING = 'Server=localhost;Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
$env:OVERMIND_TEST_RESULTS = Join-Path $PWD 'artifacts/test-results/resources'

dotnet restore src/overmind.sln
dotnet build src/overmind.sln -c Release --no-restore
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --list-tests
```

**Authoritative full command: both real database profiles and the batch-parser tests**, currently 32 discovered tests (15 per profile, 2 parser tests):

```powershell
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=audit.trx' --results-directory artifacts/test-results
```

The same command works locally, in CI and in an appropriately configured Kudu environment. In scripts, stop on a nonzero restore/build status; preserve the test exit status with `exit $LASTEXITCODE`. Do not pipe away the native exit status. The supplied runsettings fail a zero-test selection and map inconclusive results to failure. No integration test is skipped for missing configuration or privilege. A filtered run is only the selected scope, even when green.

For a backend-only build/test scope, target the project directly: `dotnet test src/tests/AuditTests/AuditTests.csproj -c Release --settings src/tests/audit.runsettings`. This restores/builds the test project and its backend dependencies without requiring a second solution. Both forms run the same tests and require the same SQL configuration. Bare `dotnet test` from the repository root is not the documented command because the single solution lives under `src`.

```powershell
# Representative focused existing scenario, RCSI off (one test).
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --filter 'TestCategory=RCSI_Off&FullyQualifiedName~SavedOrderSqlAndHistoricalReader' --logger 'trx;LogFileName=focused.trx' --results-directory artifacts/test-results

# Complete integration profile, independently selectable (15 tests each).
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --filter 'TestCategory=RCSI_Off' --logger 'trx;LogFileName=rcsi-off.trx' --results-directory artifacts/test-results
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --filter 'TestCategory=RCSI_On' --logger 'trx;LogFileName=rcsi-on.trx' --results-directory artifacts/test-results

# Database-free, LIMITED SCOPE: two SQL batch-parser tests, no audit/SQL behavior verification.
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --filter 'TestCategory=Infrastructure'
```

Use a fresh results directory per CI run. Reusing a `LogFileName` overwrites the prior TRX. TRX contains test failures, SQL error numbers/batch locations and captured scenario output; resource journals are also attached. Failed cleanup fails the test, reports `CLEANUP FAILED`, and preserves the original scenario error alongside cleanup exceptions. Inspect failures and skipped counts, not just process startup or a results file's existence.

## Environment and database safety

`global.json` requests SDK 8.0.422 with `latestFeature` roll-forward. Install a compatible .NET 8 SDK (a runtime alone cannot restore/build/test), restore from NuGet, and supply a dedicated **full SQL Server 2022+ instance**. SQL Server 2022 is the locally verified version; other versions need verification. Production SQL uses `CURRENT_TRANSACTION_ID()` and the suite exercises full-instance capabilities. Azure SQL Database is not assumed equivalent.

| Configuration | Contract |
| --- | --- |
| `OVERMIND_TEST_CONNECTION_STRING` | Required SqlClient connection string to the dedicated test instance. Set `Database=master` or omit Database. Existing application database names and AttachDBFilename are rejected. No application configuration fallback. |
| `OVERMIND_TEST_RESULTS` | Optional writable directory for per-scenario JSONL resource journals; otherwise a `resources` directory under the test run directory. Set an absolute path in CI/Kudu. TRX location is controlled separately by `--results-directory`. |

For CI SQL authentication, securely inject a connection string shaped like `Server=tcp:sql-tests.example.invalid,1433;Database=master;User ID=overmind_test_runner;Password=<secret>;Encrypt=True;TrustServerCertificate=False`. This is a template, not a usable credential. Configure the dedicated login and a valid server certificate. Pass the secret as an environment variable, not a command argument or checked-in file. The tests never print the connection string. Windows integrated authentication runs as the actual test host identity. Remote SQL authentication is implemented through SqlClient but was not used in local validation.

The dedicated test identity needs CREATE/ALTER/DROP DATABASE (including RCSI and ALLOW_SNAPSHOT_ISOLATION), permission to create schemas/users/roles and `EXECUTE AS USER` in its databases, real cross-database transactions, relevant lock/request/session DMV access, and permission to `KILL` its **own unit's** test session. On SQL Server 2022, DMV requirements include VIEW SERVER PERFORMANCE STATE; KILL requires ALTER ANY CONNECTION (or appropriate server roles). A dedicated sysadmin test login on an isolated test instance is the simplest complete provisioning; this is not the application's runtime role. The suite itself exercises `email_runtime` through a real restricted database user. Missing privileges produce failed tests, not a reduced green suite.

Every database-changing test creates generated `OvermindAuditTest_<32hex>` names. Cleanup records only successful CREATEs in that scenario and, once read, checks the server database ID and creation timestamp before deleting. It never scans a prefix to select databases. RCSI is explicitly set OFF or ON and verified for **every** created database, including the second bootstrap/cross-database database and the real schema-cycle database. Each scenario/profile uses independent databases. SqlClient pooling, MARS and ambient enlistment are disabled for test connections. The uncertain-commit regression obtains the session ID from its own live unit and checks that session's database before KILL.

Cleanup runs after success, assertions and partial setup failures, attempts every created database, and verifies absence. Closed nonpooled sessions release transactions, temporary objects and session locks; cleanup switches only the owned databases to SINGLE_USER before DROP. An abruptly killed process or a lost CREATE acknowledgment cannot guarantee cleanup. The journal records intent before CREATE, successful creation and engine identity afterward, and removal afterward. If a journal contains only create-intent, creation outcome is uncertain and automatic cleanup does not assume ownership.

For recovery, stop the failed run, open **that run's** JSONL attachment, and have the test-server administrator inspect only its exact recorded names on its recorded server. Match database ID and creation timestamp against the `identified` record; for an uncertain CREATE, establish ownership using server evidence and run timing first. After that check, drop each verified leftover individually. Do not drop all `OvermindAuditTest_%` databases: other runs can own them. There is no automatic broad recovery scanner.

## Coverage continuity

Methods in [AuditScenarios.cs](../src/tests/AuditTests/AuditScenarios.cs) are inherited by `Overmind.AuditTests.ReadCommittedTests` (`RCSI_Off`) and `Overmind.AuditTests.ReadCommittedSnapshotTests` (`RCSI_On`). Both classes also have `FullAudit`. Test Explorer/TRX fully qualified class names distinguish profiles; the CLI's short discovery listing repeats method names. Filter any row below with `FullyQualifiedName~<method>` and optionally its profile category.

| Former maintained source/group | Discoverable method (in both profiles) |
| --- | --- |
| `dbrow_version_tests.sql`: allocation, rollback gaps, composition, optional INOUT, enrollment/forgery, tenants/actors | `AllocationCompositionAndGuards` |
| `email_family_tests.sql`: lifecycle, identities, final history/actions, exact dictionaries, root/actor errors and public/private permission boundary | `EmailLifecycleIdentityHistoryAndPermissions` |
| `email_order_tests.sql` + `OrderingCases.cs` | `SavedOrderSqlAndHistoricalReader` |
| `user_construction_tests.sql` + `UserConstructionCases.cs` | `OrdinaryUserConstructionPromotionAndHistoricalType` |
| Main Python runner's dependent same-root stale writer, late-root older allocation, identical catalog misses/existing hits and pre-mutation historical reader schedule | `NativeRootCatalogAndReaderConcurrency` |
| `email_review_regressions.py`: independent new values in one gap under the actual runtime role | `DistinctCatalogMissesUnderRestrictedRole` |
| Same module: instrument the real reader before COMMIT, inspect history locks amid 200 roots, restore definition | `HistoricalReaderBoundedLockFootprint` |
| Same module: SNAPSHOT before/after enrollment | `UnsupportedIsolationBeforeAndAfterEnrollment` |
| `user_construction_regressions.py`: competing promotions | `CompetingPromotionsRetainOneWinner` |
| Main Python runner: 80 simultaneous-session allocations | `EightyAllocationsAcrossFourConnections` |
| Console `Program.cs`: shared units, provisional outputs, readers/diffs/actions, failed/cancelled units, disposal, delete/restore, root history/missing revision | `SharedUnitHistoryDiffActionsAndRollback` |
| `LifetimeCases.cs`: queued cancel/commit, blocked SQL cancel/dispose, terminated owned session, commit-first rejection | `CancellationDisposalAndUncertainCommitRaces` |
| Main runner + bootstrap console branch: actual C# builder, tenant ID 2, retry, subsequent allocation/email, cross-database forged hints in one transaction | `SystemBootstrapAndCrossDatabaseOwnership` |
| `SchemaCycle.cs`: actual Overmind manager, seeds, ordinary actor, business batches, views/account independence, deployment-role persistence/legacy counter cleanup | `ApplicationSchemaCycleSeedsAndDeploymentRole` |
| New direct-executor verification: GO retains session SET/temp/transaction state; separate invocations isolate state; SQL error number and stop-on-error | `SqlExecutorPreservesBatchesSessionsAndErrors` |

Two database-free `SqlScriptTests` cover standalone/case/comment GO delimiters, quoted strings/escaped identifiers/nested comments, empty batches and rejection of unsupported command directives. These protect the replacement executor; they are not substitute audit tests.

The four original SQL fixtures remain unchanged. [SchemaFiles.cs](../src/tests/AuditTests/SchemaFiles.cs) retains the runner's production script list and dependency order, with files copied from production source at build time. `SeedAsync(1..4)` loads allocation → email → saved order → user construction **on the current test's database**, with a fresh SQL connection per fixture as before. Tests requiring only email stop at stage 2. Saved-order and user-reader cases intentionally run after their own SQL fixture stage. The native concurrency schedule remains grouped because its roots progress through revisions 1–4; the C# shared-unit and lifetime sequences retain their intentional within-scenario state. No test depends on another discovered test.

[SqlScenarios.cs](../src/tests/AuditTests/SqlScenarios.cs) ports the adopted Python regressions, with attribution to baseline `efacebb`. Distinct logical SQL invocations use distinct nonpooled connections. All batches of one invocation share a connection (including cross-database SQL); SET QUOTED_IDENTIFIER ON matches former sqlcmd `-I`. A lexical parser recognizes standalone GO, including a trailing line comment; repeat counts and sqlcmd directives are explicitly unsupported because the retained scripts do not use them. SQL exceptions keep their numbers. Concurrency uses separate opened connections, a client start barrier, the original SQL application-lock rendezvous, a 45-second cancellation budget and 15-second rendezvous deadlines; every participant's completion/failure is observed. This orchestration/session boundary and the regenerated fixture state are particular points for the returning review.

Independent reports and `src/tests/review/` probes are historical artifacts, excluded from the supported test path. Probe contents are unchanged after relocation; their old path references and dependencies are preserved as part of the review record. To rerun a historical probe that imports the former Python runner, use its recorded checkpoint (or `efacebb` for the pre-migration environment) in a separate checkout with its historical prerequisites. Their pending user-construction findings were not silently converted into passing assertions or fixed in production. Company-name locking, promotion input rejection, login/account policy, explicit snapshot operations and other review recommendations remain separate work.

## What was actually verified

### Original migration evidence (before solution consolidation)

The results in this subsection used the former `Overmind.Tests.sln` (or direct test project). They remain historical evidence; current operational commands above use `src/overmind.sln`. The consolidation follow-up is recorded separately below.

Local validation date: **2026-09-06**, baseline commit **`efacebb`** (initially clean), plus this migration's **uncommitted** solution/test/documentation/example changes. No production file, original SQL fixture, independent report or historical probe changed. OS: Windows x64, NT build **10.0.26200.0**; SDK selected by unchanged global.json: **8.0.424**; .NET runtime **8.0.30**. Packages: MSTest/framework/adapter **4.4.0**, Microsoft.NET.Test.Sdk/testhost **18.9.0**, Microsoft.Data.SqlClient **6.0.2**. The SDK's VSTest console reports **17.11.1 (x64)**; that is distinct from the testhost NuGet package version.

SQL endpoint: local dedicated `localhost`, **SQL Server 2022 Developer (RTM-GDR), 16.0.1190.2**, Windows integrated authentication, explicit local certificate trust. Every SQL profile used READ COMMITTED writers with its actual database RCSI setting; the isolation rejection case additionally enabled ALLOW_SNAPSHOT_ISOLATION in its own database. No remote SQL authentication or remote pipeline execution is claimed.

Supporting files are local, ignored by Git, under `artifacts/test-results/`. Preserve them separately if needed; logs/TRX/journals are not committed. The former console/Python runner had no framework test counts: **42 PASS messages** in each baseline are supporting observations, not 42 independent tests or proof of parity. The scenario map above establishes continuity.

| Execution | Exit | Passed / failed / skipped | Cleanup and supporting evidence |
| --- | --- | --- | --- |
| Former `dotnet build tests/EmailReference/EmailReference.csproj --nologo` | 0 | Build: 0 warnings/errors | `baseline-build.log` |
| Former `python tests/sql/run_dbrow_version_tests.py --server localhost` | 0 | No framework count; 42 PASS messages | All 3 removed, `baseline-off.log` |
| Former command with `--rcsi` | 0 | No framework count; 42 PASS messages | All 3 removed, `baseline-on.log` |
| New project, Release, `RCSI_Off` plus `Infrastructure` | 0 | 17 / 0 / 0 | All 16 removed, `migration-off.trx`, `migration-off.log`, `resources/` |
| New solution, Release, `RCSI_On` | 0 | 15 / 0 / 0 | All 16 removed, `migration-on.trx`, `migration-on.log`, `resources/` |
| Final restore and Release build of `Overmind.Tests.sln` | 0 / 0 | Build: 0 warnings/errors; all three referenced backend projects built in Release | `final-restore.log`, `final-build.log` |
| Final solution discovery with `--list-tests` | 0 | 32 discovered | No databases; `final-discovery.log` |
| Documented focused saved-order command, RCSI off | 0 | 1 / 0 / 0 | 1 removed, `focused.trx`, `focused.log`, `focused-resources/` |
| **Final authoritative full command, both profiles plus parser tests** | **0** | **32 / 0 / 0** (15 off, 15 on, 2 parser) | **All 32 removed**, 16 per profile; `audit.trx`, `audit.log`, `final-resources/`; duration 3 min 8 sec |
| Zero-test filter `FullyQualifiedName=NoSuchTest` | **1, expected** | 0 selected | No databases; `empty-filter.trx`, `empty-filter.log` |
| Missing connection environment variable, focused allocation case | **1, expected** | 0 / 1 / 0 | Fails before CREATE; `missing-config.trx`, `missing-config.log` |
| Temporary `MigrationProbe` assertion failure and partial setup failure | **1, expected** | 0 / 2 / 0 | All 3 removed, including both partial-setup resources; `controlled-failures.trx`, `controlled-failures.log`, `probe-resources/` |

The temporary probe first failed an MSTest assertion after seed setup, then separately threw SQL error **52089** after creating a table in a second owned database. TRX retained the original failures and all removal messages. The temporary test source was removed, the final solution rebuilt, and final discovery excludes those two tests. These are deliberate runner acceptance checks, not unresolved product failures. The new executor's permanent test also confirms SQL error **52087** survives and later GO batches do not execute after failure.

The original migration combined run used the former unfiltered full command targeting `Overmind.Tests.sln`, after the old maintained runners and temporary probes were removed. Both profile classes passed every scenario. Journals contain matching successful CREATE/removal entries for all **32** databases (16 per profile); each fixture also queried absence after DROP. Earlier migration runs removed 32 databases, the controlled failures removed 3, and the focused run removed 1; all their journals have zero unmatched successful creations. The two original baseline runs removed their 6 databases. No cleanup failure occurred in these runs.

Current documentation links and `git diff --check` passed; the Kudu PowerShell file parsed without syntax errors. The solution explicitly includes the three backend dependencies so Release selects Release for every project (the initial test-only solution listing built referenced projects as Debug; this was corrected before final verification).

### Single-solution follow-up — 2026-09-06

At the user's request, `src/overmind.sln` now contains the test project in a lowercase `tests` solution folder, matching the physical directory. The separate root solution was removed. This follow-up starts from committed migration checkpoint `76e49c7`; its solution/documentation/example changes are uncommitted. Test code, SQL fixtures and production code are unchanged. Current commands and both inactive CI/Kudu examples use the single solution; the original migration evidence above retains the commands actually used then.

Restore and Release build of `src/overmind.sln` passed with zero warnings/errors, including the WebAPI, all three backend libraries and `AuditTests`. Discovery found the same 32 tests. The full run passed **32 / failed 0 / skipped 0**, exit **0**, in **3 min 32 sec**, covering both RCSI profiles. All **32** disposable databases were removed: **16 per profile**, with zero unmatched successful creations in the journals. Evidence: `artifacts/test-results/consolidated-audit.trx`, `consolidated-audit.log` and `consolidated-resources/`; restore/build/discovery logs use the matching `consolidated-` prefix and each command exited 0. The full test command used `src/overmind.sln` and `--settings tests/audit.runsettings` before the physical relocation, with `LogFileName=consolidated-audit.trx` to retain earlier results and `OVERMIND_TEST_RESULTS` pointing to the separate `consolidated-resources` directory. The test environment is unchanged from the original local verification above. Remote examples remain unexecuted.

### Physical test-tree relocation — 2026-09-06

The user subsequently chose to move the entire test tree from root `tests` to `src/tests`, matching the lowercase solution folder beside the other solution directories. The solution project path is now `tests/AuditTests/AuditTests.csproj`; project references and the production SQL content path resolve to `../../Framework` and `../../Data`. Current commands use `--settings src/tests/audit.runsettings`. Test/fixture/probe contents are preserved; only the test project needs reference-path changes. Earlier verification commands above describe the layout used at that time.

Fresh restore and Release build using the relocated project both exited **0**, with **zero warnings/errors**. Discovery exited **0** and found **32** tests. The full unfiltered command using `--settings src/tests/audit.runsettings` passed **32 / failed 0 / skipped 0**, exit **0**, in **2 min 49 sec**. Both profiles ran and all **32** disposable databases were removed (**16 per profile**, no unmatched successful creations). Evidence is recorded separately under `artifacts/test-results/relocated-*`, including `relocated-restore.log`, `relocated-build.log`, `relocated-discovery.log`, `relocated-audit.log`, `relocated-audit.trx` and `relocated-resources/`. The TRX filename and resource directory were selected explicitly to retain prior runs; all other full-command settings and the local SQL environment are unchanged.

All **19** relocated source/fixture/probe/runsettings files other than the `.csproj` were checked against their committed Git contents and matched; the `.csproj` changes only reference paths. The root `tests` directory is gone. Current documentation links, Kudu example syntax and diff whitespace checks passed. The current uncommitted changes include this relocation and the preceding solution consolidation over `76e49c7`; the independent return-session checklist remains pending.

### What remains unverified or outside this migration

| Status | Boundary and next step |
| --- | --- |
| Prepared, unexecuted remotely | GitHub Actions and Kudu examples: provision/configure the declared dedicated test service, then run the exact full command there and retain TRX. No site settings, hooks or deployment were changed. |
| Implemented, not exercised locally | SQL-authentication connection strings and remote certificate validation: verify using the intended CI login/server. Local validation used Windows integrated authentication. |
| Implemented, not fault-injected | Cleanup failure aggregation/database-replacement guard and a failed initial RCSI ALTER: review the fixture and exercise in a dedicated fault-injection environment if required. Success, assertion failure and partial setup cleanup were exercised. |
| Recovery instructions only; no automatic recovery implementation | Abrupt process death or lost CREATE acknowledgment: inspect that run's exact journal and server evidence as described above. A process killed without cleanup was not deliberately left behind. |
| Known production findings, deferred regression/policy work | Pending user-construction review corrections remain unresolved and preserved. Decide/fix them in the authorized production task, then port the relevant historical counterexamples as named regressions. |
| Future capability, unimplemented | Other database providers, general migrations, commit receipts/lost-ack recovery and the remaining contact/account lifecycles. This migration adds no implementation or passing-test claim for them. |

No local integration scenario was environment-blocked, silently skipped or omitted to obtain the successful migration profiles.

## GitHub Actions and Windows Kudu

[GitHub Actions example](../examples/ci/github-audit-tests.yml) is prepared outside `.github/workflows`, so it is inactive. Supply a separately provisioned, reachable SQL Server 2022+ test instance with the capabilities above; configure the `audit-tests` environment and its `AUDIT_TEST_CONNECTION_STRING` secret. The hosted Windows runner supplies the compute for .NET, **not SQL Server**. The example installs the SDK from `global.json`, runs the same restore/build/full-test commands, preserves native exit status, and uploads results with `if: always()`. No SQL service or paid resource was provisioned here. Action versions follow the current official [checkout](https://github.com/actions/checkout), [setup-dotnet](https://github.com/actions/setup-dotnet), [upload-artifact](https://github.com/actions/upload-artifact), and [.NET workflow guide](https://docs.github.com/en/actions/tutorials/build-and-test-code/net). GitHub's own action runtime is supplied by the runner; backend orchestration does not call Node.js.

[Windows Kudu gate example](../examples/ci/kudu-audit-gate.ps1) is also inactive. Before selecting it for a real site, check that the **Kudu process** can resolve the SDK selected by global.json, restore NuGet packages, reach the dedicated full SQL test instance with the required capabilities, and write the result directory. Do not use the application's production connection string. A site's installed ASP.NET runtime does not establish SDK availability. Configure `OVERMIND_TEST_CONNECTION_STRING` separately for that gate; no live settings were changed here.

Integrate the gate into the site's existing custom deployment script **before publish/copy/sync/deployment**, preserving its failure code:

```bat
rem Example insertion inside the site's selected deploy.cmd, from repository root.
powershell.exe -NoProfile -File examples\ci\kudu-audit-gate.ps1 -ResultsDirectory "%HOME%\data\overmind-audit\%DEPLOYMENT_ID%"
if errorlevel 1 exit /b %ERRORLEVEL%
rem Only now continue the site's existing build/publish/copy/deployment steps.
```

Ensure `DEPLOYMENT_ID` is populated or supply another unique writable path; retain/download the TRX and resource journals when deployment fails. This is a gate insertion, not a replacement deployment script: a custom script must still perform the site's existing deployment work after success. No `.deployment` file was installed. See official [App Service deployment customization](https://learn.microsoft.com/en-us/azure/app-service/deploy-local-git) and [Kudu custom scripts](https://github.com/projectkudu/kudu/wiki/Custom-Deployment-Script).

If the site cannot supply SDK/network/full-instance permissions (including cross-database and owned-session termination), run the **complete** integration gate in suitable CI and let Kudu perform the declared remaining build/deployment steps only after that gate succeeds. Do not label a build, parser-only run, Azure SQL Database subset, or omitted privileged cases as the full suite. Both remote examples remain **prepared, unexecuted**.

## How to extend the suite

Add a named method to `AuditScenarios` to run it in both profiles automatically. Use `Run(async db => { await db.SeedAsync(requiredStage); ... })`, obtain sessions only from `db.ConnectionString` or `db.OwnedConnectionString(await db.CreateAsync())`, and `await using` every connection/unit. Use the actual application schema manager only on the newly created blank database, as `ApplicationSchemaCycleSeedsAndDeploymentRole` does. Add production script paths to `SchemaFiles.Paths` in build dependency order; keep SQL assertions in `src/tests/sql` and call them explicitly from the scenario. Rebuild when production SQL resources change.

For races reuse `db.ConcurrentAsync`, `Signal` and `WaitSignal` in `AuditDatabase`, and the actual blocked-request observation in `LifetimeCases` where appropriate. Include SQL postconditions and bounded waiting, observe every participant, and never replace overlap with a sequential call. Assembly-level `DoNotParallelize` prevents uncontrolled scenario parallelism even if a runner requests it; concurrency inside a scenario remains deliberate. Different test processes still own distinct names. Do not share a database between test methods or depend on discovery ordering to prepare a root revision.

## Return-session verification checklist — pending independent execution

- [ ] Inspect the delivered diff and coverage map, including session/batch/concurrency changes; confirm production and historical probes are unchanged.
- [ ] Restore/build/discover from the repository root with the commands above; verify both profile classes and expected scenario names.
- [ ] Run the focused saved-order scenario, then the full suite in both RCSI profiles.
- [ ] Inspect process exit status, failed/skipped counts, SQL errors and TRX/resource artifacts.
- [ ] Confirm cleanup of that returning run's exact owned databases using its journals and server state.

The migration author's successful runs are evidence, not completion of this independent checklist.
