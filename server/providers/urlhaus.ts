// URLhaus (abuse.ch) API v1. Every request needs the Auth-Key header (since mid-2025).
// https://urlhaus-api.abuse.ch/
import type { ProviderResult, UrlhausResult } from '../../src/engine/lookup-contract.js'
import { TtlCache } from '../cache.js'
import { fetchWithTimeout, mapLimit, readJson, TimeoutError, type FetchLike } from '../http.js'

const API = 'https://urlhaus-api.abuse.ch/v1'
const TTL = 30 * 60_000
const MAX_EACH = 10

const cache = new TtlCache<UrlhausResult>(5000)

export interface UrlhausDeps {
  fetch: FetchLike
  authKey: string | undefined
  timeoutMs?: number
  now?: () => number
  cache?: TtlCache<UrlhausResult>
}

type Kind = UrlhausResult['kind']
const ENDPOINT: Record<Kind, [string, string]> = {
  url: ['/url/', 'url'],
  host: ['/host/', 'host'],
  payload: ['/payload/', 'sha256_hash'],
}

type Outcome = UrlhausResult | 'timeout' | 'error' | 'unauthorized'

async function one(kind: Kind, indicator: string, deps: UrlhausDeps & { authKey: string }): Promise<Outcome> {
  const [path, field] = ENDPOINT[kind]
  let res: Response
  try {
    res = await fetchWithTimeout(
      deps.fetch,
      API + path,
      {
        method: 'POST',
        headers: { 'Auth-Key': deps.authKey, 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ [field]: indicator }).toString(),
      },
      deps.timeoutMs ?? 5000,
    )
  } catch (e) {
    return e instanceof TimeoutError ? 'timeout' : 'error'
  }
  if (res.status === 401 || res.status === 403) return 'unauthorized'
  if (!res.ok) return 'error'
  const body = (await readJson(res)) as Record<string, unknown> | null
  // The documented host response spells the field "query_staus".
  const status = body?.query_status ?? body?.query_staus
  if (status !== 'ok') return { kind, indicator, listed: false }
  const urls = Array.isArray(body?.urls) ? (body.urls as Record<string, unknown>[]) : []
  const first = kind === 'url' ? body! : (urls[0] ?? {})
  const tags = Array.isArray(first.tags) ? first.tags.filter((t): t is string => typeof t === 'string') : undefined
  const reference =
    typeof first.urlhaus_reference === 'string' && first.urlhaus_reference.startsWith('https://urlhaus.abuse.ch/')
      ? first.urlhaus_reference
      : `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(indicator)}`
  return {
    kind,
    indicator,
    listed: true,
    urlStatus: typeof first.url_status === 'string' ? first.url_status : undefined,
    threat: typeof first.threat === 'string' ? first.threat : typeof body?.signature === 'string' ? body.signature : undefined,
    tags,
    reference,
  }
}

export async function lookupUrlhaus(input: { urls: string[]; hosts: string[]; hashes: string[] }, deps: UrlhausDeps): Promise<ProviderResult<UrlhausResult>> {
  if (!deps.authKey) return { status: 'not_configured', message: 'URLhaus is not configured.', results: [] }
  const jobs: [Kind, string][] = [
    ...input.hashes.slice(0, MAX_EACH).map((h): [Kind, string] => ['payload', h]),
    ...input.hosts.slice(0, MAX_EACH).map((h): [Kind, string] => ['host', h]),
    ...input.urls.slice(0, MAX_EACH).map((u): [Kind, string] => ['url', u]),
  ]
  if (!jobs.length) return { status: 'skipped', results: [] }
  const now = deps.now ?? Date.now
  const store = deps.cache ?? cache
  const authed = { ...deps, authKey: deps.authKey }

  const outcomes = await mapLimit(jobs, 4, async ([kind, indicator]): Promise<Outcome> => {
    const key = `${kind}:${indicator}`
    const cached = store.get(key, now())
    if (cached) return cached
    const r = await one(kind, indicator, authed)
    if (typeof r !== 'string') store.set(key, r, TTL, now())
    return r
  })
  const results = outcomes.filter((o): o is UrlhausResult => typeof o !== 'string')
  if (outcomes.includes('unauthorized')) return { status: 'error', message: 'URLhaus rejected the request (check the Auth-Key).', results }
  if (!results.length && outcomes.length) {
    return outcomes.includes('timeout')
      ? { status: 'timeout', message: 'URLhaus did not answer in time.', results }
      : { status: 'error', message: 'URLhaus is unavailable right now.', results }
  }
  return { status: 'ok', results: results.filter((r) => r.listed) }
}
