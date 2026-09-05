# dbrow_version Allocation — Design Analysis & Session Notes

> Historical record. See [analysis v2](dbrow_version-allocation-analysis_v2.md) for ordering corrections
> and [ADR 0001](adr/0001-dbrow-version-allocation-helper.md) for the 2026-09-05 helper extraction.
> The pending allocation checklist and XACT_ABORT leak claim below are superseded by that ADR.

> **Status:** discussion captured, decision pending implementation.
> **Context:** `src/Framework/Sistrategia.Data.SqlClient` — the 4-layer DB (data → entities → contacts → security).
> **Reference spec:** `D:\Code\GitHub\Sistrategia\SistrategiaDataAnalysis\schema-analysis\05-design-recommendations.md` → §2 "The versioning spine — the load-bearing design".

---

## TL;DR / Decision

`dbrow_version` should be allocated with **`NEXT VALUE FOR [data].[dbrow_version_seq]`**, never with
`COALESCE((SELECT MAX(dbrow_version) + 1 FROM [data].[dbrow_version] WHERE [tenant_id] = @tenant_id), 1)`.

- `entity_insert` — ✅ already correct (uses the sequence).
- `contact_insert` — ❌ still uses `MAX()+1` (spec violation + real concurrency bug).
- `user_insert` — ❌ still uses `MAX()+1` (spec violation + real concurrency bug).

**Pending action (agreed, not yet done):** change the two callers to use the sequence. Touch points are only
the ledger-row insert and the value passed into `entity_insert`; the handoff semantics (caller allocates +
writes the `data.dbrow_version` ledger row, `entity_insert` defers when a value is passed) stay identical.

---

## What the spec commits to (§2.1, §2.3)

`dbrow_version` = **per-tenant transaction clock**. Required properties only:

- **Total order within a tenant** (needed for "as-of version N / timestamp T" reconstruction, §2.2).
- PK is `(tenant_id, dbrow_version)`.
- "**gaps are fine**"; "per-tenant *contiguity* is not needed and was never real anyway."
- Allocation is `NEXT VALUE FOR data.dbrow_version_seq` — atomic, race-free, explicitly replacing the
  unlocked `MAX()+1` that v3/v4 carried (a real PK-collision bug under concurrency; `04` lines 4343/6487).
- Global sequence is monotonic ⇒ each tenant's subsequence is monotonic too. Trade accepted: tenants see gaps.
- Platform commitment SQL Server ≥ 2016, so `SEQUENCE` is safe.

So for the framework this is **settled**: the sequence is canonical. The only open item is bringing the two
non-compliant callers in line.

---

## The real trade-space (three designs, not two)

The designs differ in *semantics*, not just safety:

| Design | Per-tenant contiguity | Concurrency-safe | Write contention |
|---|---|---|---|
| **1. `MAX()+1 WHERE tenant_id`** | yes (single-threaded only) | ❌ no | serializes per tenant *and* still races |
| **2. Global `SEQUENCE`** (spec's pick) | no (gaps) | ✅ yes | none |
| **3. Per-tenant counter row** (`UPDATE … SET @v = next = next+1`) | yes | ✅ yes | serializes per tenant |

Design #1 is strictly dominated (it's #3's semantics with a race bolted on). The genuine choice is **#2 vs #3**.

### Where gaps come from (this is what each design can/can't promise)

- **`MAX()+1`** reads the *committed* max → a rolled-back allocation is invisible → next txn reuses the number.
  Its only real appeal is **gap-free per-tenant numbering** (invoice-folio style), but it can only deliver that
  under serialization — which is exactly the bug. It promises something it structurally can't keep.
- **Global sequence** burns numbers on (a) rollback, (b) `CACHE 100` loss at restart, (c) interleaving across
  tenants. Gaps guaranteed. In exchange: zero allocation contention, ever.
- **Counter row** is the only one that can be *both* safe and gap-free — but only if the increment lives inside
  the business transaction, which then holds the tenant's row lock **for the whole transaction duration**,
  serializing every write to a busy tenant. Move the increment to an autonomous commit to recover concurrency,
  and rollback gaps come back. So #3 forces **gap-free XOR per-tenant write throughput.**

**Crux:** the global sequence sidesteps the dilemma by declaring gaps acceptable up front. The reconstruction
algorithm (§2.2) only ever does `WHERE dbrow_version <= @bound ORDER BY dbrow_version`, so contiguity buys
nothing there. #2 is correct *for the stated requirement*.

---

## When to revisit #2 → #3

Only if `dbrow_version` ever becomes **user-facing or regulatory** — e.g. "transaction #47 for this tenant", or
a jurisdiction demanding gap-free sequential numbering (some e-invoicing regimes). Then contiguity is a real
requirement, not hygiene.

Preferred answer even then: keep a **separate human-facing folio** (that's what `data.sequence` /
`sequence_next_number` already exist for) distinct from the internal clock. Keeping the two concerns separate is
what lets `dbrow_version` stay a cheap opaque clock.

---

## Subtlety that neither option escapes

`dbrow_version` is an **allocation order, not a commit order**. Example: T1 grabs 5, T2 grabs 6, T2 commits
first, T1 later. A reader in between sees 6 but not 5, and 5 "appears in the past."

- Fine for as-of-`@bound` queries (only committed rows are read).
- **Never** assume "higher `dbrow_version` ⇒ committed later." Wall-clock authority is `modified`;
  `dbrow_version` is just the tie-broken total order.
- Worth a code comment — it's the kind of assumption that sneaks into a reporting query years later.
  (`MAX()+1` has this problem too, only worse.)

---

## Session resume checklist

When we pick this back up:

1. [ ] Update `Scripts/Contacts/create_contact_insert.sql` — replace `MAX()+1` allocation with
       `NEXT VALUE FOR [data].[dbrow_version_seq]`.
2. [ ] Update `Scripts/Security/User/create_security_user_insert.sql` — same replacement.
3. [ ] Confirm the caller-allocates + `entity_insert`-defers handoff still holds after the change.
4. [ ] (Optional) Add the "allocation order ≠ commit order" comment near the ledger insert.

### Related prior fixes already applied this session (for continuity)
- `create_contact_insert.sql`: location tables now use `location_id` (upsert into `email_location` /
  `address_location` / `phone_location`) instead of the old `location_name` binding; added required
  `dbrow_version` to `contact_email`; converted positional `entity_insert` calls to named parameters;
  converted the `event_create` call to the new named-parameter signature (title/summary now come from
  `event_type_localized` templates).
- `create_security_user_insert.sql`: `event_create` call converted to the new named-parameter signature.
- `Data/.../Scripts/insert_minimal_data.sql` (Overmind): fixed role_localized `language_id` (`0→1` English,
  `1→2` Spanish) to match `data.language` seed.
- Added event-type seeds: `Scripts/Contacts/insert_minimal_data.sql` (`contacts.contact.new`) and new
  `Scripts/Security/insert_minimal_data.sql` (`security.user.new`), wired into
  `SecurityDatabaseSchemaBuilder.InsertMinimalData()`.

### Still-open items from the broader `entity_insert` review (not yet acted on)
- `@tenant_id` can silently become NULL → cryptic FK failure; consider a fail-fast `THROW`.
- CATCH blocks use `RAISERROR(@Message, 16, 1)` which loses error metadata and doesn't abort the batch;
  consider `;THROW;` consistently across procs.
- Undocumented contract: passing `@dbrow_version` requires the ledger row to already exist (entity table has no
  FK on it, but `entity_history` / `entity_version_history` do).
- `SET XACT_ABORT ON` leaks into session state (connection-scoped, not restored on exit).
