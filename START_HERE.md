# Start Here — SBTS 2.2 Foundation Clean

For the complete Arabic instructions, open `START_HERE_AR.md`.

This archive is source-only and contains no `.git`, `.env`, dependencies, build
output, or credentials. It is prepared for the current repository
`abadya3-code/SBTS-Production` and Railway auto-deployment.

Recommended sequence:

1. Extract to a new fixed folder.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm foundation:check`.
4. Run `01_CONNECT_GITHUB_ONCE.cmd` once, or copy the source into the existing
   Git clone while preserving its `.git` directory.
5. Use `02_PUSH_UPDATE.cmd` for later changes.
6. Configure Railway from `RAILWAY_SETUP_AR.md`.
7. Verify `/health` and `/ready`, then test Area → Project → Blind persistence.

Do not push until TypeScript, Vitest, and the production build all pass.
