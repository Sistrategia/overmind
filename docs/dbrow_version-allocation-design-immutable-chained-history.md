# Alternative: independently verifiable chained audit history

Date: 2026-09-04
Status: optional assurance design for evaluation.

Builds on [the primary design](dbrow_version-allocation-design.md). It retains `dbrow_version`, `entity_version`, portable identities, commit capture, and explicit merge semantics. It does not replace the database with a blockchain.

## 1. When this earns its cost

Use this tier when customers need evidence that retained history has not been rewritten by privileged operators, independently verifiable exports, or durable verification across organizations and databases. The primary design assumes controlled administrators and provides conventional audit protection. This alternative deliberately strengthens that threat model.

Call the guarantee **tamper evidence**, not absolute immutability. An attacker controlling all copies, signing keys, and checkpoint stores can defeat local verification. A hash chain held only beside the mutable data can be recomputed. Independent checkpoint custody is part of the mechanism, not an optional deployment detail.

Neither variant proves that an authorized source told the truth initially or that an uninstrumented action was captured. Neither makes incompatible concurrent transactions valid. Source authentication, capture completeness, and domain validation remain necessary.

## 2. Recommended construction

Prefer immutable transaction evidence leaves, batched Merkle commitments, and chained signed checkpoints per tenant and source incarnation. Hash after commit from frozen evidence, keeping shared chain-head coordination out of business transactions. Portable revision parents form a causal graph separately from the checkpoint chain.

| Structure | Meaning |
| --- | --- |
| Transaction leaf hash | Commitment to exact typed business evidence and provenance |
| Revision parent graph | Which revisions a change knew or merged |
| Batch Merkle root | Commitment to an ordered set of certified committed transaction leaves |
| Previous checkpoint hash | Continuity of one tenant/origin publication stream |
| Signature | Authentication by a named key under an explicit trust policy |
| External anchor/receipt | Independent retention of a checkpoint commitment |

These solve different problems. Do not use the hash bytes as a chronological version or assume a parent hash establishes SQL commit order.

## 3. Canonical evidence

Define a versioned canonical byte representation before hashing. Include domain separator, envelope/schema version, transaction/origin identity, tenant public identity, operation identity, actors and delegation, recorded/effective times, revision IDs and parents, typed changed-row evidence, stable child identities, and referenced-value commitments.

Use fixed encodings, explicit lengths/type tags, stable field ordering, and a declared ordering for sets. Distinguish null from absent, decimal scale where significant, binary from text, and timezone-normalized instants from local dates. Preserve local language and Unicode semantics explicitly. Encode BIGINTs and exact decimals as tagged decimal strings if using JSON; do not pass them through lossy floating point conversions.

RFC 8785 provides a JSON canonicalization scheme, but the application still needs its own type/schema contract. Use published test vectors and cross-language fixtures rather than assuming ordinary JSON serialization is canonical. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html)

Example notation, not a finalized cryptographic wire protocol:

```text
leaf = H("overmind.audit.leaf.v1" || canonical_business_envelope)
batch_leaf = H("overmind.audit.commit.v1" || source_commit_position || leaf)
checkpoint = {
  tenant_uid, origin_uid, stream_epoch, checkpoint_number,
  coverage_start, coverage_end, count, merkle_root,
  previous_checkpoint_hash, encoding_version, hash_algorithm, key_id
}
signature = Sign(key, H("overmind.audit.checkpoint.v1" || Canonical(checkpoint)))
```

`||` means unambiguous framed encoding, not naive string concatenation. Specify leaf/internal-node separation, odd-leaf handling, proof format, and signature algorithm in the implementation protocol. Use a reviewed cryptographic library and algorithm agility. Do not implement new cryptographic primitives.

Commit metadata arrives after the business transaction. Keep the original business envelope immutable; the batch leaf binds its digest to captured source position. Delivery state, verification timestamps, and later commit observations are companion metadata and do not mutate the original leaf.

## 4. Publication protocol

1. The business transaction writes history and a frozen envelope or deterministic immutable manifest atomically, as in the primary design.
2. Commit capture establishes complete source intervals. The evidence publisher waits for a certified boundary; it never follows maximum allocation ID.
3. Build a per-tenant/origin batch from a complete interval. Sort by captured source position and a specified tie-breaker. Hash leaves and construct the Merkle root.
4. Persist the batch, checkpoint, proofs/manifests, and publication work idempotently. A unique stream/epoch/checkpoint key and single fenced publisher prevent accidental forks.
5. Sign through a separately controlled key service and submit the checkpoint to independently administered retention storage or a witness. Persist its receipt. Retries must reuse the same checkpoint bytes.
6. Advance the anchored boundary only after independent acknowledgment. Expose committed, captured, and anchored boundaries separately.

Empty intervals may produce continuity checkpoints. Avoid one chain per database if tenant exports must not expose unrelated tenant activity. The source-wide capture service certifies complete intervals, while each tenant receives its own evidence subset and checkpoint stream.

The checkpoint count and boundaries support reconciliation, but a Merkle inclusion proof alone proves only inclusion. Claims of completeness require trusted capture accounting and a complete manifest/range verification protocol. An omitted write before capture or before independent anchoring remains a threat. Stronger requirements may require independent capture, a witness, or a synchronous external receipt before reporting an operation as externally attested.

Asynchronous anchoring creates a measurable exposure window. Define an anchoring service objective and an overdue policy: continue writes with an explicit degraded assurance status, or block further attestation-sensitive actions. A crash or backlog cannot silently turn unanchored history into anchored history.

## 5. Verification and export

An export includes canonical evidence or authorized redacted evidence, commit bindings, Merkle proofs, signed checkpoints, external receipts, lineage, schema/type definitions, and the trust policy/key history needed for verification. Store the canonical bytes where practical; reserializing data with a future library is not a safe archival strategy.

A verifier checks identity scope, signatures/key validity, checkpoint continuity, independent anchors, inclusion proofs, payload hashes, causal dependencies, and declared coverage. Verify stored relational history against its commitments periodically and after restores. Failures produce durable alerts under separate custody.

Two different checkpoints claiming the same predecessor/position are fork evidence. Detecting an issuer presenting different histories to isolated recipients requires checkpoint comparison through a witness or exchanged receipts; a verifier inspecting only one internally consistent branch may not detect equivocation.

Verification proves bytes agree with previously anchored commitments under the trust assumptions. It does not prove legal correctness, authorized business intent, or absence of activity outside the audited write path.

## 6. Decentralized merge and different database models

Preserve original signed source envelopes and checkpoints on import. The receiver creates its own local acceptance transaction and revision, referencing source evidence; it never re-signs a rewritten envelope as though it were the original.

Concurrent branches remain branches. A merge revision names every accepted parent and the policy/human decision responsible. Content hashes help compare and verify those parents. They do not select a winner or resolve business invariants.

A receiving document, graph, or relational system can materialize its own projection while retaining the canonical evidence. A projection digest can be recorded as derivative evidence with transformation version. It must not replace the source commitment or imply that both schemas have identical semantics.

Each origin publishes its own chain. Distributed checkpoints reference certified source checkpoints and verify causal closure. A single worldwide chain would introduce ordering/governance coordination with little benefit for ordinary tenant audit. If mutually distrustful parties require one authoritative shared state, consensus becomes a separate product architecture rather than a hash-field enhancement.

## 7. Key custody, restores, and algorithm lifecycle

Separate database administration, signing authority, and anchor administration where the threat model requires it. Keep private signing keys outside database tables. Record key IDs, public-key history, rotation, revocation, and compromise findings. A claimed signing timestamp alone does not prove a signature predates key compromise; independent receipts/checkpoints provide the external evidence boundary.

Fence a publisher during failover. A restored divergent writer starts a new origin/stream epoch and links to its last verified ancestor checkpoint. Do not reuse an old checkpoint number to hide missing acknowledged history. Verify database and archive restore against externally retained receipts before declaring assurance restored.

Retain algorithms and encoding definitions for old evidence. Before retiring a weakening algorithm, re-anchor existing evidence/checkpoints under a supported algorithm with a recorded transition. This preserves continuity claims without pretending the original historical signature changed.

## 8. Erasure and confidentiality

Permanent cleartext evidence can conflict with erasure requirements. Decide payload retention and disclosure before enabling an irreversible external archive. Keep personal payloads out of publicly distributed checkpoints; a digest of a predictable email or phone number can still be guessed. Hashing is not anonymization.

Possible policy: encrypted payload archives under scoped keys, durable non-sensitive metadata/commitments, and explicit redaction transactions. Key destruction can make an encrypted payload unavailable, but residual copies, key backups, plaintext projections, and replica retention must be addressed. It does not automatically establish legal erasure.

After authorized payload destruction, verification may establish the retained commitment and redaction event, but cannot reconstruct or rehash the unavailable plaintext. Report that limit. Never modify old anchored bytes and silently claim the original evidence is intact.

## 9. SQL Server ledger as an alternative implementation

Evaluate native SQL Server ledger for database-level tamper evidence, potentially on a dedicated append-only evidence table rather than duplicating every existing history mechanism. Microsoft describes external database digests as part of verification. [Ledger overview](https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-overview) and [digest management](https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-digest-management).

It raises the SQL Server floor to 2022 for on-premises ledger and requires a review of table/DDL limitations. It is not available under the existing SQL Server 2016 baseline. [Ledger limitations](https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-limits)

Native ledger does not replace portable envelope semantics, domain conflict resolution, or tenant authorization. Its value is reducing custom database integrity machinery. Benchmark native ledger plus a portable evidence format against custom batch anchoring before selecting either; do not pay for both by default without distinct assurance requirements.

## 10. Cost and comparison

| Dimension | Primary design | This alternative |
| --- | --- | --- |
| Application audit coverage | Controlled atomic history | Same prerequisite |
| Privileged rewrite detection | Operational controls/backups | Anchored cryptographic verification |
| Hot-path work | Ledger, history, context, outbox | Also freeze/hashable evidence; hashing can be asynchronous |
| Shared business write lock | Aggregate scope | Same; checkpoint publication serialized separately |
| Storage | History, commit index, transport evidence | Also canonical archives, proofs, checkpoints, receipts |
| Operational dependencies | Capture and distribution | Also key service, witness/anchor, verifier |
| Offline conflict resolution | Explicit domain policy | Same policy with verifiable source evidence |
| Erasure complexity | Retention across history/replicas | Additionally irreversible commitments and archive policy |

Hashing work scales with payload bytes; batching reduces signature/anchor frequency but increases exposure latency. Merkle proofs avoid distributing entire batches for individual inclusion verification. Partition publication by tenant/origin and bound batch bytes and duration. Benchmark CPU, archive bytes, signature throughput, proof generation, verification duration, and p99 anchoring lag on realistic histories.

## 11. Acceptance and adoption

Before production, test payload alteration, row omission, checkpoint deletion, tail truncation, recomputed local chains, signing-key compromise drills, equivocation, capture gaps, worker retries, missing archives, schema evolution, redaction, and forked restores. Verification against an independent anchor must fail where the guarantee says it should. Exercise cross-language canonicalization on exact decimals, BIGINT limits, Unicode, null/missing fields, and binary values.

Adopt after the primary write and reconstruction contracts are sound. Start with periodic independently anchored tenant/origin checkpoints and a working offline verifier. Add stronger witness or synchronous attestation only for customers whose assurance needs justify the availability and operational cost.

The recommended long-term path is relational audit plus portable causal evidence, with independently anchored commitments as an assurance tier. Full distributed consensus should remain a separate decision triggered by a concrete requirement for shared authority among mutually distrustful writers.
