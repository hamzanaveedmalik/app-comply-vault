/**
 * CV-WEB-02 — Live marketing integrations must match the adapter registry.
 * CV-WEB-03 — Marketing pages must not contain unsupported quantified claims.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adapters } from "~/server/integrations";
import { MARKETING_LIVE_REGISTRY_KEYS } from "~/lib/marketing/live-integrations";
import {
  FORBIDDEN_UNSUPPORTED_CLAIM_PATTERNS,
  QUANTIFIED_MARKETING_CLAIMS,
} from "~/lib/marketing/claims";

function collectFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const st = statSync(root);
  if (st.isFile()) return [root];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(tsx|ts|md|txt)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("CV-WEB-02 marketing integrations vs adapter registry", () => {
  it("lists exactly the adapters registered in IntegrationHub", () => {
    const registryKeys = Object.keys(adapters).sort();
    const marketingKeys = [...MARKETING_LIVE_REGISTRY_KEYS].sort();
    expect(marketingKeys).toEqual(registryKeys);
  });
});

describe("CV-WEB-03 quantified claims", () => {
  it("has a methodology path for every quantified claim", () => {
    for (const claim of QUANTIFIED_MARKETING_CLAIMS) {
      expect(claim.methodologyPath.startsWith("/")).toBe(true);
      expect(claim.methodologyPath.length).toBeGreaterThan(1);
    }
  });

  it("does not embed unsupported claim phrases in marketing pages", () => {
    const roots = [
      path.join(process.cwd(), "src/app/page.tsx"),
      path.join(process.cwd(), "src/app/layout.tsx"),
      path.join(process.cwd(), "src/app/trust"),
      path.join(process.cwd(), "src/app/privacy"),
      path.join(process.cwd(), "src/app/terms"),
      path.join(process.cwd(), "src/app/uk"),
      path.join(process.cwd(), "src/lib/marketing"),
      path.join(process.cwd(), "public/security"),
    ];

    const files = roots.flatMap(collectFiles);
    const offenders: string[] = [];
    for (const file of files) {
      if (file.includes(`${path.sep}methodology${path.sep}`)) continue;
      // Test file may mention forbidden patterns as string literals in regexes.
      if (file.endsWith("claims.ts") || file.endsWith("marketing-honesty.test.ts")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_UNSUPPORTED_CLAIM_PATTERNS) {
        if (pattern.test(text)) {
          offenders.push(`${path.relative(process.cwd(), file)} ~ ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
