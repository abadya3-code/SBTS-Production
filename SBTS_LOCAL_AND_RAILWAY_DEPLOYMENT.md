# SBTS 2.1 — GitHub, Railway and Portable Deployment

For the current Arabic Railway procedure use `RAILWAY_SETUP_AR.md`.

## GitHub

The package contains no Git metadata. Run `01_CONNECT_GITHUB_ONCE.cmd` once, or copy the package contents into an existing clone and run:

```bash
git add .
git commit -m "Deploy SBTS 2.1 clean release"
git push origin main
```

## Railway

- Use the included Dockerfile.
- Add Railway MySQL in the same project/environment.
- Set application `DATABASE_URL` to `${{MySQL.MYSQL_URL}}` using an Add Reference action.
- Configure a fixed JWT secret and temporary admin bootstrap variables.
- Let `railway.json` run migrations, admin bootstrap, the production doctor and `/health`.

## Other providers

Use the same Dockerfile, provide MySQL and environment variables, run `pnpm railway:predeploy` as the release/migration job, then start `node dist/index.js`.

See `HOSTING_PORTABILITY.md` for mappings and requirements.

## Migration and storage controls

The executable migration command is:

```bash
pnpm db:migrate
```

It runs the Drizzle journal followed by resumable SBTS domain migrations. `SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO` is an expert-only recovery variable for databases where domain SQL was applied manually before migration tracking; do not set it on a normal fresh or upgraded deployment.

When evidence storage is enabled on Railway, add a Railway Storage Bucket or another S3-compatible service and configure its bucket, endpoint, access key, secret and region. Keep `STORAGE_REQUIRED=false` until upload, download and physical delete are verified.
