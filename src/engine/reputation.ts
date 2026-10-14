// Browser side of online checks: decide exactly what leaves the browser, then fold the
// provider results back into the report as findings (re-scored, with ATT&CK tags).
import { buildReport } from './analyze'
import { CHECKS, LIMITS, type FindingKind } from './config'
import { tldOf } from './checks/links'
import { FREE_WEBMAIL, RISKY_TLDS } from './data/lists'
import { FindingSet } from './findings'
import { LOOKUP_LIMITS, PROVIDER_LABELS, type LookupRequest, type LookupResponse, type ProviderName } from './lookup-contract'
import type { LinkInfo, Report, ReputationSummary } from './types'
import { defangHost, defangUrl } from './util/defang'
import { domainOfEmail, registrable } from './util/domain'

export { GOOGLE_ATTRIBUTION, learnMoreUrl } from './attribution'

/** Query strings and fragments often carry personal tokens (password resets, tracking IDs). */
export function stripUrl(url: string, stripQuery = true): string {
  try {
    const u = new URL(url)
    u.username = ''
    u.password = ''
    if (stripQuery) {
      u.search = ''
      u.hash = ''
    }
    return u.href
  } catch {
    return url
  }
}

const priority = (l: LinkInfo) => l.flags.reduce((sum, k) => sum + CHECKS[k].weight, 0)
const webLinks = (r: Report) => r.links.filter((l) => l.scheme === 'http' || l.scheme === 'https')

/** Exactly what will be sent: most suspicious first, deduplicated, capped. */
export function buildLookupRequest(report: Report, opts: { stripQuery?: boolean } = {}): LookupRequest {
  const strip = opts.stripQuery ?? true
  const links = webLinks(report)
    .map((l, i) => ({ l, i, p: priority(l) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.l)
  const urls = [...new Set(links.map((l) => stripUrl(l.url, strip)))].slice(0, LOOKUP_LIMITS.urls)
  const senderDomains = report.email ? [domainOfEmail(report.email.from?.address), domainOfEmail(report.email.replyTo)].map((d) => registrable(d)) : []
  const domains = [...new Set([...links.map((l) => l.registrableDomain), ...senderDomains])]
    .filter((d): d is string => Boolean(d) && !FREE_WEBMAIL.has(d!))
    .slice(0, LOOKUP_LIMITS.domains)
  const hashes = [...new Set((report.email?.attachments ?? []).map((a) => a.sha256))].slice(0, LOOKUP_LIMITS.hashes)
  return { urls, domains, hashes }
}

export function isEmptyRequest(req: LookupRequest): boolean {
  return !req.urls.length && !req.domains.length && !req.hashes.length
}

const BRANDISH: FindingKind[] = ['link-lookalike', 'link-combosquat', 'link-brand-subdomain', 'link-brand-tld', 'link-brand-mention']

function brandFor(report: Report, link: LinkInfo): string | null {
  for (const f of report.findings) {
    if (!BRANDISH.includes(f.kind)) continue
    for (const e of f.evidence) {
      if (!e.includes(link.defanged)) continue
      const m = /: ([^)]+)\)$/.exec(e) ?? /^([^→]+) →/.exec(e)
      if (m) return m[1]!.trim()
    }
  }
  return null
}

const ago = (days: number) => (days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`)

function sbDescription(types: string[]): string {
  if (types.includes('SOCIAL_ENGINEERING')) return 'suspected phishing (social engineering)'
  if (types.includes('MALWARE')) return 'a site that may host malware'
  if (types.includes('UNWANTED_SOFTWARE')) return 'a site that may host unwanted software'
  return 'a potentially harmful site'
}

function summarize(res: LookupResponse, req: LookupRequest): ReputationSummary {
  return {
    state: 'done',
    providers: (Object.keys(PROVIDER_LABELS) as ProviderName[]).map((p) => ({
      name: PROVIDER_LABELS[p],
      status: res[p].status,
      ...(res[p].message ? { message: res[p].message } : {}),
    })),
    sent: { urls: req.urls.length, domains: req.domains.length, hashes: req.hashes.length },
    checkedAt: new Date().toISOString(),
  }
}

export function offReputation(state: 'off' | 'failed', message?: string): ReputationSummary {
  return {
    state,
    providers: message ? [{ name: 'Online checks', status: 'error', message }] : [],
    sent: { urls: 0, domains: 0, hashes: 0 },
    checkedAt: new Date().toISOString(),
  }
}

/** Returns a new report with reputation findings merged in and the verdict recomputed. */
export function applyReputation(report: Report, res: LookupResponse, req: LookupRequest, opts: { stripQuery?: boolean } = {}): Report {
  const strip = opts.stripQuery ?? true
  const r = structuredClone(report)
  const links = webLinks(r)
  const fs = new FindingSet()
  const linksForUrl = (url: string) => links.filter((l) => stripUrl(l.url, strip) === url)
  const linksForDomain = (d: string) => links.filter((l) => l.registrableDomain === d)
  const rep = (l: LinkInfo) => (l.reputation ??= {})
  const flag = (l: LinkInfo, k: FindingKind) => {
    if (!l.flags.includes(k)) l.flags.push(k)
  }

  // Google Safe Browsing: advisory wording, attribution handled by the UI via `source`.
  // Repeat hits merge into one finding, so word it for the most relevant threat across all hits.
  const allSbTypes = [...new Set(res.safeBrowsing.results.flatMap((h) => h.threatTypes))]
  for (const hit of res.safeBrowsing.results) {
    const ls = linksForUrl(hit.url)
    for (const l of ls) {
      rep(l).safeBrowsing = hit.threatTypes
      flag(l, 'rep-safe-browsing')
    }
    const shown = ls[0]?.defanged ?? defangUrl(hit.url)
    fs.add(
      'rep-safe-browsing',
      `Google Safe Browsing lists ${res.safeBrowsing.results.length > 1 ? 'links in this message' : 'this link'} as ${sbDescription(allSbTypes)}.`,
      `${shown} (${hit.threatTypes.join(', ')})`,
      { forceHigh: true, source: 'google-safe-browsing', threatTypes: hit.threatTypes },
    )
  }

  // VirusTotal: ≥ N engines saying malicious is a known-bad hit; fewer is a weaker signal.
  for (const v of res.virusTotal.results) {
    if (!v.found || !v.stats) continue
    const { malicious, suspicious } = v.stats
    const summary = { malicious, suspicious, link: v.link, found: true }
    if (v.kind === 'file') {
      const att = r.email?.attachments.find((a) => a.sha256 === v.indicator)
      if (att) att.virusTotal = { ...summary, label: v.label }
    } else {
      const ls = v.kind === 'domain' ? linksForDomain(v.indicator) : linksForUrl(v.indicator)
      ls.forEach((l) => (rep(l).virusTotal = summary))
    }
    const name =
      v.kind === 'file'
        ? (r.email?.attachments.find((a) => a.sha256 === v.indicator)?.filename ?? 'an attachment')
        : v.kind === 'domain'
          ? defangHost(v.indicator)
          : defangUrl(v.indicator)
    const evidence = `${v.kind} ${v.kind === 'url' ? defangUrl(v.indicator) : v.kind === 'domain' ? defangHost(v.indicator) : v.indicator}: ${malicious} malicious, ${suspicious} suspicious${v.label ? ` (${v.label})` : ''}`
    const trusted = (v.reputation ?? 0) >= LIMITS.vtTrustedReputation
    if (malicious >= LIMITS.vtMaliciousEngines && !trusted) {
      fs.add('rep-virustotal-malicious', `${malicious} security vendors on VirusTotal flag ${name} as malicious.`, evidence, {
        forceHigh: true,
        source: 'virustotal',
      })
    } else if ((malicious >= 1 || suspicious >= 2) && (v.reputation ?? 0) <= 0) {
      fs.add('rep-virustotal-suspicious', `A few security vendors on VirusTotal flag ${name} as malicious or suspicious.`, evidence, { source: 'virustotal' })
    }
  }

  // URLhaus: listed malware-distribution URLs, hosts and payloads.
  for (const u of res.urlhaus.results) {
    if (!u.listed) continue
    if (u.kind === 'payload') {
      const att = r.email?.attachments.find((a) => a.sha256 === u.indicator)
      if (att) att.urlhaus = { threat: u.threat, reference: u.reference }
    } else {
      const ls = u.kind === 'host' ? linksForDomain(u.indicator) : linksForUrl(u.indicator)
      ls.forEach((l) => {
        rep(l).urlhaus = { status: u.urlStatus, threat: u.threat, reference: u.reference }
        flag(l, 'rep-urlhaus')
      })
    }
    const what =
      u.kind === 'payload'
        ? 'this attachment as known malware'
        : u.kind === 'host'
          ? `${defangHost(u.indicator)} as a site that has spread malware`
          : 'this link as a malware download'
    fs.add(
      'rep-urlhaus',
      `URLhaus (abuse.ch) lists ${what}.`,
      `${u.kind} ${u.kind === 'url' ? defangUrl(u.indicator) : u.kind === 'host' ? defangHost(u.indicator) : u.indicator}${u.threat ? ` (${u.threat})` : ''}${u.urlStatus ? `, ${u.urlStatus}` : ''}`,
      { forceHigh: true, source: 'urlhaus' },
    )
  }

  // Domain age: newly registered domains are a strong phishing signal.
  const senderDomain = registrable(domainOfEmail(r.email?.from?.address))
  for (const d of res.rdap.results) {
    if (d.status !== 'ok' || d.ageDays === undefined) continue
    const ls = linksForDomain(d.domain)
    ls.forEach((l) => {
      rep(l).domainAgeDays = d.ageDays
      rep(l).domainRegistered = d.registered
    })
    if (d.ageDays >= (RISKY_TLDS.has(tldOf(d.domain)) ? LIMITS.newRiskyTldDomainDays : LIMITS.newDomainDays)) continue
    ls.forEach((l) => flag(l, 'domain-new'))
    const brand = ls.map((l) => brandFor(r, l)).find(Boolean)
    const explanation = brand
      ? `This claims to be from ${brand}, but the link goes to a domain registered ${ago(d.ageDays)}.`
      : d.domain === senderDomain && !ls.length
        ? `The sender's domain (${d.domain}) was registered ${ago(d.ageDays)}.`
        : `The link goes to ${d.domain}, a domain registered ${ago(d.ageDays)}.`
    fs.add('domain-new', explanation, `${defangHost(d.domain)} registered ${d.registered?.slice(0, 10) ?? '?'} (${d.ageDays} days)`, { source: 'rdap' })
  }

  const kept = r.findings.filter((f) => f.category !== 'reputation')
  const merged = [...kept, ...fs.list()].sort((a, b) => b.weight - a.weight)
  return { ...buildReport(r.mode, merged, r.links, r.email), reputation: summarize(res, req) }
}
