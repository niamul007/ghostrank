// ──────────────────────────────────────────
// GhostRank — v2 rescore script (dev only)
// ──────────────────────────────────────────
// Re-scores an existing scan from its stored ScanRun rows.
// Read-only: makes no API calls and writes nothing to the database.
// Usage: npm run rescore -- <scanId>

import "dotenv/config"
import { RunStatus } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { scoreScan } from "../scanner/scorer"
import { findMention } from "../scanner/matcher"
import { aggregateNamedBusinesses } from "../scanner/namedBusinesses"

const TOP_OTHERS = 10

async function main(): Promise<void> {
  const scanId = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
  if (!scanId) {
    console.log("Usage: npm run rescore -- <scanId>")
    process.exitCode = 1
    return
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      client: { select: { businessName: true, nameVariants: true, competitors: true } },
      runs: { orderBy: [{ questionId: "asc" }, { runNumber: "asc" }] },
    },
  })
  if (!scan || !scan.client) {
    console.log("Scan not found")
    process.exitCode = 1
    return
  }

  const { client, runs } = scan
  const businessNames = [client.businessName, ...client.nameVariants]
  console.log(`Scan:        ${scan.id}`)
  console.log(`Client:      ${client.businessName}`)
  console.log(`Names:       ${businessNames.join(", ")}`)
  console.log(`Competitors: ${client.competitors.join(", ") || "(none)"}`)

  const result = scoreScan({ runs, businessNames })

  console.log("\n── Score ──")
  console.log(`score:           ${result.score ?? "(none)"}`)
  console.log(`countedRuns:     ${result.countedRuns}`)
  console.log(`expectedRuns:    ${result.expectedRuns}`)
  console.log(`lowConfidence:   ${result.lowConfidence}`)
  console.log(`averagePosition: ${result.averagePosition === null ? "(none)" : result.averagePosition.toFixed(1)}`)
  console.log(`byGroup:         ${JSON.stringify(result.byGroup)}`)
  console.log(`reputation:      ${JSON.stringify(result.reputation)}`)
  console.log("perQuestion:")
  for (const q of result.perQuestion) {
    console.log(`  ${q.questionId}: ${q.mentioned}/${q.counted}`)
  }

  console.log("\n── Runs ──")
  const byQuestion = new Map<string, typeof runs>()
  for (const run of runs) {
    byQuestion.set(run.questionId, [...(byQuestion.get(run.questionId) ?? []), run])
  }
  for (const [questionId, questionRuns] of byQuestion) {
    console.log(`\n[${questionId}] ${questionRuns[0].questionText}`)
    const verdicts = new Set<boolean>()
    for (const run of questionRuns) {
      if (run.status !== RunStatus.SUCCESS) {
        console.log(`  run ${run.runNumber}: ${run.status} (${run.errorLabel ?? "no label"})`)
        continue
      }
      const mention = findMention(run.answer, businessNames)
      verdicts.add(mention.mentioned)
      console.log(
        `  run ${run.runNumber}: mentioned ${mention.mentioned ? "yes" : "no"}, position ${mention.position ?? "-"}`,
      )
    }
    if (verdicts.size === 0) console.log("  runs agreed: n/a (no successful runs)")
    else console.log(`  runs agreed: ${verdicts.size === 1 ? "yes" : "no"}`)
  }

  console.log("\n── Named by the AI ──")
  const named = aggregateNamedBusinesses({
    runs,
    businessNames,
    competitorNames: client.competitors,
  })

  console.log(`counted runs: ${named.totalCountedRuns}`)
  console.log(`\nOther businesses (not client, not a chosen competitor), top ${TOP_OTHERS}:`)
  if (named.others.length === 0) console.log("  (none)")
  for (const o of named.others.slice(0, TOP_OTHERS)) {
    console.log(`  ${o.runs} run(s)  ${o.name}`)
  }

  console.log("\nChosen competitors:")
  if (client.competitors.length === 0) console.log("  (none chosen)")
  for (const c of named.chosenCompetitors) {
    console.log(`  ${c.runs} run(s)  ${c.name}`)
  }
}

main()
  .catch((error) => {
    console.error("Rescore failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
