# SBTS 2.1 Clean Release — Verification Report

Generated: 2026-07-26

## Inventory

| Item | Count |
|---|---:|
| Total packaged files | 349 |
| Application/domain source files | 278 |
| TypeScript/TSX files | 227 |
| Automated test files | 25 |
| SQL migrations | 18 |

## Executed checks

| Check | Result |
|---|---:|
| Release structure | PASS |
| Sprint 2 acceptance | 73/73 PASS |
| Sprint 2 SQL structure | 33 statements PASS |
| Sprint 3 acceptance | 40/40 PASS |
| Sprint 3 SQL structure | 9 statements PASS |
| Sprint 4 acceptance | 66/66 PASS |
| Sprint 4 SQL structure | 9 statements PASS |
| Sprint 5 auth/deployment acceptance | 16/16 PASS |
| Sprint 5 SQL structure | 6 statements PASS |
| TypeScript/TSX syntax parsing | 223 files, 0 parse errors |
| Forbidden release folders/secrets | PASS |

## Critical deployment proofs added

- Hosted database URL validation and localhost rejection in production.
- Resumable Drizzle + SBTS domain migration chain.
- Admin create/reset with password hash replacement and account unlock.
- Post-bootstrap bcrypt comparison against the configured admin password.
- JWT session create/verify round-trip before deployment activation.
- Non-empty appId fallback and legacy session compatibility.
- React Query auth cache refresh after login.
- Account lockout and password-change audit fields.
- Dockerfile with Node 22, frozen pnpm lock and non-root runtime.
- Railway Config-as-Code with pre-deploy and /health.

## Toolchain boundary

The delivery environment could not resolve registry.npmjs.org, so the locked dependency tree could not be installed here. Therefore `pnpm check`, the full Vitest suite and `pnpm build` are not claimed as executed in this environment. They are configured as mandatory GitHub Actions checks and will run after push with network access.

## Operational boundary

This source is suitable for Staging deployment. Plant use still requires database backup/restore validation, role-based UAT, security review and formal operational sign-off.
