import { Request, Response, NextFunction } from "express"

export async function createClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: validate body, create Client scoped to req.user.agencyId
  next(new Error("Not implemented"))
}

export async function getClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: fetch Client by req.params.id, verify it belongs to req.user.agencyId
  next(new Error("Not implemented"))
}

export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: list all Clients for req.user.agencyId
  next(new Error("Not implemented"))
}

export async function updateClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: validate body, update Client fields, verify ownership
  next(new Error("Not implemented"))
}

export async function deleteClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: delete Client by req.params.id, verify ownership first
  next(new Error("Not implemented"))
}
