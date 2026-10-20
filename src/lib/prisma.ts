// Standard Prisma client. Prisma connects to Neon over TCP using the pooled
// DATABASE_URL. No driver adapter is needed; PrismaClient handles the
// connection pool internally.
import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()
