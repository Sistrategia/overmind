# AGENTS.md — Overmind project memory

Working area: `src/Framework/Sistrategia.Data.SqlClient` — a 4-layer DB framework.
Layer order (build/drop dependency): **data → entities → contacts → security**.
`*_by` columns are `INT` = `entity_id` of the actor; a user is an entity (type 4) that is also a contact (type 1).
System User = id 1, public key `71F092F4-3A35-463D-9589-E5EE1373F7D5`. Default tenant `908E5A8C-0372-4EDC-ADDF-011E059091ED`.

## Active design thread (RESUME HERE)

**Latest implementation (2026-09-05):** allocation helper extracted with user authorization.
Read `docs/adr/0001-dbrow-version-allocation-helper.md` for the decision, contracts, tests, and limitations.
`data.dbrow_version_ensure` centralizes sequence allocation/ledger creation and tenant/actor reuse checks.
Entity/contact/user inserts retain optional INOUT versions; only the transaction owner commits/rolls back.
Supplied versions require an ambient transaction, but proving SAME-transaction ownership remains a trusted
caller contract. SQL integration runner: `python tests/sql/run_dbrow_version_tests.py --server localhost`.

**Design session handoff (2026-09-04):** read `docs/dbrow_version-design-session-handoff.md` for broader context.
The user prefers the balance of `docs/dbrow_version-allocation-design.md` over the optional
chained-history alternative. Subsequent clarification narrows distribution to practical disconnected
branch/client synchronization and history-preserving migrations across schemas/database providers.
That clarification is captured in the handoff but is **not yet incorporated into the design documents**.
The broader distributed design remains a proposal; the helper extraction alone was authorized and implemented.

**`dbrow_version` allocation.** Full analysis + resume checklist:
→ `docs/dbrow_version-allocation-analysis.md`

Decision: allocate `dbrow_version` with `NEXT VALUE FOR [data].[dbrow_version_seq]`, never `MAX()+1`.
- Entity/contact/user inserts now delegate to `data.dbrow_version_ensure`.
- The previous MAX()+1 pending note was stale: both derived procs already used the sequence before extraction.

Spec reference: `D:\Code\GitHub\Sistrategia\SistrategiaDataAnalysis\schema-analysis\05-design-recommendations.md` §2.

## Fixes already applied this session
- `create_contact_insert.sql`: location tables use `location_id` (upsert into `*_location`) not old `location_name`;
  added required `dbrow_version` to `contact_email`; named-param `entity_insert` calls; new `event_create` signature.
- `create_security_user_insert.sql`: new `event_create` signature.
- Overmind `Scripts/insert_minimal_data.sql`: role_localized `language_id` fixed (`0→1` en, `1→2` es) to match `data.language`.
- Event-type seeds added: `Scripts/Contacts/insert_minimal_data.sql` (`contacts.contact.new`) + new
  `Scripts/Security/insert_minimal_data.sql` (`security.user.new`), wired into `SecurityDatabaseSchemaBuilder.InsertMinimalData()`.

## Open items from `entity_insert` review (not yet acted on)
- Helper now rejects missing tenants; user_insert's legacy tenant fallback still needs policy review.
- Entity/contact/user CATCH now uses bare THROW; other procedures have not been standardized.
- Reuse validates ledger tenant/actor; exact transaction ownership is documented but not proven by the scalar ID.
- Corrected: procedure-scoped SET XACT_ABORT is restored on return (verified). It is now enabled for ambient calls too.
- Legacy unknown-actor fallback and self-creation bootstrap authorization remain separate review items.
- Separate bootstrap writers remain: tenant_insert hard-codes ledger version 1; InsertSystemUser in
  SecurityDatabaseSchemaBuilder has active MAX()+1/hard-coded references. Not covered by this extraction's tests.

## Working style with this user
- Discuss design as a partner; when multiple valid designs exist, map the trade-space honestly rather than citing "best practice".
- Do NOT modify code during exploration/context-gathering phases unless asked.
- Verify SQL proc changes against the actual table schemas before editing.
