// Domain registration date via RDAP. Uses IANA's RDAP bootstrap registry (RFC 9224) to find
// the registry server for the TLD, then asks the registry about the domain. We never contact
// the domain itself. (rdap.org's redirector blocks datacenter IPs, so it isn't used.)
import type { ProviderResult, RdapResult } from '../../src/engine/lookup-contract.js'
import { TtlCache } from '../cache.js'
import { fetchWithTimeout, mapLimit, readJson, type FetchLike } from '../http.js'

const BOOTSTRAP = 'https://data.iana.org/rdap/dns.json'
const BOOTSTRAP_TTL = 24 * 3600_000
const TTL = 24 * 3600_000
const UNKNOWN_TTL = 3600_000
const MAX_DOMAINS = 10
export const USER_AGENT = 'GonePhishing/1.0 (+https://github.com/chasemcapron/phishing-triage-tool)'

const cache = new TtlCache<RdapResult>(5000)
let bootstrap: { services: Map<string, string>; expires: number } | null = null

export interface RdapDeps {
  fetch: FetchLike
  timeoutMs?: number
  now?: () => number
  cache?: TtlCache<RdapResult>
  /** Test hook: bypasses the module-level bootstrap cache. */
  freshBootstrap?: boolean
}

/** TLD → RDAP base URL (https only), from IANA's dns.json. */
async function services(deps: RdapDeps): Promise<Map<string, string> | number> {
  const now = (deps.now ?? Date.now)()
  if (!deps.freshBootstrap && bootstrap && bootstrap.expires > now) return bootstrap.services
  let res: Response
  try {
    res = await fetchWithTimeout(deps.fetch, BOOTSTRAP, { method: 'GET', headers: { accept: 'application/json', 'user-agent': USER_AGENT } }, deps.timeoutMs ?? 4000)
  } catch {
    return 0
  }
  if (!res.ok) return res.status
  const body = (await readJson(res)) as { services?: [string[], string[]][] } | null
  const map = new Map<string, string>()
  for (const [tlds, urls] of body?.services ?? []) {
    const base = urls?.find((u) => typeof u === 'string' && u.startsWith('https://'))
    if (!base) continue
    for (const tld of tlds ?? []) if (typeof tld === 'string') map.set(tld.toLowerCase(), base.endsWith('/') ? base : `${base}/`)
  }
  bootstrap = { services: map, expires: now + BOOTSTRAP_TTL }
  return map
}

/** Longest matching suffix in the bootstrap table (entries are TLDs, rarely multi-label). */
function serverFor(domain: string, map: Map<string, string>): string | undefined {
  const labels = domain.split('.')
  for (let i = 1; i < labels.length; i++) {
    const hit = map.get(labels.slice(i).join('.'))
    if (hit) return hit
  }
  return undefined
}

async function one(domain: string, base: string, deps: RdapDeps): Promise<RdapResult | number> {
  const now = (deps.now ?? Date.now)()
  let res: Response
  try {
    res = await fetchWithTimeout(
      deps.fetch,
      `${base}domain/${encodeURIComponent(domain)}`,
      { method: 'GET', redirect: 'follow', headers: { accept: 'application/rdap+json, application/json', 'user-agent': USER_AGENT } },
      deps.timeoutMs ?? 4000,
    )
  } catch {
    return 0
  }
  if (res.status === 404) return { domain, status: 'not_registered' }
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
  const skipped = domains.slice(MAX_DOMAINS)

  const pending = list.filter((d) => !store.get(d, now()))
  const map = pending.length ? await services(deps) : new Map<string, string>()
  if (typeof map === 'number') {
    const cachedOnly = list.map((d) => store.get(d, now())).filter((r): r is RdapResult => Boolean(r))
    if (!cachedOnly.length) return { status: 'error', message: `Domain registration data is unavailable right now (${map ? `HTTP ${map}` : 'timeout'}).`, results: [], skipped }
    return { status: 'ok', results: cachedOnly, skipped }
  }

  const outcomes = await mapLimit(list, 4, async (d): Promise<RdapResult | number> => {
    const cached = store.get(d, now())
    if (cached) return cached
    const base = serverFor(d, map)
    // No RDAP server for this TLD (e.g. several ccTLDs): unknown, not an error.
    const r = base ? await one(d, base, deps) : ({ domain: d, status: 'unknown' } as RdapResult)
    if (typeof r !== 'number') store.set(d, r, r.status === 'unknown' ? UNKNOWN_TTL : TTL, now())
    return r
  })
  const results = outcomes.filter((o): o is RdapResult => typeof o !== 'number')
  if (!results.length) {
    const codes = [...new Set(outcomes.filter((o): o is number => typeof o === 'number'))].map((c) => (c ? `HTTP ${c}` : 'timeout')).join(', ')
    return { status: 'error', message: `Domain registration data is unavailable right now (${codes}).`, results, skipped }
  }
  return { status: 'ok', results, ...(skipped.length ? { skipped } : {}) }
}
