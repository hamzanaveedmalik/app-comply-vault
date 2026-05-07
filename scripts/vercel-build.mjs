/**
 * Vercel runs one build per deployment; `prisma migrate deploy` uses an advisory lock.
 * Neon pooler + concurrent preview/prod deploys often hit P1002 (pg_advisory_lock).
 * Prisma’s advisory lock timeout is fixed at 10s and is not configurable; see Prisma docs.
 *
 * - Production (VERCEL_ENV=production): always run migrations.
 * - Other Vercel targets: skip by default (schema already applied from prod deploys, or use Neon branch + VERCEL_FORCE_MIGRATE=1).
 * - Local / CI without VERCEL=1: always run migrations (matches previous `npm run build` behavior).
 */
import { spawnSync } from "node:child_process";

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {Record<string, string | undefined>} [envPatch]
 * @returns {void}
 */
function run(cmd, args, envPatch = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...envPatch },
  });
  const code = result.status ?? 1;
  if (code !== 0) process.exit(code);
}

const onVercel = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV ?? "";
const forceMigrate = process.env.VERCEL_FORCE_MIGRATE === "1";

const shouldMigrate =
  !onVercel || vercelEnv === "production" || forceMigrate;

if (shouldMigrate) {
  // On Vercel, default-disable migrate advisory locking (official escape hatch for stuck locks /
  // pooler quirks). Set PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=0 in Vercel env to keep locking.
  // https://www.prisma.io/docs/orm/reference/environment-variables-reference#prisma_schema_disable_advisory_lock
  const migrateEnv =
    onVercel && process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK === undefined
      ? { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" }
      : {};
  run("npx", ["prisma", "migrate", "deploy"], migrateEnv);
} else {
  console.log(
    "[vercel-build] Skipping prisma migrate deploy (Vercel preview/dev). Set VERCEL_FORCE_MIGRATE=1 if this deployment must run migrations.",
  );
}

run("npx", ["next", "build"]);
