# ADR 0008: Bounded constructor corrections

Date: 2026-09-07. Status: implemented and verified for fresh schemas.

Iteration 0 of the [contact/API master plan](../contact-api-master-plan.md), following
[ADR 0007](0007-ordinary-user-construction-and-type-history.md) and its preserved
[independent review](../user-construction-independent-review.md).

## Scope and decisions

Enforce the author's person-only account rule, reject ignored promotion inputs, correct concurrent
company-name convenience lookup, preserve creation occurrence time and record the actual seed's initial
role. The author explicitly deferred login uniqueness until provisioning on 2026-09-07. No login constraint,
account tenant column, phone port, general contact lifecycle, public provisioning grant or customer migration
belongs to this pass. New/substantively edited SQL follows the readable audit-unit script style.

## Person accounts and promotion inputs

`security.user_insert` requires contact category 1 (person) for both new construction and existing-contact
promotion. Organization/group attempts fail with 51605. Existing root locking, entry-version checks,
tenant/lifecycle validation and duplicate-account rejection remain in place. System's separate reserved
bootstrap is unchanged. This does not repair previously created nonperson accounts in populated databases.

Promotion checks original inputs before applying new-contact name defaults. Non-NULL name components,
profile/presentation fields, contact email label, phone and address inputs fail with 51606. The legacy
required `@full_name` must be passed as NULL. New-person construction still defaults absent full/display
names from login as before. Account email, credentials and initial role remain account inputs; account
email does not modify the contact list.

Legacy switches cannot distinguish omission from explicitly supplying their default values. Promotion
accepts neutral `@is_private=0/NULL`, the default person category (including NULL as the existing person
default), and default `@auto_create_person_company=1`; a nondefault privacy/category/company-creation
request is rejected. This does not change contact privacy or create a company during promotion. A future
dedicated promotion API can omit these constructor switches entirely.

Validation precedes allocation on a standalone rejected call. Inside an enrolled unit, earlier successful
work must roll back with the rejection. Existing output reset and owner-only commit/rollback behavior remain.
Existing account/stale/foreign/inactive-root errors retain precedence over unsupported detail inputs.

## Company lookup equality and concurrency

Company names retain their existing database-collation equality within a tenant and category 2. This is
a convenience lookup, not a new unique company business identity. Direct privileged creation can still
create same-named organizations deliberately; existing ambiguity remains error 51313.

The private owner-executed `contacts.contact_company_lookup` reads first using a filtered company-name
index and root seeks. On a miss it acquires a transaction-owned application lock in the dbo namespace,
then rechecks the complete tenant/category/name predicate. The caller retains this protection through
company creation and the outer commit/rollback. A hit preserves the existing shared root eligibility check
in `contact_insert`. No helper commits independently, and `email_runtime` cannot execute the new helper.

The lock key contains tenant ID and `CHECKSUM` of the NVARCHAR(256) name under the database collation.
Unlike a UTF-16 byte hash, this groups values that the existing equality comparison considers equal.
SQL Server documents the same-type/equality property and also documents collisions, ignored dashes and
trailing-space behavior in [CHECKSUM](https://learn.microsoft.com/en-us/sql/t-sql/functions/checksum-transact-sql).
The checksum is **only a synchronization bucket**. Every lookup still compares the full name. Distinct
values that collide may wait for each other but never become equal or link to one company because of the
checksum. The tests include an intentional dash collision and accent variants. This is not a checksum-based
uniqueness constraint, change detector or durable identifier.

The helper rejects a mismatch between the actual `full_name` column collation and database collation
(51316), rather than silently using different lock/lookup equivalence after an unsupported collation
change. Fresh DDL inherits the database collation. Lock acquisition failure is 51315; missing name or
wrong/unallocated audit-unit context is 51314. Lock wait uses the caller's `@@LOCK_TIMEOUT`.

Indexed range locking was considered, but would introduce protection of missing-name gaps and potentially
couple distinct values. This pass retains the existing application-lock mechanism with conservative
collisions instead. The filtered index prevents an initial company lookup scan across unrelated contacts.
It is included in fresh creation and disappears with its table during schema drop.

The new distinct-company regression also exposed a separate READ COMMITTED wait: `actor_resolve` could
scan provisional user roots belonging to another creation. A required seek through the existing unique
public-key index limits resolution to the actual actor, with a clustered lookup for tenant/lifecycle state.
Actor eligibility and tenant policy are unchanged. This narrow change is necessary for the tested
unrelated-constructor concurrency schedule, not a general constructor-hardening pass.

## Occurrence time and actual seed evidence

`user_insert` passes its occurrence input `@created` to `event_create.@when_ocurred`.
In the actual schema that parameter is stored in **`entities.event.created`**. There is no
`event.when_ocurred` column. The earlier testing handoff incorrectly described `event.created` as independent
recording metadata; the historical review/probe files remain preserved, and the maintained handoff is corrected.

For standalone construction, entity created/modified, ledger modified and event created carry the supplied
occurrence time; `data.dbrow_version.recorded_at` remains server recording time. A reused unit retains its
first ledger occurrence metadata as before; this change does not overwrite the ledger or invent a commit time.

The installation seed passes `@user_primary_role=N'Developer'` and no longer inserts `user_role` directly.
The constructor validates the definition, assigns it and records `initial_role_id` in the creation event.
This is initial-assignment evidence, not general role lifecycle/history.

## Verification

Two new maintained scenarios run in both RCSI profiles:

- `PersonAccountEligibilityPromotionInputsAndOccurrence`: organization/group rejection on both paths;
  35 individual unsupported promotion-input cases with an earlier successful email edit and whole-unit
  rollback; account-only promotion, new-name defaults and occurrence versus recording time.
- `CompanyNameConcurrencyRespectsCollationAndDistinctValues`: identical names, case variants, trailing
  spaces, accents, distinct names and intentional checksum collision; actual blocking observation before
  releasing the holder, third-call success, distinct-name progress while the holder is uncommitted, and
  private-helper denial. Equality is evaluated by the test database, not inferred from .NET string comparison.

The existing user-construction fixture retains tenant scoping, inactive/pre-existing-ambiguous company
rejection, role validation, promotion history and composition. The real application schema-cycle test now
requires Developer membership and matching initial-role/occurrence evidence on both schema creations.
Existing bootstrap and email/actor/history/concurrency tests remain part of the full gate.

Baseline: 38/38 passed, zero failures/skips, 3 min 28 sec, zero build warnings/errors. All 38 owned databases
were removed. Evidence is under ignored `artifacts/test-results/iteration-0/baseline/`.
Final rebuild/discovery and full gate: 42/42 passed, zero failures/skips, 5 min 14 sec, zero build
warnings/errors. Both READ COMMITTED profiles (RCSI off/on) passed. Evidence is under ignored
`artifacts/test-results/iteration-0/final-2/`; the changed SQL sources match the test build's copies.
All 149 distinct owned databases across seven baseline/development/final runs have matching
intent/create/identity/verified-removal records. `verification.json` reconciles both journal copies per
database (original and test attachment). The [testing handoff](../testing-handoff.md#iteration-0-constructor-corrections--2026-09-07)
records the development failures and their resolution as well as the final result.
This pass makes no production-scale, remote CI, SQL-auth, migration or other-provider claim.
