# SBTS 2.2 Repository Manifest

## Release identity

- Package: `sbts-professional`
- Version: `2.2.0`
- Runtime: Node.js 22.16.x
- Package manager: pnpm 10.4.1
- Client: React 19 + Vite
- API: Express + tRPC
- Persistence: Drizzle ORM + MySQL 8-compatible database
- Deployment: Dockerfile + Railway Config-as-Code

## Foundation-critical files

| File | Responsibility |
|---|---|
| `package.json` | Locked build, migration, pre-deploy, verification commands |
| `Dockerfile` | Reproducible non-root production image |
| `railway.json` | Docker builder, pre-deploy, start, health check |
| `.github/workflows/ci.yml` | GitHub validation with correct pnpm setup order |
| `drizzle/schema.ts` | Drizzle application schema contract |
| `scripts/apply-sbts-domain-migrations.ts` | Locked, resumable domain migrations and 0018 recovery |
| `scripts/seed-system-data.ts` | Explicit non-demo reference seed |
| `scripts/backfill-workflow-runtime.ts` | Explicit canonical runtime backfill |
| `scripts/verify-schema-contract.ts` | Hosted database contract check |
| `scripts/production-doctor.ts` | End-to-end production readiness gate |
| `server/_core/databaseUrl.ts` | DATABASE_URL validation and localhost guard |
| `server/_core/sdk.ts` | Deployment-bound JWT signing and verification |
| `server/_core/cookies.ts` | Same-origin secure cookie options |
| `server/db/projects.ts` | Database-backed Area/Project persistence |
| `server/db/featureToggles.ts` | Read-only query and controlled singleton mutation |
| `client/src/components/areas/CreateAreaDialog.tsx` | Working Area creation UI |
| `client/src/components/projects/CreateProjectDialog.tsx` | Working Project creation UI |
| `server/foundation.contract.test.ts` | Foundational regression contracts |

## Excluded from the release archive

- `.git`
- `.env` and credentials
- `node_modules`
- `dist`
- logs, local database files, coverage, and editor metadata

## Required verification before production promotion

```bash
pnpm install --frozen-lockfile
pnpm foundation:check
```

Hosted environment:

```bash
pnpm railway:predeploy
```
