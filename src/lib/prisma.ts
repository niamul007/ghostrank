// Standard Prisma client for a local (or directly reachable) Postgres database.
//
// Previously this file used PrismaNeon + the @neondatabase/serverless WebSocket
// adapter. That adapter was necessary because Neon's cloud Postgres only accepts
// connections over HTTPS/WebSockets (not plain TCP port 5432).
//
// With a local Docker Postgres container we connect over plain TCP to
// localhost:5432 — the normal Postgres protocol. No adapter needed.
// PrismaClient handles the connection pool internally.
import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()
