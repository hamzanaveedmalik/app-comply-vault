/**
 * CV-TR-02a — helpers for byte-identical audit packs.
 * Same input state must hash identically across TZ, locale, and wall-clock days.
 */

/** ZIP DOS epoch — fixed mtime for every archive entry. */
export const ZIP_ENTRY_EPOCH = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

/** Fixed zlib level so compression output does not vary by environment defaults. */
export const ZIP_COMPRESSION_LEVEL = 9 as const;

/**
 * Format an instant as UTC ISO-8601 with millisecond precision.
 * Never use toLocaleString / toLocaleDateString in pack content.
 */
export function formatUtcIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date for deterministic export formatting");
  }
  return d.toISOString();
}

/** YYYY-MM-DD from an instant, in UTC (date-only display). */
export function formatUtcDate(value: Date | string): string {
  return formatUtcIso(value).slice(0, 10);
}

/**
 * Resolve the single reference timestamp injected into pack content.
 * Prefer an explicit sealedAt (protocol start), then finalizedAt, then earlier workflow stamps.
 * Never falls back to wall-clock now.
 */
export function resolvePackTimestamp(args: {
  packTimestamp?: Date | null;
  finalizedAt?: Date | null;
  ccoSignedOffAt?: Date | null;
  cmReviewedAt?: Date | null;
  advisorCertifiedAt?: Date | null;
  draftReadyAt?: Date | null;
  updatedAt?: Date | null;
  createdAt: Date;
}): Date {
  const candidates = [
    args.packTimestamp,
    args.finalizedAt,
    args.ccoSignedOffAt,
    args.cmReviewedAt,
    args.advisorCertifiedAt,
    args.draftReadyAt,
    args.updatedAt,
    args.createdAt,
  ];
  for (const c of candidates) {
    if (c instanceof Date && !Number.isNaN(c.getTime())) {
      return c;
    }
  }
  return args.createdAt;
}

/** Stable JSON for any embedded object (sorted keys, no whitespace variance). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

export function sortByStartTimeThenClaim<
  T extends { startTime?: number | null; claim?: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = a.startTime ?? 0;
    const tb = b.startTime ?? 0;
    if (ta !== tb) return ta - tb;
    return (a.claim ?? "").localeCompare(b.claim ?? "");
  });
}

export function sortFlags<
  T extends { type: string; severity: string; status: string },
>(flags: T[]): T[] {
  return [...flags].sort((a, b) => {
    const byType = a.type.localeCompare(b.type);
    if (byType !== 0) return byType;
    const bySev = a.severity.localeCompare(b.severity);
    if (bySev !== 0) return bySev;
    return a.status.localeCompare(b.status);
  });
}

export function sortVersions<T extends { version: number; id: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    if (a.version !== b.version) return a.version - b.version;
    return a.id.localeCompare(b.id);
  });
}

export function sortSegmentsByStart<T extends { startTime: number }>(segments: T[]): T[] {
  return [...segments].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return 0;
  });
}
