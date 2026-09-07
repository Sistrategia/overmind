# 10. Porting a family

Previous: [9. Reading history](09-reading-history.md) · [Index](README.md) · Next: [11. Errors and troubleshooting](11-errors-and-troubleshooting.md)

Email is the original reference. Iteration 1 applies its lifecycle to phone while adding explicit parsing/value semantics and a composed reader; see the [phone guide](../phone-family.md). Iteration 2 now applies it to [web links](../web-link-family.md). Address and later families reuse that mechanism with their own field contracts. File paths are relative to `src/Framework/Sistrategia.Data.SqlClient/Scripts`.

## 1. Tables

For a family `X` of root `contact`, create the same four tables email has:

| Table | Purpose | Copy from |
| --- | --- | --- |
| `contacts.x` (dictionary, only if the value is shared) | exact value with `value_key`/`value_length` unique key | `Contacts/Emails/create_email_schema.sql` |
| `contacts.contact_x` (live association) | `contact_id`, `tenant_id`, `ordinal`, value id, association columns, `is_public`, `display_order`, `dbrow_version`; FK to the owner `(tenant_id, entity_id)`, to the ledger `(tenant_id, dbrow_version)`, to the identity | same file |
| `contacts.contact_x_identity` | `(contact_id, ordinal)` issued once, `created_version` | same file |
| `contacts.contact_x_history` | identical columns plus `dboperation_type_id` and `display_order`; PK `(dbrow_version, contact_id, ordinal)`; **index `(contact_id, ordinal, dbrow_version DESC)`** | same file |
| `contacts.contact_x_action` | one row per effective command with the exact values and positions; PK `(tenant_id, dbrow_version, action_ordinal)` | same file |

Check widths through every layer and make every FK `WITH CHECK`. Iteration 1 resolves the phone extension mismatch: live/history/action support 25 UTF-16 units and the constructors no longer truncate before validation.

## 2. Writers

Copy and rename these procedures, in this order:

| Email procedure | Role |
| --- | --- |
| `email_values_ensure` | intern the dictionary value: read first, applock on miss |
| `contact_email_history_sync` | final snapshots for every live child this unit touched |
| `contact_email_write` | the state machine: lock root, validate, allocate or join, mutate, history, order check, bump once, action row |
| `contact_email_change` | public boundary: owns or joins the transaction, resolves actor and contact, calls the writer |
| `contact_email_insert`, `email_update`, `email_delete`, `email_restore`, `email_move` | thin public wrappers per operation |
| `contact_emails_as_of` | the as-of function over identities and history |
| `contact_email_read` | the reader; add the new family's result set or write a sibling reader |

The writer's step order is the contract; keep it exactly:

1. Validate operation and flags.
2. `entities.entity_write_lock` on the root with the caller's expected version.
3. Confirm the root is a contact; assert the unit's actor if a number is already known.
4. Read the current child and its identity; validate the operation against them.
5. Intern values; return early on a no-op update.
6. `data.dbrow_version_ensure` (allocate or join).
7. Allocate the ordinal from the identity table on insert; mutate the live row or rows; maintain `display_order`.
8. Delete handling of this unit's own history row; then `contact_x_history_sync`.
9. Verify the order is dense and unique.
10. `entities.entity_version_bump`, then `data.audit_action_next` and the action row.

`contact_insert` should call the new family's writer for its initial value the way it calls `contact_email_write` today, with `@expected_entity_version = 0` and the ledger's actor.

## 3. Views

Replace `ordinal = 1` with the first row by `display_order` in `contact_view` (and any other view that shows a "primary" value), as was done for email.

## 4. Grants

Add the public wrappers and the reader to `Security/create_email_runtime_permissions.sql` (or a family-specific script) and DENY the internal helpers. Every table stays denied.

## 5. Registration

Add the scripts to `ContactsDatabaseSchemaBuilder` in dependency order (dictionary and tables first; writer before the public boundary; wrappers after), and the drop entries in reverse. Add the files to `src/tests/AuditTests/SchemaFiles.cs` and a named scenario in `AuditScenarios.cs`; the [testing handoff](../testing-handoff.md) explains fixture prerequisites, both profiles and concurrency helpers.

## 6. Tests

Copy `src/tests/sql/email_family_tests.sql` and `email_order_tests.sql` for the family and keep every case: constructor at version 1 with history and action; repeated updates and delete/restore in one unit; insert/delete cancellation and later restore; stale token, missing child, wrong actor, wrong tenant, raw unenrolled transaction, forged committed number; full rollback after a nested success; exact spelling; runtime-role permissions; move, principal and dense order. Reuse the two-connection cases in `src/tests/AuditTests/SqlScenarios.cs`: same-root stale writer, late-root rejection, catalog misses, reader barrier, same-gap distinct values. Extend the discoverable C# scenarios and the schema-cycle check in `src/tests/AuditTests`.

## 7. What phone established

Iteration 0 handles the constructor corrections ([ADR 0008](../adr/0008-constructor-corrections.md)); login uniqueness remains deferred. Phone's complete international identity, preserved interpretation and qualified geography are in [ADR 0009](../adr/0009-phone-values-parsing-and-numbering-geography.md). The shared read transaction/root barrier and private components are in [ADR 0010](../adr/0010-composed-contact-family-reader.md). Future families join that coordinator and the existing audit unit; they do not add independent transactions inside a Save/read.

Next: [11. Errors and troubleshooting](11-errors-and-troubleshooting.md)
