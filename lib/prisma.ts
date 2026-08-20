import { PrismaClient } from "@prisma/client";

// Prisma singleton for server-side database access.
// NEVER import this module into client components — it ships the database
// client into the browser bundle. Server Components and Route Handlers only.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;