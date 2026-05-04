/**
 * Vercel runs one build per deployment; `prisma migrate deploy` uses an advisory lock.
 * Neon pooler + concurrent preview/prod deploys often hit P1002 lock timeouts.
 *
 * - Production (VERCEL_ENV=production): always run migrations.
 * - Other Vercel targets: skip by default (schema already applied from prod deploys, or use Neon branch + VERCEL_FORCE_MIGRATE=1).
 * - Local / CI without VERCEL=1: always run migrations (matches previous `npm run build` behavior).
 */
import { spawnSync } from "node:child_process";

/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {void}
 */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
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
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(
    "[vercel-build] Skipping prisma migrate deploy (Vercel preview/dev). Set VERCEL_FORCE_MIGRATE=1 if this deployment must run migrations.",
  );
}

run("npx", ["next", "build"]);
