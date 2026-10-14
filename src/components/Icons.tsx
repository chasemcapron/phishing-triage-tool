// Inline SVG icons (no icon library; keeps the CSP at default-src 'self').
import type { ReactNode } from 'react'
import type { Severity, Verdict } from '../engine'

type IconProps = { className?: string; title?: string }

function Svg({ className, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ?? 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

export const IconOctagonAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" />
    <path d="M12 8v5M12 16.5v.01" />
  </Svg>
)
export const IconTriangleAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17v.01" />
  </Svg>
)
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8v.01" />
  </Svg>
)
export const IconShieldSearch = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="11.5" cy="11.5" r="2.5" />
    <path d="m13.5 13.5 2 2" />
  </Svg>
)
export const IconDot = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
  </Svg>
)
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Svg>
)
export const IconPumpkin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7.5c-1.6-1-3.4-1.2-5-.6C3.8 8 2.6 11 3.2 14.6 3.8 18.4 6.6 20.6 9.6 20c.9-.2 1.7-.5 2.4-.5s1.5.3 2.4.5c3 .6 5.8-1.6 6.4-5.4.6-3.6-.6-6.6-3.8-7.7-1.6-.6-3.4-.4-5 .6z" />
    <path d="M12 7.5V5q0-1.6 2-2.2M9.2 7.4c-1.5 3-1.5 9.4.4 12.5M14.8 7.4c1.5 3 1.5 9.4-.4 12.5" />
  </Svg>
)
export const IconLeaf = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 18.5C4 11 9 4.5 20 4c.4 10.6-5.6 16-13 15" />
    <path d="M3 21l11-11" />
  </Svg>
)
export const IconSnowflake = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
    <path d="M9.5 3.5 12 5.5l2.5-2M9.5 20.5 12 18.5l2.5 2M3.6 10.4 6.6 9.6l-.6-3M20.4 13.6l-3-.8.6 3M3.6 13.6l3-.8-.6 3M20.4 10.4l-3 .8.6-3" />
  </Svg>
)
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
    <path d="M19 16v4M17 18h4" />
  </Svg>
)
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Svg>
)
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
)

export function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  if (verdict === 'high') return <IconOctagonAlert className={className} />
  if (verdict === 'suspicious') return <IconTriangleAlert className={className} />
  return <IconShieldSearch className={className} />
}

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  if (severity === 'high') return <IconOctagonAlert className={className} />
  if (severity === 'medium') return <IconTriangleAlert className={className} />
  if (severity === 'low') return <IconInfo className={className} />
  return <IconDot className={className} />
}
