// VirusTotal API v3, GET lookups only (never submits URLs or files for scanning).
// Public API quota: 4 requests/minute, 500/day.
import type { ProviderResult, VirusTotalResult, VirusTotalStats } from '../../src/engine/lookup-contract.js'
import { TtlCache } from '../cache.js'
import { fetchWithTimeout, readJson, TimeoutError, type FetchLike } from '../http.js'
import { QuotaBudget, SlidingWindowLimiter } from '../rateLimit.js'

const API = 'https://www.virustotal.com/api/v3'
const GUI = 'https://www.virustotal.com/gui'
const FOUND_TTL = 12 * 3600_000
const NOT_FOUND_TTL = 6 * 3600_000
/** Full-URL reports are the most expensive use of the budget; cap them per request. */
const MAX_URL_LOOKUPS = 2

const cache = new TtlCache<VirusTotalResult>(5000)
const budget = new QuotaBudget(4, 500)
/**
 * Each network's share of the daily quota (uncached lookups only), so one script can't
 * spend the 500/day key and leave every other visitor with "limit reached".
 */
export const VT_PER_CLIENT_DAILY = 60
const perClient = new SlidingWindowLimiter([{ windowMs: 86_400_000, max: VT_PER_CLIENT_DAILY }])

export const VT_LIMIT_MESSAGE = 'VirusTotal limit reached, try again in a minute.'
export const VT_CLIENT_LIMIT_MESSAGE = "Your network has used today's share of VirusTotal lookups. The other checks still ran."

export interface VirusTotalDeps {
  fetch: FetchLike
  apiKey: string | undefined
  timeoutMs?: number
  now?: () => number
  cache?: TtlCache<VirusTotalResult>
  budget?: QuotaBudget
  /** Who is asking (client IP); their uncached lookups count against VT_PER_CLIENT_DAILY. */
  clientKey?: string
  clientLimiter?: SlidingWindowLimiter
}

interface Job {
  kind: VirusTotalResult['kind']
  indicator: string
  path: string
}

function stats(v: unknown): VirusTotalStats | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const s = v as Record<string, unknown>
  const n = (k: string) => (typeof s[k] === 'number' ? s[k] : 0)
  return { malicious: n('malicious'), suspicious: n('suspicious'), harmless: n('harmless'), undetected: n('undetected') }
}

function link(job: Job, id: unknown): string {
  if (job.kind === 'file') return `${GUI}/file/${job.indicator}/detection`
  if (job.kind === 'domain') return `${GUI}/domain/${job.indicator}`
  return typeof id === 'string' && /^[a-f0-9]{64}$/.test(id) ? `${GUI}/url/${id}/detection` : `${GUI}/home/url`
}

/**
 * Jobs in priority order: attachment hashes (strongest signal), then domains in the
 * client's priority order, then at most two full URLs.
 */
export function planJobs(hashes: string[], domains: string[], urls: string[]): Job[] {
  return [
    ...hashes.map((h): Job => ({ kind: 'file', indicator: h, path: `/files/${h}` })),
    ...domains.map((d): Job => ({ kind: 'domain', indicator: d, path: `/domains/${encodeURIComponent(d)}` })),
    ...urls.slice(0, MAX_URL_LOOKUPS).map((u): Job => ({ kind: 'url', indicator: u, path: `/urls/${Buffer.from(u).toString('base64url')}` })),
  ]
}

export async function lookupVirusTotal(
  input: { hashes: string[]; domains: string[]; urls: string[] },
  deps: VirusTotalDeps,
): Promise<ProviderResult<VirusTotalResult>> {
  if (!deps.apiKey) return { status: 'not_configured', message: 'VirusTotal is not configured.', results: [] }
  const jobs = planJobs(input.hashes, input.domains, input.urls)
  if (!jobs.length) return { status: 'skipped', results: [] }
  const now = deps.now ?? Date.now
  const store = deps.cache ?? cache
  const quota = deps.budget ?? budget
  const clients = deps.clientLimiter ?? perClient

  const results: VirusTotalResult[] = []
  const skipped: string[] = []
  let limited = false
  let clientLimited = false
  let failure: ProviderResult<VirusTotalResult>['status'] | null = null
  let failCode = 0

  for (const job of jobs) {
    const key = `${job.kind}:${job.indicator}`
    const cached = store.get(key, now())
    if (cached) {
      results.push(cached)
      continue
    }
    if (!limited && !failure && deps.clientKey && !clients.check(deps.clientKey, now()).ok) {
      limited = clientLimited = true
    }
    if (limited || failure || !quota.take(now())) {
      limited ||= !failure
      skipped.push(job.indicator)
      continue
    }
    let res: Response
    try {
      res = await fetchWithTimeout(
        deps.fetch,
        API + job.path,
        { method: 'GET', headers: { 'x-apikey': deps.apiKey, accept: 'application/json' } },
        deps.timeoutMs ?? 5000,
      )
    } catch (e) {
      failure = e instanceof TimeoutError ? 'timeout' : 'error'
      skipped.push(job.indicator)
      continue
    }
    if (res.status === 404) {
      const r: VirusTotalResult = { kind: job.kind, indicator: job.indicator, found: false }
      store.set(key, r, NOT_FOUND_TTL, now())
      results.push(r)
      continue
    }
    if (res.status === 429) {
      quota.exhaust(now())
      limited = true
      skipped.push(job.indicator)
      continue
    }
    if (!res.ok) {
      failure = 'error'
      failCode = res.status
      skipped.push(job.indicator)
      continue
    }
    const body = (await readJson(res)) as { data?: { id?: unknown; attributes?: Record<string, unknown> } } | null
    const attrs = body?.data?.attributes ?? {}
    const label = (attrs.popular_threat_classification as { suggested_threat_label?: unknown } | undefined)?.suggested_threat_label
    const r: VirusTotalResult = {
      kind: job.kind,
      indicator: job.indicator,
      found: true,
      stats: stats(attrs.last_analysis_stats),
      reputation: typeof attrs.reputation === 'number' ? attrs.reputation : undefined,
      link: link(job, body?.data?.id),
      label: typeof label === 'string' ? label : undefined,
    }
    store.set(key, r, FOUND_TTL, now())
    results.push(r)
  }

  if (failure && !results.length) {
    return {
      status: failure,
      message: failure === 'timeout' ? 'VirusTotal did not answer in time.' : `VirusTotal is unavailable right now${failCode ? ` (HTTP ${failCode})` : ''}.`,
      results,
      skipped,
    }
  }
  if (limited) return { status: 'rate_limited', message: clientLimited ? VT_CLIENT_LIMIT_MESSAGE : VT_LIMIT_MESSAGE, results, skipped }
  return { status: 'ok', results, ...(skipped.length ? { skipped } : {}) }
}
