import { useEffect, useRef, useState } from 'react'
import { useOnline } from '../online'
import type { Severity } from '../engine'
import { IconCheck, IconCopy, IconLock, SeverityIcon } from './Icons'

const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' }

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge sev-${severity}`}>
      <SeverityIcon severity={severity} className="icon icon-sm" />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

/** Result badge for SPF/DKIM/DMARC values: color plus a text label. */
export function ResultBadge({ result }: { result: string | null }) {
  const r = result ?? 'none'
  const sev: Severity = r === 'pass' ? 'info' : r === 'fail' ? 'high' : r === 'softfail' ? 'medium' : 'low'
  return (
    <span className={`badge result-${r === 'pass' ? 'pass' : `sev-${sev}`}`}>
      {r === 'pass' ? <IconCheck className="icon icon-sm" /> : <SeverityIcon severity={sev} className="icon icon-sm" />}
      {r}
    </span>
  )
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without the async clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.className = 'sr-only'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function CopyButton({ text, label = 'Copy', compact = false }: { text: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className={compact ? 'btn btn-ghost btn-icon' : 'btn btn-secondary btn-sm'}
      onClick={async () => {
        if (await writeClipboard(text)) {
          setCopied(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 1800)
        }
      }}
      aria-label={compact ? `${label}: ${text}` : undefined}
    >
      {copied ? <IconCheck className="icon icon-sm" /> : <IconCopy className="icon icon-sm" />}
      {!compact && <span>{copied ? 'Copied' : label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}

/** Segmented two-option switch (Simple / Analyst). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function PrivacyNote() {
  const { online, setOnline } = useOnline()
  return (
    <div className="privacy">
      <IconLock className="icon icon-sm" />
      <div className="privacy-body">
        <p>
          Your message is analyzed in your browser and links are never opened.{' '}
          {online ? (
            <>
              For online checks, only the links (without anything after <code>?</code> or <code>#</code>) and their domains are
              sent to Google Safe Browsing, VirusTotal, URLhaus and domain registries, which may keep them. If a registry
              won't answer our server, your browser asks it for the domain's age directly. The message itself never leaves
              your device. Reputation data can be incomplete or wrong.
            </>
          ) : (
            <>Online checks are off: nothing leaves your device.</>
          )}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          className="online-switch"
          onClick={() => setOnline(!online)}
        >
          <span className="online-switch__track" aria-hidden="true">
            <span className="online-switch__thumb" />
          </span>
          Online reputation checks: {online ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
