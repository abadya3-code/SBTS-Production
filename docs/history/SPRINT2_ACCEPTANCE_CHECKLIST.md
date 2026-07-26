# SBTS Sprint 2 — Acceptance Checklist

## Database

- [x] Additive runtime migration created.
- [x] Legacy Blind data preserved and mapped.
- [x] Runtime, phase, checklist and event tables linked with foreign keys.
- [x] Compliance, package, hold and approval domains created.
- [x] RBAC catalog seeded in Migration and application seed.
- [x] TiDB-incompatible `JSON_TABLE` removed.
- [ ] Migration executed on the real Staging database.
- [ ] Backup restore rehearsal completed.

## Backend

- [x] Eight action commands mapped to eight canonical phases.
- [x] Direct legacy phase mutation rejected.
- [x] Server-side checklist/permit/LOTO/gas/torque/package/leak/approval gates implemented.
- [x] Optimistic concurrency implemented.
- [x] Transition events and audit-compatible logs persisted.
- [x] Safety Hold two-person release implemented.
- [x] Package status reconciliation implemented.
- [x] Dedicated record permissions implemented.
- [x] Operations Foreman final authority implemented.
- [ ] Full integration tests executed with a database.

## UI/UX and Settings

- [x] Project Detail consumes canonical phase/lifecycle summaries.
- [x] Blind Detail Hub consumes runtime state and checklist persistence.
- [x] Live server blocking reasons displayed.
- [x] Safety Hold and independent release actions displayed.
- [x] Workflow/Safety settings are database-backed.
- [x] Gas-test acceptance limits configurable.
- [x] Theme and workflow UI density remain centrally controlled.
- [ ] Dedicated record editors for PTW/LOTO/Gas/Torque/Leak completed in field UI.
- [ ] Full Isolation Package management page completed.
- [ ] Final approval interaction panel completed.
- [ ] Evidence upload and certificate lock UI completed.

## Verification

- [x] Sprint 2 static checks pass: 73/73.
- [x] SQL structural checks pass: 33 statements.
- [x] TypeScript/TSX syntax pass: 207 files.
- [ ] `pnpm check` passes in connected environment.
- [ ] Vitest suite passes.
- [ ] Production build passes.
- [ ] Browser/mobile UAT passes.
