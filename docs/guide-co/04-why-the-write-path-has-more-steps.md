# 4. Why the write path has more steps

[← Ask history a question](03-ask-history-a-question.md) · [Contents](README.md) · [Next: Tenants, people, users and shared values →](05-tenants-people-users-and-shared-values.md)

Most of the added SQL exists because a rule that feels obvious in one procedure becomes less obvious when procedures call one another, two users edit concurrently, or a connection fails. It helps to learn each rule through the mistake it prevents.

## Who owns the transaction?

A standalone public email command can open, enroll and complete its own transaction. If a caller already owns a transaction, the command joins it; the caller remains responsible for completion and rollback on failure.

An **ambient transaction** is simply a transaction already open when the procedure is called. Its existence alone does not say that it follows this framework's audit contract. Native SQL callers explicitly enroll it with `data.audit_unit_begin`. The C# `SqlAuditUnit` does the corresponding setup for its owned transaction.

Enrollment does not allocate a ledger number. It establishes the allowed unit boundary. Actual allocation is lazy.

This distinction caused the earlier CreateSchema failure: the application seed had a real SQL transaction, but it was not enrolled. The correction gave business seed batches a named audited runner. Ordinary DDL/resource execution kept its own runner. The intent is now visible at the call site.

## Why passing a number is no longer enough

Imagine an application accidentally retains 1052 after committing, then passes it into tomorrow's edit. If the only rule were “this ledger row exists,” tomorrow's change could attach to yesterday's audit entry and claim yesterday's attribution.

The current contract for optional INOUT is:

| Input inside an enrolled unit | Meaning |
| --- | --- |
| NULL | Discover this unit's existing allocation, or allocate when needed. |
| A number | Assert that this active transaction owns that allocation. |

A non-NULL number cannot start an independent standalone unit. A committed old number, another database's number, or a conflicting actor/tenant is rejected.

SQL Server implements proof of ownership using private, transaction-owned application locks. Think of the per-version lock as a temporary ownership record held by the active transaction. It disappears when the transaction completes. Reuse checks for ownership already held; it does not acquire ownership of an old number on demand.

An engine transaction ID helps the code find a possible current allocation efficiently. It is a lookup hint, not a permanent business identity or the proof itself. A writable session variable is also insufficient evidence of ownership.

You do not need to use these private helpers from ordinary application code. Public entry points and the transaction owner compose them. Other database providers would need an equivalent lifetime guarantee; copying SQL Server's lock function names is not the goal.

## Why lock the root when editing only an email?

Mariana and another operator can both read Lina at revision 3. If they save independently without checking the entry version under protection, the later writer can overwrite work it never saw.

The email writer obtains the root's exclusive write lock, then validates the expected version. The winner advances Lina to 4. After waiting, the other writer sees that its expected 3 is stale and fails. The application can then present the newer state and resolve the conflict.

The same lock coordinates every owned email change, including child identity allocation and saved positions. We pay serialization for concurrent edits to the same aggregate because those edits share a revision and list invariants. Independent contacts can usually progress independently, subject to shared references and other database resources.

Repeated calls within Mariana's own unit still use entry revision 3. The root lock and matching spine let the framework distinguish its own provisional bump from someone else's committed change.

## Why allocate after locking an existing root?

The historical reader uses numeric boundaries within a root. Therefore a later accepted revision of Lina must not receive a smaller audit number than an earlier revision.

Normally we lock known existing roots before allocating. Sometimes a unit discovers another root only after it already has a number. Suppose unit A has 1052, then discovers a company that unit B has already changed under 1053 and committed. A cannot safely stamp that company with 1052 afterward. It rejects this ordering conflict and the owner rolls back the entire unit.

If the company's stamp is older than 1052, that particular ordering check permits the late root; normal expected-version and business checks still apply. We therefore do not require callers to know every possible root in advance.

Known multiple roots should be acquired in a consistent order to reduce deadlocks. That does not eliminate every deadlock or cross-root invariant. Domain operations must protect the relationships and balances they depend on. Automatic whole-unit retries are not implemented by the current C# API, and stale user edits should not be “fixed” by silently substituting a newer expected version.

## Why does the reader also take a lock?

A historical result is assembled from several queries. It needs one consistent view of root context, child snapshots and actions.

The current SQL reader owns a short SERIALIZABLE transaction and reads the same root key first with a shared lock. The writer takes its exclusive root lock before child changes. This prevents the reader from assembling a mixed result and avoids a reader/writer lock-upgrade cycle found during testing. It also means reading old history can wait for a current write to that root.

A snapshot-based reader remains a possible measured optimization. Current native writers require READ COMMITTED, with RCSI either off or on. RCSI is SQL Server's row-versioned read implementation for that isolation level; enabling it does not remove this framework's explicit root locks. Explicit SNAPSHOT writes are outside the supported writer profile.

## Why commit needs its own failure rule

Before commit admission, a failed or cancelled C# command invalidates the unit. Disposing an uncommitted unit rolls it back. Once commit is admitted, later cancellation cannot be treated as an instruction that certainly undoes the database work.

If the issued provider commit fails, the API reports `AuditUnitCommitUncertainException`. The caller knows the outcome needs reconciliation; it does not know from that exception alone that the transaction rolled back. The provisional version is useful for correlation, but it is not a durable retry receipt.

Request receipts and safe recovery from an uncertain commit remain future work. The current implementation deliberately does not blindly repeat the business operation.

These rules explain most of the small procedures: enroll, assert ownership, resolve context, lock, allocate, bump, preserve evidence. Their purpose is to let nested code share one business operation without silently weakening its guarantees.

For a second pass, [ADR 0005](../adr/0005-email-reference-family.md) explains the native boundary and [ADR 0006](../adr/0006-email-review-corrections-and-saved-order.md) records the tested corrections.

[← Chapter 3](03-ask-history-a-question.md) · [Next: Tenants, people, users and shared values →](05-tenants-people-users-and-shared-values.md)
