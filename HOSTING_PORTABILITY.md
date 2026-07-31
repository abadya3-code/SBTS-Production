# SBTS 2.2.2 Hosting Portability

SBTS is provider-neutral at the application layer. Railway is the current
deployment target, not a hard dependency.

## Required services

- OCI/Docker-compatible runtime using Node.js 22.
- MySQL 8-compatible database reachable from the app and pre-deploy job.
- HTTPS reverse proxy.
- Persistent S3-compatible (or explicitly selected Forge) object storage.

## Required production variables

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=<stable random secret, preferably 64+ characters>
VITE_APP_ID=sbts-production
STORAGE_REQUIRED=true
STORAGE_BACKEND=s3
RUN_WORKFLOW_BACKFILL_ON_DEPLOY=false
BOOTSTRAP_ADMIN_ON_DEPLOY=false
SEED_DEMO_DATA=false
ALLOW_DEMO_DATA_IN_PRODUCTION=false
```

The host supplies `PORT`. Do not define `APP_VERSION`, `ENABLE_OAUTH`, or
`ENABLE_MANUS_RUNTIME`.

## Generic deployment

```bash
docker build -t sbts:2.2.2 .
pnpm railway:predeploy
docker run --rm -p 3000:3000 --env-file .env.production sbts:2.2.2
```

The pre-deploy command name is historical but host-neutral. Gate traffic on
`/ready`, not only `/health`.

## Provider mapping

- Railway: `railway.json`, Dockerfile, MySQL reference, Railway Bucket.
- Kubernetes: pre-deploy Job, Deployment, `/ready` readiness probe.
- Docker Compose: migration/doctor job followed by the application service.
- VM/container host: one pre-deploy command per release before restart.

Do not use ephemeral disk for controlled evidence in production. Core login,
Areas, Projects, Blinds, workflow, migrations, and tRPC remain independent of
the hosting provider.
