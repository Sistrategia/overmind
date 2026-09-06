# 6. What the audit costs

[← Tenants, people, users and shared values](05-tenants-people-users-and-shared-values.md) · [Contents](README.md) · [Next: Disconnected branches and migrations →](07-disconnected-branches-and-migrations.md)

Your priority is a very good audit trail, including installations with millions of records. That does not mean every additional write or lock is automatically justified. The useful question is what guarantee a cost buys, and whether it is paid locally or across unrelated work.

## Additional writes preserve different evidence

Mariana's Save writes current data, a ledger entry, a revision-spine entry, final child snapshots and actions. Each has a distinct purpose: current reads, shared attribution, revision lookup, reconstruction and intermediate action evidence.

Some costs are deliberately bounded. Nested calls reuse one ledger row. A root bumps once in the unit. Unchanged root and contact payloads need not be recopied for an email-only revision. Repeated writes to the same child within the unit converge into its one final snapshot, while meaningful actions remain separate.

This is still more database and transaction-log work than keeping only current rows. History and its indexes will grow. The tests establish behavior; they do not establish a capacity figure or an acceptable retention cost for a large customer.

## Most contention should have an understandable owner

Two writers editing Lina serialize on Lina's root. That protects one coherent aggregate revision and its list. If one contact becomes very hot, its root lock can become a real throughput limit. Splitting an aggregate is then a domain decision because it changes what a revision means.

Unrelated contacts should have a better path. The database-wide sequence avoids a tenant counter locked for the entire business transaction. Shared email/location dictionary insertion uses targeted value locks so different missing values do not automatically serialize merely because they occupy the same index gap.

There is still shared work: the allocator, log, indexes, actor/reference reads and common companies or role definitions. “Per-root locking” does not mean the whole operation touches only one lock.

An existing company referenced during account construction is held eligible through the transaction. A busy company can therefore couple otherwise separate creations and company edits. The unresolved company-name miss race is a different path from the already corrected email/location interning path. The current code must not be credited with a company concurrency fix it does not yet have.

## Saved order has an intentional write cost

Moving child 7 to the top also changes child 1's position. With a longer list, a move can shift many rows. Deletion similarly closes the position gap; restoration appends.

Dense integer positions make the user behavior clear and reconstruction straightforward. They also mean a move can write several current and historical rows. That is a reasonable starting tradeoff for contact email lists, but we should measure actual list sizes and move patterns before claiming it scales to every ordered collection.

Fractional positions or another ordering structure could reduce some shifts at the expense of different maintenance and audit rules. The current reference does not add that complexity without a demonstrated need.

## The historical reader needs the right access path

A global transaction-leading history key is useful when collecting a transaction's evidence. Reading Lina's history has a different access pattern: locate Lina first, then find the latest applicable version.

That is why root-leading history indexes were added. Testing then found that index presence alone did not ensure the desired plan: the locking reader could still scan unrelated history and hold a much larger set of locks. The correction requires root-leading seeks for its root/contact payload reads.

This is a concrete example of performance work supporting correctness and concurrency. It is also a provider-specific implementation choice. Another engine needs an appropriate query/index/read profile, not a literal translation of the SQL hint.

## Measurements that would inform the next decision

The useful workload is more varied than “insert a million rows.” We need a contact with long history, many independent contacts sharing common dictionary values, concurrent new values, long email lists, and many employees referencing one company. Multi-root business operations need their own contention cases.

Measure reconstruction latency, transaction duration, lock waits and retries, log volume, history/index size and the cost of reordering. When delivery exists, add backlog and offline retention measurements. These observations can justify compression, archival, different indexes or a different read profile.

The current regression suite includes concurrent writers and targeted lock-footprint tests. It has passed READ COMMITTED with RCSI both off and on in the reported local SQL Server runs. It is not a production-size benchmark, and it does not certify PostgreSQL, MySQL or Azure deployment performance.

The performance position today is therefore concrete but limited: the design avoids several unnecessary shared bottlenecks and preserves only the payload snapshots it needs, while retaining evidence that earns its storage. Capacity and retention choices still need representative customer workloads.

Further detail: [review corrections and measured regressions](../adr/0006-email-review-corrections-and-saved-order.md) and the [verification coverage](../email-reference-family.md).

[← Chapter 5](05-tenants-people-users-and-shared-values.md) · [Next: Disconnected branches and migrations →](07-disconnected-branches-and-migrations.md)
