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

**Authoritative full command: both real database profiles and the batch-parser tests**, currently 38 discovered tests (18 per profile, 2 parser tests):

```powershell
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=audit.trx' --results-directory artifacts/test-results
```

The same command works locally, in CI and in an appropriately configured Kudu environment. In scripts, stop on a nonzero restore/build status; preserve the test exit status with `exit $LASTEXITCODE`. Do not pipe away the native exit status. The supplied runsettings fail a zero-test selection and map inconclusive results to failure. No integration test is skipped for missing configuration or privilege. A filtered run is only the selected scope, even when green.

For a backend-only build/test scope, target the project directly: `dotnet test src/tests/AuditTests/AuditTests.csproj -c Release --settings src/tests/audit.runsettings`. This restores/builds the test project and its backend dependencies without requiring a second solution. Both forms run the same tests and require the same SQL configuration. Bare `dotnet test` from the repository root is not the documented command because the single solution lives under `src`.

```powershell
# Representative focused existing scenario, RCSI off (one test).
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --filter 'TestCategory=RCSI_Off&FullyQualifiedName~SavedOrderSqlAndHistoricalReader' --logger 'trx;LogFileName=focused.trx' --results-directory artifacts/test-results

# Complete integration profile, independently selectable (18 tests each).
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
| Historical email A: rolled-back savepoint allocation cannot be reused; whole-unit rollback | `RolledBackSavepointCannotReuseAllocation` |
| Historical email E: actual C# two-root deadlock, victim rollback/invalidation, survivor history and explicit fresh retry | `OppositeRootDeadlockRollsBackAndRequiresFreshUnit` |
| Historical user P5: existing-contact promotion then email, rollback/commit and historical type | `PromotionThenEmailSharesRevisionAndRollsBackTogether` |

Two database-free `SqlScriptTests` cover standalone/case/comment GO delimiters, quoted strings/escaped identifiers/nested comments, empty batches and rejection of unsupported command directives. These protect the replacement executor; they are not substitute audit tests.

The four original SQL fixtures retain their scenario sequences. The review-probe integration below replaces supplied promotion contact names with explicit NULL and adds fixture-shape assertions; production SQL is unchanged. [SchemaFiles.cs](../src/tests/AuditTests/SchemaFiles.cs) retains the runner's production script list and dependency order, with files copied from production source at build time. `SeedAsync(1..4)` loads allocation → email → saved order → user construction **on the current test's database**, with a fresh SQL connection per fixture as before. Tests requiring only email stop at stage 2. Saved-order and user-reader cases intentionally run after their own SQL fixture stage. The native concurrency schedule remains grouped because its roots progress through revisions 1–4; the C# shared-unit and lifetime sequences retain their intentional within-scenario state. No test depends on another discovered test.

[SqlScenarios.cs](../src/tests/AuditTests/SqlScenarios.cs) ports the adopted Python regressions, with attribution to baseline `efacebb`. Distinct logical SQL invocations use distinct nonpooled connections. All batches of one invocation share a connection (including cross-database SQL); SET QUOTED_IDENTIFIER ON matches former sqlcmd `-I`. A lexical parser recognizes standalone GO, including a trailing line comment; repeat counts and sqlcmd directives are explicitly unsupported because the retained scripts do not use them. SQL exceptions keep their numbers. Concurrency uses separate opened connections, a client start barrier, the original SQL application-lock rendezvous, a 45-second cancellation budget and 15-second rendezvous deadlines; every participant's completion/failure is observed. This orchestration/session boundary and the regenerated fixture state are particular points for the returning review.

Independent reports and `src/tests/review/` probes are historical artifacts, excluded from the supported test path. Probe contents are unchanged after relocation; their old path references and dependencies are preserved as part of the review record. To rerun a historical probe that imports the former Python runner, use its recorded checkpoint (or `efacebb` for the pre-migration environment) in a separate checkout with its historical prerequisites. Their pending user-construction findings were not silently converted into passing assertions or fixed in production. Company-name locking, promotion input rejection, login/account policy, explicit snapshot operations and other review recommendations remain separate work.

## Historical review probe coverage

Assessment dated **2026-09-06**, against `d660dd4` plus this test-only integration. Sources: the archived [email A–G](../src/tests/review/email-reference-family/run_review_probes.py) and [user P1–P9/P3b](../src/tests/review/user-construction/run_user_construction_probes.py) scripts in full, their [email](email-reference-family-independent-review.md) and [user](user-construction-independent-review.md) reports, and ADRs [0005](adr/0005-email-reference-family.md), [0006](adr/0006-email-review-corrections-and-saved-order.md), [0007](adr/0007-ordinary-user-construction-and-type-history.md). The scripts mostly print observations; header lists alone omit cases. Their original contents and reports remain unchanged. [Archive provenance](../src/tests/review/README.md) explains retention.

Each method below is discoverable under both profile classes in [AuditScenarios.cs](../src/tests/AuditTests/AuditScenarios.cs). Use `--filter 'FullyQualifiedName~<method>'`, optionally combined with `TestCategory=RCSI_Off` or `TestCategory=RCSI_On`. “Covered” identifies an assertion, not simply a successful probe process.

| Old probe/question | Current contract, assertion and disposition |
| --- | --- |
| Email A: savepoint rollback releases version lock/ledger but retains outer enrollment; discovery, old reuse, fresh NULL allocation | **Added** `RolledBackSavepointCannotReuseAllocation`, [ReviewProbeCases.SavepointOwnership](../src/tests/AuditTests/ReviewProbeCases.cs): verifies ownership before rollback, released lock/absent ledger afterward, NULL discovery, error 51103 for old reuse, then whole rollback with no ledger change. The historical fresh-NULL experiment is **not adopted** as partial-success support; ADR 0005 provides neither that C# mode nor automatic retry. |
| B1/B2: sparse root payload scans before/after candidate indexes | **Covered/superseded** by `HistoricalReaderBoundedLockFootprint`, [SqlScenarios.ReaderFootprint](../src/tests/AuditTests/SqlScenarios.cs): instruments the actual reader before COMMIT amid 200 unrelated roots, rejects more than 16 history KEY locks or blocking whole-table locks, restores the definition. ADR 0006 requires seeks as well as indexes; the replayed TOP queries and exact one-key expectation are obsolete acceptance criteria. |
| C: delete ordinal 1, append replacement, principal visible despite stable identity | **Covered** by `SavedOrderSqlAndHistoricalReader`, [email_order_tests.sql](../src/tests/sql/email_order_tests.sql): ordinal high-water assertion, restoration appends, deletion of ordinal 1 leaves `contact_view` showing order-b; [OrderingCases](../src/tests/AuditTests/OrderingCases.cs) checks dense position and exactly one principal. `ApplicationSchemaCycleSeedsAndDeploymentRole` also checks actual contact/actor views and independent account email. Principal means saved position 1, not identity 1. |
| D: RCSI fixture execution; later same-root stale writer and identical catalog-miss subcases | **Covered** by every `RCSI_On` scenario (database setting verified), including `AllocationCompositionAndGuards`, `EmailLifecycleIdentityHistoryAndPermissions`, and `NativeRootCatalogAndReaderConcurrency`. [SqlScenarios.NativeConcurrency](../src/tests/AuditTests/SqlScenarios.cs) asserts 51206 for the stale contender and one shared dictionary row. The old PASS-line count is not a test count. |
| E: opposite root order, deadlock outcome, final spine counts | **Added** `OppositeRootDeadlockRollsBackAndRequiresFreshUnit`, [DeadlockCases](../src/tests/AuditTests/DeadlockCases.cs). Two actual units finish writes to distinct roots before requesting the opposite root, with a 45-second cancellation budget; all participants are observed. Requires exactly one SQL 1205 and one commit, without choosing a victim. Checks victim ledger/history/action absence, both surviving revisions/child snapshots/actions, rejected victim commands/commit, cleared provisional version, and historical reads before/after an explicit new-unit retry using refreshed versions. Other errors fail; old printed “either/both aborted” outcomes are not accepted. |
| F: distinct misses in same gap versus another gap | **Covered/superseded** by `DistinctCatalogMissesUnderRestrictedRole`, [SqlScenarios.DistinctCatalogMisses](../src/tests/AuditTests/SqlScenarios.cs): new email **and location** values in the same gap commit under `email_app` while the first unit remains open. ADR 0006 removed deliberate gap locking. F's second insertion reuses the first insertion's expected revision; after the first now succeeds, the second is stale. Its literal two-error comparison is obsolete. No claim of universal contention freedom. |
| G: plain absent-value seek beside uncommitted key; candidate interner distinct miss; identical-value serialization | **Covered at the supported boundary** by the distinct-miss case above and `NativeRootCatalogAndReaderConcurrency` (identical misses deduplicate, existing hits commit while another unit is open). **Obsolete implementation experiment:** the probe-only procedure is not production `email_values_ensure`; no reason to maintain its standalone seek or exact timeout result. Its identical-value call can block in the initial RC read, so 1222 does not establish that its application lock timed out. Its hard-coded infinite applock timeout also differs from the production caller timeout. |
| P1: two accounts share a login | **Unresolved policy**: no active uniqueness constraint/check. Decide scope, normalization and NULL semantics before asserting rejection. No passing duplicate-login acceptance test added. Recipe below. |
| P2: promotion drops name/name-parts/job/phone/company inputs | **Unresolved correctness finding**: promotion still ignores those inputs. Existing positive promotion calls now pass required `@full_name=NULL`, preserving valid contact/account-email assertions without endorsing ignored caller details. `OrdinaryUserConstructionPromotionAndHistoricalType` retains historical type/name/contact-email and independent account-email checks in [user_construction_tests.sql](../src/tests/sql/user_construction_tests.sql) and [UserConstructionCases](../src/tests/AuditTests/UserConstructionCases.cs). Rejection needs a production change before an acceptance test. |
| P3/P3b: concurrent absent company name under RCSI; RC comparison; third creation fails | **Unresolved correctness finding**: [contact_insert](../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/create_contact_insert.sql) still counts then creates without a miss lock. Existing user-construction fixture checks tenant scoping/new company history/inactive rejection and pre-existing ambiguity 51313, not this race. P3b's incidental RC scan blocking is not a guarantee; its holder waits for the blocked contender and can hit its rendezvous deadline. Preserve that distinction when interpreting its printed company count. |
| P4: company contact promoted to account | **Policy settled by the author, 2026-09-06; enforcement pending**: ordinary accounts belong to human person contacts. Companies/organizations and groups may own business data or be represented by a person, but cannot themselves receive ordinary user accounts. Current eligibility checks entity contact type, not person contact category; new construction also accepts a non-person category. Add atomic rejection for both paths in a production follow-up, then regressions under both profiles. Preserve the reserved System technical bootstrap; future agent/bot/application identities require a separate explicit contract. No production/test change was made in this policy discussion. |
| P5: promotion then email shares version/root snapshot | **Added** `PromotionThenEmailSharesRevisionAndRollsBackTogether`, [ReviewProbeCases.PromotionThenEmail](../src/tests/AuditTests/ReviewProbeCases.cs): existing root, entry token 1 for both commands, NULL allocation discovery, one revision 2/spine/root snapshot/account history/child snapshot/action; whole rollback restores earlier contact/email and removes account/ledger/evidence; fresh transaction commits and C# reader proves earlier contact type and later user/email state. Reverse order and new-root entry token 0 remain covered in `OrdinaryUserConstructionPromotionAndHistoricalType`. |
| P6: administrative occurrence versus recording clocks | **Covered in part**: `OrdinaryUserConstructionPromotionAndHistoricalType` first fixture assertion requires ledger modified=2007 and server recorded_at at/after test start; `SavedOrderSqlAndHistoricalReader` SQL ending separately checks occurrence/recording time. The probe prints **event.created**, which is recording metadata; the report additionally identifies **event.when_ocurred** receiving recorded_at in `user_insert`. That occurrence-field mismatch is **unresolved**, not an assertion that all clocks must equal each other. |
| P7: phone parameters populate contact card but account/history phone stays NULL | **Capability unimplemented**: source routes phone parameters to legacy contact construction; no account-phone input/workflow exists. Do not assert permanently NULL account phone or port a phone family. Future separate account input needs its own security/history contract. |
| P8: hypothetical privileged delete snapshot says UPDATE | **Future lifecycle contract required**: snapshot helper derives INSERT/UPDATE for implemented creation/promotion. There is no general root delete/restore API or explicit operation argument. Preserve the raw-DML counterexample; do not turn op 2 on a deleted root into a passing lifecycle test. Creation/promotion op 1/2 remain asserted by the ordinary-construction fixture. |
| P9: fixture System actor realism | **Corrected interpretation/strengthened assertions**: after all four fixtures, P9's reported type/contact/account rows exist. Stage 1 supplies only a user-typed entity; stage 3 deliberately adds contact/account rows for view joins. `EmailLifecycleIdentityHistoryAndPermissions` now asserts stage-1 type instead of raw-DML promotion; `SavedOrderSqlAndHistoricalReader` asserts the enriched shape. Neither synthetic setup proves production bootstrap: `SystemBootstrapAndCrossDatabaseOwnership` verifies actual bootstrap, and `ApplicationSchemaCycleSeedsAndDeploymentRole` verifies actual seed construction and ordinary-user email execution. |

Report-only details also remain distinct from executable probes. The email report's issued-commit cancellation premise was corrected in ADR 0006; `CancellationDisposalAndUncertainCommitRaces` covers actual admission/failure behavior, not lost-ack recovery. The user report's seed-role finding remains open: the sample uses a raw Developer membership insert; the generic constructor's `initial_role_id` is already asserted in the ordinary-user fixture, but the actual seed does not use that option.

### Unresolved recipes and future assertions — not executed in this integration

Use only a newly owned fixture database with the actual schema and `SeedAsync(4)` equivalent; use its System actor, tenant 1, fresh keys/logins and observed concurrent task outcomes. The archive retains complete original SQL. These are future fix inputs, not green-gate tests or permission to touch application databases.

- **P1:** call `security.user_insert` twice with distinct public keys/full names and the same login in one tenant; inspect both account rows. Future assertions depend on the selected login scope, including concurrent attempts.
- **P4:** create `contact_type_id=2` with `contact_insert`, then promote at expected version 1; also try new-user construction with that contact category and repeat for group contacts. The author's person-only ordinary-account policy is now settled: future assertions must require atomic rejection with existing contact state/history unchanged and no new account or committed audit evidence. Verify normal person construction/promotion and the explicit System bootstrap still work. Enforcement and these negative tests remain pending; the historical acceptance observation is not desired behavior.
- **P2:** create an ordinary contact named Alpha with initial email; promote at expected version 1 with `@full_name=N'Beta'`, `@person_first_name=N'Beta'`, `@person_job_title`, `@phone_number/@numbers_only` and `@person_company=N'Ghost Company'`. Inspect unchanged name/no corresponding details, phone, relationship or company. Future assertion: each supplied unsupported contact-detail input fails atomically; account `@email` with required `@full_name=NULL` still succeeds. Validation must distinguish caller inputs before the current name defaults are applied.
- **P3:** RCSI ON, session A begins/enrolls and constructs a user naming a fresh company, retaining its transaction; after A's successful call, B constructs another user naming the same company and commits; A commits. Count company-category rows in tenant 1, then attempt a third user with that name (historical result: two companies, 51313). For a future locking fix, release A after observing B blocked rather than waiting for B to finish; then require both users linked to exactly one company under both profiles, unrelated names independent, and existing ambiguity still rejected. Preserve P3b's timeout/scan caveat above.
- **P6:** create a new user with `@created='20070615'`; compare entity created/modified, ledger modified/recorded_at, event created/**when_ocurred** for its returned audit version. Future assertion after correction: when_ocurred preserves occurrence time while recorded_at/event.created retain server recording time.
- **P7/P8:** P7's contact phone inputs and returned account/history fields remain a routing observation until an account-phone contract exists. For P8, create a contact, begin/enroll, root-lock at version 1, allocate op 3, stamp entity.deleted/deleted_by with privileged DML, bump and call `entity_history_snapshot`, inspect op/deleted and roll back everything. Future delete/restore writers need explicit, validated operation semantics before asserting op 3; this recipe is not a supported lifecycle endpoint.
- **Seed role:** after the real schema seed, inspect its `security.user.new` event's `$.initial_role_id` alongside Developer membership. Future assertion should require the chosen role ID in that event after the seed uses the constructor option; general role history remains deferred.

### Integration execution and follow-up

Local execution used the same SDK/runtime/SQL Server and integrated-auth configuration recorded in the migration evidence below. Evidence is under ignored `artifacts/test-results/review-probes/`; each retry uses a distinct TRX/journal directory. The authoritative count increases **32 → 38** solely because three new scenarios each run in both profiles (18 + 18 + 2 parser tests).

| Execution | Result | Evidence relative to that directory |
| --- | --- | --- |
| Solution restore / final Release build | Exit 0 / 0; zero warnings/errors | `restore.log`, `build-final-output.log` |
| Solution discovery | Exit 0; 38 tests | `discovery-final.log` |
| Individual savepoint and deadlock filters | Exit 0 each; 2 passed each, zero failures/skips | `focused/` named TRX files; `focused-resources/` |
| Individual promotion, ordinary-construction and saved-order filters after setup corrections | Exit 0 each; 2 passed each, zero failures/skips | `focused-verified/`; `focused-verified-resources/` |
| Promotion filter after explicitly rejecting NULL revision outputs | Exit 0; 2 passed, zero failures/skips | `final-output/promotion.trx`, `final-output-focused.log`; `final-output-resources/` |
| First full gate | Exit 0; 38 passed, zero failures/skips; 3 min 20 sec | `review-probes.trx`, `full.log`; all 38 DBs removed, `full-resources/` |
| **Final full gate after NULL-output assertion** | **Exit 0; 38 passed, zero failures/skips; 3 min 24 sec** | `final-full/review-probes.trx`, `final-full.log`; all 38 DBs removed, `final-full-resources/` |

Final command: `dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=review-probes.trx' --results-directory artifacts/test-results/review-probes/final-full`, with `OVERMIND_TEST_RESULTS` set to the absolute `final-full-resources` path. TRX confirms **18 passing RCSI-off, 18 passing RCSI-on and 2 passing parser tests**. The final full run removed **19 databases per profile** (the cross-database scenario owns two). Across all this integration's focused/setup-failure/full executions, **92 create intents, successful creations, identities and removals reconcile exactly**, with no unresolved resources; `reconciliation.json` records the audit. Each removal is recorded only after the fixture's server-side `DB_ID` absence check succeeds. Production files/reports are unchanged and both archived scripts' Git blob hashes match HEAD. Documentation links and `git diff --check` pass. No `src/tests/sql/__pycache__` existed to remove. Remote CI/Kudu/SQL-auth execution remains unverified.

Two earlier promotion setup attempts failed (2 tests each, exit 1): the legacy signature requires an explicit `@full_name` argument, then an over-strong early fixture assertion expected contact/account rows before stage 3 supplies them. Both were corrected in tests, all four affected databases removed, and failure evidence retained in `focused/PromotionThenEmailSharesRevisionAndRollsBackTogether.trx` and `focused-final/`. These were test-authoring errors, not production fixes or deliberate sensitivity demonstrations. No production procedure or historical probe was changed for sensitivity experiments. The new invariants directly require 51103/1205, database rollback/commit postconditions and matching revision/history values; passing them is not a claim of mutation-tested fault coverage.

Independent follow-up for these additions is **complete — 2026-09-06** (the earlier completed migration checklist remains a separate checkpoint):

- [x] Review the three new scenarios, NULL promotion inputs, staged fixture assertions and complete A–G/P1–P9/P3b inventory against current production contracts.
- [x] Restore/build/discover 38 tests; independently run all three new methods in both profiles with a combined focused filter, then the unfiltered full gate with fresh evidence paths.
- [x] Inspect actual 1205 outcomes, historical/fresh-retry assertions, profile counts, failures/skips and exact owned-resource cleanup; keep unresolved recipes separate from verified results.

Codex independently reviewed the uncommitted integration over `d660dd4`, including both historical scripts in full, the new assertions and the relevant ownership, C# failure, promotion and company-lookup code. No blocking issue was found in this test-only change. Production files and the original reports remain unchanged; both archived Python files match their HEAD Git blobs. The review made no test or production changes. It recorded these results in this handoff and `AGENTS.md`.

Fresh evidence is under ignored `artifacts/test-results/review-probes-return-20260906-01/`, using the documented localhost integrated-auth configuration:

| Independent execution | Result | Evidence |
| --- | --- | --- |
| Restore / Release build / discovery | All exit 0; zero build warnings/errors; 38 discovered | `restore.log`, `build.log`, `discovery.log` |
| Three new methods, both profiles | Exit 0; 6 passed, zero failed/skipped; 27 seconds | `focused.log`, `focused.trx`, `focused-resources/` |
| Unfiltered solution gate | Exit 0; 38 passed, zero failed/skipped; 3 min 34 sec; 18 per profile plus 2 parser tests | `audit.log`, `audit.trx`, `full-resources/` |

All **44 databases** reconcile by exact name and owner across create-intent, successful creation, engine identity and removal: 6 focused (3 per profile), then 38 full-suite (19 per profile). Removal records follow the fixture's server-side absence check. `verification.json` records TRX class counts, cleanup reconciliation and actual SQL 1205 evidence. Every deadlock execution had exactly one victim and one committed survivor; both possible victim positions occurred across the focused/full runs. The assertions verified whole rollback, invalidation, surviving historical state and explicit fresh-unit retry. This does not introduce automatic retry or prove partial-savepoint success. All 42 local Markdown file links checked in the handoff, integration prompt and archive README resolve; `git diff --check` passes. Remote CI/Kudu/SQL-auth and production-scale performance remain unverified. The unresolved production recipes above were reviewed against source, not rerun or fixed in this follow-up.

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

### Independent return-session verification — 2026-09-06

The original implementation agent (Codex) inspected and executed the delivered migration at committed target **`d660dd4`**, compared with pre-migration baseline **`efacebb`**. The working tree was clean before verification. Production and test code were not edited for this review; only this evidence record and the shared memory pointer were updated afterward.

Inspection confirmed no migration changes under the production Framework/Data/Applications/Domain trees or `global.json`. Git blob comparisons confirmed that all four SQL fixtures, both independent probe files, and the retained lifetime/order/user-construction C# case files match the baseline exactly. SchemaCycle changed only its ownership comment. All **42** production setup paths retain their original order, and the **16** shared-unit `Check` statements remain after console extraction. The review also traced fixture setup, the extracted SQL concurrency schedules, GO/session/error handling, per-scenario ownership/cleanup, both inherited profile classes, runsettings and the inactive CI examples. No blocking migration defect was found for the reviewed local test workflow.

Environment: Windows x64 **10.0.26200**, .NET SDK **8.0.424**, VSTest console **17.11.1**, and the framework/adapter/testhost package versions stated above. SQL statements executed on dedicated `localhost`, **SQL Server 2022 RTM-GDR 16.0.1190.2**, using Windows integrated authentication and explicit local certificate trust. Restore initially encountered the agent sandbox's restriction on the normal user NuGet configuration; rerunning with approved access succeeded. This was an execution-environment restriction, not a repository or package error.

The commands were the documented single-solution commands, with results redirected to the fresh ignored directory **`artifacts/test-results/return-session-20260906-01/`**. `OVERMIND_TEST_RESULTS` selected its `focused-resources` or `full-resources` subdirectory. Logs, TRX and `cleanup-verified.json` are local evidence, not committed artifacts.

| Independently executed check | Exit/result | Evidence |
| --- | --- | --- |
| `dotnet restore src/overmind.sln` with normal NuGet access | 0; projects up to date | Tool execution record |
| Release build, `--no-restore` | 0; zero warnings/errors | `build.log` |
| Documented `--list-tests` | 0; 32 discovered | `discovery.log` |
| Focused saved-order scenario, RCSI off | 0; 1 passed, 0 failed/skipped | `focused.log`, `focused.trx` |
| Full unfiltered command with `src/tests/audit.runsettings` | **0; 32 passed, 0 failed/skipped; 3 min 19 sec** | `audit.log`, `audit.trx` |
| Empty filter `FullyQualifiedName=NoSuchTest` | **1, expected**; no tests selected | `empty-filter.log`, `empty-filter.trx` |
| Focused allocation scenario with connection configuration removed | **1, expected**; one configuration failure before database creation | `missing-config.log`, `missing-config.trx` |

TRX inspection confirmed **15 passing ReadCommittedTests**, **15 passing ReadCommittedSnapshotTests**, and **2 passing SqlScriptTests**. The negative checks verified failure reporting; their deliberate failures are not unresolved test regressions. No source was temporarily weakened or modified to obtain these results.

Resource-journal reconciliation found **33 successful creations and 33 matching identity/removal records**: one database for the focused run, then 16 per profile for the full run. There were no unresolved create intents or cleanup failures. Each successful fixture cleanup executed its SQL `DB_ID` absence assertion after DROP; the returning review matched those successful results to the exact run journals. No broad database cleanup or additional application-database operation was performed.

The migrated .NET suite is suitable for continuing local backend work. GitHub Actions/Kudu execution, remote SQL authentication and the separately identified fault-injection/production boundaries below remain unverified or deferred; this local review does not extend those claims.

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

## Return-session verification checklist — completed 2026-09-06 at d660dd4

- [x] Inspect the delivered diff and coverage map, including session/batch/concurrency changes; confirm production and historical probes are unchanged.
- [x] Restore/build/discover from the repository root with the commands above; verify both profile classes and expected scenario names.
- [x] Run the focused saved-order scenario, then the full suite in both RCSI profiles.
- [x] Inspect process exit status, failed/skipped counts, SQL errors and TRX/resource artifacts.
- [x] Confirm cleanup of that returning run's exact owned databases using its journals and the executed post-DROP server-state assertions.

Completed by the returning implementation agent's own inspection and executions recorded above, independently of the migration author's earlier runs. Revalidate affected coverage after future code changes; this is a dated checkpoint, not a claim about later revisions.
