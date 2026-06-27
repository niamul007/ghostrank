import { Request, Response, NextFunction } from "express"
import * as scanService from "../services/scan.service"

export async function startScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: validate req.params.clientId, call scanService.createScan
  next(new Error("Not implemented"))
}

export async function getScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: call scanService.getScanById(req.params.id)
  next(new Error("Not implemented"))
}

export async function listScans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: call scanService.getScansByClient(req.params.clientId)
  next(new Error("Not implemented"))
}
