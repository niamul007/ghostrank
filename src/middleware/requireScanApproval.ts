import { Request, Response, NextFunction } from "express"
import { prisma } from "../lib/prisma"
import { AppError } from "../utils/AppError"

// Paid scans are gated: a new agency must be approved before it can start one.
// Runs after `authenticate`, so req.user is set.
export async function requireScanApproval(req: Request, _res: Response, next: NextFunction) {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: req.user!.agencyId },
      select: { scanApproved: true },
    })
    if (!agency?.scanApproved) {
      return next(new AppError("Scanning is not enabled for this account yet.", 403))
    }
    next()
  } catch (err) {
    next(err)
  }
}
