# AGENTS.md — Overmind project memory

Working area: `src/Framework/Sistrategia.Data.SqlClient` — a 4-layer DB framework.
Layer order (build/drop dependency): **data → entities → contacts → security**.
`*_by` columns are `INT` = `entity_id` of the actor; a user is an entity (type 4) that is also a contact (type 1).
System User = id 1, public key `71F092F4-3A35-463D-9589-E5EE1373F7D5`. Default tenant `908E5A8C-0372-4EDC-ADDF-011E059091ED`.

## Active design thread (RESUME HERE)

**`dbrow_version` allocation.** Full analysis + resume checklist:
→ `docs/dbrow_version-allocation-analysis.md`

Decision: allocate `dbrow_version` with `NEXT VALUE FOR [data].[dbrow_version_seq]`, never `MAX()+1`.
- `entity_insert` — already correct.
- **PENDING:** change `create_contact_insert.sql` and `create_security_user_insert.sql` (they still use
  `COALESCE((SELECT MAX(dbrow_version)+1 ... WHERE tenant_id=@tenant_id),1)` — the race the spec kills).

Spec reference: `D:\Code\GitHub\Sistrategia\SistrategiaDataAnalysis\schema-analysis\05-design-recommendations.md` §2.

## Fixes already applied this session
- `create_contact_insert.sql`: location tables use `location_id` (upsert into `*_location`) not old `location_name`;
  added required `dbrow_version` to `contact_email`; named-param `entity_insert` calls; new `event_create` signature.
- `create_security_user_insert.sql`: new `event_create` signature.
- Overmind `Scripts/insert_minimal_data.sql`: role_localized `language_id` fixed (`0→1` en, `1→2` es) to match `data.language`.
- Event-type seeds added: `Scripts/Contacts/insert_minimal_data.sql` (`contacts.contact.new`) + new
  `Scripts/Security/insert_minimal_data.sql` (`security.user.new`), wired into `SecurityDatabaseSchemaBuilder.InsertMinimalData()`.

## Open items from `entity_insert` review (not yet acted on)
- `@tenant_id` can silently become NULL → cryptic FK failure; consider fail-fast `THROW`.
- CATCH uses `RAISERROR(@Message,16,1)` → loses error metadata, doesn't abort batch; consider `;THROW;` consistently.
- Passing `@dbrow_version` implicitly requires the ledger row to pre-exist (undocumented contract).
- `SET XACT_ABORT ON` leaks into session state.

## Working style with this user
- Discuss design as a partner; when multiple valid designs exist, map the trade-space honestly rather than citing "best practice".
- Do NOT modify code during exploration/context-gathering phases unless asked.
- Verify SQL proc changes against the actual table schemas before editing.
