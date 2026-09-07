# 11. Errors and troubleshooting

Previous: [10. Porting a family](10-porting-a-family.md) · [Index](README.md) · Next: [12. Status and map](12-status-and-map.md)

All custom errors are `THROW` with numbers in the 51000 range, grouped by layer. `XACT_ABORT` is on in every writer, so after any of these the transaction is doomed and the owner must roll back; a partial commit is never possible.

## 510xx: allocation and reuse (`data.dbrow_version_ensure`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51001 | requires an active, committable caller transaction | You called a helper outside a transaction or after an error doomed it. Open and enroll first. |
| 51002 | an existing tenant is required | The tenant id did not resolve. Pass a valid tenant key. |
| 51003 | an actor entity ID is required | Internal: a caller passed NULL as actor. |
| 51004 | supplied audit version does not exist for this tenant | The number is not this tenant's. Do not pass numbers across tenants. |
| 51005 | the audit unit has a different tenant or actor | Two actors in one unit. Use two units. |
| 51006 / 51007 | timestamp or operation type missing | Internal helper misuse. |
| 51008 | a supplied audit version requires the caller's active transaction | You passed a number with no ambient transaction. Either drop the number or open and enroll. |

## 511xx: enrollment and ownership (`data.audit_unit_begin`, `audit_unit_assert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51100 | enrollment requires a committable caller transaction | `BEGIN TRANSACTION` first. |
| 51101 / 51104 | could not enroll / could not guard the new allocation | The private lock could not be taken. Should not happen; report it. |
| 51102 | the ambient transaction is not enrolled | **The most common one.** You opened a transaction and called an audited procedure without `EXEC data.audit_unit_begin`. Seeds must run through `RunLocalStoredAuditCommands`. |
| 51103 | supplied audit version is not owned by this transaction and database | You passed a committed or foreign number. Pass NULL to join, or pass the number this unit allocated. |
| 51105 | action does not belong to this audit unit | Internal: action counter asked for another unit's ledger row. |
| 51106 | audit writes require READ COMMITTED isolation | Your session is in SNAPSHOT, REPEATABLE READ or SERIALIZABLE. Use READ COMMITTED (RCSI is fine). |

## 512xx: actors, tenants and roots (`entities.actor_resolve`, `entity_write_lock`, `entity_version_bump`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51200 | unknown target tenant | The tenant key does not exist. |
| 51201 | an active user actor authorized for this tenant is required | The actor is not a user-typed, active entity in that tenant. Check the GUID, the tenant, and that the account was created through `user_insert`. |
| 51202 | target does not exist in this tenant | Contact key unknown or belongs to another tenant. |
| 51203 | target is deleted or locked (also: referenced company) | Lifecycle blocks the write. |
| 51204 | a later unit has changed this root; retry the whole operation | Late-root ordering conflict or lost race in the bump. Roll back and retry the whole unit. |
| 51205 | root stamp has no matching audit spine | Data inconsistency between entity and spine. Investigate; never patch by hand. |
| 51206 | the expected entity version is stale or missing | Classic optimistic conflict, or you forgot the token. Reload the aggregate and retry with its current version. |

## 513xx: email family (`contacts.contact_email_write`, `email_values_ensure`, `contact_insert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51300 / 51301 | email or location length out of range | Values are 1 to 256 and up to 100 UTF-16 code units. Nothing is truncated silently. |
| 51302 / 51303 | unknown operation / visibility flags must be explicit | Internal or caller misuse. |
| 51304 | the target entity is not a contact | Root exists but has no contact row. |
| 51305 / 51306 | ordinal missing / association does not exist | Update, delete or move named a child that is not live. |
| 51307 | restore requires an existing, currently absent identity | Restore only recreates a known deleted child. |
| 51308 | new ordinals are allocated, not supplied | Do not pass an ordinal on insert. |
| 51309 | email identity has incomplete prior history | The identity's birth unit shows no cancelling delete yet there is no history. Data inconsistency; investigate. |
| 51310 | supply a position only to move | Position is not an insert or restore parameter. |
| 51311 | order is not a dense unique list | Invariant check failed after a change. Should not happen through the writers; report it. |
| 51312 | could not lock the email value | Dictionary applock timed out under your `LOCK_TIMEOUT`. Roll back and retry. |
| 51313 | company name is ambiguous within this tenant | Two companies share the name. Select the company explicitly (an id-based API is planned). |
| 51314 | company lookup requires a name and this tenant's allocated unit | Private-helper precondition; the constructor must supply its actual unit context. |
| 51315 | could not lock the company name | Roll back the unit; a configured lock timeout or lock-acquisition failure prevented safe creation. |
| 51316 | company full_name must use database collation | Unsupported collation drift would make lookup and locking disagree. Review schema/collation changes. |

## 514xx: reader (`contacts.contact_email_read`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51400 | requires its own read transaction | Do not call the reader inside an open transaction. |
| 51401 | requested revision does not exist | Wrong version number for this contact. |
| 51402 | historical root payload unavailable | No root history at or below the bound. Fresh schemas always have it; legacy imports may not. |

## 515xx: bootstrap and tenants (`security.system_user_bootstrap`, `data.tenant_insert`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51500 / 51503 | bootstrap or tenant creation requires a unit with no existing allocation | Run them standalone, not inside another business unit. |
| 51501 | could not lock System bootstrap | Another bootstrap is running. |
| 51502 | conflicting or incomplete System identity | Entity 1 exists but is not the expected System. The bootstrap will not repair it. Investigate. |

## 516xx: user construction (`security.user_insert`, `user_history_create`)

| Number | Message | What it means and what to do |
| --- | --- | --- |
| 51600 | type definitions required / only an ordinary contact can be promoted | Seeds missing, or the root is not a contact-typed entity. |
| 51601 | this contact already has a user account | Promotion of an existing account. |
| 51602 | initial role name must identify exactly one eligible definition | Unknown, other-tenant or ambiguous global/local role name. |
| 51603 | new user construction accepts only version 0 or omitted | You passed an expected version for a root that does not exist. |
| 51604 | user creation history requires this unit's user root, subtype and spine | Internal precondition; report it. |
| 51605 | ordinary user accounts require a human person contact | Organization/group accounts are rejected on creation and promotion. |
| 51606 | promotion does not modify contact details | Pass account inputs and `@full_name=NULL`; compose supported contact changes explicitly. |
| 51700 | normalized phone interpretation is missing, malformed or inconsistent | Use `PhoneParser.PrepareForDatabase` for native adapters; ordinary C# commands parse inside the unit. |
| 51701 / 51717 | phone label exceeds 100 / extension exceeds 25 UTF-16 units | Correct the input; values are never silently truncated. |
| 51702–51712 | phone operation, flags, child identity, position, prior history or catalog lock failure | Same lifecycle/rollback rules as the corresponding email errors; inspect the message. |
| 51718 | legacy ambiguous phone arguments or label/extension without a phone | Supply prepared `@phone_data`; national/split input needs explicit country context. |

## Engine errors you will meet

| Number | Meaning here |
| --- | --- |
| 1205 | Deadlock victim. Two units locked roots in opposite order. Retry the whole unit. |
| 1222 | Lock timeout under your `LOCK_TIMEOUT`. Usually a long-running unit holds the root. |
| 229 | Permission denied. The runtime role tried to reach a table or an internal helper directly. |
| 2627 / 2601 | Unique key. Public key or dictionary value collision; the unit is doomed. |

## Three habits that avoid most errors

1. Open, **enroll**, work, commit. Never skip the middle step.
2. Pass the `entity_version` the user actually saw, and reload on 51206.
3. Treat a failed unit as gone. Discard every output value, roll back, start a new unit.

Next: [12. Status and map](12-status-and-map.md)

## Web-link additions (iteration 2)

| Error | Meaning | Response |
| --- | --- | --- |
| 51800 | Missing, overlong or structurally invalid HTTP/HTTPS URL | Validate with WebLinkInput; preserve the accepted value without silent rewriting. |
| 51801 / 51817 | Label exceeds 100 / display text exceeds 256 UTF-16 units | Correct input; SQL accepts wide parameters so it can reject before truncation. |
| 51818 | Constructor web-link metadata supplied without a URL | Supply a complete initial link or omit its metadata. |
| 51819 | Invalid link-type token | Use NULL or 1–50 lowercase ASCII letters, digits, underscores or hyphens. |

Other 518xx lifecycle/order/catalog-lock errors mirror the email/phone guards. Any command error
requires whole-unit rollback; an expired optimistic token is not fixed by retrying inside that unit.

## Address additions (iteration 3)

| Error | Meaning | Response |
| --- | --- | --- |
| 51900 / 51901 | Invalid/missing/overlong address payload or overlong label | Validate through AddressInput; preserve accepted values. |
| 51918 | Initial address metadata without a value, or JSON mixed with legacy address inputs | Supply one complete representation and its metadata. |
| 51920 | Blank or overlong geographic name | Supply an accepted name of at most 256 UTF-16 units. |
| 51921 | Unknown/invalid ID, conflicting hierarchy or name, or missing parent context | Supply consistent IDs/names and required parent context. |
| 51922 | Attempted mutation of an immutable address/catalog/label | Select/create a replacement and explicitly repoint the contact association. |
| 51923 | Lines mixed with structured street, or a number without street | Choose one street representation. |

Other 519xx lifecycle/order/lock errors mirror the preceding families. Any error requires whole-unit
rollback. See [ADR 0012](../adr/0012-immutable-address-values-and-geographic-catalogs.md).

## Contact profile/lifecycle additions (iteration 4)

| Error | Meaning | Response |
| --- | --- | --- |
| 52000 / 52001 | Invalid profile JSON, field type/width, required name or name value | Validate ContactProfileInput and supply the full desired replacement. |
| 52002 | Immutable person-name mutation | Select/create another exact value through a contact operation. |
| 52003 | Missing explicit tenant | Resolve tenant in the trusted application and pass it. |
| 52004 | Unsupported/mismatched category or System target | Use person/organization fields; category conversion and System profile lifecycle are excluded. |
| 52005 | Unsupported operation or profile data on a lifecycle command | Separate explicit profile replacement from delete/restore. |
| 52006 | Creation public key already exists | Resolve the existing contact; this is not an upsert or a commit receipt. |
| 52007 | Deletion would affect an account or relationship | Resolve that dependency through its explicit operation; no implicit cascade. |
| 52008 | Snapshot intent contradicts stamped root/history | Private protocol error; roll back the whole unit. |
| 52010 | Complete profile history unavailable | Report missing coverage; never substitute today's names. |
| 52012 | Person-name miss lock failed | Discard the failed unit and use the established retry policy. |

Deleted/locked edits still use 51203 and stale/missing entry versions use 51206. All command failures
require whole-unit rollback; profile/lifecycle commands do not create a separate transaction inside a unit.

## Service outcomes (iteration 5a)

`ContactServiceException.Failure` maps known database guards to Validation, Forbidden, NotFound,
Conflict, Dependency or HistoryUnavailable; unknown provider/invariant failures remain Storage.
`OperationCanceledException` means the operation was cancelled before confirmed commit, including
SqlClient attention errors. `AuditUnitCommitUncertainException` stays distinct and retains its original
error/provisional stamp. No automatic retry is performed. See [ADR 0014](../adr/0014-integrated-contact-service-and-access-boundary.md).
HTTP response mapping and authentication-derived context remain iteration 5b.

## HTTP outcomes (iteration 5b)

The [HTTP guide](../contact-http-api.md) maps authentication to 401, grants to 403, missing data to 404,
validation to 400, stale/dependency/history-coverage conflicts to distinct 409 codes, and uncertain
commit to 500/commit_uncertain. Problem responses omit internal exceptions and never advise automatic
retry. A disconnected caller may have no acknowledgement even after commit succeeds.

Iteration 6 also maps provisioning failures through this HTTP boundary. SQL 51607 is invalid login;
51608 is missing/oversized backend password hash. Duplicate tenant/login constraints (2601/2627), stale
revisions and existing-account conflicts become 409. Invalid person categories or role definitions
become 400; missing provisioning or exact-role grants become 403 before writes. Password hashes and
plaintext never appear in the response. See [ADR 0016](../adr/0016-tenant-logins-and-administrative-provisioning.md).
