# ADR 0011: Exact web-link values and contact associations


Later evolution: [ADR 0012](0012-immutable-address-values-and-geographic-catalogs.md) appends the address
component, giving 13 composed result sets. The original checkpoint below is retained as history.
Date: 2026-09-07. Status: implemented and verified for fresh schemas.
Iteration 2 was authorized by the author over `00c72f2`. The author explicitly retained
`ordinal` as stable child identity and `display_order` as saved position for every implemented family.

## Context and decision

Web links had domain objects but no installed SQL family. They now follow the email/phone audit
mechanisms in ADRs 0005–0010: root lock before allocation, unit-entry optimistic token, one aggregate
bump per unit, retained child identity, final touched-row history and globally ordered effective actions.
This ADR adds a value contract; it introduces no new transaction-ownership mechanism.

The shared immutable `contacts.web_link` identifies an **exact accepted URL**, up to 2048 UTF-16 code
units. That limit is our API/storage choice, not a claim about a universal URL limit. No case folding,
trimming, percent decoding, query sorting, fragment removal, slash insertion or default-port removal
occurs. Two spellings that navigate to the same resource may intentionally have different IDs.
There is no normalized search identity in this iteration.

SQL uses an indexed SHA-256 hash and length to locate candidates, followed by full binary equality.
A transaction-owned hash application lock protects the miss/recheck/insert path. Hash collisions
serialize candidates but never establish equality; the hash index is deliberately nonunique.
The controlled writer enforces exact interning because a full 4096-byte URL is not used as an index key.
Runtime principals cannot directly modify or enumerate the shared dictionary.

`contact_web_link` stores `web_link_id`, an optional immutable label reference, nullable `link_type`
and `display_text`, restrictive `is_public`, identity/order and owner/audit metadata. A type describes
the association, not an inferred property of the host. Types are extensible lowercase ASCII tokens
of 1–50 letters, digits, underscores or hyphens; NULL means unspecified. There is no closed social
platform catalog or hostname-based type inference. Display text permits 256 UTF-16 units; label
permits 100. Both retain exact accepted text, including trailing spaces; NULL and empty are distinct.
Duplicate URL associations are allowed, including different labels or types on the same contact.

The explicit child tenant is constrained to the owning entity and audit ledger with composite FKs.
It has no independent business meaning and does not introduce tenant partitioning. This retains the
email/phone integrity convention discussed with the author.

## Validation boundary

Accept absolute HTTP and HTTPS links, including internationalized host/path text accepted by .NET's
URI parser. `WebLinkInput.Validate()` uses `Uri.TryCreate` for structure and host/port validation while
returning the original string unchanged. The API rejects credentials (including an empty user-info
delimiter), unencoded whitespace/controls, backslashes, malformed percent escapes, unpaired UTF-16
surrogates and excess length. No network request or ownership/reachability check occurs.

Native SQL commands guard length, explicit scheme/authority, credentials, whitespace/controls,
backslashes, percent escapes and metadata. They do not implement a second complete URI parser.
Trusted native adapters **must perform the same backend validation** before passing the exact URL,
including constructor arguments. SQL is not an untrusted HTTP input boundary. This is analogous to
phone's trusted parser/structural SQL separation, without a prepared JSON representation.

The HTTP/HTTPS scope excludes email/telephone schemes, relative links and application deep links;
these need a separately agreed contract if requested. Display text is plain text. A future UI must
encode text and use URL attributes appropriately. `is_public` retains directory-display eligibility,
subject to root privacy and application authorization. Internal historical readers return all values
and flags. No anonymous endpoint or URL-fetching facility is introduced.

## Lifecycle and composition

Insert allocates a new retained ordinal and appends. Update replaces URL and association metadata,
including clearing NULL optional fields, while preserving position. Delete closes the order gap;
restore requires a retained absent identity and appends. Move/default changes position, never identity.
Identical replacement and an already-current move allocate nothing. Effective change/revert retains
actions even when the final diff is empty. Insert/delete retains identity/actions without inventing
a final row snapshot. One contact's value replacement leaves other associations and old revisions intact.

`SqlAuditUnit` adds web-link methods and validates inside command admission, so validation/SQL errors
invalidate and roll back preceding email/phone work. Existing cancellation and uncertain-commit
contracts remain unchanged. Native ambient callers enroll and roll back the whole unit on error.

The shared coordinator appends a web-link component under the same root barrier and revision bounds.
`contact_channels_read` now returns **ten sets**: root, email state/diff/actions, phone state/diff/actions,
then web-link state/diff/actions. Deploy the matching rebuilt C# reader with fresh DDL; native consumers
of the former seven-set contract must consume the appended results and server completion. Email-only
and phone-only SQL readers retain their four-set shapes. `contact_web_link_read` and
`SqlContactWebLinkReader` provide the corresponding four-set standalone web-link API.

`contact_channels_runtime` now includes web links as part of its contact-channel capability.
`email_runtime` remains email-only. All new internal helpers/components and direct table access are
denied through the inherited restricted profile; constructors remain privileged. Existing deployment
roles/memberships survive schema cycles.

Both constructors append optional initial web-link arguments and route them through the same writer
at revision 1, with construction actions hidden from the timeline in favor of the creation event.
Orphan metadata rejects; promotion rejects supplied contact web-link inputs rather than ignoring them.
The domain `WebLink` now tracks saved order and visibility; collection insertion no longer invents
or overwrites a persisted ordinal. Validation belongs to the write boundary, not rewriting setters.

## Evidence and remaining scope

Focused tests passed 11/11 in both RCSI profiles plus database-free validation. The final full gate
passed 64/64 in 6 min 38 sec, zero failures/skips or build warnings/errors. All 74 created databases
have verified removal evidence; two earlier connection-failure intent names were independently
verified absent. Full evidence is recorded in the [testing handoff](../testing-handoff.md#iteration-2-web-links--2026-09-07).
Scenarios cover exact variants and Unicode, field widths, no-op/revert, moves, deletion/restoration,
ephemeral identities, shared-value isolation, standalone/composed history, mixed-family action order
and rollback, native rejection, constructor/promotion paths, permissions, same-value concurrency and
distinct-value progress, and a writer blocked behind the reader after email/phone results.
The real application schema cycle also exercises an ordinary seed user's mixed email/web-link save.

Fresh schemas only. Address/profile lifecycle, service/HTTP exposure, URL discovery/search,
customer upgrades, backend link fetching and independent review execution are separate work.
Login uniqueness remains explicitly deferred until provisioning.
