# 7. Shared values

Previous: [6. Children: identity and order](06-children-identity-and-order.md) · [Index](README.md) · Next: [8. Actors, tenants and users](08-actors-tenants-and-users.md)

## What is shared and what is owned

Your dictionaries stay: `contacts.email`, `contacts.email_location`, `contacts.person_name`, the location tables. They are global, immortal and immutable. A value is stored once and referenced by id; history rows stay narrow; a value that appears on two contacts is provably the same value; and regulatory erasure can re-point an association to a sentinel instead of rewriting every copy.

What is *owned* is the association: `contact_email` belongs to its contact and therefore to a tenant. A tenant can only see values through its own associations. The `email_runtime` role has no SELECT on the dictionaries at all, so an application cannot enumerate other tenants' addresses through the shared table.

## Exact spelling

The old uniqueness constraint compared under the server's collation, which merged case and, on some servers, accents, and always ignored trailing spaces. For an audit that promises to show what was entered, that is a fidelity loss. The dictionaries now key on the exact UTF-16 bytes **and** their length:

```sql
[value_key]    AS CONVERT(VARBINARY(512), [email_address]) PERSISTED
[value_length] AS DATALENGTH([email_address])              PERSISTED
CONSTRAINT [uq_email_address] UNIQUE ([value_key], [value_length])
```

Both columns are needed: string comparison pads trailing spaces, and binary comparison pads trailing zero bytes, so either alone would merge values that differ at the end. `Case@example.test`, `case@example.test` and `case@example.test ` are three values. Normalized matching for search is a separate concern and never rewrites the accepted spelling.

Widths are enforced without truncation: public parameters are `NVARCHAR(MAX)`, and a value over 256 code units (or a location over 100) fails with 51300 or 51301 instead of being cut.

## Interning without blocking each other

`contacts.email_values_ensure` is the one place values are interned:

1. Read the existing value with no lock hints. Hits, which are the common case, never block anyone.
2. On a miss, take a transaction-owned application lock named after the SHA-256 of the exact bytes, read again, and insert if still absent.

The lock serializes only identical values. The earlier version used a key-range lock on the miss path, which the first review showed blocks *different* new values that happen to sort into the same index gap for the whole life of the unit; that is gone. If two units intern the same brand-new address at once, one waits for the other's commit and then finds the row. Identical values still deduplicate; different values never wait.

## Contact person names and locations

The name and location dictionaries in `contact_insert` still use the older `IF NOT EXISTS … INSERT` shape. They will adopt the same exact-key and applock pattern when their families are ported (Chapter 10).

## Where your old code differs

- Uniqueness depended on the server collation; now it is exact and identical on every server.
- Concurrent misses either errored on the unique key or serialized neighbours; now identical values wait for each other and nothing else waits.

Next: [8. Actors, tenants and users](08-actors-tenants-and-users.md)
