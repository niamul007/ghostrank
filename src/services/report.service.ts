import { prisma } from "../lib/prisma"

export async function generateReport(
  _scanId: string,
  _clientId: string
): Promise<{ id: string }> {
  // TODO: compile ScanResults, render PDF, upload to storage, persist Report record
  throw new Error("Not implemented")
}

export async function getReportById(reportId: string) {
  // TODO: return report with scan and client relations
  return prisma.report.findUnique({
    where: { id: reportId },
    include: { scan: true, client: true },
  })
}

export async function getReportsByClient(clientId: string) {
  // TODO: return all reports for a client ordered by createdAt desc
  return prisma.report.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  })
}
