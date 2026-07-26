/**
 * CV-TR-01a — provisioned-database privilege contract.
 *
 * CI must set RECORD_SEAL_PRIVILEGE_TEST_DATABASE_URL to a disposable Neon
 * branch connection URL for the restricted `complyvault_app` role. The test is
 * skipped locally when that secret is absent.
 *
 * RAW SQL: the acceptance criterion is PostgreSQL authorization itself;
 * Prisma's model API cannot assert UPDATE/DELETE privilege denial.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../generated/prisma";

const privilegeDatabaseUrl =
  process.env.RECORD_SEAL_PRIVILEGE_TEST_DATABASE_URL;

describe.skipIf(!privilegeDatabaseUrl)(
  "CV-TR-01a RecordSeal PostgreSQL privileges",
  () => {
    let client: PrismaClient;

    beforeAll(() => {
      client = new PrismaClient({
        datasourceUrl: privilegeDatabaseUrl,
      });
    });

    afterAll(async () => {
      await client.$disconnect();
    });

    it("uses a runtime role that does not own RecordSeal", async () => {
      const rows = await client.$queryRawUnsafe<
        Array<{ current_user: string; table_owner: string }>
      >(
        `SELECT current_user, tableowner AS table_owner
         FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'RecordSeal'`,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.current_user).toBe("complyvault_app");
      expect(rows[0]?.table_owner).not.toBe("complyvault_app");
    });

    it("permits SELECT and INSERT but denies UPDATE, DELETE, and TRUNCATE", async () => {
      const rows = await client.$queryRawUnsafe<
        Array<{
          can_select: boolean;
          can_insert: boolean;
          can_update: boolean;
          can_delete: boolean;
          can_truncate: boolean;
        }>
      >(
        `SELECT
           has_table_privilege(current_user, '"RecordSeal"', 'SELECT') AS can_select,
           has_table_privilege(current_user, '"RecordSeal"', 'INSERT') AS can_insert,
           has_table_privilege(current_user, '"RecordSeal"', 'UPDATE') AS can_update,
           has_table_privilege(current_user, '"RecordSeal"', 'DELETE') AS can_delete,
           has_table_privilege(current_user, '"RecordSeal"', 'TRUNCATE') AS can_truncate`,
      );

      expect(rows).toEqual([
        {
          can_select: true,
          can_insert: true,
          can_update: false,
          can_delete: false,
          can_truncate: false,
        },
      ]);
    });

    it("Postgres explicitly rejects UPDATE and DELETE attempts", async () => {
      await expect(
        client.$executeRawUnsafe(
          `UPDATE "RecordSeal" SET "updatedAt" = "updatedAt" WHERE false`,
        ),
      ).rejects.toThrow(/permission denied|insufficient.?privilege/i);

      await expect(
        client.$executeRawUnsafe(`DELETE FROM "RecordSeal" WHERE false`),
      ).rejects.toThrow(/permission denied|insufficient.?privilege/i);
    });
  },
);
