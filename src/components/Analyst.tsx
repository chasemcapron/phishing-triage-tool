import { CHECKS } from '../engine/config'
import type { AuthResultsHeader, EmailDetails, Hop, LinkInfo } from '../engine'
import { CopyButton, formatBytes, ResultBadge } from './Common'
import { IconTriangleAlert } from './Icons'

const flagTitles = (flags: (keyof typeof CHECKS)[]) => flags.map((k) => CHECKS[k].title)

function Flags({ flags }: { flags: (keyof typeof CHECKS)[] }) {
  if (!flags.length) return <span className="muted">—</span>
  return (
    <ul className="flag-list">
      {flagTitles(flags).map((t) => (
        <li key={t}>
          <IconTriangleAlert className="icon icon-sm" />
          {t}
        </li>
      ))}
    </ul>
  )
}

export function SenderSummary({ email }: { email: EmailDetails }) {
  const rows: [string, string | null][] = [
    ['Subject', email.subject],
    ['From', email.from ? (email.from.name ? `"${email.from.name}" <${email.from.address}>` : email.from.address) : null],
    ['Reply-To', email.replyTo],
    ['Return-Path', email.returnPath],
    ['Message-ID', email.messageId],
    ['Date', email.date],
  ]
  return (
    <section className="panel" aria-labelledby="sender-heading">
      <h2 id="sender-heading">Message</h2>
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ? <code>{v}</code> : <span className="muted">not present</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function methodDetail(h: AuthResultsHeader | null, method: string): string {
  const m = h?.methods.find((x) => x.method === method)
  if (!m) return ''
  return Object.entries(m.props)
    .filter(([k]) => ['smtp.mailfrom', 'header.from', 'header.d', 'header.i', 'header.s', 'smtp.helo'].includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
}

export function AuthTable({ email }: { email: EmailDetails }) {
  const { auth } = email
  const others = auth.headers.filter((h) => !h.trusted)
  return (
    <section className="panel" aria-labelledby="auth-heading">
      <h2 id="auth-heading">Authentication</h2>
      {!auth.trusted ? (
        <p className="muted">No Authentication-Results header found.</p>
      ) : (
        <>
          <p className="small">
            Trusted header from <strong>{auth.provider}</strong>
            {auth.providerVerified ? ' (matches the server that received the message)' : ' (could not match it to the receiving server)'}.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Result</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {(['spf', 'dkim', 'dmarc'] as const).map((m) => (
                  <tr key={m}>
                    <th scope="row">{m.toUpperCase()}</th>
                    <td>
                      <ResultBadge result={auth[m]} />
                    </td>
                    <td>
                      <code>{methodDetail(auth.trusted, m) || '—'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {others.length > 0 && (
        <details className="raw">
          <summary>
            {others.length} other authentication header{others.length > 1 ? 's' : ''} (not trusted: may be forged or from earlier hops)
          </summary>
          <ul>
            {others.map((h, i) => (
              <li key={i}>
                <span className="tag">{h.kind === 'arc' ? 'ARC' : `Auth #${h.index + 1}`}</span> <code>{h.raw}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function delayText(h: Hop): string {
  if (h.delaySeconds === null) return ''
  const s = h.delaySeconds
  const abs = Math.abs(s)
  const v = abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.round(abs / 60)}m` : `${(abs / 3600).toFixed(1)}h`
  return s < 0 ? `−${v}` : `+${v}`
}

export function RelayTimeline({ hops }: { hops: Hop[] }) {
  return (
    <section className="panel" aria-labelledby="relay-heading">
      <h2 id="relay-heading">Relay path ({hops.length} hops)</h2>
      {!hops.length ? (
        <p className="muted">No Received headers.</p>
      ) : (
        <ol className="timeline">
          {hops.map((h) => {
            const backwards = h.delaySeconds !== null && h.delaySeconds < -300
            const slow = h.delaySeconds !== null && h.delaySeconds > 3600
            return (
              <li key={h.index} className={h.isBoundary ? 'boundary' : undefined}>
                <div className="hop-head">
                  <span className="hop-num">{h.index + 1}</span>
                  <code className="hop-route">
                    {h.from ?? '(local)'} → {h.by ?? '?'}
                  </code>
                  {h.isBoundary && <span className="tag tag-accent">Entered recipient's provider</span>}
                </div>
                <div className="hop-meta">
                  {h.fromIp && (
                    <span>
                      IP <code>{h.fromIp}</code> <span className="tag">{h.ipClass}</span>
                    </span>
                  )}
                  {h.protocol && <span>{h.protocol}</span>}
                  <span>{h.date ? new Date(h.date).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'no timestamp'}</span>
                  {h.delaySeconds !== null && (
                    <span className={backwards || slow ? 'delay delay-warn' : 'delay'}>
                      {(backwards || slow) && <IconTriangleAlert className="icon icon-sm" />}
                      {delayText(h)}
                      {backwards ? ' (earlier than previous hop)' : slow ? ' (long delay)' : ''}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export function LinksTable({ links }: { links: LinkInfo[] }) {
  if (!links.length) return null
  return (
    <section className="panel" aria-labelledby="links-table-heading">
      <div className="panel-head">
        <h2 id="links-table-heading">Links ({links.length})</h2>
        <CopyButton text={links.map((l) => l.defanged).join('\n')} label="Copy all" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Destination (defanged)</th>
              <th scope="col">Shown as</th>
              <th scope="col">Domain</th>
              <th scope="col">Flags</th>
              <th scope="col">
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.url} className={l.flags.length ? 'flagged' : undefined}>
                <td className="break">
                  <code>{l.defanged}</code>
                </td>
                <td className="break">{l.displayTexts.length ? l.displayTexts.join(' · ') : <span className="muted">—</span>}</td>
                <td>
                  <code>{l.registrableDomain ?? l.host ?? '—'}</code>
                  {l.unicodeHost !== l.host && (
                    <div className="small muted">
                      displays as <code>{l.unicodeHost}</code>
                    </div>
                  )}
                </td>
                <td>
                  <Flags flags={l.flags} />
                </td>
                <td>
                  <CopyButton text={l.defanged} label="Copy link" compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function AttachmentsTable({ email }: { email: EmailDetails }) {
  if (!email.attachments.length) return null
  return (
    <section className="panel" aria-labelledby="att-heading">
      <h2 id="att-heading">Attachments ({email.attachments.length})</h2>
      <p className="muted small">Hashed in your browser. Files are never uploaded; only the SHA-256 may be looked up.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Declared type</th>
              <th scope="col">Real type</th>
              <th scope="col">Size</th>
              <th scope="col">SHA-256</th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {email.attachments.map((a) => (
              <tr key={a.sha256 + a.filename} className={a.flags.length ? 'flagged' : undefined}>
                <td className="break">
                  <code>{a.filename}</code>
                  {a.archiveEntries && (
                    <div className="small muted">
                      contains: <code>{a.archiveEntries.slice(0, 10).join(', ')}</code>
                    </div>
                  )}
                </td>
                <td>
                  <code>{a.mimeType}</code>
                </td>
                <td>{a.detectedType ?? <span className="muted">unknown</span>}</td>
                <td>{formatBytes(a.size)}</td>
                <td className="hash">
                  <code title={a.sha256}>{a.sha256.slice(0, 16)}…</code>
                  <CopyButton text={a.sha256} label="Copy SHA-256" compact />
                </td>
                <td>
                  <Flags flags={a.flags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
