# 1. The design you already know

[Guide contents](README.md) · [Next: Follow one Save →](02-follow-one-save.md)

The strongest part of the original design is still present: an entity gives business data a durable identity, related tables describe it, and an audit version connects changes that happened together. The contact you inspect today can be connected to the contact that existed when a customer made a mistake or an administrator investigated an incident.

The redesign keeps that relational structure. The dependency order remains `data → entities → contacts → security`. A contact has an entity root. A user has that entity identity, a contact row and an account row. Email addresses belong to the contact's collection. History remains stored in relational tables.

The main change is how explicitly we define the rules that make those records trustworthy under composition, concurrent work and failure.

## Start with the contact

Imagine Lina is contact 42. Her name, contact information and email list form the part of the business object covered by our example. We call the owning entity the **aggregate root**. Here that simply means: when an owned email changes, Lina's contact revision changes too.

It does not mean every table that refers to Lina belongs to her aggregate. An invoice that names Lina has its own owner and rules. Likewise, adding an employee-owned company relationship does not automatically revise the company or make its revision a complete record of all employees.

The word *aggregate* is useful because it lets us talk about the business object the user sees, even when several SQL tables store it.

## The two version numbers have separate jobs

Suppose Lina's current `entity_version` is 3 and her latest `dbrow_version` is 1048.

| Value | What it tells us |
| --- | --- |
| `entity_id = 42` | Which local entity this is. It keeps that identity through later changes. |
| `entity_version = 3` | Which accepted local revision of Lina's aggregate this is. |
| `dbrow_version = 1048` | Which local audited business unit produced that revision. Other roots may share this number if the unit changed them too. |

`entity_version` is the number suitable for a conversation with a user: “You are looking at revision 3 of this contact.” An email edit can produce revision 4 even if no name field changes. The number belongs to the aggregate, not separately to each child table.

`dbrow_version` connects evidence across tables and roots. Despite its legacy name, it is not a different number for every modified row, and it is not SQL Server's `rowversion` data type. In this framework it is a BIGINT identifying one locally allocated audit unit.

The selected design uses one database-wide allocator. Each ledger row still belongs to a tenant. We are not introducing a second tenant transaction counter alongside the aggregate counter.

## What accepting gaps means

Lina's next change might receive 1052. Numbers 1049–1051 might belong to other work, or an allocation might have been consumed by work that rolled back. The gap itself cannot tell us which happened.

This is a tradeoff: we give up using the sequence as a gapless business counter. In return, allocating a number does not require every writer in a tenant to hold a common counter row until commit. The audit's usefulness comes from the committed evidence and its relationships.

A gap also cannot prove that evidence was deleted. Protecting history requires controlled writes, permissions, retention and operational controls. Stronger tamper evidence is a separate capability. A prettier sequence would not establish all of that.

There is one more distinction that matters later. Writer A can allocate 1052, writer B allocate 1053, and B commit first. Allocation order and commit order can differ for independent roots. We deliberately enforce stronger ordering **within each aggregate**, because its historical reader needs it. Chapter 4 explains how.

## From an implicit convention to an explicit contract

Much of the legacy design already aimed for “these changes belong together.” The new implementation gives that intention a defined boundary called an **audit unit**: one controlled transaction, one database, one tenant, one actor, and at most one allocated ledger identity. A unit with only unchanged-value commands may never need an allocation.

The allocator lives in one shared helper. The procedures still accept optional INOUT `dbrow_version` parameters, so callers retain convenient composition. What becomes stricter is the meaning of reuse: the supplied number must belong to the current enrolled transaction. Finding an old ledger row is insufficient.

That stronger contract is the reason for many of the new files. They centralize rules that previously depended more heavily on each caller doing the right thing.

One historical correction is useful when reading the older notes: by the actual helper extraction, the three active constructor allocation blocks already used sequences. The extraction removed duplicated mechanics; some early pending `MAX()+1` notes were stale. The design still rejects unlocked maximum-based allocation for the database audit number.

**A useful stopping point:** Lina has one identity, her own revision number, and a link from each revision to the business operation that produced it. The next chapter follows one such operation.

For the original decision and its correction, see [ADR 0001](../adr/0001-dbrow-version-allocation-helper.md). No source reading is needed to continue.

[← Contents](README.md) · [Next: Follow one Save →](02-follow-one-save.md)
