// ──────────────────────────────────────────
// GhostRank — Client Controller
// ──────────────────────────────────────────
// CRUD operations for managing client businesses.
// An agency adds their clients here, then runs scans on them.

import { Request, Response, NextFunction } from "express"
import { prisma } from "../lib/prisma"

/**
 * POST /api/clients
 *
 * Adds a new client business to monitor.
 * Requires: businessName, niche, location
 *
 * The agencyId comes from the JWT token (req.agencyId)
 * set by the auth middleware — so agencies can only
 * create clients under their own account.
 */
export async function createClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { businessName, niche, location } = req.body
    const agencyId = (req as any).agencyId

    if (!businessName || !niche || !location) {
      res.status(400).json({
        status: "error",
        message: "businessName, niche, and location are required",
      })
      return
    }

    const client = await prisma.client.create({
      data: {
        agencyId,
        businessName,
        niche,
        location,
      },
    })

    res.status(201).json({
      status: "success",
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/clients
 *
 * Lists all clients for the logged-in agency.
 * Each client includes their latest scan score
 * so the dashboard can show a quick overview.
 */
export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agencyId = (req as any).agencyId

    const clients = await prisma.client.findMany({
      where: { agencyId },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            score: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({
      status: "success",
      data: clients,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/clients/:id
 *
 * Gets a single client with their scan history.
 */
export async function getClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string
    const agencyId = (req as any).agencyId

    const client = await prisma.client.findFirst({
      where: { id, agencyId },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            score: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    if (!client) {
      res.status(404).json({
        status: "error",
        message: "Client not found",
      })
      return
    }

    res.json({
      status: "success",
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /api/clients/:id
 *
 * Updates a client's info (name, niche, location).
 */
export async function updateClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string
    const agencyId = (req as any).agencyId
    const { businessName, niche, location } = req.body

    // Verify ownership
    const existing = await prisma.client.findFirst({
      where: { id, agencyId },
    })

    if (!existing) {
      res.status(404).json({
        status: "error",
        message: "Client not found",
      })
      return
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(businessName && { businessName }),
        ...(niche && { niche }),
        ...(location && { location }),
      },
    })

    res.json({
      status: "success",
      data: client,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/clients/:id
 *
 * Deletes a client and all their scans/results (cascade).
 */
export async function deleteClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string
    const agencyId = (req as any).agencyId

    const existing = await prisma.client.findFirst({
      where: { id, agencyId },
    })

    if (!existing) {
      res.status(404).json({
        status: "error",
        message: "Client not found",
      })
      return
    }

    await prisma.client.delete({ where: { id } })

    res.json({
      status: "success",
      message: "Client deleted",
    })
  } catch (error) {
    next(error)
  }
}