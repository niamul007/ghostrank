// ──────────────────────────────────────────
// GhostRank — v2 scan smoke script (dev only)
// ──────────────────────────────────────────
// Runs one real v2 scan in the foreground and prints what was stored.
// Usage: npm run smoke:v2 -- <clientId> --yes

import "dotenv/config"
import { RunStatus } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { createScan } from "../services/scan.service"
import { runScanV2 } from "../scanner/runScanV2"

const USAGE = [
  "Usage: npm run smoke:v2 -- <clientId> --yes",
  "",
  "This makes 24 real Claude API calls",
].join("\n")

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const confirmed = args.includes("--yes")
  const clientId = args.find((arg) => !arg.startsWith("--"))

  if (!clientId || !confirmed) {
    console.log(USAGE)
    return
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) {
    console.log(`Client not found: ${clientId}`)
    process.exitCode = 1
    return
  }

  console.log(`Client:   ${client.businessName}`)
  console.log(`Niche:    ${client.niche}`)
  console.log(`City:     ${client.city ?? "(none)"}`)

  const scan = await createScan(clientId)
  console.log(`\nScan ${scan.id} created, running (this can take a while)...`)
  await runScanV2(scan.id, clientId)

  const final = await prisma.scan.findUnique({
    where: { id: scan.id },
    select: { status: true, errorMsg: true, rawResults: true },
  })
  const runs = await prisma.scanRun.findMany({
    where: { scanId: scan.id },
    orderBy: [{ questionId: "asc" }, { runNumber: "asc" }],
  })

  console.log("\n── Scan ──")
  console.log(`status:     ${final?.status}`)
  console.log(`errorMsg:   ${final?.errorMsg ?? "(none)"}`)
  console.log(`rawResults: ${JSON.stringify(final?.rawResults, null, 2)}`)

  console.log("\n── Runs ──")
  const success = runs.filter((r) => r.status === RunStatus.SUCCESS).length
  console.log(`total: ${runs.length}  SUCCESS: ${success}  FAILED: ${runs.length - success}`)

  const perQuestion = new Map<string, number>()
  for (const run of runs) {
    perQuestion.set(run.questionId, (perQuestion.get(run.questionId) ?? 0) + 1)
  }
  console.log("runs per question (expect 3 each):")
  for (const [questionId, count] of perQuestion) {
    console.log(`  ${questionId}: ${count}`)
  }

  const inputTokens = runs.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0)
  const outputTokens = runs.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0)
  const longestMs = runs.reduce((max, r) => Math.max(max, r.durationMs ?? 0), 0)
  console.log(`input tokens: ${inputTokens}`)
  console.log(`output tokens: ${outputTokens}`)
  console.log(`longest durationMs: ${longestMs}`)

  console.log("\n── Questions ──")
  const nameLower = client.businessName.toLowerCase()
  for (const questionId of perQuestion.keys()) {
    const forQuestion = runs.filter((r) => r.questionId === questionId)
    const firstOk = forQuestion.find((r) => r.status === RunStatus.SUCCESS)
    console.log(`\n[${questionId}] ${forQuestion[0].questionText}`)
    if (!firstOk) {
      console.log("  (no successful answer)")
      continue
    }
    const mentions = firstOk.answer.toLowerCase().includes(nameLower)
    console.log(`  answer: ${firstOk.answer.slice(0, 200)}`)
    console.log(`  mentions business name: ${mentions ? "yes" : "no"}`)
  }

  console.log(`\nScan id: ${scan.id}`)
  console.log(`Inspect later with GET /api/scans/${scan.id}/runs`)
}

main()
  .catch((error) => {
    console.error("Smoke script failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
