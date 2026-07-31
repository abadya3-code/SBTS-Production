console.error(`DB_PUSH_DISABLED

The Drizzle journal currently covers migrations 0000–0012, while controlled
SBTS domain migrations 0013+ use scripts/apply-sbts-domain-migrations.ts.
Running drizzle-kit generate here could emit duplicate or shrinking DDL.

Use:
  pnpm db:migrate

Do not re-enable db:push until Sprint 7 unifies the migration history.`);
process.exit(1);
