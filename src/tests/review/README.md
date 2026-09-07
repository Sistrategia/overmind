# Archived independent-review probes

These Python scripts are historical evidence, not supported test entry points. Their contents retain original paths, setup lists, dependencies and observations; they are deliberately unchanged by the .NET migration and coverage integration.

- [Email review probes](email-reference-family/run_review_probes.py): review of `48f2cd90baf38125af5c3aa4cc3b52468ca3a3f9` against `f320fa15ce0040624d6ba26187e57d41f6b196aa`, before ADR 0006 corrections. [Original report](../../../docs/email-reference-family-independent-review.md).
- [User-construction probes](user-construction/run_user_construction_probes.py): ADR 0007 working tree over `a3b715ae1502a4faff3e59ef518bc9a3ca6eb2ff`, subsequently committed with its review in `c575325`. [Original report](../../../docs/user-construction-independent-review.md).

The [current .NET coverage inventory](../../../docs/testing-handoff.md#historical-review-probe-coverage) classifies every probe/subcase, names maintained test filters, records verification and preserves recipes for unresolved findings. Follow that handoff's `dotnet test src/overmind.sln` instructions for current work; these files introduce no Python/sqlcmd requirement to the maintained suite.

Retain the originals while unported findings and review provenance remain useful. They could later move to a dedicated history archive, or leave the current tree if exact checkpoint/blob references, reports, reproduction details and coverage mappings are preserved and all consumers' links are updated. A `.py` extension alone is no reason to remove evidence. Generated `__pycache__` is not evidence.
