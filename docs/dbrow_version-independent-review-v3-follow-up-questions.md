# Audit foundation — follow-up questions for independent review v3

Date: 2026-09-05.
Status: questions sent to the independent reviewer through the user; responses pending.

Related review: [Independent review v3](dbrow_version-independent-review-v3.md).
Implementation context: [ADR 0001 — allocation helper](adr/0001-dbrow-version-allocation-helper.md).
Broader context: [Design session handoff](dbrow_version-design-session-handoff.md).

This document preserves the questions supplied in the conversation for the user to relay to the independent reviewer. These are requests for analysis, not implementation instructions or newly adopted decisions. The first four questions would help most before changing the implementation. Please provide concrete examples, proposed contracts, and supporting code or documentation where relevant.

## Working context

We agree on the core: a sequence with gaps, local `entity_version`, optional INOUT parameters, centralized allocation, and explicit transaction ownership. Single-tenant installations should use a real default tenant. Some catalogs, role definitions, and platform actors can legitimately be shared.

We want to settle the remaining mechanisms without introducing unnecessary infrastructure.

## 1. What exactly should history preserve when nested calls modify the same row several times in one transaction?

For example, a phone changes `111 → 222 → 333` before commit. How should procedures produce one correct final history row: updates restricted to the current transaction's history, explicit finalization, or another mechanism? Also consider insert-then-delete and change-then-revert. If a meaningful business action uses an intermediate value, where should that evidence be recorded?

## 2. How would you distinguish tenant-owned data, shared definitions, and global actors?

Given a real default tenant, global role definitions, a shared System User, and immutable shared catalogs, what exact rules should govern ownership and access? In particular, distinguish a global role definition from a tenant-scoped assignment. Please examine the existing-contact and role lookups in `user_insert`: what checks are needed under this clarified model?

## 3. What guarantee does the proposed engine transaction-ID check actually provide?

Please examine reuse after commit, instance restart, restore onto another instance, and database cloning. Is `CURRENT_TRANSACTION_ID()` alone sufficient for our intended guarantee? If additional protection is necessary, what is the smallest reliable mechanism? Separately, should two helper calls with `NULL` within one SQL transaction allocate twice, join automatically, or fail?

## 4. How can root-lock-before-allocation remain enforceable with composable INOUT procedures?

Suppose an outer procedure already allocated a version, then a nested call discovers another existing aggregate that it must modify. How should we reject or safely support this? Please distinguish existing roots from newly created roots and show a concrete protocol that works for ordinary callers without requiring a large transaction-context framework.

## 5. Where should actor resolution and authorization live in the four-layer architecture?

How do we verify that an actor is an eligible user without creating an `entities → security` dependency? Which entry points may accept an already-resolved actor ID or request self-registration? What prevents these parameters from bypassing authorization? For preallocated entity IDs, please identify the actual changes required in bootstrap code, `SCOPE_IDENTITY()` callers, and existing-contact user creation.

## 6. Can you specify a complete Change Tracking export-and-recovery protocol?

Please cover snapshot boundaries, cursor acquisition, pagination with equal change versions, durable acknowledgment, and outages beyond retention. Can we preserve historical replay order after retention expires, or do we need a durable companion journal? If commit versions are persisted, should they live outside the tracked ledger to avoid generating additional tracked updates?

## 7. How should portable transaction identity and conflict detection survive forks and forwarding?

A database copy receives a new origin, but inherited transactions must retain their original identities. Imported transactions may later be forwarded elsewhere. What minimum schema preserves this? Also, if two disconnected copies both have `entity_version = 4` with different contents, what common-base reference should an incoming operation carry, without introducing a general revision graph?

## 8. What is the appropriate concurrency and value-identity contract for shared immutable catalogs?

Are `UPDLOCK, HOLDLOCK` lookups on every existing catalog value likely to serialize unrelated contacts until commit? What alternative would you use for existing versus missing values? For names, how should exact spelling, case/accent comparison, matching normalization, historical references, and tenant-scoped visibility interact? Please evaluate the dictionary approach on its merits, including likely storage savings and write costs.

## 9. What actually enforces committed-history protection?

Given SQL Server ownership chaining, which unwanted writes would table-level `DENY UPDATE, DELETE` prevent, and which could still occur through permitted procedures? How would you protect history while supporting any allowed current-transaction corrections and explicit erasure? Please propose tests under the application principal that demonstrate the guarantee.

## 10. What is the smallest reference implementation that would validate these decisions?

Please propose a bounded set of procedures and behavioral/concurrency tests covering reconstruction, tenant isolation, self-registration, nested writes, and shared catalogs. Which decisions must be settled before migration, and which can safely wait? For performance, identify the few workloads most likely to expose weaknesses at millions of records.

## Invitation to challenge the framing

Please challenge these questions if they assume the wrong problem. Your reasoning about which concerns matter—and which do not—would be as useful as agreement on a particular implementation.
