import { forwardRef, type CSSProperties } from 'react'
import { adviceFor } from '../engine/advice'
import { THRESHOLDS } from '../engine/config'
import { friendSummary } from '../engine/export'
import type { Finding, Report } from '../engine'
import { CopyButton, SeverityBadge } from './Common'
import { SASH, VerdictFish } from './art/Fish'
import { IconInfo } from './Icons'
import { AttackChips, GoogleAdvisory, SourceNote } from './Reputation'

const VERDICT_SUMMARY: Record<Report['verdict'], string> = {
  high: 'Several strong warning signs. Treat this as a scam.',
  suspicious: 'Some warning signs. Do not tap links or reply until you have checked another way.',
  none: 'Nothing matched our checks, but that is not a guarantee. New scams can look clean.',
}

/**
 * Where each verdict fish's lip is, as fractions of its viewBox (x, y), plus its height/width
 * ratio, so the hook can sit in the mouth. Values come from the shapes in art/Fish.tsx.
 */
const MOUTH: Record<Report['verdict'], [number, number, number]> = {
  high: [0.215, 0.6, 136 / 160],
  suspicious: [0.235, 0.64, 130 / 150],
  none: [0.16, 0.58, 124 / 150],
}

export const VerdictCard = forwardRef<HTMLHeadingElement, { report: Report; analyst: boolean }>(function VerdictCard(
  { report, analyst },
  headingRef,
) {
  const [mouthX, mouthY, ratio] = MOUTH[report.verdict]
  const sash = SASH[report.verdict]
  const [main, sub] = report.verdictLabel.split(' — ')
  const sbFinding = report.findings.find((f) => f.source === 'google-safe-browsing')
  const catchVars = {
    '--mouth-x': mouthX,
    '--mouth-y': mouthY,
    '--fish-ratio': ratio,
    '--sash-x': sash.cx / sash.box[0],
    '--sash-y': sash.cy / sash.box[1],
    '--sash-w': sash.text / sash.box[0],
    '--sash-rot': `${sash.rot}deg`,
    '--label-len': main!.length,
  } as CSSProperties
  return (
    <section className={`verdict verdict-${report.verdict}`} aria-labelledby="verdict-heading">
      {/* The catch: the fish hangs from the fishing line by its lip, the verdict painted on its band. */}
      <div className="catch" style={catchVars}>
        <span className="catch-cord" aria-hidden="true" />
        <div className="catch-fish">
          <VerdictFish verdict={report.verdict} sash className="catch-fish__art" />
          <svg className="catch-hook" viewBox="0 0 24 36" aria-hidden="true" focusable="false">
            <circle className="fishing-hook__eye" cx="16" cy="4.5" r="3" />
            <path className="fishing-hook__metal" d="M16 7.5V26A5 5 0 0 1 6 26V20.5L9.4 23.6" />
            <path className="fishing-hook__shine" d="M17.4 11V22" />
          </svg>
          <span className="catch-mouth" aria-hidden="true" />
          <span className="catch-fizz" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h2 id="verdict-heading" ref={headingRef} tabIndex={-1} className="verdict-label catch-sash">
            <span className="catch-sash__main">{main}</span>
            {sub && (
              <>
                <span className="sr-only"> — </span>
                <span className="catch-sash__sub">{sub}</span>
              </>
            )}
          </h2>
        </div>
      </div>
      <p className="verdict-summary">{VERDICT_SUMMARY[report.verdict]}</p>
      {report.reasons.length > 0 && (
        <ul className="reasons" aria-label="Why">
          {report.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {sbFinding && report.reasons.includes(sbFinding.explanation) && <GoogleAdvisory threatTypes={sbFinding.threatTypes} />}
      {analyst && (
        <p className="verdict-meta">
          Risk score <strong>{report.score}</strong> · Suspicious at {THRESHOLDS.suspicious}, High at {THRESHOLDS.high} ·{' '}
          {report.findings.filter((f) => f.weight > 0).length} weighted findings
        </p>
      )}
    </section>
  )
})

export function WhatToDo({ report }: { report: Report }) {
  const advice = adviceFor(report)
  const link = report.links.find((l) => l.scheme === 'http' || l.scheme === 'https')
  return (
    <section className={report.verdict === 'none' ? 'todo todo-none' : 'todo'} aria-labelledby="todo-heading">
      <h2 id="todo-heading">What to do</h2>
      <ul>
        {advice.steps.map((s, i) => (
          <li key={s}>{i === 0 && report.verdict !== 'none' ? <strong>{s}</strong> : s}</li>
        ))}
      </ul>
      {advice.report.length > 0 && (
        <div className="todo-report">
          <h3>Report it</h3>
          <p className="small">Reporting gets the site blocked faster for everyone. These open the official forms in a new tab.</p>
          <div className="todo-actions">
            {advice.report.map((r) => (
              <a key={r.href} className="btn btn-secondary btn-sm" href={r.href} target="_blank" rel="noopener noreferrer">
                {r.label}
              </a>
            ))}
            {link && <CopyButton text={link.url} label="Copy the link for the form" />}
          </div>
        </div>
      )}
      <div className="todo-share">
        <CopyButton text={friendSummary(report)} label="Copy a summary to send someone" />
        <span className="small muted">Plain English, with the link made safe so it can't be tapped.</span>
      </div>
    </section>
  )
}

const CATEGORY_LABEL: Record<Finding['category'], string> = {
  auth: 'Authentication',
  sender: 'Sender',
  relay: 'Relay path',
  links: 'Links',
  attachments: 'Attachments',
  content: 'Content',
  reputation: 'Reputation',
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (!findings.length) {
    return <p className="muted">No findings. Every check ran and none matched.</p>
  }
  return (
    <ol className="findings">
      {findings.map((f) => (
        <li key={f.kind} className={`finding finding-${f.severity}`}>
          <div className="finding-head">
            <SeverityBadge severity={f.severity} />
            <span className="finding-title">{f.title}</span>
            <span className="finding-cat">{CATEGORY_LABEL[f.category]}</span>
            <span className="finding-weight" title="Points added to the risk score">
              {f.weight > 0 ? `+${f.weight}` : 'info'}
            </span>
          </div>
          <p className="finding-explain">{f.explanation}</p>
          <SourceNote finding={f} />
          {f.evidence.length > 0 && (
            <ul className="evidence">
              {f.evidence.map((e) => (
                <li key={e}>
                  <code>{e}</code>
                </li>
              ))}
            </ul>
          )}
          <AttackChips ids={f.attack} />
        </li>
      ))}
    </ol>
  )
}

export function LinkList({ report }: { report: Report }) {
  if (!report.links.length) return null
  const all = report.links.map((l) => l.defanged).join('\n')
  return (
    <section className="panel" aria-labelledby="links-heading">
      <div className="panel-head">
        <h2 id="links-heading">Links found ({report.links.length})</h2>
        <CopyButton text={all} label="Copy all" />
      </div>
      <p className="muted small">
        <IconInfo className="icon icon-sm" /> Shown defanged so they can't be tapped by accident. Never visited by this tool.
      </p>
      <ul className="link-list">
        {report.links.map((l) => (
          <li key={l.url} className={l.flags.length ? 'flagged' : undefined}>
            <code className="defanged">{l.defanged}</code>
            <CopyButton text={l.defanged} label="Copy link" compact />
          </li>
        ))}
      </ul>
    </section>
  )
}
