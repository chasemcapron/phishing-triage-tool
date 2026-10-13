import { forwardRef } from 'react'
import { THRESHOLDS } from '../engine/config'
import type { Finding, Report } from '../engine'
import { CopyButton, SeverityBadge } from './Common'
import { VerdictFish } from './art/Fish'
import { IconInfo, VerdictIcon } from './Icons'

const VERDICT_SUMMARY: Record<Report['verdict'], string> = {
  high: 'Several strong warning signs. Treat this as a scam.',
  suspicious: 'Some warning signs. Do not tap links or reply until you have checked another way.',
  none: 'Nothing matched our checks, but that is not a guarantee. New scams can look clean.',
}

export const VerdictCard = forwardRef<HTMLHeadingElement, { report: Report; analyst: boolean }>(function VerdictCard(
  { report, analyst },
  headingRef,
) {
  return (
    <section className={`verdict verdict-${report.verdict}`} aria-labelledby="verdict-heading">
      <div className="verdict-top">
        <div className="verdict-text">
          <p className="verdict-eyebrow">Your catch</p>
          <div className="verdict-title">
            <VerdictIcon verdict={report.verdict} className="icon verdict-icon" />
            <h2 id="verdict-heading" ref={headingRef} tabIndex={-1} className="verdict-label">
              {report.verdictLabel}
            </h2>
          </div>
          <p className="verdict-summary">{VERDICT_SUMMARY[report.verdict]}</p>
        </div>
        <VerdictFish verdict={report.verdict} className="verdict-fish" />
      </div>
      {report.reasons.length > 0 && (
        <ul className="reasons">
          {report.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
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
  const isEmail = report.mode === 'email'
  if (report.verdict === 'none') {
    return (
      <section className="todo todo-none" aria-labelledby="todo-heading">
        <h2 id="todo-heading">What to do</h2>
        <ul>
          <li>If you weren't expecting it, don't use its links. Open the company's app or type its website address yourself.</li>
          <li>Never share passwords, one-time codes or card numbers in reply to a message.</li>
        </ul>
      </section>
    )
  }
  return (
    <section className="todo" aria-labelledby="todo-heading">
      <h2 id="todo-heading">What to do</h2>
      <ul>
        <li>
          <strong>Don't tap or open {isEmail ? 'its links or attachments' : 'the link'}</strong>, and don't reply.
        </li>
        <li>
          {isEmail
            ? 'Report it as phishing in your mail app (for example "Report phishing" in Gmail or Outlook), then delete it.'
            : 'Report it as junk in your Messages app, or forward the text to 7726 (SPAM) in the US, then delete it.'}
        </li>
        <li>
          Already entered card details? <strong>Call your bank using the number on the back of your card.</strong>
        </li>
        <li>Already entered a password? Change it on the real site, and anywhere else you reuse it.</li>
        {isEmail && <li>At work, report it to your IT or security team before deleting it.</li>}
      </ul>
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
          {f.evidence.length > 0 && (
            <ul className="evidence">
              {f.evidence.map((e) => (
                <li key={e}>
                  <code>{e}</code>
                </li>
              ))}
            </ul>
          )}
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
