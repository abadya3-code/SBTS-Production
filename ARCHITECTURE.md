# SBTS 2.1 Architecture

## System shape

```text
Browser / Tablet / Mobile Web
        ↓ HTTPS + HttpOnly JWT cookie
React + Vite single-page application
        ↓ same-origin tRPC
Express application server
        ├─ standalone email/password authentication
        ├─ RBAC and workflow transition guards
        ├─ project/blind/isolation package modules
        ├─ PTW / LOTO / gas / torque / inspection / quality
        ├─ audit, notifications and certificates
        └─ storage abstraction
        ↓
Drizzle ORM → MySQL 8 / TiDB
        ↓ optional
S3-compatible object storage
```

## Authentication

- Login identifier: normalized email.
- Password hashing: bcrypt, 12 rounds.
- Session: signed HS256 JWT stored in an HttpOnly, Secure, SameSite=Lax cookie.
- Account states: pending, active, rejected.
- Account lockout: database-backed failed-attempt counter and `lockedUntil`.
- Admin bootstrap: controlled pre-deploy create/reset, disabled after use.
- OAuth: disabled by default and activated only with `ENABLE_OAUTH=true` plus a configured server.

## Deployment lifecycle

```text
Docker build
→ frozen dependency installation
→ release structure check
→ frontend/server build
→ deployment environment validation
→ Drizzle migration journal
→ SBTS resumable domain migrations
→ optional administrator bootstrap
→ production doctor
→ application start
→ /health traffic switch
```

The domain migration runner records both file and statement checksums. It can resume after an interrupted statement sequence and refuses modified migrations that were already applied.

## Workflow domain

The canonical runtime contains eight user-facing phases:

1. Operations Initial Isolation.
2. Blind Installation & Controlled Tightening.
3. Independent Mechanical Verification.
4. Internal Inspection & Work Execution.
5. Reinstatement Preparation & Authorization.
6. Blind Removal & Reinstatement.
7. Independent Reinstatement Verification & Leak Test.
8. Final Approval & Return to Service.

Server guards evaluate checklists, permits, LOTO, gas tests, torque, evidence, independent approvals, safety holds, quality records and package readiness. Legacy five-phase values remain only as a compatibility projection for older views and reports.

## Source layout

```text
client/              React UI
server/_core/        server startup, auth/session, environment, tRPC
server/routers/      API modules
server/db/           database helpers
shared/              shared workflow/types/contracts
drizzle/             schema and SQL migrations
scripts/             deployment, migration, admin and verification tools
docs/                engineering and UAT documentation
```

## Portability

The application is packaged as one Docker image and does not depend on Railway-specific APIs. Railway uses `railway.json`; other providers can run the same image and execute `pnpm railway:predeploy` as their migration/release job.
