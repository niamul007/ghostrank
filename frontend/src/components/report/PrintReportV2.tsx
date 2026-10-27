import { useState } from "react"
import { formatDate, formatDateTime } from "../../lib/format"
import type { ReportDataV2 } from "../../types"

const NEUTRAL_ACCENT = "#1e3a5f"
const GROUP_LABEL: Record<ReportDataV2["byGroup"][number]["group"], string> = {
  find: "Looking for a recommendation",
  compare: "Comparing options",
  need: "Specific needs",
}
const PROVIDER_LABEL: Record<string, string> = { claude: "Claude" }

/** Returns a 6-digit lowercase hex, or null when the value is not a hex colour. */
function normalizeHex(value: string | undefined): string | null {
  if (!value) return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
  return `#${h.toLowerCase()}`
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** White or near-black, whichever has the higher contrast on the accent. */
function textOn(hex: string): string {
  const l = luminance(hex)
  const vsWhite = 1.05 / (l + 0.05)
  const vsDark = (l + 0.05) / (0.01 + 0.05)
  return vsWhite >= vsDark ? "#ffffff" : "#111418"
}

function safeLogo(url: string | null): string | null {
  if (!url) return null
  const u = url.trim()
  return /^https?:\/\//i.test(u) || /^data:image\//i.test(u) ? u : null
}

function Bar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div className="pr-bar">
      <div className="pr-bar-head">
        <span>{label}</span>
        <span className="pr-muted pr-num">{detail}</span>
      </div>
      <div className="pr-bar-track">
        <div className="pr-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 78
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  return (
    <svg viewBox="0 0 200 200" width="190" height="190" role="img" aria-label={`Score ${score} out of 100, ${label}`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#e6e8ec" strokeWidth="16" />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="var(--pr-accent)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 100 100)"
      />
      <text x="100" y="108" textAnchor="middle" fontSize="54" fontWeight="700" fill="#111418">
        {score}
      </text>
      <text x="100" y="134" textAnchor="middle" fontSize="13" fill="#5b6270">
        out of 100
      </text>
    </svg>
  )
}

function summarySentence(report: ReportDataV2): string {
  const name = report.business.name
  const counted = report.basedOnRuns
  const mentioned = report.questions.reduce((sum, q) => sum + q.mentioned, 0)
  const top = report.named.others[0]
  const first =
    mentioned === 0
      ? `AI never named ${name} in ${counted} answers.`
      : `AI named ${name} in ${mentioned} of ${counted} answers.`
  if (!top) return first
  return `${first} It recommended ${top.name} in ${Math.round(top.percent)}% of answers.`
}

/** A4 print layout for a v2 report. Styles live in index.css under the pr- prefix. */
export function PrintReportV2({ report }: { report: ReportDataV2 }) {
  const { business, agency } = report
  const [logoFailed, setLogoFailed] = useState(false)
  const accent = normalizeHex(agency.brandColors[0]) ?? NEUTRAL_ACCENT
  const onAccent = textOn(accent)
  const logo = logoFailed ? null : safeLogo(agency.logo)
  const place = business.city ?? business.location
  const hasRuns = report.basedOnRuns > 0
  const provider = PROVIDER_LABEL[report.model.provider] ?? report.model.provider
  const topOthers = report.named.others.slice(0, 5)
  const topSources = report.sources?.domains.slice(0, 5) ?? []

  return (
    <div className="pr-doc" style={{ "--pr-accent": accent } as React.CSSProperties}>
      {/* Page 1 */}
      <section className="pr-sheet">
        <header className="pr-band" style={{ background: accent, color: onAccent }}>
          {logo ? (
            <img src={logo} alt={agency.name} className="pr-logo" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="pr-band-name">{agency.name || "GhostRank"}</span>
          )}
        </header>

        <div className="pr-body">
          <p className="pr-kicker">AI Visibility Audit</p>
          <h1 className="pr-title">{business.name}</h1>
          <p className="pr-sub">
            {business.niche} · {place} · scanned {formatDate(report.scanDate)}
          </p>

          {hasRuns ? (
            <div className="pr-hero">
              <ScoreRing score={report.score} label={report.scoreLabel} />
              <p className="pr-verdict">{report.scoreLabel}</p>
              <p className="pr-muted">
                Likely between {report.scoreRange.low}% and {report.scoreRange.high}%
              </p>
              <p className="pr-summary">{summarySentence(report)}</p>
              {report.lowConfidence ? (
                <p className="pr-note">Some answers failed, so this result is less reliable.</p>
              ) : null}
            </div>
          ) : (
            <div className="pr-hero">
              <p className="pr-verdict">Not enough answers</p>
              <p className="pr-muted">None of the AI answers in this scan could be counted, so there is no score.</p>
            </div>
          )}
        </div>
      </section>

      {/* Page 2 */}
      <section className="pr-sheet">
        <div className="pr-body">
          {hasRuns ? (
            <>
              <h2 className="pr-h2">By question type</h2>
              <div className="pr-card">
                {report.byGroup.map((g) => (
                  <Bar
                    key={g.group}
                    label={GROUP_LABEL[g.group]}
                    percent={g.percent}
                    detail={`${g.mentioned} of ${g.counted} answers (${Math.round(g.percent)}%)`}
                  />
                ))}
              </div>

              <h2 className="pr-h2">Who the AI recommends instead</h2>
              <div className="pr-card">
                {topOthers.length === 0 ? (
                  <p className="pr-muted">No other businesses were named.</p>
                ) : (
                  topOthers.map((o) => (
                    <Bar key={o.name} label={o.name} percent={o.percent} detail={`${Math.round(o.percent)}% of answers`} />
                  ))
                )}
              </div>

              {topSources.length > 0 && report.sources ? (
                <>
                  <h2 className="pr-h2">Websites the AI looked at</h2>
                  <div className="pr-card">
                    {topSources.map((d) => (
                      <Bar
                        key={d.domain}
                        label={d.domain}
                        percent={report.sources!.totalRuns > 0 ? (d.runs / report.sources!.totalRuns) * 100 : 0}
                        detail={`in ${d.runs} of ${report.sources!.totalRuns} answers`}
                      />
                    ))}
                    <p className="pr-muted pr-small" style={{ margin: "4mm 0 0" }}>
                      Pages the AI came across while searching. Getting listed or improved on these sites is a way to be found.
                    </p>
                  </div>
                </>
              ) : null}

              <h2 className="pr-h2">Your chosen competitors</h2>
              <div className="pr-card">
                {report.named.chosenCompetitors.length === 0 ? (
                  <p className="pr-muted">No competitors were chosen for this client.</p>
                ) : (
                  <table className="pr-table">
                    <tbody>
                      {report.named.chosenCompetitors.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td className="pr-right pr-num">
                            named in {c.runs} of {report.basedOnRuns} answers
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <p className="pr-muted">No charts to show for this scan.</p>
          )}
        </div>
      </section>

      {/* Page 3 */}
      <section className="pr-sheet">
        <div className="pr-body">
          {hasRuns ? (
            <>
              <h2 className="pr-h2">Question by question</h2>
              <div className="pr-card">
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th className="pr-right">Named</th>
                      <th className="pr-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.questions.map((q) => {
                      const gap = q.counted > 0 && q.mentioned === 0
                      return (
                        <tr key={q.questionId}>
                          <td>{q.text}</td>
                          <td className="pr-right pr-num">
                            {q.mentioned} of {q.counted}
                          </td>
                          <td className="pr-right">{gap ? <span className="pr-gap">Gap</span> : ""}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {report.reputation.answers.length > 0 ? (
            <>
              <h2 className="pr-h2">What the AI says when asked directly</h2>
              {report.reputation.answers.slice(0, 2).map((answer, i) => (
                <blockquote key={i} className="pr-quote">
                  “{answer}”
                </blockquote>
              ))}
              <p className="pr-muted pr-small">AI answers can be inaccurate.</p>
            </>
          ) : null}

          <div style={{ breakInside: "avoid" }}>
            <h2 className="pr-h2">How this was measured</h2>
            <p className="pr-para">
              This report is based on {report.basedOnRuns} AI answers to {report.questions.length} questions, asked 3
              times each, using {provider} ({report.model.model}). The scan ran on {formatDate(report.scanDate)}. AI
              answers vary, so results differ between scans and the score is best read as a range.
            </p>

            <footer className="pr-footer">
              <span>{agency.name ? `Prepared by ${agency.name}` : "Prepared with GhostRank"}</span>
              <span>Generated {formatDateTime(report.generatedAt)}</span>
            </footer>
          </div>
        </div>
      </section>
    </div>
  )
}
