# Sprint 1 Acceptance Checklist

## Product truth

- [x] Eight user-facing phases defined once.
- [x] Two internal gates defined.
- [x] Owners and permissions defined.
- [x] Conditional Slip Blind approval policy defined.
- [x] Safety Hold state and policies defined.
- [x] Gas-test timing policy defined.
- [x] Certificate leak-test policy defined.

## Technical linkage

- [x] Shared specification imported by frontend Workflow Studio.
- [x] Shared specification consumed by database seed.
- [x] Canonical workflow stored in workflow tables.
- [x] Workflow policy stored in a dedicated settings table.
- [x] Settings procedures added.
- [x] Settings UI added.
- [x] Theme policy linked from database to Theme Provider.
- [x] Legacy workflow preserved for migration safety.

## Mandatory connected-environment checks

- [ ] Install locked dependencies with pnpm.
- [ ] Run migration against a database backup.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Open Settings and verify read/write persistence.
- [ ] Verify canonical workflow appears in Workflow Studio.
- [ ] Verify Standard, Modern and Manus theme policies.
- [ ] Verify existing project/blind records remain unchanged after migration.
