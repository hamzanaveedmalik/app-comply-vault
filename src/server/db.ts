import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () => {
  // Use placeholder during Vercel build when DATABASE_URL may not be available yet.
  // At runtime, Vercel injects env vars and the real URL is used.
  const url =
    env.DATABASE_URL ||
    (process.env.VERCEL === "1"
      ? "postgresql://build:build@localhost:5432/build"
      : undefined);
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return new PrismaClient({
    datasourceUrl: url,
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
