# Start Here — SBTS 2.2.2 Sprint 5 Recovery

For the complete Arabic procedure, open `START_HERE_AR.md`.

This is a source-only recovery archive. It contains no `.git`, `.env`,
dependencies, build output, or credentials, so extracting it does not update
GitHub or Railway.

1. Copy the source into the existing `SBTS-Production` Git clone while
   preserving its `.git` directory.
2. Use Node.js 22 and run `pnpm install --frozen-lockfile`.
3. Run `pnpm foundation:check`.
4. Remove the legacy Railway variable `APP_VERSION`.
5. Configure MySQL, a stable JWT secret, and explicit S3 object storage using
   `RAILWAY_SETUP_AR.md`.
6. Run `02_PUSH_UPDATE.cmd` to verify, commit, push, and compare GitHub HEAD.
7. After Railway succeeds, run
   `pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app`.

Do not accept the deployment unless `/health` and `/ready` both report version
`2.2.2`, the same GitHub commit, and a connected database.
