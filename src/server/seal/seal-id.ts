/**
 * Pre-allocate RecordSeal ids so sealId can be embedded in pack bytes
 * before the ledger INSERT (CV-TR-01 / CV-TR-02).
 */

import { randomBytes } from "node:crypto";

/**
 * Cuid-shaped unique id (Prisma RecordSeal.id is String @id).
 */
export function newRecordSealId(): string {
  const time = Date.now().toString(36);
  const entropy = randomBytes(8).toString("hex");
  return `c${time}${entropy}`;
}
