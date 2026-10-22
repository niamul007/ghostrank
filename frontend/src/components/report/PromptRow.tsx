import { useId, useState } from "react"
import { Badge, type Tone } from "../Badge"
import type { ReportData, ResultIssue, SentimentLabel } from "../../types"

const SENTIMENT_TONE: Record<SentimentLabel, "good" | "neutral" | "bad"> = {
  positive: "good",
  neutral: "neutral",
  negative: "bad",
}

const ISSUE_BADGE: Record<ResultIssue, { label: string; tone: Tone } | null> = {
  not_mentioned: { label: "Not mentioned", tone: "bad" },
  low_position: { label: "Low position", tone: "warn" },
  negative: { label: "Negative", tone: "bad" },
  ok: null,
}

/** One prompt result. Collapsed by default; chips stay visible, detail expands. */
export function PromptRow({ result }: { result: ReportData["results"][number] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const issue = ISSUE_BADGE[result.issue]
  const competitors = result.competitors ?? []
  const fix = result.fix ?? null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="block w-full cursor-pointer px-5 py-4 text-left hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <p className="wrap-break-word text-sm text-text">{result.prompt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{result.category}</Badge>
          <Badge tone={result.mentioned ? "good" : "neutral"}>
            {result.mentioned ? "mentioned" : "not mentioned"}
          </Badge>
          {result.position !== null ? <Badge tone="accent">position #{result.position}</Badge> : null}
          {result.sentiment ? (
            <Badge tone={SENTIMENT_TONE[result.sentiment as SentimentLabel]}>{result.sentiment}</Badge>
          ) : null}
          {issue ? <Badge tone={issue.tone}>{issue.label}</Badge> : null}
        </div>
      </button>

      {open ? (
        <div id={panelId} className="flex min-w-0 flex-col gap-4 px-5 pb-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-text-faint">What the AI answered</p>
            <p className="whitespace-pre-wrap wrap-break-word text-sm text-text-dim">{result.answerExcerpt}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-text-faint">Recommended instead</p>
            {competitors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {competitors.map((name) => (
                  <span
                    key={name}
                    className="max-w-full wrap-break-word rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-dim"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-dim">No other businesses detected</p>
            )}
          </div>
          {fix !== null ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-text-faint">How to improve</p>
              <p className="wrap-break-word text-sm text-text-dim">{fix}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
