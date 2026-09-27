import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Invalidate stale client if schema changed during hot reload
if (globalForPrisma.prisma && !("chatSession" in globalForPrisma.prisma)) {
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let sqliteConfigured = false;

export async function configureSqlitePragmas(client: PrismaClient = prisma): Promise<void> {
  if (sqliteConfigured) return;
  try {
    // In Prisma with SQLite, PRAGMAs can return result values, so $queryRawUnsafe is safe for all
    await client.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await client.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);
    await client.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    await client.$queryRawUnsafe(`PRAGMA cache_size = -64000;`);
    await client.$queryRawUnsafe(`PRAGMA temp_store = MEMORY;`);
    sqliteConfigured = true;
  } catch (err) {
    // Deferred or non-fatal if running in environments where SQLite raw pragmas aren't supported
    console.warn("[Prisma] SQLite WAL pragma setup warning:", err);
  }
}

// Automatically configure SQLite pragmas on server startup
if (typeof window === "undefined") {
  configureSqlitePragmas(prisma).catch(() => {});
}
