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

/**
 * @param {string} name
 * @param {string | undefined} value
 * @returns {{ ok: true, url: string, username: string, hostname: string, database: string } | { ok: false, reason: string }}
 */
function parseDbUrl(name, value) {
  if (!value || !value.trim()) {
    return { ok: false, reason: `${name} is missing or empty` };
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return {
      ok: false,
      reason: `${name} is not a valid URL (expected postgresql://USER:PASSWORD@HOST/DB)`,
    };
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    return {
      ok: false,
      reason: `${name} must use postgresql:// (got ${parsed.protocol})`,
    };
  }

  if (!parsed.username) {
    return {
      ok: false,
      reason: `${name} has no username — Prisma reports P1000 user "(not available)"`,
    };
  }

  if (!parsed.password) {
    return {
      ok: false,
      reason: `${name} has no password`,
    };
  }

  return {
    ok: true,
    url: value.trim(),
    username: parsed.username,
    hostname: parsed.hostname,
    database: parsed.pathname.replace(/^\//, "") || "(none)",
  };
}

/**
 * @param {string} name
 * @param {{ ok: true, username: string, hostname: string, database: string }} parsed
 * @returns {void}
 */
function logDbUrl(name, parsed) {
  console.log(
    `[vercel-build] ${name}: user=${parsed.username} host=${parsed.hostname} db=${parsed.database}`,
  );
}

const onVercel = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV ?? "";
const forceMigrate = process.env.VERCEL_FORCE_MIGRATE === "1";

const shouldMigrate =
  !onVercel || vercelEnv === "production" || forceMigrate;

if (shouldMigrate) {
  const databaseUrl = parseDbUrl("DATABASE_URL", process.env.DATABASE_URL);
  if (!databaseUrl.ok) {
    console.error(`[vercel-build] ${databaseUrl.reason}`);
    process.exit(1);
  }
  logDbUrl("DATABASE_URL", databaseUrl);

  // prisma/schema.prisma requires DIRECT_URL. An empty/malformed value produces
  // P1000 with user "(not available)". Fall back to DATABASE_URL so a missing
  // DIRECT_URL cannot break production deploys when the pooled URL works.
  let directUrl = parseDbUrl("DIRECT_URL", process.env.DIRECT_URL);
  /** @type {Record<string, string | undefined>} */
  const migrateEnv = {};

  if (!directUrl.ok) {
    console.warn(
      `[vercel-build] ${directUrl.reason}; using DATABASE_URL for DIRECT_URL`,
    );
    migrateEnv.DIRECT_URL = databaseUrl.url;
    directUrl = databaseUrl;
  }
  logDbUrl("DIRECT_URL", directUrl);

  // On Vercel, default-disable migrate advisory locking (official escape hatch for stuck locks /
  // pooler quirks). Set PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=0 in Vercel env to keep locking.
  // https://www.prisma.io/docs/orm/reference/environment-variables-reference#prisma_schema_disable_advisory_lock
  if (onVercel && process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK === undefined) {
    migrateEnv.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1";
  }

  run("npx", ["prisma", "migrate", "deploy"], migrateEnv);
} else {
  console.log(
    "[vercel-build] Skipping prisma migrate deploy (Vercel preview/dev). Set VERCEL_FORCE_MIGRATE=1 if this deployment must run migrations.",
  );
}

run("npx", ["next", "build"]);
