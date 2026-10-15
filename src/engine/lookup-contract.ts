// Shared contract for POST /api/lookup. Imported by the browser engine and the server,
// so it must not reference DOM types.

export type ProviderStatus = 'ok' | 'not_configured' | 'rate_limited' | 'timeout' | 'error' | 'skipped'

/** Everything that leaves the browser: web links, registrable domains and attachment hashes. */
export interface LookupRequest {
  urls: string[]
  domains: string[]
  hashes: string[]
}

export const LOOKUP_LIMITS = {
  urls: 25,
  domains: 25,
  hashes: 10,
  urlLength: 2048,
  bodyBytes: 32 * 1024,
} as const

export interface SafeBrowsingHit {
  /** The submitted URL the match applies to. */
  url: string
  threatTypes: string[]
}

export interface VirusTotalStats {
  malicious: number
  suspicious: number
  harmless: number
  undetected: number
}

export interface VirusTotalResult {
  kind: 'url' | 'domain' | 'file'
  indicator: string
  /** False when VirusTotal has no report (404), which is a neutral result. */
  found: boolean
  stats?: VirusTotalStats
  reputation?: number
  /** Link to the report on virustotal.com. */
  link?: string
  /** Suggested threat label for files, when VirusTotal has one. */
  label?: string
}

export interface UrlhausResult {
  kind: 'url' | 'host' | 'payload'
  indicator: string
  listed: boolean
  urlStatus?: string
  threat?: string
  tags?: string[]
  reference?: string
}

export interface RdapResult {
  domain: string
  status: 'ok' | 'unknown' | 'not_registered'
  /** ISO registration date, when the registry publishes one. */
  registered?: string
  ageDays?: number
  /** The registry or registrar has suspended the domain ("client hold" / "server hold"), usually after abuse reports. */
  hold?: boolean
}

export interface ProviderResult<T> {
  status: ProviderStatus
  /** Short, user-facing explanation for any status other than ok. */
  message?: string
  results: T[]
  /** Indicators not checked (budget or caps). */
  skipped?: string[]
}

export interface LookupResponse {
  safeBrowsing: ProviderResult<SafeBrowsingHit>
  virusTotal: ProviderResult<VirusTotalResult>
  urlhaus: ProviderResult<UrlhausResult>
  rdap: ProviderResult<RdapResult>
}

export type ProviderName = keyof LookupResponse

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  safeBrowsing: 'Google Safe Browsing',
  virusTotal: 'VirusTotal',
  urlhaus: 'URLhaus',
  rdap: 'Domain age (RDAP)',
}

/** Reads the registration date out of an RDAP domain answer (RFC 9083 events). */
export function rdapFromBody(domain: string, body: unknown, now: number): RdapResult {
  const events = (body as { events?: { eventAction?: unknown; eventDate?: unknown }[] } | null)?.events
  const reg = Array.isArray(events) ? events.find((e) => e?.eventAction === 'registration')?.eventDate : undefined
  const t = typeof reg === 'string' ? Date.parse(reg) : NaN
  const statuses = (body as { status?: unknown } | null)?.status
  const hold = Array.isArray(statuses) && statuses.some((s) => s === 'client hold' || s === 'server hold')
  const held = hold ? { hold } : {}
  if (Number.isNaN(t)) return { domain, status: 'unknown', ...held }
  return { domain, status: 'ok', registered: new Date(t).toISOString(), ageDays: Math.max(0, Math.floor((now - t) / 86_400_000)), ...held }
}
