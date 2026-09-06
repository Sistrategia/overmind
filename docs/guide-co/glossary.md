# A small glossary

[Guide contents](README.md) · [Code and status map](08-return-to-the-code-with-a-map.md)

This is a lookup page. The chapters introduce the terms through the example.

| Term | Meaning in this guide |
| --- | --- |
| Aggregate/root | The entity that owns a business revision; Lina's owned email changes advance her contact revision. |
| Actor | The entity attributed with the operation. Authentication and authorization still belong to the trusted application boundary. |
| Audit unit | One controlled local transaction with fixed database, tenant and actor, sharing at most one ledger allocation. |
| Ambient transaction | A transaction already open when a procedure is invoked. It must be enrolled before joining the audit protocol. |
| Enrollment | Establishing that the active transaction participates in this audit contract. It does not itself allocate a version. |
| `dbrow_version` | Database-local BIGINT identifying an allocated audit unit. Gaps are allowed; it is not a commit cursor or SQL Server `rowversion`. |
| `entity_version` | Accepted local aggregate revision, incremented at most once per unit. |
| Expected/entry version | The root revision the operation was based on when entering the unit; repeated calls keep that token. |
| Ledger | `data.dbrow_version`: the unit's identity and shared metadata. |
| Spine | `entities.entity_version_history`: the aggregate-revision-to-unit map. |
| Payload history | Historical field values used to reconstruct supported state. |
| Action evidence | Ordered effective changes with accepted values/references. It can explain activity absent from a final diff. |
| Ordinal | Stable email child identity within its owning contact/family. It is not its list position. |
| Display order | The saved one-based list position. First is principal/default for the contact card. |
| `EmailId` | A shared immutable address-value key, distinct from the contact's child identity. |
| INOUT | A parameter that can receive a value and return one; SQL Server uses OUTPUT declaration and call syntax. |
| Provisional result | An output obtained before commit; it must not be treated as durable success yet. |
| `recorded_at` | Server UTC allocation/recording time. It is not measured commit time. |
| RCSI | SQL Server's row-versioned reads under READ COMMITTED. Explicit root protection still applies. |
| Interning | Reusing one stored immutable value for equal accepted values; associations keep their own ownership/history. |
| Outbox/inbox | Proposed durable publication and receipt records for disconnected delivery; unimplemented here. |
| Origin pair | Proposed original transaction identity: origin plus source-local number. Destination acceptance has its own local number. |
| Coverage | Which historical periods/families are known exactly, baseline-only or unknown; general import coverage is future work. |
| ADR | Architecture decision record: a decision and its rationale, with a status and scope. |

If several terms still feel abstract, return to [Follow one Save](02-follow-one-save.md). The example uses nearly all of the local ones in a single operation.
