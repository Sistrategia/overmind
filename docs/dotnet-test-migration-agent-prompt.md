# Agent task: consolidate backend testing on .NET and dotnet test

Prepared 2026-09-06 for a separate implementation session. This file is the task brief; creating it does not implement the migration.

## Objective

Migrate Overmind's maintained Python SQL-test orchestration and custom .NET console harness into conventional, discoverable .NET tests run through `dotnet test`. Preserve the existing behavioral coverage and use the real SQL Server implementation.

The user wants developers and CI servers to use languages and runtimes already needed by the application. The backend uses .NET; React/TypeScript will serve the frontend. Use C# for backend test orchestration and retain useful SQL fixtures as SQL. The supported backend test path must no longer require Python, Node.js or `sqlcmd`.

The user uses both GitHub Actions and Windows Azure App Service's Kudu deployment pipeline. Provide a CI-independent test entry point, reliable failure exit codes, machine-readable results and documented environment requirements. Keep orchestration reusable across these environments rather than embedding it in a particular pipeline.

Implement this as a bounded testing-infrastructure migration. Do not bundle production audit changes, pending user-construction fixes, phone-family implementation, provider ports or an application framework upgrade into it.

## Read first and establish the actual baseline

Read repository `AGENTS.md`, then these focused sources:

- [Email usage and verification guide](email-reference-family.md).
- [ADR 0005](adr/0005-email-reference-family.md), [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md), and [ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md), concentrating on test contracts and limits.
- [The user-construction review](user-construction-independent-review.md), to distinguish known production gaps from test-migration regressions.
- [global.json](../global.json) and the current project/solution definitions.

Run `git status` and inspect recent history before editing. Other agents may have changed the implementation since this prompt was written; preserve their work and establish the current coverage baseline. There is no need to reread the entire design history or sibling applications.

At preparation time, `global.json` requests SDK 8.0.422 with `latestFeature` roll-forward, and the test harness targets `net8.0`. The application solution is [src/overmind.sln](../src/overmind.sln). Recheck these facts rather than freezing the repository to this snapshot.

## Current test inventory

| Source | Responsibility to preserve |
| --- | --- |
| [run_dbrow_version_tests.py](../tests/sql/run_dbrow_version_tests.py) | Disposable database creation, production DDL loading, SQL fixtures, concurrent sessions, both isolation profiles, bootstrap/cross-database checks, C# execution and cleanup. |
| [email_review_regressions.py](../tests/sql/email_review_regressions.py) | Adopted concurrency, dictionary, historical-reader lock-footprint and isolation regressions. |
| [user_construction_regressions.py](../tests/sql/user_construction_regressions.py) | Competing contact-to-user promotions. |
| [SQL allocation fixtures](../tests/sql/dbrow_version_tests.sql) | Allocation, composition, actors, tenant scope and rollback. |
| [SQL email fixtures](../tests/sql/email_family_tests.sql), [order fixtures](../tests/sql/email_order_tests.sql), [user fixtures](../tests/sql/user_construction_tests.sql) | Existing behavioral assertions against real procedures and tables. |
| [EmailReference.csproj](../tests/EmailReference/EmailReference.csproj) and [Program.cs](../tests/EmailReference/Program.cs) | Current executable harness, shared units, historical readers/diffs/actions and command lifetime. |
| [OrderingCases.cs](../tests/EmailReference/OrderingCases.cs), [LifetimeCases.cs](../tests/EmailReference/LifetimeCases.cs), [UserConstructionCases.cs](../tests/EmailReference/UserConstructionCases.cs) | Saved order, commit/cancellation/disposal races, uncertain commit and historical promotion behavior. |
| [SchemaCycle.cs](../tests/EmailReference/SchemaCycle.cs) | Actual application create/drop/create, seeds, ordinary actor usability, deployment-role membership and business batch boundaries. |

The Python runner invokes the .NET harness after arranging SQL state; they are not independent suites with interchangeable setup. Some cases depend on earlier fixture state. Account for that explicitly when splitting them into tests.

Original independent reports and the Python probes under `tests/review/` are historical review artifacts. Preserve them unchanged. They may remain as historical source files without being required by the maintained test entry point. Port any adopted missing regression into the maintained .NET suite with traceable attribution; do not delete independent probes simply to make a search for `.py` return nothing.

## Desired test structure

Use a mainstream test framework and normal test-project packages. `dotnet test` is the SDK entry point; a test host/adapter and framework provide discovery, assertions and reporting. It is not a package-free replacement for all test infrastructure. These components should restore through NuGet with the rest of the solution. [Microsoft's description](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test-vstest)

Prefer the conventional VSTest-compatible route for the repository's existing .NET 8 SDK. Choose a maintained .NET 8-compatible framework/adapter combination, such as MSTest or xUnit, and briefly record the choice. Avoid an SDK upgrade or runner-mode migration merely to obtain a newer testing platform. Verify package compatibility using primary documentation at implementation time.

Convert the console cases into named, discoverable tests with useful failure output. Do not make one opaque test that shells out to the old Python runner or console executable. Reuse substantial C# assertions and support code where appropriate; test sessions should not recursively build or invoke `dotnet run`.

Choose meaningful scenario boundaries. SQL scenarios may remain grouped when they intentionally share state, but expose enough names to diagnose a failure. Do not rely on incidental test discovery order. Use explicit fixture setup and controlled parallelization to keep one scenario/profile/run from corrupting another.

Add appropriate test-project solution integration, or a focused test solution if the application solution makes that necessary. Document an exact command from the repository root; do not assume bare `dotnet test` can discover a solution stored only under `src`.

Avoid building a general-purpose testing framework. A small reusable database fixture, script executor and concurrency helper should be sufficient unless the existing cases demonstrate another need.

## Preserve SQL execution and concurrency semantics

Use the repository's existing SqlClient dependency to execute SQL directly. Keep production scripts as the source of truth rather than copying DDL into test-only schemas. Preserve schema dependency order: data → entities → contacts → security.

Audit the scripts' actual batch requirements. `GO` currently works through `sqlcmd`; it must be handled by the replacement executor with correct connection and batch boundaries. Do not split arbitrarily on a string containing GO. Support the batch syntax actually used, with focused verification for the chosen parser, without inventing a full SQL command-line interpreter.

Preserve session SET behavior, errors and error numbers, transaction lifetime, temporary objects and cross-database cases. The current Python helper opens a separate sqlcmd session for each logical invocation, while a scenario may intentionally retain one connection across statements/batches. Avoid accidentally replacing that behavior with one shared connection for all tests or allowing pooled-session assumptions to hide a bug.

Concurrency cases must still use separate connections and actual overlap. Keep explicit rendezvous/coordination, bounded timeouts, cancellation and observation of failures from every participating task. Do not replace concurrent work with sequential assertions or longer sleeps that only make a race less visible.

Preserve at least these coverage groups:

- Allocation uniqueness, rollback gaps, optional INOUT, enrollment and forged/reused allocation rejection.
- Tenant/actor checks, root entry-version conflicts, late-root ordering and one bump per aggregate per unit.
- Email insert/update/delete/restore/order, retained child identity, final snapshots, actions and historical state/diffs.
- Exact dictionary identity, unrelated concurrent misses and reader lock-footprint regressions.
- Real restricted-role execution and denial of private helpers/direct access.
- Ordinary account creation/promotion, competing promotions, historical type and actor usability.
- C# command failure, cancellation/disposal races and uncertain commit handling.
- System bootstrap, cross-database ownership, real application schema cycles and seed behavior.

Run the full applicable suite in both READ COMMITTED profiles: RCSI off and RCSI on. These are database settings for distinct test fixtures, not merely two labels on the same configured database.

## Database configuration and cleanup

All database-changing tests must use generated disposable `OvermindAuditTest_<32hex>` databases created and owned by that run. A name matching the prefix alone does not prove ownership. Track the exact created resources and limit destructive cleanup to them. Never rebuild, truncate or drop an existing application database, including an App Service application's database.

Retain cleanup on success, assertion failure and setup failure. Handle partial setup and open connections/pools. Report cleanup failures without losing the original test error. An abruptly terminated process cannot guarantee cleanup; document a narrowly scoped recovery process instead of scanning and dropping every database with the prefix.

The commit-failure regression terminates its own test SQL session. Keep the session/database ownership checks and limit termination to that session. Do not widen this into killing other users' sessions.

Accept test-server/authentication configuration through documented environment variables or equivalent standard test settings, using the same interface locally and in CI. Support local Windows integrated authentication and an explicitly configured CI authentication path as appropriate. Do not read the application's production connection string as a fallback or print credentials in logs/results. Certificate trust bypasses used locally must be explicit test configuration, not an unconditional setting for every remote server.

Document required database capabilities and permissions: disposable database lifecycle, both RCSI profiles, actual cross-database scenarios, restricted-role setup, relevant lock/session DMV access and termination of the owned test session. A reachable SQL Server endpoint is still an integration-test prerequisite; eliminating Python does not eliminate the database.

## CI and Kudu requirements

Publish one authoritative full-audit command with deterministic nonzero failure status and TRX results or another broadly supported report format. Include configuration examples, Release execution, explicit restore/build/test stages where useful, and filters/categories appropriate to the selected framework.

The full integration command must fail clearly if its required configuration or capabilities are missing. Do not produce a green full-suite result by silently skipping database tests, running zero selected tests, or omitting privileged cases. If there is a useful database-free build/test command, label its limited scope explicitly; do not create artificial unit tests just to give that command a passing count.

Provide a minimal GitHub Actions example that calls the same commands, obtains test configuration securely, preserves failure exit codes and retains results after failure. Specify how its dedicated SQL test service is supplied. Do not assume a hosted runner already has a compatible local SQL Server. Actions examples should follow current official documentation and clearly identify any configuration still required. [GitHub's .NET workflow guide](https://docs.github.com/en/actions/tutorials/build-and-test-code/net)

Provide a Windows Kudu deployment-hook example or integration instructions using the same test command. Kudu supports custom deployment scripts, but SDK availability, test-database connectivity/capabilities, writable result paths and deployment sequencing must be checked for the actual site. Do not assume a production runtime implies the required SDK is installed. Preserve the script's failure status so a required failed test prevents deployment. [App Service deployment customization](https://learn.microsoft.com/en-us/azure/app-service/deploy-local-git), [Kudu custom scripts](https://github.com/projectkudu/kudu/wiki/Custom-Deployment-Script)

Kudu may run the full suite only when an appropriate dedicated SQL test environment is reachable and provisioned. Do not assume Azure SQL Database supports every full-instance/cross-database/DMV/session test identically. If that site cannot provide those prerequisites, document the split: execute the full integration gate in a suitable CI environment and use Kudu for the declared remaining build/deployment steps. Do not claim those environments have been tested unless they actually have.

Keep pipeline wrappers thin. Do not introduce Docker as a mandatory developer/Kudu dependency; optional CI service provisioning may use an appropriate existing runner capability. Prepare examples in the repository, but do not alter live App Service settings, install software on a live site, provision paid resources or deploy the application as part of this task. Avoid installing an active deployment hook that changes the existing release path without the user's explicit selection of that integration.

## Migration and acceptance

1. Inventory the current assertions and setup dependencies; establish the available baseline in both profiles before removing the old maintained runner.
2. Implement the .NET test project(s) and direct SQL orchestration. Keep a concise mapping from old scenarios to new discovered test names, including each isolation profile.
3. Run the new complete suite against disposable databases. Demonstrate discovery, successful execution, failure propagation and cleanup. Exercise a controlled failing case without leaving a deliberately failing assertion committed.
4. Compare coverage and outcomes with the baseline. Known production findings remain findings; do not weaken assertions or silently fix production code to make this migration pass. Report a blocking production issue separately and keep unaffected migration work moving.
5. Remove the superseded maintained Python orchestration only after parity is established. Historical independent-review probes remain preserved and outside the required developer/CI workflow.
6. Update the current usage/test documentation, relevant sections of both `docs/guide-co` and `docs/guide-cc`, and shared handoff/AGENTS notes. Preserve historical reports/ADRs as historical records rather than rewriting earlier executed commands. Prefer one concise migration note and updated commands over another large document set.

Completion means a fresh developer or CI runner can restore, discover and execute the maintained backend tests with the selected .NET SDK/packages and a documented SQL test environment, without Python, Node.js or sqlcmd. Both full profiles retain their coverage, owned resources are cleaned up, and reports expose meaningful test failures. Examples for GitHub Actions and Kudu use the same test interface and state their actual prerequisites.

In the final response, provide the chosen framework/runner, exact commands and configuration names, the coverage mapping, actual verification results, remaining environment limitations and any CI examples prepared but not executed. Do not claim remote pipeline validation from a local test run. Leave unrelated production redesign and live deployment for their own tasks.
