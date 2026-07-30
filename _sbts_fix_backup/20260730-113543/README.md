# SBTS 2.2 — Foundation Clean Release

SBTS is a full-stack isolation assurance application for plant blinding and de-blinding work. This release focuses on the production foundation required before continuing feature sprints: schema alignment, deterministic migrations, database-backed Area/Project creation, explicit system seeding, workflow-runtime backfill, authenticated sessions, CI, and Railway deployment safety.

## What is fixed in this release

- Drizzle/MySQL alignment is checked before traffic starts.
- Domain migration `0018` is recovered portably through `information_schema`; partially failed Railway deployments can continue safely.
- Read APIs no longer seed demo Areas, Projects, or Blinds.
- System permissions, roles, and workflow templates are seeded explicitly during pre-deploy.
- Existing Blind records receive canonical workflow runtime records before the app starts.
- Areas and Projects have working creation dialogs connected to tRPC and MySQL.
- `DATABASE_URL`, JWT, app ID, admin bootstrap, schema, referential integrity, and session round-trip are validated.
- GitHub Actions installs pnpm before enabling the setup-node pnpm cache.
- `/health` and `/ready` expose the running version and Git commit.

## Stack

- React 19 + TypeScript + Vite
- Express + tRPC
- Drizzle ORM + MySQL
- Vitest
- Docker + Railway Config-as-Code
- Optional S3-compatible storage

## Railway pre-deploy sequence

```text
Environment validation
→ Drizzle migrations
→ SBTS domain migrations
→ Hosted schema contract
→ System reference seed (no demo data)
→ Canonical workflow runtime backfill
→ Optional administrator create/reset
→ Production doctor
→ Start application
→ /health
```

A failed migration, missing column, orphan relationship, missing workflow runtime, invalid administrator, or failed JWT round-trip stops the new deployment before it replaces the active revision.

## Start here

- Arabic quick start: `START_HERE_AR.md`
- Railway setup: `RAILWAY_SETUP_AR.md`
- Foundation release report: `SBTS_2.2_FOUNDATION_RELEASE_AR.md`
- Portable hosting: `HOSTING_PORTABILITY.md`

## Repository workflow

First connection on Windows:

```text
01_CONNECT_GITHUB_ONCE.cmd
```

Later updates:

```text
02_PUSH_UPDATE.cmd
```

Or:

```bash
git add .
git commit -m "Describe the SBTS update"
git push origin main
```

## Verification

```bash
pnpm install --frozen-lockfile
pnpm release:check
pnpm check
pnpm test
pnpm build
```

Database checks in the hosted environment:

```bash
pnpm db:migrate
pnpm system:seed
pnpm workflow:backfill
pnpm schema:contract
pnpm doctor
```

## Runtime endpoints

- `GET /health` — process liveness, version, and commit.
- `GET /ready` — database readiness, version, and commit.

## Security

- Never commit `.env`, credentials, `node_modules`, or `dist`.
- Keep one stable random `JWT_SECRET`; changing it invalidates all sessions.
- Use `BOOTSTRAP_ADMIN_ON_DEPLOY=true` only for controlled creation/reset, then set it to false and remove `ADMIN_PASSWORD`.
- Demo data is manual and blocked in production unless explicitly overridden for disposable UAT.
- Keep the repository private during plant pilot and complete formal cybersecurity and operational acceptance before production use.
