# SBTS 2.1 — Smart Blind Tag System

SBTS is a full-stack isolation assurance application for plant blinding and de-blinding work. It combines the eight-phase engineering workflow with PTW/LOTO, gas testing, torque, inspection, defect/punch/NDT governance, approvals, audit history and controlled certificates.

## Clean release

This source package is designed for:

- GitHub version control and automatic deployments.
- Railway using the included `Dockerfile` and `railway.json`.
- Any Docker-compatible host with Node.js 22 and MySQL 8/TiDB.
- S3-compatible evidence storage when file uploads are enabled.

The package intentionally excludes `.git`, `.env`, `node_modules`, `dist` and credentials.

## Stack

- React 19 + TypeScript + Vite
- Express + tRPC
- Drizzle ORM + MySQL/TiDB
- Vitest
- Docker + Railway Config-as-Code
- Optional S3-compatible storage

## Deployment safety controls

The Railway pre-deploy sequence is:

```text
Environment validation
→ Drizzle migrations
→ SBTS domain migrations
→ Optional admin create/reset
→ Production doctor
→ Start application
→ /health check
```

The production doctor verifies the database schema, Sprint 5 migration, an active password-enabled administrator, the configured admin password after bootstrap, and a JWT session round-trip. A failed check stops the new deployment before it replaces the active revision.

## Start here

- Arabic quick start: `START_HERE_AR.md`
- Railway setup: `RAILWAY_SETUP_AR.md`
- Portable hosting: `HOSTING_PORTABILITY.md`
- Engineering release report: `SBTS_2.1_CLEAN_RELEASE_REPORT_AR.md`

## Repository workflow

First connection on Windows:

```text
01_CONNECT_GITHUB_ONCE.cmd
```

Later updates:

```text
02_PUSH_UPDATE.cmd
```

Or use Git directly:

```bash
git add .
git commit -m "Describe the SBTS update"
git push origin main
```

## Verification commands

```bash
pnpm release:check
pnpm sprint2:verify
pnpm sprint3:verify
pnpm sprint4:verify
pnpm sprint5:verify
pnpm check
pnpm test
pnpm build
```

The static release checks can run without a database. Full typecheck, Vitest and build require installed locked dependencies.

## Runtime endpoints

- `GET /health` — process liveness
- `GET /ready` — database readiness

## Security reminders

- Never commit `.env` or paste secrets into source code.
- Use a fixed `JWT_SECRET` of at least 32 characters; changing it invalidates all sessions.
- Enable `BOOTSTRAP_ADMIN_ON_DEPLOY=true` only for the first admin creation or a controlled password reset.
- After a successful login, set bootstrap to false and remove `ADMIN_PASSWORD` from hosted variables.
- Keep the repository private during development and plant pilot.

## Release boundary

This is a production-oriented clean source release, but plant operational approval still requires role-based UAT, cybersecurity review, backup/restore verification and formal Operations/Maintenance/Inspection/Safety sign-off.
