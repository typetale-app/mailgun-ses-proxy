import "dotenv/config";
import { PrismaClient } from "./generated";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const url = (process.env.DATABASE_URL || "").replace(/^mysql:/, "mariadb:");
const adapter = new PrismaMariaDb(url);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;