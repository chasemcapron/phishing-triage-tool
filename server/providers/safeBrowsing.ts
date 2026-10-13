// Google Safe Browsing v5 urls.search (v4 Lookup is deprecated; support ends 2027-03-31).
// https://developers.google.com/safe-browsing/reference/rest/v5/urls/search
import type { ProviderResult, SafeBrowsingHit } from '../../src/engine/lookup-contract.js'
import { TtlCache } from '../cache.js'
import { fetchWithTimeout, readJson, TimeoutError, type FetchLike } from '../http.js'

const ENDPOINT = 'https://safebrowsing.googleapis.com/v5/urls:search'
const VALID_THREATS = new Set(['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'])
/** ToS: a warning needs data from Google fetched within the past 30 minutes. */
const MAX_POSITIVE_TTL = 30 * 60_000
const MAX_NEGATIVE_TTL = 60 * 60_000
const DEFAULT_TTL = 300_000

const cache = new TtlCache<string[]>(5000)

export interface SafeBrowsingDeps {
  fetch: FetchLike
  apiKey: string | undefined
  timeoutMs?: number
  now?: () => number
  cache?: TtlCache<string[]>
}

function parseDuration(v: unknown): number {
  const m = typeof v === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(v) : null
  return m ? Math.round(Number(m[1]) * 1000) : DEFAULT_TTL
}

/** A returned threat URL may be a host-suffix/path-prefix expression ("host/path"), not the exact input. */
export function threatMatchesInput(threatUrl: string, input: string): boolean {
  let inHost: string
  let inPath: string
  try {
    const u = new URL(input)
    inHost = u.hostname.toLowerCase()
    inPath = u.pathname + u.search
  } catch {
    return false
  }
  const expr = threatUrl.replace(/^[a-z]+:\/\//i, '')
  const slash = expr.indexOf('/')
  const host = (slash < 0 ? expr : expr.slice(0, slash)).toLowerCase().replace(/:\d+$/, '')
  const path = slash < 0 ? '/' : expr.slice(slash)
  const hostOk = inHost === host || inHost.endsWith(`.${host}`)
  return hostOk && inPath.startsWith(path)
}

export async function lookupSafeBrowsing(urls: string[], deps: SafeBrowsingDeps): Promise<ProviderResult<SafeBrowsingHit>> {
  if (!deps.apiKey) return { status: 'not_configured', message: 'Google Safe Browsing is not configured.', results: [] }
  if (!urls.length) return { status: 'skipped', results: [] }
  const now = deps.now ?? Date.now
  const store = deps.cache ?? cache

  const results: SafeBrowsingHit[] = []
  const pending: string[] = []
  for (const url of urls) {
    const cached = store.get(url, now())
    if (cached === undefined) pending.push(url)
    else if (cached.length) results.push({ url, threatTypes: cached })
  }
  if (!pending.length) return { status: 'ok', results }

  // Key goes in a header (not the query string) so it can never end up in URL logs.
  const qs = new URLSearchParams({ alt: 'json' })
  for (const u of pending) qs.append('urls', u)
  let res: Response
  try {
    res = await fetchWithTimeout(deps.fetch, `${ENDPOINT}?${qs}`, { method: 'GET', headers: { 'X-Goog-Api-Key': deps.apiKey, accept: 'application/json' } }, deps.timeoutMs ?? 5000)
  } catch (e) {
    return e instanceof TimeoutError
      ? { status: 'timeout', message: 'Google Safe Browsing did not answer in time.', results }
      : { status: 'error', message: 'Google Safe Browsing is unavailable right now.', results }
  }
  if (res.status === 429) return { status: 'rate_limited', message: 'Google Safe Browsing limit reached, try again later.', results }
  if (!res.ok) {
    // Google's error reason codes (e.g. API_KEY_INVALID) are safe to show and make setup issues obvious.
    const err = (await readJson(res)) as { error?: { status?: unknown; details?: { reason?: unknown }[] } } | null
    const reason = [err?.error?.details?.find((d) => typeof d?.reason === 'string')?.reason, err?.error?.status].find(
      (x): x is string => typeof x === 'string' && /^[A-Z_]{3,40}$/.test(x),
    )
    return { status: 'error', message: `Google Safe Browsing is unavailable right now (HTTP ${res.status}${reason ? ` ${reason}` : ''}).`, results }
  }

  const body = (await readJson(res)) as { threats?: { url?: unknown; threatTypes?: unknown }[]; cacheDuration?: unknown } | null
  const threats = Array.isArray(body?.threats) ? body.threats : []
  const ttl = parseDuration(body?.cacheDuration)
  const found = new Map<string, Set<string>>()
  for (const t of threats) {
    if (typeof t?.url !== 'string' || !Array.isArray(t.threatTypes)) continue
    const types = t.threatTypes.filter((x): x is string => typeof x === 'string' && VALID_THREATS.has(x))
    if (!types.length) continue
    for (const input of pending) {
      if (!threatMatchesInput(t.url, input)) continue
      const set = found.get(input) ?? new Set<string>()
      types.forEach((x) => set.add(x))
      found.set(input, set)
    }
  }
  for (const input of pending) {
    const types = [...(found.get(input) ?? [])]
    store.set(input, types, Math.min(ttl, types.length ? MAX_POSITIVE_TTL : MAX_NEGATIVE_TTL), now())
    if (types.length) results.push({ url: input, threatTypes: types })
  }
  return { status: 'ok', results }
}
