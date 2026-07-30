# SBTS 2.1.2 Engineering Cleanup

This package consolidates the latest production-clean baseline and the tRPC/schema hotfix.

## Applied fixes

- Added explicit React callback/property types in QualityGovernancePanel.
- Removed implicit-any callback errors for controlled Select and Checkbox fields.
- Reworked evidence Base64 conversion to avoid unsafe Uint8Array spread.
- Made the Blind Detail workflow transition guard explicit.
- Typed Isolation Package creation callback.
- Typed Drizzle insert payloads for NDT and torque records.
- Updated the Slip Blind phase-owner test to match the current backend contract.
- Increased isolated reports-router import test timeouts.
- Preserved the 0018 schema-alignment migration and production doctor checks.
- Bumped package version to 2.1.2.

## Validation performed in this workspace

- All TypeScript/TSX sources passed TypeScript transpilation syntax validation.
- package.json parses successfully.
- No `.env`, `node_modules`, or `dist` directory is included.

## Required validation on the user's machine

Run in this order:

```powershell
pnpm install --frozen-lockfile
pnpm release:check
pnpm check
pnpm vitest run server/projects.phase-owners.test.ts
pnpm vitest run server/reports.test.ts --reporter=verbose
pnpm test
pnpm build
```

Do not push to production until all commands pass.
