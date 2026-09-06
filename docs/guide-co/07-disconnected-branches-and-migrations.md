# 7. Disconnected branches and historical migrations

[← What the audit costs](06-what-the-audit-costs.md) · [Contents](README.md) · [Next: Return to the code with a map →](08-return-to-the-code-with-a-map.md)

**This chapter describes the recommended future capability. The current email/user reference does not implement synchronization, origin mappings, an outbox/inbox, or historical migration.**

Your disconnected scenarios are practical: a branch in Mexico loses connectivity, people continue useful work, and the application later brings that work together with another database. A separate recurring need is moving logical data and its history into a new schema or provider.

The local audit foundation is valuable to both because it identifies business units and preserves their outcomes. It does not require every ordinary single-database installation to operate a distributed system.

## A branch's number remains local

Suppose the branch corrects Lina's email while disconnected. Its transaction number is 73. The central database may allocate 8120 when it later accepts that source operation. Both numbers are meaningful in their own database.

The proposed source identity is a pair: **which origin produced the transaction, and that origin's transaction number**. The receiver preserves that pair and maps it to its local application. It does not insert 73 as though 73 were the receiver's next local audit number.

| Question | Example answer |
| --- | --- |
| Where was the change originally recorded? | Branch origin B, transaction 73. |
| Which local unit accepted it centrally? | Central unit 8120. |
| Which contact/child does it refer to here? | The destination IDs established by source mappings. |
| What state did the branch edit? | The declared source/base identity for the affected aggregate. |

Local entity revisions also remain local. Branch revision 4 and central revision 4 are not automatically the same state. Child ordinal 7 created independently in two databases is not automatically the same child. Existing public keys help, but do not eliminate mapping, collision and ownership checks. Even the shared default-tenant seed GUID does not mean two customer installations are one tenant.

An origin identifies a writable database incarnation. Forking a database, or recovering it with acknowledged history lost, needs an explicit lineage rule before accepting new work. A normal restart is not by itself a new origin. These operational cases belong to the delivery design, not to everyday contact editing.

## Pending delivery is safer than chasing the largest number

Recall that 1053 can commit before 1052 on independent roots. A sender that records “sent through 1053” and subsequently selects only larger numbers can miss 1052 forever when it commits later.

The proposed baseline uses publication work written atomically with the business unit: an **outbox**. A worker looks for pending work regardless of allocation number. The receiver stores incoming evidence durably in an **inbox**, recognizes duplicate source identities and records application outcomes.

Receiving a batch of ten transactions is a transport convenience. Applying each original business transaction remains its own local audit unit. Otherwise unrelated original changes would be collapsed into one actor/version/completion boundary.

Dependencies distinguish “I have not received the predecessor yet” from “both sides changed this contact differently.” If a required aggregate conflicts, the source transaction is staged rather than partially applied without explanation. A chosen reconciliation becomes a new local transaction linked to its inputs. It must not claim that altered content is the unchanged original branch transaction.

This gives us auditable acceptance and correction without promising that arbitrary business conflicts resolve automatically.

## Historical migration preserves outcomes

Now imagine replacing an old schema with the new one. You want Lina's history to remain understandable in the destination, including old values, actors and grouping.

Re-running old application commands through today's rules can change their meaning. Defaults, validation and business calculations may have changed. The recommended migration instead transforms the **recorded outcomes** using an identified mapping version, preserving source identities and evidence while recording the importer's local acceptance separately.

Occurrence time, source recording time and destination recording time answer different questions. `recorded_at` in the local allocator is the server recording instant, not commit time. A historical date passed into a legacy creation parameter should not be presented as a measured destination commit time.

The current ordinary constructor still has an open event-time consistency finding: supplied historical creation time reaches entity/ledger occurrence fields, while its creation event uses local recording time. This is documented review work, not a completed general import-time policy.

Coverage is equally important. The inspected legacy sources differ: CFUS has email child history; the inspected LaSalle path can project current email values onto old root transactions because that family lacks the necessary child history. The destination cannot infer values that the source never recorded.

A truthful import can preserve complete known intervals, establish a snapshot baseline where appropriate, and identify unknown earlier state. The present reader does not implement that coverage manifest yet. New writes after an incomplete baseline do not magically repair the earlier evidence.

## Where stronger ordering and tamper evidence fit

Some installations may later need certified source commit order. The design offers an optional provider change-feed adapter and retained ordering evidence with explicit coverage and recovery rules. This is additional to portable pending-work delivery; the basic disconnected workflow does not require it everywhere.

Likewise, chained hashes can help with a defined tamper-evidence requirement, especially when evidence is anchored outside the authority that can rewrite the database. They do not automatically provide conflict resolution, restore missing history or make an administrator-controlled database untouchable.

Your selected direction keeps these capabilities optional. The relational local record remains useful on its own, and supplies the evidence a later delivery or assurance layer would need. The next proof should be a bounded real branch workflow or historical import, not a general distributed graph built in anticipation of every possibility.

When you need those details: [delivery/provider ADR](../adr/0004-portable-delivery-and-provider-profiles.md), [legacy evidence](../dbrow_version-legacy-implementation-findings.md), and the optional [chained-history exploration](../dbrow_version-allocation-design-immutable-chained-history.md).

[← Chapter 6](06-what-the-audit-costs.md) · [Next: Return to the code with a map →](08-return-to-the-code-with-a-map.md)
