# SBTS 2.2 Hosting Portability

SBTS is provider-neutral at the application layer. Railway is the current
deployment target, not a hard application dependency.

## Required platform services

- OCI/Docker-compatible runtime.
- MySQL 8-compatible database reachable from the application/pre-deploy job.
- HTTPS reverse proxy.
- Optional persistent S3-compatible storage when evidence upload is enabled.

## Required runtime variables

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
JWT_SECRET=<stable random secret, preferably 64+ characters>
VITE_APP_ID=sbts-production
ENABLE_OAUTH=false
STORAGE_REQUIRED=false
BOOTSTRAP_ADMIN_ON_DEPLOY=false
SEED_DEMO_DATA=false
ALLOW_DEMO_DATA_IN_PRODUCTION=false
```

The host provides `PORT` where applicable.

## Generic container deployment

```bash
docker build -t sbts:2.2.0 .
docker run --rm -p 3000:3000 --env-file .env.production sbts:2.2.0
```

Before switching traffic to the new image, run in the same network and with the
same variables:

```bash
pnpm railway:predeploy
```

The command name is historical; its implementation is host-neutral.

## Provider mapping

- Railway: `railway.json`, Dockerfile, MySQL reference variable.
- Kubernetes: init/pre-deploy Job plus Deployment health probes.
- Docker Compose: one migration/doctor job followed by the app service.
- VM/container host: run the pre-deploy command once per release before
  restarting the service.

## Storage

When `STORAGE_REQUIRED=true`, configure either an S3-compatible backend or the
supported Forge backend. Do not use ephemeral application disk for controlled
evidence in production.

## Portability boundary

OAuth and object storage are adapters. Core login, Areas, Projects, Blinds,
workflow, MySQL persistence, migrations, and tRPC do not depend on Railway.
