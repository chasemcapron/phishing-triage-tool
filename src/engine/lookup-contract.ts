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
