# SBTS 2.2.2 — GitHub, Railway and Portable Deployment

For the current Arabic procedure use `RAILWAY_SETUP_AR.md`.

## GitHub source of truth

The delivery archive contains no Git metadata. Copy its contents into the real
clone of `abadya3-code/SBTS-Production`, preserving `.git`, then run
`02_PUSH_UPDATE.cmd`. The script executes the full release gate, pushes `main`,
and confirms that GitHub HEAD matches the local commit.

## Railway

- Build the repository `main` branch with the included Dockerfile.
- Add Railway MySQL and set `DATABASE_URL=${{MySQL.MYSQL_URL}}` by reference.
- Provide a stable JWT secret and explicit S3-compatible object storage.
- Do not define `APP_VERSION`, `ENABLE_OAUTH`, or `ENABLE_MANUS_RUNTIME`.
- Let `railway.json` run the controlled migrations, schema contract, reference
  seed, optional one-time backfill/admin bootstrap, doctor, and `/ready` gate.

After deployment run:

```bash
pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
```

## Migration controls

```bash
pnpm db:migrate
```

This runs the Drizzle journal followed by resumable, checksummed SBTS domain
migrations. `db:push` is deliberately blocked until both histories are unified.
`SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO` is expert-only recovery for databases
where domain SQL was applied manually before tracking.

## Storage controls

Production requires `STORAGE_REQUIRED=true` and an explicit
`STORAGE_BACKEND=s3` or `forge`. For Railway use a Storage Bucket and map its bucket,
endpoint, access key, secret, and region. Do not store controlled evidence on
ephemeral application disk.

Other providers use the same Dockerfile, MySQL, object storage, and environment
contract. Run `pnpm railway:predeploy` as the release job, then start
`node dist/index.js` and gate traffic on `/ready`.
