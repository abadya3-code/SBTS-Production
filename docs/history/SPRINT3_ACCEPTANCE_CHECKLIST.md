# SBTS Sprint 3 Acceptance Checklist

## Database

- [x] Migration 0015 is additive.
- [x] Migration avoids `JSON_TABLE` and unsupported TiDB constructs.
- [x] Workflow policy fields are represented in Drizzle schema.
- [x] Inspection templates and records have foreign keys and uniqueness controls.
- [x] Permissions are provisioned for existing and clean databases.
- [ ] Migration applied successfully to Staging database.
- [ ] Backup restore verified before migration.
- [ ] Post-migration row counts and constraints verified.

## Backend

- [x] PTW, LOTO, gas-test, torque, leak-test and evidence APIs are connected.
- [x] Isolation Package list/detail/create/readiness APIs are connected.
- [x] Inspection Activity Builder and records are database-backed.
- [x] Mandatory inspection activities block phase progression.
- [x] Independent approval activities require a different user.
- [x] Approved inspection records are locked from ordinary editing.
- [x] Evidence policy is enforced by the server.
- [x] Torque execution and independent verification are separated.
- [x] Operational record changes create audit-log entries.
- [ ] Full dependency-based TypeScript check passed in Staging.
- [ ] Full Vitest suite passed in Staging.

## Frontend and UI/UX

- [x] Blind Detail displays real field-operation editors.
- [x] New components use existing semantic theme tokens.
- [x] Feature toggles control optional panels.
- [x] Blocking and permission errors return server messages.
- [x] Isolation Packages page supports creation, search, detail and readiness.
- [x] Local date-time input conversion avoids UTC display shift.
- [x] Inspection activities distinguish completion from independent approval.
- [ ] Tablet/mobile field test completed with Operations and Maintenance users.
- [ ] Accessibility keyboard/screen-reader review completed.
- [ ] All supported application themes visually regression-tested.

## Security and governance

- [x] Granular RBAC protects each record type.
- [x] Evidence MIME type and size are checked server-side.
- [x] Current-phase restriction protects evidence and inspection records.
- [x] Safety Hold and optimistic concurrency from Sprint 2 remain enforced.
- [ ] File malware scanning strategy implemented.
- [ ] Storage object deletion/orphan cleanup implemented.
- [ ] Penetration/security review completed.

## Release

- [x] Version updated to `2.0.0-beta.3`.
- [x] Static Sprint 2 and Sprint 3 verifiers pass.
- [x] TypeScript syntax verifier passes.
- [x] SQL structure verifiers pass.
- [ ] Production build passed in connected Staging.
- [ ] End-to-end role scenarios passed.
- [ ] UAT signed by Operations, Maintenance, Inspection, Safety and T&I.
