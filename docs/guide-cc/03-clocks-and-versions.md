# 3. Clocks and versions

Previous: [2. The audit unit](02-the-audit-unit.md) · [Index](README.md) · Next: [4. Locking and order](04-locking-and-order.md)

## Four values, four meanings

| Column | Lives on | Means | Never means |
| --- | --- | --- | --- |
| `dbrow_version` | the ledger, and every row a unit touched | *Which unit* changed this row. A database-local `BIGINT` from one global sequence. | when it was committed, how many transactions the tenant has had, a portable identity |
| `entity_version` | `entities.entity`, and the spine | *Which revision* of the aggregate the user is looking at: "version 3 of this contact". Increases at most once per unit. | a global order, a transaction count |
| `recorded_at` | the ledger | The server's UTC instant when the unit allocated its number. | commit time, business time |
| `modified` | the ledger, `entity.modified` | Occurrence time as supplied by the caller (the old semantic), or the server time for the new email paths. Kept for compatibility and imports. | measured commit time |

The column your old code stamped everywhere is still `dbrow_version`. What changed is what you may conclude from it.

## Gaps are fine, and so is disorder

The sequence is global across tenants and cached (`CACHE 100`), so a tenant sees gaps: numbers used by other tenants, numbers burned by rollbacks, numbers lost at a restart. The old per-tenant `MAX() + 1` promised contiguity and could only keep the promise by serializing every writer of the tenant, which is the race the reviews documented. Contiguity was never a requirement; the reconstruction algorithm only ever asks "the latest row at or below this bound".

More subtly, **allocation order is not commit order**. Unit A can take number 100, unit B take 101, B commit first and A commit later. For a moment the database contains 101 but not 100. Two consequences:

- Any export or synchronization that walks `WHERE dbrow_version > @last_seen` can skip 100 forever. The design documents say so and point to a transactional outbox or, optionally, SQL Server Change Tracking (which orders by commit) for that job. Nothing in the current code walks the ledger that way.
- Reconstructing *one aggregate* by "latest history at or below the bound" is still exact, because of the rule in the next chapter: every change to an aggregate locks its root before it allocates, so within one aggregate the numbers are always in commit order.

So you keep the cheap number, you lose nothing for per-aggregate history, and tenant-wide "as of Tuesday 15:00" is explicitly a deferred feature, not something the ledger pretends to answer.

## The spine

`entities.entity_version_history` is the translation table between the two numbers:

```
entity_id  entity_version  dbrow_version
   4711          1              1030      -- created
   4711          2              1187      -- an email was edited
   4711          3              1190      -- promoted to a user account
```

Given "contact 4711 at version 2", the reader looks up the bound 1187 and takes, for the root and for each child, the latest history row with `dbrow_version <= 1187`. The spine is unique on both `(entity_id, entity_version)` and `(entity_id, dbrow_version)`.

## Bump once

Within a unit, an aggregate advances at most once, no matter how many of its rows change. The helper `entities.entity_version_bump` does this idempotently: if the entity already carries this unit's number it returns; otherwise it increments `entity_version`, stamps the entity with the unit's number and `recorded_at`, and inserts the spine row. Five email edits in one unit are one revision. Creating a contact and giving it its first email in the same unit is revision 1, not 2.

## What your reporting queries must not assume

- Do not order events across aggregates by `dbrow_version` and call it "what happened first". Within one aggregate it is safe; across aggregates use `recorded_at` with the understanding that it is allocation time.
- Do not count ledger rows per tenant and present the number to a user. Folios and invoice numbers belong to `data.sequence`, which remains the gapless per-tenant counter for business documents.

Next: [4. Locking and order](04-locking-and-order.md)
