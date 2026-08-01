# SBTS 2.2.2 — Sprint 6 Integrated Release Candidate

SBTS is a full-stack isolation-assurance application for plant blinding and
de-blinding work. Release 2.2.2 repairs the deployment chain, removes mock
dashboard data, tightens authentication and RBAC, and establishes a verifiable
baseline and delivers the first integrated Sprint 6 operational package.

## Sprint 6 integrated outcomes

- Secure, tokenized QR verification is unique to each Blind and supports
  controlled generation, rotation and revocation with audit and inbox events.
- Physical Blind Tags use the database-backed 70 × 110 mm layout, top-center
  hole, three reusable templates and real active QR verification URLs.
- Governed certificates remain immutable, versioned and SHA-256 verified; the
  project register is a separate operational export and cannot masquerade as a
  certificate.
- Workflow Guard Policies and Default Tag Settings are organized as focused
  operational configuration workspaces.
- The operations inbox provides unread, type, priority and archive views with
  ownership-protected actions and smart links back to the affected record.
- Generated HTML reports are DOM-sanitized and database-backed fields are
  escaped before printing; incomplete destructive/share actions stay hidden.
- Migration `0020_sprint6_qr_print_inbox_designer.sql` is portable, additive,
  resumable and checked by the Railway schema and production-doctor gates.

## Recovery outcomes

- The server and browser receive one immutable release identity: version
  `2.2.2` plus the build commit.
- `/health` proves process identity; `/ready` additionally proves database
  connectivity. Railway and Docker gate traffic on `/ready`.
- `auth.me` returns an allow-listed DTO and never exposes password hashes,
  lockout counters, reset tokens, or internal authentication fields.
- Database-backed permission procedures protect projects, blinds, workflow,
  reports, users, roles, audit, settings, and evidence operations.
- `/storage/*` requires an active authenticated session.
- The Dashboard reads the canonical eight-phase MySQL runtime; mock metrics and
  the legacy five-phase completion calculation are removed.
- LOTO verification, torque acceptance, and leak-test acceptance enforce
  different actors.
- The canonical workflow and permission metadata are refreshed by the explicit
  system seed on each release; demo data is never deployed automatically.
- `db:push` is intentionally disabled until the two migration histories are
  unified. Deployments use the controlled migration runners only.
- Unused Manus/OAuth/AI modules and high-risk unused dependencies were removed.

## Stack

- React 19, TypeScript, Vite
- Express and tRPC
- Drizzle ORM and MySQL
- Vitest
- Docker and Railway Config-as-Code
- Required S3-compatible object storage in production

## Local verification

Use Node.js 22 and pnpm 10.4.1:

```bash
pnpm install --frozen-lockfile
pnpm foundation:check
pnpm audit --prod
```

`foundation:check` runs release contracts, Sprint 2–5 static/SQL checks,
TypeScript, tests, and the production build.

`02_PUSH_UPDATE.cmd` installs the exact frozen dependency set automatically
before running the same gate, so a clean source folder does not require a
separate manual install.

## Controlled Railway sequence

```text
Validate environment and release identity
→ Apply Drizzle migrations
→ Apply checksummed SBTS domain migrations
→ Verify hosted schema contract
→ Refresh system reference data
→ Optional one-time workflow runtime backfill
→ Optional controlled administrator bootstrap
→ Production doctor
→ Start as non-root
→ /ready
```

The runtime backfill is not repeated on every deployment. Set
`RUN_WORKFLOW_BACKFILL_ON_DEPLOY=true` for the first controlled upgrade only,
then return it to `false`.

## Publishing and proof

This source archive deliberately has no `.git` directory and cannot publish by
itself. Copy it into the real clone of `abadya3-code/SBTS-Production` while
preserving that clone's `.git`, then run:

```text
02_PUSH_UPDATE.cmd
```

After Railway reports Success:

```bash
pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
```

Sprint 5 is accepted online only when both endpoints report version `2.2.2`,
the exact GitHub `main` commit, and `database: connected`.

## Runbooks

- Arabic quick start: `START_HERE_AR.md`
- Railway setup: `RAILWAY_SETUP_AR.md`
- Sprint 6 integrated report: `SBTS_2.2.2_SPRINT6_INTEGRATED_RC9_AR.md`
- Portable hosting: `HOSTING_PORTABILITY.md`

## Security boundary

- Never commit `.env`, credentials, `node_modules`, or `dist`.
- Keep a stable, random `JWT_SECRET`; rotating it invalidates all sessions.
- Use administrator bootstrap only for a controlled create/reset, then disable
  it and remove `ADMIN_PASSWORD`.
- Keep the repository private during pilot and complete formal cybersecurity,
  safety, and operational acceptance before production use.
