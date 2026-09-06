# 8. Return to the code with a map

[← Disconnected branches and migrations](07-disconnected-branches-and-migrations.md) · [Contents](README.md) · [Glossary](glossary.md)

After following Lina's Save, you can read the code by responsibility instead of opening every file added during the redesign. This chapter is a lookup map. There is no need to memorize it.

## Start with the operation, then follow one level down

If you prefer C#, begin with [SqlAuditUnit](../../src/Framework/Sistrategia.Data.SqlClient/SqlAuditUnit.cs). It is the application owner used in chapter 2: context, connection, command serialization, commit and disposal. The [C# reader](../../src/Framework/Sistrategia.Data.SqlClient/SqlContactEmailReader.cs) turns historical SQL results into revision, state, diff and action records.

If you prefer SQL, begin with [email_update](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_email_update.sql), then [contact_email_change](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_contact_email_change.sql), and finally [contact_email_write](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_contact_email_write.sql). The thin wrapper names the operation; the common entry handles its public transaction/context boundary; the private writer contains the shared lifecycle logic.

On the first read, treat a helper call as the rule its name represents. Open it only when you want to check that rule. This is the map for that second pass:

| Question at the call site | Procedure to inspect |
| --- | --- |
| Is the existing transaction enrolled? | [audit_unit_begin](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Data/create_audit_unit_begin.sql), [audit_unit_assert](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Data/create_audit_unit_assert.sql) |
| Which tenant and eligible actor are acting? | [actor_resolve](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Entities/create_actor_resolve.sql) |
| Is this root editable at the expected entry revision? | [entity_write_lock](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Entities/create_entity_write_lock.sql) |
| Which one audit number belongs to this unit? | [dbrow_version_ensure](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Data/create_dbrow_version_ensure.sql) |
| Does this aggregate already have its new revision in this unit? | [entity_version_bump](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Entities/create_entity_version_bump.sql) |
| How are final email snapshots maintained? | [contact_email_history_sync](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_contact_email_history_sync.sql) |
| How is a supported historical revision assembled consistently? | [contact_email_read](../../src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_contact_email_read.sql) |

The helper invocation is intentionally repeated in callers. Its allocation or locking implementation is not copied into every family. That is the extraction principle from the original discussion, now applied to more of the write contract.

For native SQL composition, the familiar outer TRY/transaction/CATCH remains. Enroll after beginning the transaction, call public commands with the same INOUT variable and entry tokens, commit once, and roll back the unit on failure. The [existing usage guide](../email-reference-family.md) has the complete SQL example; this guide's purpose is to explain why each line is there.

## Keep these tables distinct

| Table | Its role in the story |
| --- | --- |
| `data.dbrow_version` | The local unit and its shared attribution/recording metadata. |
| `entities.entity_version_history` | The spine from an aggregate revision to its audit unit. |
| `entities.entity_history` | Historical root payload, including type. |
| `contacts.contact_history` | Historical supported contact payload. |
| `contacts.contact_email_identity` | Retained identity of each email child, including deleted children. |
| `contacts.contact_email` | The current association, value references and saved position. |
| `contacts.contact_email_history` | Final child-state snapshots at touched units. |
| `contacts.contact_email_action` | Ordered effective email actions within the unit. |
| `security.user_history` | Non-secret account payload at construction; full account lifecycle remains unimplemented. |

One naming trap from the sibling projects: CFUS uses `entity_history` for its thin spine and `entity_data_history` for root payload. Overmind uses `entity_version_history` and `entity_history` respectively. Matching the responsibility is more reliable than copying a familiar table name.

## Where the implementation stands

At this guide's checkpoint, the email lifecycle is the complete reference family for the declared fresh-schema boundary: insert, update, delete, restore, saved moves, history, actions, reader/diff, unit ownership and restricted database access. Ordinary administrative user creation and contact promotion now preserve type history and make constructed users eligible actors.

The actual application create/drop/create cycle is tested. It uses the normally constructed seed user for email work. The implementing and independent-review reports record passing SQL/C# runs with RCSI off and on. The runner creates and removes generated disposable databases. These results are existing evidence; writing this guide did not run the suite again.

This is fresh creation DDL. It is not an upgrade/backfill package for a customer's populated database. A running application must also load its rebuilt embedded SQL resources before using changed creation scripts.

The latest [user-construction review](../user-construction-independent-review.md) is useful precisely because a passing reference suite does not exhaust every reachable behavior. Its current open items include:

- Concurrent company-name misses can create duplicates that later name-based creation rejects.
- Promotion preserves existing contact details but currently accepts and silently drops supplied contact-detail changes.
- Login uniqueness scope and whether organizational contacts may hold accounts need explicit decisions.
- The root snapshot helper currently labels construction/promotion INSERT or UPDATE; it is not a general delete/restore writer.
- Historical occurrence versus event recording time needs consistency work; account phone inputs and seed role-assignment evidence need the documented follow-ups.

For the seed role issue specifically, the sample still assigns Developer by direct DML, bypassing the constructor's optional initial-role event evidence. General role history is also unimplemented. Do not infer complete role reconstruction from account construction history.

Shared actor delegation, public self-registration, broader account/role/relationship lifecycle, the remaining contact families, historical migration, synchronization and other provider implementations are later work. Existing legacy constructors outside the restricted email capability also retain separate hardening work. The reviewed email contract is not automatically inherited by every old procedure in the repository.

## A small set of documents for the second reading

| When you want to know… | Read… |
| --- | --- |
| The overall chosen direction | [Primary design](../dbrow_version-allocation-design.md) |
| Why allocation moved into a helper | [ADR 0001](../adr/0001-dbrow-version-allocation-helper.md), remembering its ownership section is historical |
| Exactly what the email implementation guarantees | [ADR 0005](../adr/0005-email-reference-family.md) and [ADR 0006](../adr/0006-email-review-corrections-and-saved-order.md) |
| Why user construction needed another change | [ADR 0007](../adr/0007-ordinary-user-construction-and-type-history.md) and its [review](../user-construction-independent-review.md) |
| How to call and verify the reference | [Usage/test guide](../email-reference-family.md) |
| The longer-term delivery and migration contract | [ADR 0004](../adr/0004-portable-delivery-and-provider-profiles.md) |

The earlier analyses and review exchanges preserve how the reasoning evolved. They are useful when investigating a decision's history, but they are not prerequisites for understanding today's write path. Some describe proposals that were simplified or findings that were corrected later.

For a first human review, revisit Mariana's Save and check three things against the code: both commands share one unit, Lina gets one revision, and reconstruction plus actions explain the result. Then inspect the failure cases that could invalidate those guarantees. That gives the many files a small, concrete purpose.

[← Chapter 7](07-disconnected-branches-and-migrations.md) · [Return to contents](README.md) · [Glossary →](glossary.md)
