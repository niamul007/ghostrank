// ──────────────────────────────────────────
// Minimal line-icon set — consistent 20px stroke icons, no icon library.
// ──────────────────────────────────────────
import type { SVGProps } from "react"

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function GhostMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" {...props}>
      <path
        fill="currentColor"
        d="M16 3c-6.075 0-11 4.925-11 11v13.2c0 .84.99 1.29 1.62.735l2.4-2.13a1 1 0 0 1 1.33 0l2.15 1.91a1 1 0 0 0 1.33 0l2.17-1.93a1 1 0 0 1 1.33 0l2.17 1.93a1 1 0 0 0 1.33 0l2.15-1.91a1 1 0 0 1 1.33 0l2.4 2.13c.63.555 1.62.105 1.62-.735V14c0-6.075-4.925-11-11-11Z"
      />
      <circle cx="12" cy="15" r="1.8" fill="var(--bg)" />
      <circle cx="20" cy="15" r="1.8" fill="var(--bg)" />
    </svg>
  )
}

export function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="8" rx="1.3" />
      <rect x="11" y="2.5" width="6.5" height="5" rx="1.3" />
      <rect x="11" y="9.5" width="6.5" height="8" rx="1.3" />
      <rect x="2.5" y="12.5" width="6.5" height="5" rx="1.3" />
    </svg>
  )
}

export function IconClients(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="7.2" cy="6.2" r="2.8" />
      <path d="M2 17c0-3 2.3-5 5.2-5s5.2 2 5.2 5" />
      <circle cx="14.3" cy="7" r="2.1" />
      <path d="M12.8 12.3c2.4.2 4.2 1.9 4.2 4.7" />
    </svg>
  )
}

export function IconScans(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6.5V3.8c0-.7.6-1.3 1.3-1.3H7" />
      <path d="M13 2.5h2.7c.7 0 1.3.6 1.3 1.3v2.7" />
      <path d="M17 13.5v2.7c0 .7-.6 1.3-1.3 1.3H13" />
      <path d="M7 17.5H4.3C3.6 17.5 3 16.9 3 16.2v-2.7" />
      <circle cx="10" cy="10" r="3.4" />
      <path d="m12.4 12.4 2.1 2.1" />
    </svg>
  )
}

export function IconReports(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 2.5h6l3 3v11.3a.7.7 0 0 1-.7.7h-8.6a.7.7 0 0 1-.7-.7V3.2a.7.7 0 0 1 .7-.7Z" />
      <path d="M11.5 2.5v3h3" />
      <path d="M7 11.2v3M10 9.4v4.8M13 12.6v1.6" />
    </svg>
  )
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 17.5h-3a1.3 1.3 0 0 1-1.3-1.3V3.8a1.3 1.3 0 0 1 1.3-1.3h3" />
      <path d="M12.8 14 17 10l-4.2-4" />
      <path d="M17 10H7.3" />
    </svg>
  )
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3.5v13M3.5 10h13" />
    </svg>
  )
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 5.5h13" />
      <path d="M7 5.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 4v1.5" />
      <path d="M5.5 5.5 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.5" />
      <path d="M8.3 9v5M11.7 9v5" />
    </svg>
  )
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12.5 3.5 16.5 7.5 7 17H3V13Z" />
    </svg>
  )
}

export function IconArrowLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 10h-13" />
      <path d="m8.5 4.5-5.5 5.5 5.5 5.5" />
    </svg>
  )
}

export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10h13" />
      <path d="m11.5 4.5 5.5 5.5-5.5 5.5" />
    </svg>
  )
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 10a6.5 6.5 0 1 1-2-4.7" />
      <path d="M16.5 2.5v4h-4" />
    </svg>
  )
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m3.5 10.5 4 4 9-9" />
    </svg>
  )
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m4 4 12 12M16 4 4 16" />
    </svg>
  )
}
