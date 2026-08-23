import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { env } from "~/env";
import { Prisma, PrismaClient } from "../../generated/prisma";

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    env.DATABASE_URL ??
    (process.env.VERCEL === "1"
      ? "postgresql://build:build@localhost:5432/build"
      : undefined);
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

function usesNeonServerless(url: string): boolean {
  return url.includes("neon.tech");
}

const createPrismaClient = (): PrismaClient => {
  const url = resolveDatabaseUrl();
  const log: Prisma.LogLevel[] =
    env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"];

  // Neon HTTP driver works behind corporate TLS interception; Prisma TCP engine does not.
  if (usesNeonServerless(url)) {
    const adapter = new PrismaNeonHttp(url, {
      arrayMode: false,
      fullResults: true,
    });
    return new PrismaClient({ adapter, log });
  }

  return new PrismaClient({
    datasourceUrl: url,
    log,
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
