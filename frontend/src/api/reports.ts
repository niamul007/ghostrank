import { api } from "./client"
import type { ApiSuccess, ReportData, ReportListItem } from "../types"

/** Generates (or reuses) the report for a completed scan. */
export async function createReport(scanId: string): Promise<ReportData> {
  const res = await api.post<ApiSuccess<ReportData>>(`/api/scans/${scanId}/report`)
  return res.data.data
}

/** Loads an existing report — same ReportData shape as createReport(). */
export async function getReport(id: string): Promise<ReportData> {
  const res = await api.get<ApiSuccess<ReportData>>(`/api/reports/${id}`)
  return res.data.data
}

export async function listReportsForClient(clientId: string): Promise<ReportListItem[]> {
  const res = await api.get<ApiSuccess<ReportListItem[]>>(`/api/clients/${clientId}/reports`)
  return res.data.data
}
