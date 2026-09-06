# From the original audit design to the new foundation

A guided tour for the person who designed the original system.

Written 2026-09-05 against repository checkpoint `c575325`, including the ordinary-user construction review. Examples use invented people, IDs and version numbers. This guide explains the current implementation and labels future work explicitly.

You already understand the difficult part: business data needs a memory. A customer's contact, invoice or account is more useful when you can explain how it arrived at its present state, who changed it, and which other changes belonged to the same operation. That idea remains the center of this redesign.

What became harder to recognize during today's work was the machinery around that idea. Allocation, ownership checks, root locks, history writers and readers acquired separate names and files. Read together, those files can make a familiar design feel unfamiliar.

This guide puts the business story back in front. We follow Mariana correcting Lina's contact, then use that same example to explain the numbers, the tables and the safeguards. You can read straight through without opening an ADR or a SQL file. Source links are there for a second pass.

## The reading path

| Chapter | The question it answers |
| --- | --- |
| [1. The design you already know](01-the-design-you-already-know.md) | What stayed, and what do the version numbers now mean? |
| [2. Follow one Save](02-follow-one-save.md) | What actually happens when two changes belong to one business operation? |
| [3. Ask history a question](03-ask-history-a-question.md) | How do we reconstruct an old contact, and why keep actions as well as snapshots? |
| [4. Why the write path has more steps](04-why-the-write-path-has-more-steps.md) | What problem does each guard prevent? |
| [5. Tenants, people, users and shared values](05-tenants-people-users-and-shared-values.md) | How do scope, identity, promotion and catalogs fit together? |
| [6. What the audit costs](06-what-the-audit-costs.md) | Where does the additional work pay for itself, and where can it become expensive? |
| [7. Disconnected branches and historical migrations](07-disconnected-branches-and-migrations.md) | How does this support the longer-term direction without requiring distributed machinery everywhere? |
| [8. Return to the code with a map](08-return-to-the-code-with-a-map.md) | What should I read, what is implemented, and what remains open? |

For a first sitting, read chapters 1–3. They give you the central picture without requiring knowledge of the helper procedures. Continue with chapter 4 when you want to understand the additional SQL. The complete guide is intended for a few short sittings; it is fine to stop after a chapter.

The [small glossary](glossary.md) is a lookup page, not prerequisite reading.

## How to use the other documents afterward

This guide teaches the model. The [primary design](../dbrow_version-allocation-design.md) states the broader recommendation. An ADR, or architecture decision record, preserves a particular decision and its reasons. The [email usage guide](../email-reference-family.md) supplies API examples; the [testing handoff](../testing-handoff.md) supplies current .NET test commands, environment requirements and verification evidence. Independent reviews supply challenges and counterexamples. The design handoff is primarily a resume record for ongoing work.

Those documents serve different purposes; you do not need to read them chronologically. Chapter 8 gives you a small selection for each kind of question, including the latest review's unresolved findings.

**Begin with [The design you already know →](01-the-design-you-already-know.md).**
