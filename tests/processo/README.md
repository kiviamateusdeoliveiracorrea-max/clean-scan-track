# Process audit database integration tests

The initial request is database-only: no screens, navigation or storage integration have been added.

- `seed.sql` preserves the 288 global FORM 14 questions literally. It is a separate data import, not a schema migration. Do not run it twice.
- `database_test.py` covers 24 real authenticated Data API checks, including transactional completion, rollback, SIM/NÃO, equal pillar averaging, local overrides, read-back, concurrent retries and unit/area restrictions.
- `consultation_test.py` covers three read-only Consulta checks.

Run with an isolated test account authorized for CTT/MOT, first with Auditor and then Consulta, using `PROCESS_TEST_EMAIL` and `PROCESS_TEST_PASSWORD`. Both scripts use the generated backend environment variables and never print credentials. The main suite removes the process records and local questions it creates. Do not use production accounts to change roles for testing.

Validation on 2026-11-03: all 27 checks passed. Twenty existing Bun audit-score and save-flow tests passed. Test process records, question overrides, account and its permission links were removed; 288 global questions remain across 11 areas.

Notes:
- All three pillars must have active questions before completion so a simple three-pillar average remains defined; incomplete pillar configuration raises an actionable error.
- Global questions are shared by name as requested; editing one affects all units using that global bank. A unit-specific bank replaces the global bank for that area.
- The completion trigger blocks empty completion; full checklist and score validation run inside `complete_audit_processo`, matching the requested RPC usage.
- No new permission functions, changes to existing 5S objects, screens or publication were made.