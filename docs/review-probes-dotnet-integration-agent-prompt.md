# Agent task: assess historical review probes and integrate useful .NET regressions

Prepared 2026-09-06 for a separate agent session. This task brief does not itself change the tests.

## Purpose and scope

Overmind's maintained backend tests now use MSTest/VSTest and `dotnet test`. Two Python scripts remain as preserved independent-review evidence. Review those scripts against the current implementation and test coverage, then integrate the useful missing regressions into the existing .NET suite.

The goal is coverage we can maintain and trust. Some original probes are already covered, some describe behavior that has since changed, and some expose unresolved production defects or policy questions. Do not mechanically translate every probe into a passing test.

This is a test/coverage task. Do not fix production procedures, settle login/account policies, implement phone or another family, or introduce a second test runner. Preserve unrelated working-tree changes and the independent reports/probe contents. Read `AGENTS.md` and current Git status/history before starting; the migration's independently verified checkpoint was `d660dd4`, but further changes may exist.

## Sources to inspect

Read these scripts in full, including their actual SQL and result checks rather than only the introductory comments:

- [Email review probes](../src/tests/review/email-reference-family/run_review_probes.py).
- [User-construction review probes](../src/tests/review/user-construction/run_user_construction_probes.py).

Compare them with their [email report](email-reference-family-independent-review.md) and [user-construction report](user-construction-independent-review.md), then the implemented contracts in [ADR 0005](adr/0005-email-reference-family.md), [ADR 0006](adr/0006-email-review-corrections-and-saved-order.md) and [ADR 0007](adr/0007-ordinary-user-construction-and-type-history.md).

Use [testing-handoff.md](testing-handoff.md) for current commands, setup, coverage and execution evidence. Inspect [AuditScenarios.cs](../src/tests/AuditTests/AuditScenarios.cs), [SqlScenarios.cs](../src/tests/AuditTests/SqlScenarios.cs), the C# scenario files, and the SQL fixtures under `src/tests/sql` before adding tests. Inspect production code only as needed to establish the behavior each proposed regression should protect.

The historical scripts retain old paths, setup lists and sometimes stale descriptions. They are not runnable entry points for the current layout. For example, the user probe's P9 header claims the fixture actor has no account row, while the delivered report records a complete entity/contact/account fixture. Resolve such discrepancies from the SQL, report and current code; do not promote a stale comment into a new assertion.

## Classify every probe before deciding what to port

Create a compact inventory covering every probe and meaningful subcase, including cases not listed in a script's header. For each, record its original question, current applicable contract, existing coverage if any, and disposition:

| Disposition | Action |
| --- | --- |
| Already covered | Point to the exact maintained test/assertion. Avoid another expensive duplicate scenario. |
| Useful missing regression for implemented behavior | Add a named .NET test or a clearly identified assertion in the appropriate existing scenario. |
| Correctness defect still present | Preserve the reproducible counterexample and proposed future assertion; report it as unresolved. Do not bless the defect with a passing acceptance test or quietly fix production. |
| Policy not selected or capability unimplemented | State what decision/implementation is required before defining an acceptance assertion. |
| Obsolete or misleading historical probe | Explain the changed contract, corrected interpretation or invalid assumptions, retaining provenance. |

A newly added test should assert a supported invariant and fail if that invariant regresses. A script that prints a surprising count is not yet such a test. Do not add ignored or deliberately failing tests to the full audit gate, and do not change its filters to conceal failures. For unresolved items, include concise reproducible SQL or a precise recipe in the coverage inventory when useful; no replacement Python or custom diagnostic framework is needed.

## Areas that deserve particular attention

The email review covers savepoint/guard behavior, historical-reader lock cost, stable child identity versus principal selection, RCSI behavior, opposite-order root deadlocks, and catalog contention. Check the script body for all additional cases. Reader footprint, saved order, RCSI profiles and several catalog races already have maintained regressions; establish whether anything materially different is missing.

An opposite-order two-root deadlock may be a valuable missing case. Assess whether the current suite proves whole-unit rollback, consistent surviving history and unusability of a failed C# unit after a deadlock. If adding it, orchestrate actual overlap with bounded coordination and check database postconditions. Avoid relying on incidental timing or an arbitrary fixed victim. The API does not implement automatic retry; a test of a fresh retry must explicitly create a new unit and respect current version checks.

Likewise, a savepoint probe must not silently establish support for partial audit-unit success. Follow the declared whole-unit ownership/failure contract. Performance probes should test the intended bounded access/independence property, not copy an outdated exact index-plan or one-key-lock expectation.

The user-construction review includes duplicate logins, ignored promotion inputs, concurrent company-name creation, organizational accounts, composed promotion/email changes, historical timestamps, account phone, snapshot operation labels and fixture realism. Some are known open policy/correctness items. Passing tests must not establish that duplicate logins or dropped inputs are desired behavior. Positive composition and historical type cases may already be covered.

If later commits have fixed an item, verify the actual fix and add the missing regression where appropriate. Do not assume the old report still describes today's code.

## Implementation and verification

Use the existing `AuditDatabase` fixture, `SqlScript` executor, `SchemaFiles`, SQL fixtures and concurrency helpers. Keep production DDL as the source of truth. Add new applicable scenarios to `AuditScenarios` so they run under both real RCSI profiles, with meaningful discoverable names and no cross-test state dependency.

Preserve actual SQL connections, transaction lifetimes, permissions and concurrency overlap. Do not substitute mocks, sequential calls or relaxed expected errors for the original mechanism. Observe all concurrent participants, use bounded waits, and keep the full-unit rollback and cleanup checks.

Only use databases freshly generated and owned by the test run. Preserve its ownership journal and exact-resource cleanup. Any test-session termination must target only the verified session owned by its disposable fixture. Never run probes against application databases or perform a prefix-wide cleanup. No Python or sqlcmd dependency may return to the maintained workflow.

After reading the documented configuration, restore/build/discover using the single `src/overmind.sln`. Run new or strengthened scenarios individually, then the full suite using:

```powershell
dotnet test src/overmind.sln -c Release --no-build --settings src/tests/audit.runsettings --logger 'trx;LogFileName=review-probes.trx' --results-directory artifacts/test-results/review-probes
```

Select fresh result/journal directories if those paths already contain another run's evidence. At the independently verified baseline the suite had 32 tests: 15 per RCSI profile and two parser tests. Report the new count and explain each addition; more tests alone do not demonstrate more coverage. Check actual profile execution, failures/skips, exit status and owned-resource cleanup. Record any environment limitation honestly.

When a new regression's sensitivity is not evident, demonstrate that it detects the original condition using a narrowly scoped disposable-fixture experiment where practical. Do not revert or weaken production files to manufacture this proof, and do not claim a test was shown to catch the bug merely because it passed today.

## Documentation and archival outcome

Add one concise **historical review probe coverage** section to `docs/testing-handoff.md` with the inventory, old probe IDs, current test locations/filters, remaining decisions and executed results. Keep unexecuted reproductions and future tests visibly separate from verified results. Update relevant current coverage documentation and AGENTS/handoff pointers without creating another large report series or changing old independent reports.

Add a short `src/tests/review/README.md` explaining that the Python scripts are archived review evidence, identifying their historical checkpoints and linking to the current .NET coverage inventory. Preserve the original script contents in this task. For any still-useful unported item, retain enough reproduction detail to support the later production fix. Identify whether the original files could eventually be removed or relocated after coverage/provenance is complete; do not delete them merely to remove `.py` extensions from the tree.

Generated `__pycache__` files are not review evidence and are not needed by the .NET suite. If cleaning that cache during this task, verify the exact resolved directory is the intended `src/tests/sql/__pycache__` inside the workspace and remove only that generated directory.

In your final response, state which probes were already covered, which new regressions were integrated, which remain unresolved and why, the exact test results and cleanup outcome, and where the updated coverage inventory lives. Leave the returning agent a small verification checklist for the added scenarios; do not mark that later independent execution complete on its behalf.
