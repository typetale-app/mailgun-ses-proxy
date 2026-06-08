import "dotenv/config"
import { PrismaClient } from "./generated"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const url = (process.env.DATABASE_URL || "").replace(/^mysql:/, "mariadb:")

// Pool options are passed as URL query parameters to mariadb.createPool().
// The adapter's first argument is forwarded directly to the mariadb driver.
const poolSize = process.env.DB_POOL_SIZE || "10"
const separator = url.includes("?") ? "&" : "?"
const connectionUrl = `${url}${separator}connectionLimit=${poolSize}&connectTimeout=10000`
const adapter = new PrismaMariaDb(connectionUrl)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma