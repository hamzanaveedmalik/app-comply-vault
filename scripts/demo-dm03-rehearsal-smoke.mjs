/**
 * CV-DM-03 — automated rehearsal smoke (no auth session).
 *
 * Verifies Release 1 demo routes exist on production (auth redirect),
 * and writes the human rehearsal scorecard for Rehearsal 1 / 2.
 *
 * Usage:
 *   node scripts/demo-dm03-rehearsal-smoke.mjs
 *   DEMO_BASE_URL=https://app.complyvault.co node scripts/demo-dm03-rehearsal-smoke.mjs
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.env.DEMO_BASE_URL || "https://app.complyvault.co").replace(
  /\/$/,
  ""
);

const ROUTES = [
  "/needs-attention",
  "/fail-closed",
  "/partner/portfolio",
  "/partner/complement",
  "/partner/economics",
  "/candidate-pack",
  "/integrations/gmail-mail",
  "/ask",
];

function headRequest(url) {
  // Prefer curl — Node fetch often fails under corp MitM / TLS interception.
  const r = spawnSync(
    "/usr/bin/curl",
    ["-sI", "-o", "/tmp/cv-dm03-hdr.txt", "-w", "%{http_code}", url],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    return { status: 0, location: "", error: r.stderr || "curl failed" };
  }
  const status = Number.parseInt(r.stdout.trim(), 10) || 0;
  const hdr = spawnSync("/bin/cat", ["/tmp/cv-dm03-hdr.txt"], {
    encoding: "utf8",
  });
  const locationMatch = (hdr.stdout || "").match(/^location:\s*(.+)$/im);
  return {
    status,
    location: locationMatch?.[1]?.trim() ?? "",
  };
}

const results = [];

for (const pathName of ROUTES) {
  const url = `${BASE}${pathName}`;
  const { status, location, error } = headRequest(url);
  const ok =
    !error &&
    (status === 307 ||
      status === 302 ||
      status === 200) &&
    (status === 200 || /signin|auth/i.test(location));
  results.push({ path: pathName, status, location, ok, error });
}

const failed = results.filter((r) => !r.ok);
console.log(`CV-DM-03 rehearsal smoke against ${BASE}`);
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  console.log(
    `  [${mark}] ${r.status} ${r.path}${r.location ? ` → ${r.location}` : ""}${
      r.error ? ` (${r.error})` : ""
    }`
  );
}

const scorecard = `# CV-DM-03 rehearsal scorecard

Generated: ${new Date().toISOString()}
Base: ${BASE}
Route smoke: ${failed.length === 0 ? "PASS" : `FAIL (${failed.length})`}

## Automated (this script)

- [${failed.length === 0 ? "x" : " "}] Production routes redirect to auth (surface exists)
${results.map((r) => `  - [${r.ok ? "x" : " "}] \`${r.path}\` (${r.status})`).join("\n")}

## Rehearsal 1 — human (full run sheet, timed)

Target: under 25 minutes including opens.

- [ ] Three hypothesis questions
- [ ] N2 zero setup → Needs Attention (held identity line spoken)
- [ ] N1 rehearsed + paraphrased + open
- [ ] Honest miss (SMS / 2023 / private jet)
- [ ] N4 fail-closed (\`demo-parked-zoom-recording-001\`)
- [ ] N3 candidate pack (confirm scope before generate)
- [ ] N5 portfolio + production-access sentence
- [ ] N6 complement → economics → dated next step (17 Aug)

Wall time: ________  Fallbacks used: ________  Broken citations: ________

## Rehearsal 2 — adversarial

- [ ] Kill live sync mid-flow → recorded-run fallback line
- [ ] Open-tier miss → specific decline
- [ ] Cold start hard refresh each surface
- [ ] Second operator can run the sheet alone

## Day-before freeze

- [ ] No schema/flag changes without third rehearsal
- [ ] Seed + embed re-run if data touched
- [ ] Run sheet + VL-02 agenda answers pinned
`;

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/release-1/demo/dm03-rehearsal-scorecard.md"
);
writeFileSync(outPath, scorecard, "utf8");
console.log(`Wrote ${outPath}`);

if (failed.length > 0) {
  process.exit(1);
}
