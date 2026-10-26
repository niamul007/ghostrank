import { api } from "./client"
import type { ApiSuccess, Report, ReportListItem } from "../types"

/** Generates (or reuses) the report for a completed scan. Narrow on `version`. */
export async function createReport(scanId: string): Promise<Report> {
  const res = await api.post<ApiSuccess<Report>>(`/api/scans/${scanId}/report`)
  return res.data.data
}

/** Loads an existing report — same Report shape as createReport(). */
export async function getReport(id: string): Promise<Report> {
  const res = await api.get<ApiSuccess<Report>>(`/api/reports/${id}`)
  return res.data.data
}

export async function listReportsForClient(clientId: string): Promise<ReportListItem[]> {
  const res = await api.get<ApiSuccess<ReportListItem[]>>(`/api/clients/${clientId}/reports`)
  return res.data.data
}
