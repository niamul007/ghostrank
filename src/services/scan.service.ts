import { prisma } from "../lib/prisma"
import { ScanJobPayload } from "../types"

export async function createScan(clientId: string): Promise<{ id: string }> {
  // TODO: insert Scan row with PENDING status, then enqueue runScanJob
  throw new Error("Not implemented")
}

export async function getScanById(scanId: string) {
  // TODO: return scan with nested scanResults
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: { scanResults: true },
  })
}

export async function getScansByClient(clientId: string) {
  // TODO: return all scans for a client ordered by createdAt desc
  return prisma.scan.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  })
}

export async function runScanJob(
  _scanId: string,
  _payload: ScanJobPayload
): Promise<void> {
  // TODO: orchestrate promptBuilder → aiQuerier → parser → scorer → persist results
  throw new Error("Not implemented")
}
