// IOC export and the Markdown ticket summary. Every indicator is defanged; any text that came
// from the message is escaped so it can't inject links, images or HTML into a ticketing system.
import { ATTACK_VERSION, reportTechniques } from './attack'
import type { Report } from './types'
import { defangEmail, defangHost, defangUrl } from './util/defang'

/**
 * Escapes Markdown/HTML control characters in untrusted text, then defangs any URLs and
 * host names so ticketing systems can't auto-link attacker-controlled domains.
 */
export function mdEscape(s: string): string {
  return defangText(s.replace(/[\\`*_{}[\]<>|#~!]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' '))
}

export function defangText(s: string): string {
  return s
    .replace(/\bhttp(s?):\/\//gi, 'hxxp$1[://]')
    .replace(/\b(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,63}\b/gu, (host) => host.replace(/\./g, '[.]'))
}

/** Inline code span that can't be broken out of, whatever backticks the text contains. */
export function mdCode(s: string): string {
  const clean = defangText(s.replace(/\r?\n/g, ' '))
  const longest = Math.max(0, ...(clean.match(/`+/g) ?? []).map((m) => m.length))
  const fence = '`'.repeat(longest + 1)
  return `${fence} ${clean} ${fence}`
}

export function defangedIocList(report: Report): string {
  const { iocs } = report
  const lines = [
    ...iocs.urls.map((u) => `url\t${defangUrl(u)}`),
    ...iocs.domains.map((d) => `domain\t${defangHost(d)}`),
    ...iocs.ips.map((ip) => `ip\t${defangHost(ip)}`),
    ...iocs.emails.map((e) => `email\t${defangEmail(e)}`),
    ...iocs.hashes.map((h) => `sha256\t${h}`),
  ]
  return lines.join('\n')
}

export function iocJson(report: Report): string {
  const ind = (type: string, value: string, defanged: string) => ({ type, value, defanged })
  const doc = {
    tool: 'Gone Phishing',
    generatedAt: new Date().toISOString(),
    mode: report.mode,
    verdict: report.verdict,
    verdictLabel: report.verdictLabel,
    score: report.score,
    subject: report.email?.subject ?? null,
    indicators: [
      ...report.iocs.urls.map((u) => ind('url', u, defangUrl(u))),
      ...report.iocs.domains.map((d) => ind('domain', d, defangHost(d))),
      ...report.iocs.ips.map((i) => ind('ip', i, defangHost(i))),
      ...report.iocs.emails.map((e) => ind('email', e, defangEmail(e))),
      ...report.iocs.hashes.map((h) => ind('sha256', h, h)),
    ],
    findings: report.findings.map((f) => ({
      kind: f.kind,
      title: f.title,
      severity: f.severity,
      weight: f.weight,
      explanation: f.explanation,
      evidence: f.evidence,
      attack: f.attack,
      ...(f.source ? { source: f.source } : {}),
    })),
    attack: { version: ATTACK_VERSION, techniques: reportTechniques(report) },
    reputation: report.reputation ?? null,
  }
  return JSON.stringify(doc, null, 2)
}

const ACTIONS: Record<Report['verdict'], string[]> = {
  high: [
    'Block the sender address/domain and the listed URLs and domains at the mail gateway and web proxy.',
    'Search for and purge similar messages from other mailboxes.',
    'Confirm with the recipient whether they clicked or replied; if credentials were entered, reset them, revoke sessions and review sign-in logs/MFA.',
    'If an attachment was opened, isolate the device and run an EDR scan.',
    'Report the message as phishing to the mail provider.',
  ],
  suspicious: [
    'Do not interact with the links or attachments until verified out-of-band.',
    'Verify the request with the purported sender using a known-good contact method.',
    'Escalate to the security team if the sender cannot be verified; consider blocking the listed domains.',
  ],
  none: [
    'No action required based on these checks; the absence of signals is not proof of legitimacy.',
    'If the message was unexpected, verify with the sender through a known-good channel.',
  ],
}

export function ticketSummary(report: Report): string {
  const lines: string[] = []
  const e = report.email
  lines.push(`## Phishing triage: ${report.verdictLabel}`)
  lines.push('')
  lines.push(`- **Verdict:** ${report.verdictLabel} (risk score ${report.score})`)
  lines.push(`- **Input:** ${report.mode === 'email' ? 'email' : 'text message / link'}`)
  if (e) {
    if (e.subject) lines.push(`- **Subject:** ${mdCode(e.subject)}`)
    if (e.from) lines.push(`- **From:** ${mdCode(e.from.name ? `${e.from.name} <${defangEmail(e.from.address)}>` : defangEmail(e.from.address))}`)
    if (e.replyTo) lines.push(`- **Reply-To:** ${mdCode(defangEmail(e.replyTo))}`)
    if (e.date) lines.push(`- **Date:** ${mdCode(e.date)}`)
    lines.push(`- **Authentication (${mdEscape(e.auth.provider ?? 'unknown provider')}):** SPF ${e.auth.spf ?? 'none'}, DKIM ${e.auth.dkim ?? 'none'}, DMARC ${e.auth.dmarc ?? 'none'}`)
    const boundary = e.hops.find((h) => h.isBoundary)
    if (boundary?.fromIp) lines.push(`- **Sending server:** ${mdCode(`${boundary.from ?? '?'} [${defangHost(boundary.fromIp)}]`)}`)
  }
  if (report.reputation?.state === 'done') {
    lines.push(`- **Online checks:** ${report.reputation.providers.map((p) => `${p.name}: ${p.status}`).join('; ')}`)
  }
  lines.push('')
  lines.push('### Key findings')
  const key = report.findings.filter((f) => f.weight > 0 || f.forceHigh).slice(0, 8)
  if (!key.length) lines.push('- None of the checks matched.')
  for (const f of key) {
    lines.push(`- **${mdEscape(f.title)}** (${f.severity}, +${f.weight}): ${mdEscape(f.explanation)}`)
    for (const ev of f.evidence.slice(0, 3)) lines.push(`  - ${mdCode(ev)}`)
  }
  const iocs = defangedIocList(report)
  lines.push('')
  lines.push('### Indicators (defanged)')
  if (iocs) {
    lines.push('```text')
    lines.push(iocs.replace(/`/g, "'"))
    lines.push('```')
  } else lines.push('- None extracted.')
  const techniques = reportTechniques(report)
  lines.push('')
  lines.push(`### MITRE ATT&CK (${ATTACK_VERSION})`)
  if (!techniques.length) lines.push('- None mapped.')
  for (const t of techniques) lines.push(`- [${t.id} ${t.name}](${t.url}) (${t.matrix}, ${t.tactic})`)
  lines.push('')
  lines.push('### Recommended actions')
  ACTIONS[report.verdict].forEach((a, i) => lines.push(`${i + 1}. ${a}`))
  lines.push('')
  lines.push('_Generated by Gone Phishing. Verdicts are advisory; heuristics can produce false positives and reputation feeds lag behind new phishing sites._')
  return lines.join('\n')
}
