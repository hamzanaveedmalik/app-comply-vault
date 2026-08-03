/**
 * CV-DM-03 — deploy prep + N1 seed (non-interactive).
 *
 * Runs what credentials allow; prints blockers for the rest.
 *
 * Usage:
 *   DATABASE_URL=... DEMO_WORKSPACE_ID=... node scripts/demo-dm03-prepare.mjs
 *   DATABASE_URL=... DEMO_WORKSPACE_ID=... node scripts/demo-dm03-prepare.mjs --seed-only
 *   VERCEL_TOKEN=... node scripts/demo-dm03-prepare.mjs --env-only
 *
 * Soft-deletes prior demo correspondence in the target workspace (same as seed-demo).
 * Requires explicit DEMO_WORKSPACE_ID — will not guess.
 */
import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";

const args = new Set(process.argv.slice(2));
const seedOnly = args.has("--seed-only");
const envOnly = args.has("--env-only");
const skipEmbed = args.has("--skip-embed");

const checklist = {
  vercelFlags: false,
  migrate: false,
  seed: false,
  embed: false,
  blockers: [],
};

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    env: process.env,
    ...opts,
  });
  return r.status === 0;
}

async function setVercelFlags() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    checklist.blockers.push(
      "VERCEL_TOKEN missing (or run: vercel login). Cannot set Release 1 flags."
    );
    return;
  }
  const pairs = [
    ["RELEASE1_DEMO_ENABLED", "true"],
    ["NEXT_PUBLIC_RELEASE1_DEMO", "true"],
    ["ASK_HYBRID_RETRIEVAL", "true"],
  ];
  for (const [key, value] of pairs) {
    const r = spawnSync(
      "vercel",
      ["env", "add", key, "production", "--token", token, "--force"],
      {
        input: `${value}\n`,
        encoding: "utf8",
        env: process.env,
      }
    );
    if (r.status !== 0) {
      console.error(r.stdout);
      console.error(r.stderr);
      checklist.blockers.push(
        `Failed to set ${key} via vercel CLI. Set manually in Vercel dashboard.`
      );
      return;
    }
    console.log(`Set ${key}=true (production)`);
  }
  checklist.vercelFlags = true;
  const redeploy = run("vercel", ["--prod", "--token", token, "--yes"]);
  if (!redeploy) {
    checklist.blockers.push(
      "vercel --prod failed. Push to main or redeploy from the dashboard."
    );
  }
}

async function seedCorpus() {
  const workspaceId = process.env.DEMO_WORKSPACE_ID?.trim();
  const databaseUrl = process.env.DATABASE_URL;
  if (!workspaceId) {
    checklist.blockers.push(
      "DEMO_WORKSPACE_ID missing. Example: DEMO_WORKSPACE_ID=c… node scripts/demo-dm03-prepare.mjs --seed-only"
    );
    return;
  }
  if (!databaseUrl) {
    checklist.blockers.push("DATABASE_URL missing.");
    return;
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

  try {
    const sql = neon(databaseUrl);
    const ws = await sql`select id, name from "Workspace" where id = ${workspaceId}`;
    if (!ws[0]) {
      checklist.blockers.push(`Workspace not found: ${workspaceId}`);
      return;
    }
    console.log(`Seeding workspace: ${ws[0].name} (${workspaceId})`);
  } catch (e) {
    checklist.blockers.push(
      `DB auth/connect failed: ${e instanceof Error ? e.message : String(e)}. Update DATABASE_URL (Neon password).`
    );
    return;
  }

  const seeded = run("node", [
    "scripts/seed-demo-neon.mjs",
    workspaceId,
    "--confirm",
  ]);
  if (!seeded) {
    checklist.blockers.push("seed-demo-neon.mjs failed.");
    return;
  }
  checklist.seed = true;

  if (skipEmbed) {
    console.log("Skipping embed backfill (--skip-embed).");
    return;
  }

  const embedded = run("node", [
    "scripts/demo-embed-backfill-neon.mjs",
    workspaceId,
  ]);
  if (!embedded) {
    checklist.blockers.push(
      "demo-embed-backfill-neon failed. Check OPENAI_API_KEY / DATABASE_URL."
    );
    return;
  }
  checklist.embed = true;
}

async function verifySeed() {
  const workspaceId = process.env.DEMO_WORKSPACE_ID?.trim();
  const databaseUrl = process.env.DATABASE_URL;
  if (!workspaceId || !databaseUrl || !checklist.seed) return;

  const sql = neon(databaseUrl);
  const summary = await sql`
    select
      (select count(*)::int from "EmailTriageItem"
        where "workspaceId" = ${workspaceId} and status = 'PENDING') as held,
      (select count(*)::int from "ParkedIngest"
        where "workspaceId" = ${workspaceId} and status = 'PARKED' and "deletedAt" is null) as parked,
      (select count(*)::int from "IndexCoverageManifest"
        where "workspaceId" = ${workspaceId} and "deletedAt" is null) as manifests
  `;
  const row = summary[0];
  console.log("Post-seed verify:", row);
  if ((row?.held ?? 0) < 3) {
    checklist.blockers.push(`Expected ≥3 held identities, got ${row?.held}`);
  }
  if ((row?.parked ?? 0) < 1) {
    checklist.blockers.push(`Expected ≥1 parked ingest, got ${row?.parked}`);
  }
  if ((row?.manifests ?? 0) < 1) {
    checklist.blockers.push("IndexCoverageManifest missing after seed.");
  }
}

console.log("CV-DM-03 prepare\n");

if (!seedOnly) {
  await setVercelFlags();
}
if (!envOnly) {
  await seedCorpus();
  await verifySeed();
}

console.log("\n── Checklist ──");
console.log(
  JSON.stringify(
    {
      vercelFlags: checklist.vercelFlags,
      seed: checklist.seed,
      embed: checklist.embed,
      blockers: checklist.blockers,
    },
    null,
    2
  )
);

if (checklist.blockers.length) {
  process.exitCode = 2;
}
