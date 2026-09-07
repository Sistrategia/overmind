# ADR 0010: Composed contact-family read boundary


Later evolution: [ADR 0012](0012-immutable-address-values-and-geographic-catalogs.md) appends the address
component, giving 13 composed result sets. The original checkpoint below is retained as history.
Date: 2026-09-07. Status: implemented and verified for fresh schemas.

The seven-set description below records iteration 1. [ADR 0011](0011-web-link-values-and-contact-associations.md)
extends the composed API to ten sets and the contact-channel role to web links in iteration 2;
the ownership/barrier contract and standalone email/phone shapes are unchanged.

The public email-only reader retains its own SERIALIZABLE transaction and four result sets.
A composed email/phone coordinator uses the same root resolution, shared clustered root-key
barrier and revision bounds, acquired once before any family reconstruction. Private family
components emit state, diff and actions, reuse as-of functions, and never begin/commit a
transaction. They receive no runtime EXECUTE permission. Direct ambient transaction use is
rejected by public readers; transaction presence alone grants no component capability.

The combined reader returns root metadata, three email sets and three phone sets. C# consumes
all seven sets and server completion before returning. Actions retain the shared audit unit's
action ordinal; a merged family-tagged action list orders them across both families. Ordinal
identity is family-local and is never joined across families as though globally unique.

One SqlAuditUnit owns email and phone commands, including parsing failure, cancellation,
rollback and commit uncertainty. No new ownership mechanism is introduced. A combined Save
bumps the root once, preserves final history in both families and retains effective actions.

Phone and composed read capabilities use a new contact_channels_runtime role that includes
the existing email capability. Existing email_runtime membership does not gain phone access.
Neither role permits arbitrary table access, constructors or internal reader/writer helpers.

Verification must cover standalone email compatibility, mixed saves and rollback in either
order, phone lifecycle/order/history, shared action ordering, denied private access and a
concurrent writer blocked by the shared root barrier until the composed read completes.
Root-leading history seeks remain required. This is a coherent email/phone reader, not yet
the complete contact/profile/address reconstruction planned for later iterations.

Final full gate: 53/53, zero failures/skips, 5 min 30 sec, zero build warnings/errors; both
RCSI profiles passed. Tests observe actual blocked requests at the root barrier, verify mixed
before/after revisions, and retain the 200-unrelated-root footprint assertion through both
email-only and combined wrappers. That probe now instruments the coordinator before COMMIT;
its declaration extraction ignores the audit-style "Created" header. All 142 owned databases
across seven runs were verified removed. See the [testing handoff](../testing-handoff.md#iteration-1-phone-and-composed-reader--2026-09-07).
