# Independent review request: email reference family

Please independently review the implemented email family and its audit-unit foundation in `D:\Code\GitHub\Sistrategia\overmind`. Decide whether this is a sound reference to copy to phone and subsequent child families, identify defects that must be fixed first, and challenge unnecessary complexity. This is a review request, not authorization to change production code or implement the next family.

## Review checkpoint

The baseline before this implementation/documentation checkpoint is `f320fa15ce0040624d6ba26187e57d41f6b196aa`. The review target is the commit that first adds this prompt. Resolve it rather than assuming a later HEAD is the same checkpoint:

```powershell
git log --diff-filter=A -1 --format=%H -- docs/email-reference-family-independent-review-prompt.md
git diff --stat f320fa15ce0040624d6ba26187e57d41f6b196aa <review-commit>
```

Record the full baseline and reviewed commit IDs in your report. If the working tree has subsequent changes, distinguish them from the checkpoint; do not reset or overwrite them. The checkpoint includes the earlier design refinements and source-intake findings, as well as the email code and schema-cycle fix.

## Product and scope

This database framework's audit/history capabilities have helped resolve real customer mistakes and security incidents. Audit quality and useful reconstruction matter more than choosing the shortest implementation, but some deployments have millions of rows and many gigabytes. Most deployments have one database, often one tenant; disconnected branches/clients and history-preserving cross-provider migrations matter in selected installations.

Overmind is a partial remake, intentionally holding only part of the eventual framework. Layers are data → entities → contacts → security. A real default tenant is appropriate; shared immutable dictionaries, role definitions and platform identities are legitimate. SQL Server/Azure is primary, with equivalent behavior expected to be possible on PostgreSQL/MySQL and later disconnected-client adapters. We have selected gapful database-local dbrow_version, user-friendly aggregate entity_version, and practical future replay/reconciliation. A blockchain, revision DAG or universal synchronization engine is not a prerequisite.

The implemented boundary is email insert/update/delete/restore; retained child identities; current-unit final history; ordered typed actions; root revisions; historical reading/diffs; SQL/C# transaction ownership; runtime grants; and the bootstrap/seed integration needed for fresh creation. Contact construction uses the same email writer. Contact email edits do not automatically change security.user.email, login or recovery credentials.

Authentication and contact-level authorization belong to a trusted backend. SQL actor/tenant checks do not make a supplied GUID an authentication credential. Privileged database owners remain trusted; this is not cryptographic protection against an administrator. Shared-actor delegation, general user lifecycle, role history, live upgrades, legacy coverage adapters, distribution, redaction and uncertain-commit receipts are deferred. Flag a deferred item as a blocker when a concrete dependency makes it necessary for this email boundary, not just because it is absent.

## Read in this order

1. `AGENTS.md`, then `docs/adr/0005-email-reference-family.md` and `docs/email-reference-family.md`. The latter contains the source map and test commands.
2. Actual DDL, procedures, C# ownership/reader classes and tests. Treat implementation claims and passing tests as claims to verify, not proof.
3. Consult `docs/dbrow_version-allocation-design.md` and ADRs 0002–0004 only as needed to distinguish current contracts from future recommendations. ADR 0001 is historical where superseded.
4. Use `docs/dbrow_version-legacy-implementation-findings.md` for prior source evidence if helpful. A new broad reading of sibling applications is unnecessary. The earlier independent review and answers are preserved input, not authority over contradictory code or evidence.

## Questions I particularly want you to challenge

### 1. Does native enrollment actually prove active allocation ownership?

Review data.audit_unit_begin, audit_unit_assert and dbrow_version_ensure together with their grants and execution context. Enrollment and per-version locks live in the private dbo namespace and are transaction owned; allocation_transaction_id is only an indexed discovery hint. NULL should find the active allocation; a supplied number should assert that same allocation, never authorize an old one.

Can an email_runtime caller forge, release, revive or confuse that ownership through public entry points, a supplied committed version, session state, pooling, nested transactions, savepoints or database switching? What happens after rollback, engine-ID reuse, restart or restore? Separate supported lifetime behavior, operational assumptions and privileged-owner attacks. Identify the smallest correction if a gap exists; do not replace the whole design without demonstrating why.

### 2. Is the history/action state machine correct for every meaningful sequence?

Trace insert/update/delete/restore within one unit and across commits: repeated updates, change/revert, insert/delete with no final snapshot, later restore of that committed canceled creation, delete/restore of a preexisting child, and repeated absence/presence cycles. Does history always reconstruct final state while actions preserve actual intermediate values? Can any path mutate prior committed history, silently manufacture known absence from incomplete history, or lose attribution?

Is retaining contact_email_identity plus a root/family ordinal counter justified for stable identity and reconstruction? Which guarantees would a simpler alternative preserve or lose? Committed issued ordinals must not be reused; provisional rolled-back IDs may be.

### 3. Are root ordering and optimistic concurrency enforced throughout composition?

Check root lock before first allocation, rejection of a late root with a newer stamp, bump-once behavior, unit-entry expected versions, constructor entry version 0, no-ops and new roots. Can two writers or a multi-root unit violate monotonic root history? Are failures propagated so callers discard the entire failed unit? Does any documented SQL isolation assumption need to be narrower?

### 4. Is the historical reader consistent, and is its locking cost acceptable?

The reader owns a SERIALIZABLE transaction and takes a shared barrier on the same clustered root key the writer locks exclusively before child mutation. Review the actual lookup order, index-key locking, actor lookup, root bump, catalog access and four result sets. Are there remaining concrete reader/writer deadlock cycles or mixed-revision results? Distinguish unavoidable/retryable multi-root deadlocks from avoidable ones introduced by this template.

Do historical names, deletion context, missing revisions, optional diffs and revision-specific actions behave correctly? Does C# observe command completion and late errors? Is short serializable reading a reasonable first profile, or does a concrete workload justify requiring snapshot isolation now? Explain the deployment and portability tradeoff.

### 5. Are the C# transaction lifetime claims too strong?

Inspect SqlAuditUnit's private connection/transaction, fixed actor/tenant, semaphore, provisional outputs, no-op results, failure invalidation, disposal and MARS rejection. In particular, test cancellation while queued and races involving a queued command, CommitAsync and DisposeAsync—not only a pre-cancelled token with no competing task. Can work commit after another caller has been told the unit failed? Are cleanup or rollback errors able to hide the original failure or leave a usable context? Uncertain commit is explicitly not solved by a durable receipt yet; assess whether the current API describes that limitation accurately.

### 6. Do actor/tenant checks and runtime permissions match the stated trust boundary?

Check unknown/omitted tenants, unknown or inactive actors, user-type eligibility, same-tenant scope, is_system, private/deleted/locked targets, catalog visibility and direct helper execution. Look for concrete unintended capability available to the shipped email_runtime role. Identify where the implementation relies on application authorization or on legacy constructor behavior, including whether those legacy paths can be reached under the runtime grants. Legitimately shared catalogs are not automatically a defect; unintended disclosure/access is.

### 7. Is exact dictionary identity correct and worth its cost?

Review byte-plus-length keys and matching predicates, case/trailing spaces/trailing zero UTF-16 units, NULL location, maximum input widths, no-row output reset, concurrent misses and existing-value hits. Do not assume BIN2 or VARBINARY alone supplies exact identity: earlier probes found padding equality in both cases. Can lookup plans create a shared bottleneck, duplicate keys, truncation, or avoidable deadlocks? Keep exact accepted spelling distinct from normalized matching and business email validation.

### 8. Is application integration complete for this boundary?

Review actual builder registration/drop order, System reservation and idempotency, a default tenant whose local ID is not 1, tenant allocation, initial contact email and the application business seed. The first suite missed that RunLocalStoredCommands opens an ambient transaction; CreateSchema then failed with 51102. The seed now explicitly enrolls that transaction, and SchemaCycle.cs exercises the real Overmind manager's CreateSchema → DropSchema → CreateSchema. The user also confirmed drop/create works after the fix.

Could another supported caller still bypass or fail enrollment? Does the fix preserve transaction ownership without weakening the guard or enrolling generic DDL before the helpers exist? Verify that green selected-procedure tests do not conceal a broken real application path. General legacy self-registration remains a separate policy problem; explain any direct effect on this implementation.

### 9. What should we measure before scaling or copying the pattern?

Consider millions of roots, a long history on one root, few versus many email identities, high same-root contention, catalog misses and existing-value reuse. Assess allocation discovery, as-of seeks, history/action indexes, ledger ordinal updates, retained identities, wide exact keys and write amplification. Recommend a small, representative benchmark with measurable acceptance criteria. Do not infer throughput or capacity from the existing concurrency assertions.

Is there complexity we can remove now without losing a concrete audit guarantee? Conversely, is there a small missing invariant that becomes expensive to retrofit once phone/address families copy this design?

### 10. Are the portability and audit claims honest?

Which guarantees depend on SQL Server behavior, and can PostgreSQL/MySQL supply an equivalent contract without duplicating these exact lock APIs? Identify engine-version/isolation/permission assumptions that need documenting or tests. Cite primary vendor documentation for uncertain semantics and distinguish unexecuted provider reasoning from measured behavior. Local audit ordering is not a global commit order, and this reference family does not claim decentralized delivery or regulatory certification is already implemented.

## Verification and working rules

Review code before running commands. The existing harness requires .NET 8, Python, sqlcmd and an authorized local SQL Server account. It creates and removes its own generated `OvermindAuditTest_<random>` databases; it must never target a customer/application database.

```powershell
dotnet build tests/EmailReference/EmailReference.csproj --nologo
python tests/sql/run_dbrow_version_tests.py --server localhost
```

The implementing agent reports the expanded suite passed on local SQL Server 2022 with zero build warnings/errors and all three disposable databases removed. Independently verify what you can. If execution is unavailable, say so; do not convert inspection into a claimed test result. No need to repeat a successful suite without a new test/change or unresolved concern.

Use focused reproductions for suspected defects. If you add probe files, keep them separate from production code, under `tests/review/email-reference-family/`, and describe their setup/cleanup. Do not edit sibling repositories, deploy anything, push changes or apply production fixes during this review. Do not print credentials or use existing application connection settings for experiments.

## Deliverable

Write `docs/email-reference-family-independent-review.md` and summarize the most important results in your reply. Include:

- Reviewed commit/baseline, scope, commands actually run and execution limitations.
- Findings first, ordered by severity. Each needs a file/line, concrete trigger or minimal reproduction, violated invariant, practical impact, and smallest proposed correction. Label confirmed failures separately from plausible unverified concerns.
- A concise response to each of the ten question groups; supported agreement is useful, and no finding is a valid outcome.
- A verdict on using email as the next-family template: ready, ready after named fixes, or requiring a specific design change. Explain which items block copying the pattern and which can remain subsequent work.
- A short assessment of the balance between audit value, complexity, performance and provider portability, plus the highest-value missing tests.

Please form your own conclusion. Do not protect the current design because it is documented, or expand the scope merely to make the review longer.
