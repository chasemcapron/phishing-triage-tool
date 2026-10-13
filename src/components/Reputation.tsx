import { TECHNIQUES, reportTechniques, ATTACK_VERSION } from '../engine/attack'
import { GOOGLE_ATTRIBUTION, learnMoreUrl } from '../engine/attribution'
import { defangedIocList, iocJson, ticketSummary } from '../engine/export'
import type { Finding, Report } from '../engine'
import { CopyButton } from './Common'
import { IconInfo } from './Icons'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const

const STATUS_TEXT: Record<string, string> = {
  ok: 'checked',
  not_configured: 'not configured',
  rate_limited: 'limit reached',
  timeout: 'timed out',
  error: 'unavailable',
  skipped: 'nothing to check',
}

/** Where the online checks stand: running, off, failed, or each provider's status. */
export function ReputationStatus({ report, checking }: { report: Report; checking: boolean }) {
  const rep = report.reputation
  let body
  if (checking) {
    body = (
      <p className="rep-line" role="status">
        <span className="rep-spinner" aria-hidden="true" /> Checking Google Safe Browsing, VirusTotal, URLhaus and domain age…
      </p>
    )
  } else if (!rep) {
    body = <p className="rep-line muted">Nothing to look up online (no links or attachments).</p>
  } else if (rep.state === 'off') {
    body = <p className="rep-line muted">Online checks are off, so only the local checks ran.</p>
  } else if (rep.state === 'failed') {
    body = <p className="rep-line">{rep.providers[0]?.message ?? 'Online checks are unavailable right now.'}</p>
  } else {
    body = (
      <>
        <ul className="rep-providers">
          {rep.providers.map((p) => (
            <li key={p.name} className={`rep-${p.status}`}>
              <span className="rep-name">{p.name}</span>
              <span className="rep-pill">{STATUS_TEXT[p.status] ?? p.status}</span>
              {p.message && p.status !== 'ok' && <span className="rep-msg">{p.message}</span>}
            </li>
          ))}
        </ul>
        <p className="small muted">
          Sent {rep.sent.urls} link{rep.sent.urls === 1 ? '' : 's'} (without ?query parts), {rep.sent.domains} domain
          {rep.sent.domains === 1 ? '' : 's'} and {rep.sent.hashes} file fingerprint{rep.sent.hashes === 1 ? '' : 's'}. Nothing else left your browser.
        </p>
      </>
    )
  }
  return (
    <section className="panel rep-panel" aria-labelledby="rep-heading">
      <h2 id="rep-heading">Online checks</h2>
      {body}
    </section>
  )
}

/** Required with every warning that came from Safe Browsing data (and only those). */
export function GoogleAdvisory({ threatTypes }: { threatTypes?: string[] }) {
  return (
    <div className="advisory">
      <p>
        <a href={GOOGLE_ATTRIBUTION.href} {...ext}>
          {GOOGLE_ATTRIBUTION.text}
        </a>{' '}
        ·{' '}
        <a href={learnMoreUrl(threatTypes)} {...ext}>
          Learn more about this threat
        </a>
      </p>
      <p className="advisory-note">{GOOGLE_ATTRIBUTION.disclaimer}</p>
    </div>
  )
}

/** Source line for non-Google reputation findings. */
export function SourceNote({ finding }: { finding: Finding }) {
  if (finding.source === 'google-safe-browsing') return <GoogleAdvisory threatTypes={finding.threatTypes} />
  if (finding.source === 'virustotal') return <p className="source-note">Results from VirusTotal.</p>
  if (finding.source === 'urlhaus') return <p className="source-note">Data: URLhaus by abuse.ch.</p>
  if (finding.source === 'rdap') return <p className="source-note">Registration date from the domain registry (RDAP).</p>
  return null
}

export function AttackChips({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <ul className="attack-chips" aria-label="MITRE ATT&CK techniques">
      {ids.map((id) => {
        const t = TECHNIQUES[id]
        if (!t) return null
        return (
          <li key={id}>
            <a className="attack-chip" href={t.url} title={`${t.name} (${t.tactic})`} {...ext}>
              {id}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function DownloadJsonButton({ report }: { report: Report }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => {
        const blob = new Blob([iocJson(report)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gone-phishing-${report.verdict}-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}
    >
      Download JSON
    </button>
  )
}

/** IOC export, ticket summary and the ATT&CK roll-up (analyst view). */
export function ExportPanel({ report }: { report: Report }) {
  const techniques = reportTechniques(report)
  return (
    <section className="panel" aria-labelledby="export-heading">
      <h2 id="export-heading">Export</h2>
      <div className="export-actions">
        <CopyButton text={ticketSummary(report)} label="Copy ticket summary" />
        <CopyButton text={defangedIocList(report) || '(no indicators)'} label="Copy defanged IOCs" />
        <CopyButton text={iocJson(report)} label="Copy JSON" />
        <DownloadJsonButton report={report} />
      </div>
      <h3 className="export-sub">MITRE ATT&amp;CK</h3>
      {techniques.length ? (
        <ul className="attack-list">
          {techniques.map((t) => (
            <li key={t.id}>
              <a href={t.url} {...ext}>
                <span className="attack-chip">{t.id}</span> {t.name}
              </a>{' '}
              <span className="muted small">
                {t.matrix} · {t.tactic}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No techniques mapped.</p>
      )}
      <p className="muted small">
        <IconInfo className="icon icon-sm" /> {ATTACK_VERSION}. The ticket summary defangs every indicator and escapes message text.
      </p>
    </section>
  )
}
