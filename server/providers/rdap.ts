// Domain registration date via RDAP. rdap.org redirects to the registry's RDAP server
// for the TLD; we query the registry about the domain and never contact the domain itself.
import type { ProviderResult, RdapResult } from '../../src/engine/lookup-contract.js'
import { TtlCache } from '../cache.js'
import { fetchWithTimeout, mapLimit, readJson, type FetchLike } from '../http.js'

const BOOTSTRAP = 'https://rdap.org/domain/'
const TTL = 24 * 3600_000
const UNKNOWN_TTL = 3600_000
const MAX_DOMAINS = 10

const cache = new TtlCache<RdapResult>(5000)

export interface RdapDeps {
  fetch: FetchLike
  timeoutMs?: number
  now?: () => number
  cache?: TtlCache<RdapResult>
}

async function one(domain: string, deps: RdapDeps): Promise<RdapResult | number> {
  const now = (deps.now ?? Date.now)()
  let res: Response
  try {
    // Following rdap.org's redirect to the registry is the documented bootstrap flow.
    res = await fetchWithTimeout(
      deps.fetch,
      BOOTSTRAP + encodeURIComponent(domain),
      { method: 'GET', redirect: 'follow', headers: { accept: 'application/rdap+json, application/json' } },
      deps.timeoutMs ?? 4000,
    )
  } catch {
    return 0
  }
  // A 404 from the registry means "not registered"; from rdap.org itself it means "TLD not supported".
  if (res.status === 404) return { domain, status: res.redirected ? 'not_registered' : 'unknown' }
  if (!res.ok) return res.status
  const body = (await readJson(res)) as { events?: { eventAction?: unknown; eventDate?: unknown }[] } | null
  const reg = body?.events?.find((e) => e?.eventAction === 'registration')?.eventDate
  const t = typeof reg === 'string' ? Date.parse(reg) : NaN
  if (Number.isNaN(t)) return { domain, status: 'unknown' }
  return { domain, status: 'ok', registered: new Date(t).toISOString(), ageDays: Math.max(0, Math.floor((now - t) / 86_400_000)) }
}

export async function lookupRdap(domains: string[], deps: RdapDeps): Promise<ProviderResult<RdapResult>> {
  if (!domains.length) return { status: 'skipped', results: [] }
  const now = deps.now ?? Date.now
  const store = deps.cache ?? cache
  const list = domains.slice(0, MAX_DOMAINS)
  const outcomes = await mapLimit(list, 4, async (d) => {
    const cached = store.get(d, now())
    if (cached) return cached
    const r = await one(d, deps)
    if (typeof r !== 'number') store.set(d, r, r.status === 'unknown' ? UNKNOWN_TTL : TTL, now())
    return r
  })
  const results = outcomes.filter((o): o is RdapResult => typeof o !== 'number')
  const skipped = domains.slice(MAX_DOMAINS)
  if (!results.length) {
    const codes = [...new Set(outcomes.filter((o): o is number => typeof o === 'number'))].map((c) => (c ? `HTTP ${c}` : 'timeout')).join(', ')
    return { status: 'error', message: `Domain registration data is unavailable right now (${codes}).`, results, skipped }
  }
  return { status: 'ok', results, ...(skipped.length ? { skipped } : {}) }
}
