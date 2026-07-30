# SBTS 2.2 Foundation Architecture

## Production topology

```text
Browser / tablet / mobile web
        │ HTTPS + HttpOnly SameSite=Lax cookie
        ▼
React 19 + Vite single-page application
        │ same-origin tRPC
        ▼
Express + tRPC application service
        ├─ standalone email/password authentication
        ├─ deployment-bound HS256 JWT sessions
        ├─ RBAC and project/phase authorization
        ├─ Areas → Projects → Blinds
        ├─ canonical workflow runtime
        ├─ compliance / torque / inspection / quality / certificates
        └─ optional object-storage abstraction
        │
        ▼
Drizzle ORM
        │
        ▼
MySQL 8-compatible database
```

Railway runs one Docker image for build, pre-deploy, and runtime. The pre-deploy
command must complete before a new revision receives traffic.

## Data ownership and write boundaries

- MySQL is the authoritative store.
- `drizzle/schema.ts` is the application schema contract.
- Drizzle journal migrations own the base schema through `0012`.
- `scripts/apply-sbts-domain-migrations.ts` owns immutable SBTS domain
  migrations `0013+`.
- Query functions are read-only. They do not create demo Areas, Projects,
  Blinds, workflow runtime, or feature settings.
- System reference data is installed only by `pnpm system:seed`.
- Existing Blind workflow runtime is completed only by
  `pnpm workflow:backfill`.
- Demo data is manual, disabled by default, and blocked in production unless a
  disposable UAT override is explicitly enabled.

## Deployment transaction

```text
deploy:check
→ db:migrate:drizzle
→ db:migrate:domain
→ schema:contract
→ system:seed
→ workflow:backfill
→ optional admin:create
→ doctor
→ start
```

The domain runner uses a MySQL advisory lock and statement checkpoints.
Migration `0018_sprint6_schema_alignment.sql` has a dedicated portable recovery
path because some hosted MySQL builds reject `ADD COLUMN IF NOT EXISTS`.
The original migration file remains immutable; the runner checks
`information_schema` and adds only missing columns.

## Areas and Projects

- Areas are first-class records.
- Projects require an existing active Area.
- Project creation requires the canonical workflow template
  `wf-sbts-standard-v2`.
- A project and its workflow assignment are inserted in one database
  transaction.
- Area and Project IDs are normalized and checked for duplicates.
- The React dialogs call the typed tRPC create procedures and invalidate the
  relevant query cache after success.

## Authentication

- Email/password credentials use bcrypt hashes.
- Accounts must be `active`; pending/rejected accounts cannot authenticate.
- Failed attempts and temporary lockout are database-backed.
- JWT tokens include subject, issuer, audience, app ID, issued-at, and expiry.
- Issuer, audience, and app ID must match the current `VITE_APP_ID`.
- Tokens are stored in an HttpOnly, Secure-in-production, SameSite=Lax cookie.
- `JWT_SECRET` is mandatory and must remain stable between deployments.
- Controlled administrator bootstrap can create/reset an account before
  traffic switches, then should be disabled.

## Operational verification

- `GET /health`: process liveness, application version, Railway/Git commit.
- `GET /ready`: live database query, version, commit.
- `pnpm schema:contract`: database table/column/index contract.
- `pnpm doctor`: migrations, reference data, relationships, workflow runtime,
  administrator, and JWT round-trip.
- GitHub Actions validates release structure, sprint contracts, TypeScript,
  Vitest, and the production build before merge/deployment.
