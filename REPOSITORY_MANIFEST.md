# SBTS 2.1 Repository Manifest

## Release identity

- Package: `sbts-professional`
- Version: `2.1.0`
- Runtime: Node.js 22
- Package manager: pnpm 10.4.1
- Database: MySQL 8 / TiDB
- Deployment: Dockerfile + Railway Config-as-Code

## Critical files

| File | Purpose |
|---|---|
| `Dockerfile` | Reproducible, non-root build/runtime image |
| `railway.json` | Railway builder, pre-deploy, start and healthcheck |
| `package.json` | Locked commands and deployment pipeline |
| `server/_core/databaseUrl.ts` | Safe hosted database URL validation |
| `server/_core/env.ts` | Central runtime configuration |
| `server/_core/sdk.ts` | JWT session signing and verification |
| `server/routers/auth.ts` | Email/password login, lockout and password management |
| `scripts/create-admin.ts` | Idempotent admin create/reset |
| `scripts/production-doctor.ts` | DB/admin/password/session readiness proof |
| `scripts/apply-sbts-domain-migrations.ts` | Resumable domain migrations |
| `drizzle/0017_sprint5_auth_deployment_hardening.sql` | Auth hardening migration |
| `.github/workflows/ci.yml` | GitHub typecheck, tests and build |

## Excluded from the release

- `.git`
- `.env`
- `node_modules`
- `dist`
- coverage/logs/IDE files
- production credentials

## Update model

```text
Edit/copy source files in the fixed master folder
→ 02_PUSH_UPDATE.cmd
→ GitHub main
→ Railway Auto Deploy
```
