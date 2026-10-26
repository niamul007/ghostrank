import { api } from "./client"
import type { ApiSuccess, Scan, ScanRunsResponse, StartScanResponse } from "../types"

/** Starts a v2 scan (24-answer question runner). */
export async function startScan(clientId: string): Promise<StartScanResponse> {
  const res = await api.post<ApiSuccess<StartScanResponse>>(`/api/clients/${clientId}/scans/v2`)
  return res.data.data
}

export async function getScan(id: string): Promise<Scan> {
  const res = await api.get<ApiSuccess<Scan>>(`/api/scans/${id}`)
  return res.data.data
}

/** Status plus the ScanRun rows recorded so far — used to poll a v2 scan. */
export async function getScanRuns(id: string): Promise<ScanRunsResponse> {
  const res = await api.get<ApiSuccess<ScanRunsResponse>>(`/api/scans/${id}/runs`)
  return res.data.data
}

export async function listScansForClient(clientId: string): Promise<Scan[]> {
  const res = await api.get<ApiSuccess<Scan[]>>(`/api/clients/${clientId}/scans`)
  return res.data.data
}
