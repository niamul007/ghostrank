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
import { classifyListed, extractListedNames, findMention, normalize } from "../scanner/matcher"

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
  console.log(`averagePosition: ${result.averagePosition ?? "(none)"}`)
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
  const successful = runs.filter((r) => r.status === RunStatus.SUCCESS)
  const others = new Map<string, { name: string; runs: number }>()
  const competitorRuns = new Map<string, number>(client.competitors.map((c) => [c, 0]))

  for (const run of successful) {
    const listed = extractListedNames(run.answer)

    const seenOthers = new Set<string>()
    for (const item of classifyListed(listed, businessNames, client.competitors)) {
      if (item.kind !== "other") continue
      const key = normalize(item.name)
      if (!key || seenOthers.has(key)) continue
      seenOthers.add(key)
      const entry = others.get(key)
      if (entry) entry.runs++
      else others.set(key, { name: item.name, runs: 1 })
    }

    for (const competitor of client.competitors) {
      const named = classifyListed(listed, businessNames, [competitor]).some(
        (l) => l.kind === "chosen-competitor",
      )
      if (named) competitorRuns.set(competitor, (competitorRuns.get(competitor) ?? 0) + 1)
    }
  }

  console.log(`successful runs: ${successful.length}`)
  console.log(`\nOther businesses (not client, not a chosen competitor), top ${TOP_OTHERS}:`)
  const topOthers = [...others.values()].sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))
  if (topOthers.length === 0) console.log("  (none)")
  for (const o of topOthers.slice(0, TOP_OTHERS)) {
    console.log(`  ${o.runs} run(s)  ${o.name}`)
  }

  console.log("\nChosen competitors:")
  if (client.competitors.length === 0) console.log("  (none chosen)")
  for (const [competitor, count] of competitorRuns) {
    console.log(`  ${count} run(s)  ${competitor}`)
  }
}

main()
  .catch((error) => {
    console.error("Rescore failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
