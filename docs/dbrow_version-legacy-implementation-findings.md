# Existing implementations: focused audit-foundation findings

Date: 2026-09-05.
Status: source inspection and recommendations; no source-project changes or migration execution.

## Scope and conclusion

The user supplied three neighboring projects to ground the new foundation in working product experience without expanding this into an audit of every application. This review follows CFUS-TOP-React's email insert/update/delete, history schema/view and data-access entry points; LaSalle-egresados's background worker, selected orchestration methods, ledger/email extractors and child-load procedure; and the relevant recommendations in SistrategiaDataAnalysis. These are the checked-out source files, not a verification of deployed databases or customer data.

The evidence supports the [current primary design](dbrow_version-allocation-design.md). Child-grain history with one aggregate revision is already a useful product pattern. Staging, identity mapping, resumable processing and human correction are real requirements, not speculative distributed-system features. None requires gapless numbering, another tenant counter, hashes or a general revision graph.

The important refinement is **historical coverage**: a transaction ledger, a current child row and a historical child snapshot are different evidence. The new system must preserve that distinction when importing older variants. The implementation intake should start with the existing email use case, then prove that the same mechanism works for phone.

## 1. CFUS-TOP-React: preserve the behavior, adapt the mechanism

### What the code establishes

[Email update][cfus-update] changes the contact-email association, records its history, and attempts to advance the contact root once when its current dbrow_version is below the supplied/allocated value (lines 99–137). [Association insert][cfus-insert] and [delete][cfus-delete] implement the corresponding lifecycle. Delete snapshots the child before physically removing its association; the shared email value remains available.

This is the right division of responsibilities: changing an email is a new version of the contact, but does not require copying unchanged contact payload. A user-facing contact revision can collect several related row changes under one ledger entry. The event is an explanation of the action, while the row history is the evidence of state.

The [email DDL][cfus-schema] distinguishes the shared value, location dictionary, live association and association history. The history key is (dbrow_version, contact_id, ordinal), allowing one state per child per unit. The [DAC][cfus-dac] passes contact public key and ordinal for edits/deletes; the [schema builder][cfus-builder] installs the procedures. This is connected application code, not merely a proposed SQL sample. Runtime coverage was not tested here.

### Important differences from Overmind

| CFUS source structure | Meaning in the new foundation |
| --- | --- |
| entities.entity_history containing entity_id, dbrow_version, entity_version | Aggregate spine: maps to Overmind's entity_version_history |
| entities.entity_data_history | Historical root payload: maps to the new entity_history shape |
| contacts.contact_email_history | Historical child association, after key/tenant/value mapping and validation |
| contact_email.ordinal | Existing child identifier requiring lifetime analysis; not automatically a globally portable or never-reused ID |

The [entity DDL][cfus-entities] makes the first two differences explicit (lines 164–207). Copying procedures by table name would write spine data into the wrong conceptual table. Its index named ux_entities_entity_history is actually created on entity_data (lines 180–181); names alone also do not establish the intended spine constraints.

### Mechanisms to replace before bringing the family over

- **Allocation and ownership:** all three association writers still use tenant-filtered MAX()+1 and accept a non-NULL version without proving active-unit ownership. Use the controlled helper/unit boundary and optional INOUT contract. The existing Overmind helper is only the first part of that transition.
- **Root ordering and concurrency:** update/delete read entity_version separately, change children before the root-order check, and conditionally insert a spine after a separate existence test. A supplied older version can change a child while skipping the root bump. Concurrent schedules also need more protection than this check/update sequence. Lock the root, validate entry version, reject invalid ordering before mutation, and derive the spine from the successful bump.
- **Repeated changes in one unit:** inserting another history row for the same child/version collides with the history PK. Use current-unit history upserts and the insert/update/delete/restore state machine in ADR 0002.
- **Missing rows and no-ops:** update/delete do not require a matching ordinal before advancing the root. A non-NULL email update with a missing ordinal can record a contact change without changing a child. Define missing-target and idempotent-delete behavior deliberately; validate stale tokens and ownership rather than treating arbitrary absence as success.
- **Stable identity:** insertion uses MAX(live ordinal)+1. Deleting the highest child permits its number to be assigned to a different future child. Use the retained root/family high-water mark; migration must disambiguate source lifetimes where reuse already occurred.
- **Contract consistency:** procedure email parameters are NVARCHAR(50), while the CFUS catalog permits NVARCHAR(256). Location parameters are 25 while the catalog permits 256. Preserve supported data through every layer. Update treats a NULL location as clearing it; decide whether the new endpoint is replacement or a patch and distinguish an omitted field from an explicit clear when needed.
- **Attribution and tenancy:** unknown actors fall back to System User. Insert can derive the ledger tenant from the actor independently of the target contact. The new unit must authorize and validate the target's actual tenant, including shared-actor cases.

These are source-visible limitations and concurrency counterexamples, not claims that a particular customer's history has been corrupted.

### Reconstruction is more than a history list

The [history view][cfus-history-view] joins historical email rows to the current entity_view for the display name. That can be useful for navigation, but it is not the contact's historical name at that email change. Keep current-context labels distinguishable from reconstructed historical fields. The canonical as-of reader must resolve the root and child states at the same aggregate boundary in a consistent snapshot.

## 2. LaSalle: a valuable migration workflow with fidelity limits

### What is worth preserving

The [worker][lasalle-worker] runs extraction separately from manually triggered validation/loading. The [orchestrator][lasalle-orchestrator] explicitly allows stewards to review, edit and fix staging before application (lines 577–603), tracks progress and errors, and keeps the long operation outside an HTTP request.

Extracting the ledger separately is especially valuable. The [ledger reader][lasalle-ledger-reader] uses a LEFT JOIN to entity history, so transactions without a root-history row can still be observed. The [staging schema][lasalle-ledger-schema] retains source tenant, source version, time and actor. This is the right motivation for a transaction manifest independent of which history families happen to exist.

The [child processor][lasalle-child] combines several families into a source-version-ordered queue, caches parent mappings, invokes existing write procedures, and tracks outcomes. These are useful operational ideas. The new design should retain the staging/validation/application separation and shared low-level write invariants, while making source-unit atomicity and evidence quality explicit.

### Findings that affect the foundation

**L1 — A missing parent can reuse the previous parent's identity.** The processor declares parent variables once (lines 273–278), assigns them with SELECT from #parent_cache inside the loop (lines 299–306), and then only checks whether @contact_public_key is NULL. It does not reset those variables before lookup. In SQL Server, SELECT assignment with no result retains the earlier value; this behavior was already verified by an isolated probe in the [handoff](dbrow_version-design-session-handoff.md).

Concrete failure path: process a valid child for A, then a child for B whose parent is absent/not completed. The second lookup returns no row, the variable can still name A, and the write dispatch can attach B's child to A using A's actor/time context. This deserves a focused fix and regression case before relying on that import path again. This review did not change it or establish whether that schedule occurred in customer data. Reset all parent context and verify exactly one resolved mapping; fixing only the version allocator would not address this problem.

**L2 — Current email values are projected onto historical root entries.** The active [email extractor][lasalle-email-reader] joins ledger → entity_history → current entity → current contact_email → email (lines 30–52). It does not read historical child states or constrain the child to a matching historical version. Consequently, a current email can appear under older root versions; removed emails and earlier values cannot be recovered from this query. A ledger operation code is also not necessarily the operation on that child. The main [reader facade][lasalle-reader] delegates to this extractor.

For example, if a root has history at versions 10 and 20 and its current email is B, this query associates B with both entries. That does not establish that B existed at version 10. Likewise, capturing a ledger entry with no entity history does not recover its child payload: this extractor's INNER JOIN still omits it. Use a clearly labeled snapshot baseline when actual child evidence is absent. Additional event/archive evidence may improve coverage only through a separately validated interpretation.

**L3 — Source order is only partially reproduced; source transactions are split.** LoadToFinalAsync first loads parties, then the contact-child range, then alumni children and further domain phases (orchestrator lines 1867–2014). Within the child range, rows are ordered by source version and load_id (processor line 184). That is ordering within a phase, not one merged replay of all original transactions. load_id belongs to each staging table, so it is not a unique cross-family tie-break or evidence of original statement order.

The normal C# path opens a connection and invokes the range without an explicit outer transaction (lines 2299–2340). The range contains no BEGIN/COMMIT around each original group; it calls contact_email_insert with no version and then separately updates staging status (lines 383–395). The target email procedure owns/commits its standalone transaction. Therefore, same-source-version rows can become separate target ledger entries and partial successes. Suppressing an email event when its source version equals the parent's version does not restore transaction grouping.

**L4 — Preserved source metadata is not consistently used for child attribution.** The parent cache supplies the parent's creation date and creator, with the party itself as a creator fallback (processor lines 240–251). Email dispatch uses that date and actor (lines 383–389), even though dbrow_version_load can retain the source transaction's own time and actor. Later child changes can therefore inherit the parent's birth metadata. Keep source attribution, uncertainty/fallback reasons and actual importer identity separate; never silently present an approximation as measured source fact.

**L5 — Duplicate messages are not an application receipt.** The range treats messages containing “already exists” or “duplicate key” as successful/skipped application (lines 495–515). That may be useful operational triage, but a conflicting business key does not prove the same source transaction was previously committed. The gap between business commit and status update makes retries especially important. Record stable source identity, the accepted transformation, local result and applied status atomically with business history. Incompatible duplicates remain explicit conflicts.

**L6 — The ledger reader has transaction/member fan-out.** Its LEFT JOIN to entity_history can return several rows for one source ledger entry when several roots participated. The staging table has one nullable entity_id per row and no unique source-transaction constraint. This can be a useful denormalized extraction, but its load_id/count is not automatically a transaction identity/count. Normalize one source header plus members, or group and validate the projection before applying. Preserve tenant-qualified source keys where numbers are tenant-local; numeric joins alone are not a portable multi-tenant mapping contract.

### Confirmation of the schema difference you remembered

The inspected LaSalle [email schema][lasalle-email-schema] has a current association with location_name and is_public, but no association version/history. Its [email insert][lasalle-email-insert] changes the root stamp; the entity_version increment is commented out and it writes no child history. The inspected entity DDL has no entity_version declaration. Thus this path does not have CFUS's aggregate-versioned child history. This statement is limited to the checked-out framework definitions, not every application-specific history table or deployed migration.

The is_public field is also a reminder that a mechanically copied CFUS association shape would lose product behavior. Model privacy/visibility as an audited association attribute when it controls exposure; preserve the product's restrictive defaults and review the relevant mutation path during the later port.

## 3. How the earlier analysis helps, and where I differ

[SistrategiaDataAnalysis recommendation 05][analysis-05] correctly emphasizes the spine, touched-table history, reconstruction consumers and a repeatable extension contract. Its migration section already identifies the need for an epoch marker when child history is missing. [Specification 09][analysis-09] develops the canonical child family and reconstruction. These are valuable input, not evidence that every prescribed mechanism has been implemented or tested.

I would refine four migration suggestions:

1. An epoch marker must have **coverage scope**. Email may have real history while phone does not; a single tenant-wide date can hide that difference. Record complete intervals, snapshot-only baselines and unknown periods by source/tenant/family, with aggregate exceptions where necessary.
2. Do not initialize entity_version by summing history-row counts. Several table rows can belong to one aggregate revision, and missing history cannot be recovered by arithmetic. Build the local spine from distinct validated accepted units per aggregate; retain trustworthy source revisions separately and label synthetic baseline revisions.
3. Correct interpretation without overwriting source evidence. If a ledger says INSERT but child history says UPDATE, preserve both source facts and the versioned rule used to produce the target's business/row operation. A multi-row business transaction cannot always be summarized by choosing one child's operation.
4. CFUS history is valuable migration input, but “direct migration” still requires mapping its spine/payload split, validating row identities and ordinal lifetimes, and checking historical coverage. Identical-looking columns do not prove equivalent history semantics.

The current Overmind design remains authoritative on gaps, allocation versus commit order, active-unit ownership, repeated changes within one unit and provider portability. These source projects do not reopen those decisions.

## 4. Narrow refinements to the proposed design

### Coverage and reconstruction

Maintain a migration manifest describing source identity/schema, consistent extraction boundary, included families, transformation version, source transaction-grouping/ordering quality and historical coverage. Store coverage at the coarsest truthful scope; this does not require another column on every business row.

Distinguish a **known empty child set** from **unknown earlier child state**. Loading a present-day snapshot must not make earlier versions show that snapshot as fact, or return an empty list that implies no children existed. An as-of response should carry coverage information or explicitly report that exact reconstruction is unavailable for a requested family/boundary. Real history beginning later does not retroactively fill the unknown period.

Ledger presence establishes an observed transaction record, not complete knowledge of its affected rows. Track unrepresented source transactions and extraction errors; do not claim complete replay solely because every ledger header was copied. Coverage of historical state is separate from coverage of a commit feed.

### Source preservation, correction and reuse

Preserve extracted source evidence (or a controlled archive reference) before steward edits. Store corrections with who/when/why, changed fields and transformation/policy version. The human-reviewed working row is not itself the untouched source record. Required privacy/redaction policy still applies to retained evidence.

Reuse catalog resolution, identity mapping, invariant checks, root bump and history-writing primitives. Ordinary commands and historical application have different orchestration: historical application must not rerun current defaults, send present-day notifications, regenerate unrelated business decisions, or infer old authorization from today's actor state. Rendered event suppression is a presentation choice; it must not suppress required machine-readable transaction evidence.

Apply each known, complete source transaction as one local audit unit, including its mapped children and application receipt. If source membership is incomplete, keep it staged or apply an explicitly labeled partial/baseline import under a new local identity with source links. Do not label it unchanged full acceptance of the original. Lossless schema translation and human correction have different provenance; changed business outcomes create local correction/reconciliation identities.

Where actor/entity dependencies prevent chronological replay, reserve/map identities first under a controlled import protocol. Do not silently turn separately committed bootstrap or parent writes into alleged original transaction history. No generic dependency solver or full distributed consensus is needed to support this distinction.

### Performance without weakened audit semantics

Bulk/stream extraction and staging, cache validated mappings, and avoid one client/server round trip per child. A SQL Server procedure or provider-specific batch can apply a complete unit efficiently while a portable coordinator retains ownership. Network batch size need not equal business transaction size.

The current email extraction can produce roughly H × C rows for an entity with H root-history entries and C current emails. That is both a fidelity problem and avoidable work; actual child history plus an explicitly marked current snapshot is a better input model. Measure representative long histories and large source groups rather than assuming a per-row loop or an all-batch transaction will scale. Do not split an indivisible source unit just to meet a page-size target.

## 5. Bounded next implementation intake

1. Prove the active audit-unit/helper and actor/bootstrap contracts already selected in ADRs 0002–0003.
2. Bring over the **email behavior** as one complete family: insert/update/delete, current-unit history, stable child identity, one aggregate bump, visibility where required, historical view/as-of/diff and the DAC contract. Adapt its SQL to Overmind's actual schemas.
3. Implement phone using the same mechanism to reveal accidental email-specific assumptions before expanding to every contact family and user subtype/role path.
4. Build two small migration fixtures: CFUS-style real child history, and LaSalle-style current children with older root history. Verify preserved known states and honest unknown coverage. Include a multi-root source transaction and a source correction.
5. Test valid-parent → missing-parent iteration, crash after business commit/before legacy status, conflicting duplicates, deleted/reused source ordinals, missing source actor, and incomplete source groups. Test a renamed contact's historical email display separately from its current navigation label.

No further general opinion round is necessary. These focused examples are enough to proceed when implementation is requested. Read additional product files only when the next family or adapter needs them; the rest of the applications remain outside this review.

## Source map

Line references above refer to the files inspected on this date. Links depend on the sibling checkout layout supplied by the user. No production data or connection settings were needed.

[cfus-update]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Email/create_email_update.sql
[cfus-insert]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Email/create_contact_email_insert.sql
[cfus-delete]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Email/create_email_delete.sql
[cfus-schema]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Email/create_email_schema.sql
[cfus-entities]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Entities/create_entities_schema.sql
[cfus-history-view]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Email/create_contact_email_history_view.sql
[cfus-dac]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Contacts/Data/SqlClient/SqlEmailDAC.cs
[cfus-builder]: ../../CFUS-TOP-React/src/Framework/Sistrategia.Data.SqlClient/Contacts/Data/SqlClient/ContactsDatabaseSchemaBuilder.cs
[lasalle-worker]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Applications/Sistrategia.Conexus.Server.WebAPI/BackgroundServices/ImportFromLoadWorker.cs
[lasalle-orchestrator]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Data.SqlImportOrchestrator/SqlImportOrchestrator.cs
[lasalle-ledger-reader]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Data.SqlLegacy/SqlLegacyDbrowVersionsDataReader.cs
[lasalle-ledger-schema]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Server.Data.SqlClient/Scripts/Load/create_dbrow_version_load_schema.sql
[lasalle-email-reader]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Data.SqlLegacy/SqlLegacyEmailsDataReader.cs
[lasalle-reader]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Data.SqlLegacy/SqlLegacyDataReader.cs
[lasalle-child]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Data/Sistrategia.Conexus.Server.Data.SqlClient/Scripts/Load/create_process_child_records_range.sql
[lasalle-email-schema]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_email_schema.sql
[lasalle-email-insert]: ../../LaSalle-egresados/server-app/Sistrategia.Conexus.Server/src/Framework/Sistrategia.Data.SqlClient/Scripts/Contacts/Emails/create_contact_email_insert.sql
[analysis-05]: ../../SistrategiaDataAnalysis/schema-analysis/05-design-recommendations.md
[analysis-09]: ../../SistrategiaDataAnalysis/schema-analysis/09-framework-design-spec.md
