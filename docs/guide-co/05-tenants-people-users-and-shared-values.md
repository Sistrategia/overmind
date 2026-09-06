# 5. Tenants, people, users and shared values

[← Why the write path has more steps](04-why-the-write-path-has-more-steps.md) · [Contents](README.md) · [Next: What the audit costs →](06-what-the-audit-costs.md)

For most of your customers, Norte may be the only tenant in the database. Nothing about the contact-editing experience needs a tenant selector in that installation. Internally, however, Lina and the audit unit still have a real tenant.

That gives the single-tenant and multi-tenant cases the same business ownership rules. An omitted tenant selects the established default. An explicit invalid tenant fails. The current resolver uses the framework's known default GUID; a general configurable tenant-selection service has not been built.

## Business ownership and shared definitions

Some data belongs to Norte: Lina's contact, her email associations and the ledger entries that record their changes. Some data can sensibly be shared: an immutable label such as Home, or a global role definition.

Sharing a value does not share the contact that uses it. It is the association between Lina and that value that belongs to her tenant and needs an audit trail.

This is also why the existing catalog idea remains useful. If many contacts use the same accepted label or name component, storing it once can reduce repetition and support matching work. The redesign does not require abandoning those dictionaries. It requires clarity about which values are immutable and what constitutes the same value.

For the implemented email/location dictionaries, exact accepted spelling is preserved separately from any future normalization or matching policy. SQL comparisons can treat some trailing characters as equal even when their stored representation differs, so the implementation uses bytes and length for exact keys. You can leave those details inside the catalog helper when reading business procedures.

Interning names can support candidate matching; a shared name ID still does not establish that two people are the same person. Entity identity, exact value identity and heuristic similarity are separate questions.

## Mariana is a user, and a user is still an entity

The `*_by` values remain local entity IDs. Mariana's account has an entity root, a contact row and a `security.user` row. Its root type says user. Her contact can own emails through the same email family.

For the implemented public email path and ordinary account constructor, the actor must be an active user-type entity eligible in the target tenant. An unknown actor does not silently become System.

Those SQL checks establish eligibility and scope. The backend still authenticates Mariana and decides whether she may edit Lina or assign an initial role. Knowing a public GUID is not proof that the caller is Mariana. The restricted `email_runtime` database role exposes the reviewed email capability to a trusted backend; it is not an unrestricted end-user SQL interface.

The System identity keeps its established ID 1 and public key. Bootstrap reserves and constructs it explicitly. That special identity does not give every `is_system` entity automatic cross-tenant authority. Broader platform/shared-actor delegation remains a separate design capability.

## When Lina becomes a user

Suppose Lina's contact is now revision 4 after Mariana's email edit. An authorized administrator gives her an account in a later unit.

Lina keeps entity ID 42 and her public key. The constructor locks her contact, validates expected revision 4, adds the account row, changes the root type to user, and produces revision 5. Root history preserves the earlier contact type and the new user type. Account construction history records the non-secret account payload.

Reading Lina at revision 4 still shows the earlier type. Reading her at 5 shows user type. The email diff between those revisions may be empty because promotion did not edit the email list.

Creating a completely new user takes a related route: build the contact portion and then the account portion in one unit. Although a provisional contact type exists internally, the committed first revision already has user type. There is no invented committed contact-only revision.

The installation sample is created by System and can act for itself after commit. Public self-registration, where a not-yet-existing person becomes its own creation actor, needs a different reservation and authorization contract. It has not been implemented by quietly allowing unknown actors through ordinary construction.

## Contact-card email and account email

After chapter 2, Lina's contact card shows child 7 because it is first in saved order. Her account email is a separate field on `security.user`, initialized unconfirmed when supplied during construction. Reordering or correcting contact emails does not alter that security field, confirmation status or login name.

This distinction preserves a simple contact experience while leaving room for explicit account verification and recovery policies. Those complete account workflows remain future work.

There is a small current API detail worth knowing: phone inputs in `user_insert` populate contact phone data on the new-contact path. They do not populate account phone; its construction history currently records NULL there. Do not read the presence of a history column as proof that the corresponding lifecycle has been implemented.

## What the latest review asks us to finish

The ordinary-user review confirmed correct type history, one revision per unit and actual seed-user usability. It also identified unfinished boundaries. Promotion currently accepts contact-detail inputs and leaves those fields unchanged without rejecting the inputs. Login uniqueness has no enforced scope. Company contacts can currently hold accounts, pending an explicit policy decision.

The tenant-scoped company-name convenience lookup has a further race: concurrent misses can create duplicate company names, after which ambiguity rejection blocks later name-based creation. Scoped lookup fixed the cross-tenant reference problem; concurrent find-or-create still needs a correction. Choosing a lock for that correction must respect the lookup's actual equality rules.

These findings remain open at this guide's checkpoint. They do not require relearning the aggregate model, but they do matter before broadening access to the constructor. Chapter 8 keeps them visible alongside the implemented capabilities.

For the full reasoning: [tenant/actor/catalog policy](../adr/0003-tenant-actor-and-catalog-policy.md), [ordinary construction](../adr/0007-ordinary-user-construction-and-type-history.md) and its [independent review](../user-construction-independent-review.md).

[← Chapter 4](04-why-the-write-path-has-more-steps.md) · [Next: What the audit costs →](06-what-the-audit-costs.md)
