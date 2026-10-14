// Domain-age fallback from the browser. Some registries rate-limit or block cloud servers
// (GMO's .shop registry answers Vercel with HTTP 429 every time), so when the server could
// not get a domain's registration date, the browser asks that registry itself. Only the
// domain name is sent, the same thing the server would have sent.
import { tldOf } from './checks/links'
import { rdapFromBody, type LookupRequest, type LookupResponse, type RdapResult } from './lookup-contract'

/**
 * Registry RDAP servers (from IANA's bootstrap file) that allow browser requests. The CSP
 * connect-src in vercel.json lists exactly these hosts; keep the two in sync.
 */
export const BROWSER_RDAP: Record<string, string> = {
  com: 'https://rdap.verisign.com/com/v1/',
  net: 'https://rdap.verisign.com/net/v1/',
  org: 'https://rdap.publicinterestregistry.org/rdap/',
  app: 'https://pubapi.registry.google/rdap/',
  shop: 'https://rdap.gmoregistry.net/rdap/',
  top: 'https://rdap.zdnsgtld.com/top/',
  ...Object.fromEntries(['xyz', 'icu', 'cyou', 'sbs', 'cfd', 'bond', 'cam', 'lat', 'monster', 'beauty'].map((t) => [t, `https://rdap.centralnic.com/${t}/`])),
  ...Object.fromEntries(['store', 'online', 'site', 'website', 'fun', 'space', 'tech'].map((t) => [t, 'https://rdap.radix.host/rdap/'])),
  ...Object.fromEntries(['info', 'live', 'life', 'today', 'pro', 'sale', 'deals', 'boutique'].map((t) => [t, 'https://rdap.identitydigital.services/rdap/'])),
  ...Object.fromEntries(['biz', 'buzz', 'club', 'fashion', 'vip', 'win'].map((t) => [t, `https://rdap.nic.${t}/`])),
  click: 'https://rdap.registry.click/rdap/',
  rest: 'https://rdap.registry.bar/rdap/',
  link: 'https://rdap.uniregistry.net/rdap/',
}

const MAX = 10
const TIMEOUT_MS = 5000
const RESERVED = new Set(['example.com', 'example.net', 'example.org'])

async function one(domain: string, f: typeof fetch, signal: AbortSignal | undefined, now: number): Promise<RdapResult | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await f(`${BROWSER_RDAP[tldOf(domain)]}domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json, application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    })
    if (res.status === 404) return { domain, status: 'not_registered' }
    if (!res.ok) return null
    return rdapFromBody(domain, await res.json().catch(() => null), now)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Fills in registration dates the server could not get. Never throws; returns `res` unchanged when there is nothing to add. */
export async function fillRdapInBrowser(
  req: LookupRequest,
  res: LookupResponse,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; now?: number } = {},
): Promise<LookupResponse> {
  const done = new Set(res.rdap.results.map((r) => r.domain))
  const skipped = new Set(res.rdap.skipped ?? [])
  const missing = req.domains.filter((d) => !done.has(d) && !skipped.has(d) && !RESERVED.has(d) && BROWSER_RDAP[tldOf(d)]).slice(0, MAX)
  if (!missing.length) return res
  const now = opts.now ?? Date.now()
  const found = (await Promise.all(missing.map((d) => one(d, opts.fetchImpl ?? fetch, opts.signal, now)))).filter((r): r is RdapResult => Boolean(r))
  if (!found.length) return res
  const rdap: LookupResponse['rdap'] = { ...res.rdap, status: 'ok', results: [...res.rdap.results, ...found] }
  delete rdap.message
  return { ...res, rdap }
}
