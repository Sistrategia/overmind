# Follow-up review: ordinary user construction and the email integration boundary

Please independently review the current Overmind user-construction changes, with ADR 0007 as the claim to verify against code. The repository is a remake with deliberately incomplete families. Review the implemented mechanism and reachable regressions; distinguish later policy work from defects in this boundary.

Baseline: a3b715a (email corrections and saved ordering). Target: the current working tree, or its subsequent checkpoint commit if one has been created. Run git status/log and state the exact baseline/target reviewed. The original email report at docs/email-reference-family-independent-review.md must remain unchanged. Save this follow-up report as docs/user-construction-independent-review.md.

Read first:

- docs/adr/0007-ordinary-user-construction-and-type-history.md.
- docs/adr/0006-email-review-corrections-and-saved-order.md and docs/email-reference-family.md for the existing email boundary and tests.
- Relevant tenant/actor/promotion sections of docs/adr/0003-tenant-actor-and-catalog-policy.md; do not assume every recommendation there is implemented.

Focus the code read on:

- Scripts/Security/User/create_security_user_insert.sql, create_user_history_schema.sql, create_user_history_create.sql, create_system_user_bootstrap.sql.
- Scripts/Entities/create_entity_history_snapshot.sql, create_entities_schema.sql, create_entity_insert.sql, existing root-lock/bump/actor helpers.
- The optional company branch in Scripts/Contacts/create_contact_insert.sql.
- Historical root type in contact_email_read and SqlContactEmailReader.
- Builder registration/drop order, private grants, the actual application seed and SchemaCycle.cs.
- tests/sql/user_construction_tests.sql, user_construction_regressions.py and tests/EmailReference/UserConstructionCases.cs.

Scripts paths above are relative to src/Framework/Sistrategia.Data.SqlClient. The sample seed is under src/Data/Sistrategia.Overmind.Data.SqlClient/Scripts/SampleData/Sistrategia.

Questions:

1. Does a new account commit as user type at revision 1, while an existing contact preserves its earlier type and receives exactly one promotion revision? Look for current-unit snapshot replacement accidentally modifying committed history.
2. Do root locking, unit-entry expected tokens and allocation ordering hold when promotion is preceded/followed by a child edit, when the contact was created in the same unit, and when two sessions compete? Check failure/rollback across entity, contact, user, histories, role assignment and event evidence.
3. Can any ordinary constructor input still reach an unknown-actor/System fallback, implicit self-registration, wrong-tenant target or inactive actor/root? Is the installation's explicit System attribution honest? Distinguish SQL eligibility checks from backend authentication/administrative authorization.
4. Is construction account history sufficient for the claims made, without copying credentials/security tokens? Does separate account email remain independent of contact ordering and contact email edits? Is adding EntityTypeId to the historical reader implemented consistently?
5. Are initial global/local role selection and the optional company reference scoped correctly? Are ambiguities, inactive companies and another tenant's matching name handled correctly? Assess the cost/lock ordering and the explicitly unimplemented company-name idempotency/relationship lifecycle.
6. Do the new shared root snapshot and private account-history helpers have appropriate preconditions and permissions? Are any general lifecycle claims stronger than the current INSERT/UPDATE construction semantics support?
7. Does real create/drop/create preserve System ID 1, bootstrap history, role membership and ordinary seed-user usability? Do tests accidentally use privileged fixture writes to conceal the original actor-type gap?
8. Is this a useful bounded fix before another family, or does a remaining reachable defect make the combined email/user-construction reference misleading? Separate immediate correction from public self-registration, login uniqueness/authentication, full account/role lifecycle and provider ports.

If executing tests, use only generated disposable OvermindAuditTest_<32hex> databases. Never drop or rebuild an existing application database. The runner performs a guarded termination of its own test session for one commit-failure test; it also inspects lock/session DMVs. Commands:

```powershell
python tests/sql/run_dbrow_version_tests.py --server localhost
python tests/sql/run_dbrow_version_tests.py --server localhost --rcsi
```

Report confirmed findings with severity, source locations, concrete trigger and smallest justified correction. Mark unexecuted reasoning clearly. Include useful counterexamples even when they confirm the design, and give a verdict on this bounded reference. Do not modify production code or rewrite tests to manufacture a passing result; keep any additional probes separately identifiable and disposable.
