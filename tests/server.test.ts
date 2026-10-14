// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from '../server/cache'
import { handleLookup } from '../server/handler'
import { lookupRdap } from '../server/providers/rdap'
import { lookupSafeBrowsing, threatMatchesInput } from '../server/providers/safeBrowsing'
import { decodeSearchUrlsResponse, encodeSearchUrlsResponse } from '../server/protobuf'
import { lookupUrlhaus } from '../server/providers/urlhaus'
import { lookupVirusTotal, VT_CLIENT_LIMIT_MESSAGE, VT_LIMIT_MESSAGE } from '../server/providers/virusTotal'
import { QuotaBudget, SlidingWindowLimiter } from '../server/rateLimit'
import { isReservedDomain, validateLookupRequest } from '../server/validate'

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>
const jsonRes = (status: number, body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' }, ...init })
function mockFetch(route: Route) {
  return vi.fn(async (url: string, init?: RequestInit) => route(url, init))
}

describe('validateLookupRequest', () => {
  it('accepts and normalizes valid indicators', () => {
    const r = validateLookupRequest({
      urls: ['https://user:pw@Evil.example/a?b=1', 'https://evil.example/a?b=1'],
      domains: ['Evil.Example.'],
      hashes: ['A'.repeat(64)],
    })
    expect(r).toEqual({ ok: true, value: { urls: ['https://evil.example/a?b=1'], domains: ['evil.example'], hashes: ['a'.repeat(64)] } })
  })

  it.each([
    [{ urls: ['javascript:alert(1)'] }],
    [{ urls: ['file:///etc/passwd'] }],
    [{ urls: ['ftp://x.example/'] }],
    [{ urls: [`https://x.example/${'a'.repeat(2100)}`] }],
    [{ urls: [{ url: 'https://x.example' }] }],
    [{ domains: ['-bad-.example'] }],
    [{ domains: ['localhost'] }],
    [{ domains: ['a b.example'] }],
    [{ hashes: ['abc'] }],
    [{ hashes: [123] }],
    [{ urls: Array.from({ length: 26 }, (_, i) => `https://x${i}.example/`) }],
    [{ extra: 1, urls: ['https://x.example/'] }],
    [{ __proto__: { polluted: true }, urls: 'https://x.example/' }],
    [[]],
    [null],
    ['https://x.example/'],
    [{}],
  ])('rejects %j', (body) => {
    expect(validateLookupRequest(body).ok).toBe(false)
  })

  it('knows reserved names', () => {
    expect(['google.test', 'contoso.example', 'example.com', 'x.localhost'].every(isReservedDomain)).toBe(true)
    expect(isReservedDomain('testsafebrowsing.appspot.com')).toBe(false)
  })
})

describe('rate limiting and quotas', () => {
  it('limits per key with Retry-After', () => {
    const l = new SlidingWindowLimiter([{ windowMs: 60_000, max: 2 }])
    expect(l.check('a', 0).ok).toBe(true)
    expect(l.check('a', 1000).ok).toBe(true)
    expect(l.check('a', 2000)).toEqual({ ok: false, retryAfter: 58 })
    expect(l.check('b', 2000).ok).toBe(true)
    expect(l.check('a', 61_000).ok).toBe(true)
  })

  it('enforces per-minute and per-day budgets', () => {
    const b = new QuotaBudget(2, 3)
    expect([b.take(0), b.take(1), b.take(2)]).toEqual([true, true, false])
    expect(b.take(61_000)).toBe(true)
    expect(b.take(122_000)).toBe(false) // day budget of 3 used
    expect(b.take(86_400_000 + 200_000)).toBe(true)
  })

  it('cache expires and evicts', () => {
    const c = new TtlCache<number>(2)
    c.set('a', 1, 1000, 0)
    c.set('b', 2, 1000, 0)
    c.set('c', 3, 1000, 0)
    expect(c.get('a', 1)).toBeUndefined()
    expect(c.get('b', 1)).toBe(2)
    expect(c.get('b', 2000)).toBeUndefined()
  })
})

describe('Safe Browsing v5', () => {
  it('matches host-suffix / path-prefix expressions to inputs', () => {
    expect(threatMatchesInput('testsafebrowsing.appspot.com/s/phishing.html', 'https://testsafebrowsing.appspot.com/s/phishing.html')).toBe(true)
    expect(threatMatchesInput('appspot.com/', 'https://testsafebrowsing.appspot.com/x')).toBe(true)
    expect(threatMatchesInput('evil.example/a/', 'https://good.example/a/')).toBe(false)
    expect(threatMatchesInput('evil.example/a/', 'https://notevil.example/a/')).toBe(false)
  })

  it('decodes the protobuf response (v5 has no JSON output)', async () => {
    const body = encodeSearchUrlsResponse([{ url: 'testsafebrowsing.appspot.com/s/malware.html', types: [1, 0] }], 300)
    const f = mockFetch(() => new Response(body as unknown as BodyInit, { status: 200, headers: { 'content-type': 'application/x-protobuf' } }))
    const r = await lookupSafeBrowsing(['https://testsafebrowsing.appspot.com/s/malware.html', 'https://www.google.com/'], { fetch: f, apiKey: 'k', cache: new TtlCache() })
    expect(r).toEqual({ status: 'ok', results: [{ url: 'https://testsafebrowsing.appspot.com/s/malware.html', threatTypes: ['MALWARE'] }] })
    expect(decodeSearchUrlsResponse(new Uint8Array()).threats).toEqual([])
    expect(() => decodeSearchUrlsResponse(new Uint8Array([0x0a, 0x05, 0x01]))).toThrow()
    const bad = await lookupSafeBrowsing(['https://x.example/'], { fetch: mockFetch(() => new Response(new Uint8Array([0x0a, 0x09]) as unknown as BodyInit, { status: 200 })), apiKey: 'k', cache: new TtlCache() })
    expect(bad.status).toBe('error')
  })

  it('sends the key in a header and caches', async () => {
    const f = mockFetch((url) => {
      expect(url).toContain('/v5/urls:search?alt=proto&urls=')
      expect(url).not.toContain('KEY123')
      return jsonRes(200, { threats: [{ url: 'testsafebrowsing.appspot.com/s/phishing.html', threatTypes: ['SOCIAL_ENGINEERING', 'THREAT_TYPE_UNSPECIFIED'] }], cacheDuration: '300s' })
    })
    const deps = { fetch: f, apiKey: 'KEY123', cache: new TtlCache<string[]>(), now: () => 0 }
    const urls = ['https://testsafebrowsing.appspot.com/s/phishing.html', 'https://www.google.com/']
    const r = await lookupSafeBrowsing(urls, deps)
    expect(r).toEqual({ status: 'ok', results: [{ url: urls[0], threatTypes: ['SOCIAL_ENGINEERING'] }] })
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY123')
    await lookupSafeBrowsing(urls, deps)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('reports missing key, quota and errors without claiming "clean"', async () => {
    expect((await lookupSafeBrowsing(['https://a.example/'], { fetch: mockFetch(() => jsonRes(200, {})), apiKey: undefined })).status).toBe('not_configured')
    const limited = await lookupSafeBrowsing(['https://b.example/'], { fetch: mockFetch(() => jsonRes(429, {})), apiKey: 'k', cache: new TtlCache() })
    expect(limited.status).toBe('rate_limited')
    const err = await lookupSafeBrowsing(['https://c.example/'], { fetch: mockFetch(() => jsonRes(403, { error: { message: 'secret detail' } })), apiKey: 'k', cache: new TtlCache() })
    expect(err).toEqual({ status: 'error', message: 'Google Safe Browsing is unavailable right now (HTTP 403).', results: [] })
  })

  it('times out', async () => {
    const hang = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))))
    const r = await lookupSafeBrowsing(['https://d.example/'], { fetch: hang, apiKey: 'k', cache: new TtlCache(), timeoutMs: 20 })
    expect(r.status).toBe('timeout')
  })
})

describe('VirusTotal', () => {
  const report = (malicious: number) => ({ data: { id: 'f'.repeat(64), attributes: { last_analysis_stats: { malicious, suspicious: 0, harmless: 60, undetected: 10 }, reputation: -5 } } })

  it('looks up hashes first, then domains, then at most two URLs, within budget', async () => {
    const seen: string[] = []
    const f = mockFetch((url, init) => {
      expect((init!.headers as Record<string, string>)['x-apikey']).toBe('vt')
      expect(init!.method).toBe('GET')
      seen.push(url.replace('https://www.virustotal.com/api/v3', ''))
      return url.includes('/files/') ? jsonRes(404, { error: { code: 'NotFoundError' } }) : jsonRes(200, report(3))
    })
    const r = await lookupVirusTotal(
      { hashes: ['a'.repeat(64)], domains: ['one.example', 'two.example'], urls: ['https://one.example/x', 'https://two.example/y', 'https://three.example/z'] },
      { fetch: f, apiKey: 'vt', cache: new TtlCache(), budget: new QuotaBudget(4, 500), now: () => 0 },
    )
    expect(seen).toEqual([`/files/${'a'.repeat(64)}`, '/domains/one.example', '/domains/two.example', `/urls/${Buffer.from('https://one.example/x').toString('base64url')}`])
    expect(r.status).toBe('rate_limited')
    expect(r.message).toBe(VT_LIMIT_MESSAGE)
    expect(r.skipped).toEqual(['https://two.example/y'])
    expect(r.results[0]).toEqual({ kind: 'file', indicator: 'a'.repeat(64), found: false })
    expect(r.results[1]).toMatchObject({ kind: 'domain', found: true, stats: { malicious: 3 }, link: 'https://www.virustotal.com/gui/domain/one.example' })
    expect(r.results[3]!.link).toBe(`https://www.virustotal.com/gui/url/${'f'.repeat(64)}/detection`)
  })

  it('stops after an upstream 429 and never submits for scanning', async () => {
    const f = mockFetch(() => jsonRes(429, { error: { code: 'QuotaExceededError' } }))
    const r = await lookupVirusTotal({ hashes: [], domains: ['a.example', 'b.example'], urls: [] }, { fetch: f, apiKey: 'vt', cache: new TtlCache(), budget: new QuotaBudget(4, 500) })
    expect(r).toMatchObject({ status: 'rate_limited', skipped: ['a.example', 'b.example'] })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
  })

  it("caps each client's share of uncached lookups and serves cached ones regardless", async () => {
    const f = mockFetch(() => jsonRes(404, {}))
    const clientLimiter = new SlidingWindowLimiter([{ windowMs: 86_400_000, max: 2 }])
    const deps = { fetch: f, apiKey: 'vt', cache: new TtlCache<never>(), budget: new QuotaBudget(100, 500), clientLimiter, now: () => 0 }
    const first = await lookupVirusTotal({ hashes: [], domains: ['a.example', 'b.example', 'c.example'], urls: [] }, { ...deps, clientKey: '203.0.113.9' })
    expect(first).toMatchObject({ status: 'rate_limited', message: VT_CLIENT_LIMIT_MESSAGE, skipped: ['c.example'] })
    expect(f).toHaveBeenCalledTimes(2)
    // Cached answers cost nothing; another network still has its own share.
    expect((await lookupVirusTotal({ hashes: [], domains: ['a.example'], urls: [] }, { ...deps, clientKey: '203.0.113.9' })).status).toBe('ok')
    expect((await lookupVirusTotal({ hashes: [], domains: ['c.example'], urls: [] }, { ...deps, clientKey: '198.51.100.7' })).status).toBe('ok')
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('is not configured without a key', async () => {
    expect((await lookupVirusTotal({ hashes: [], domains: ['a.example'], urls: [] }, { fetch: mockFetch(() => jsonRes(200, {})), apiKey: '' })).status).toBe('not_configured')
  })
})

describe('URLhaus', () => {
  it('posts form fields with the Auth-Key header and maps listings', async () => {
    // (Host lookups are supported by the client but not used by runLookup; see server/lookup.ts.)
    const f = mockFetch((url, init) => {
      expect((init!.headers as Record<string, string>)['Auth-Key']).toBe('uh')
      const body = new URLSearchParams(String(init!.body))
      if (url.endsWith('/host/')) return jsonRes(200, { query_staus: 'ok', urls: [{ url_status: 'online', threat: 'malware_download', tags: null, urlhaus_reference: 'https://urlhaus.abuse.ch/url/1/' }] })
      if (url.endsWith('/url/')) return jsonRes(200, { query_status: body.get('url') === 'https://bad.example/x' ? 'ok' : 'no_results', url_status: 'offline', threat: 'malware_download', tags: ['exe'], urlhaus_reference: 'https://urlhaus.abuse.ch/url/2/' })
      return jsonRes(200, { query_status: 'no_results' })
    })
    const r = await lookupUrlhaus({ urls: ['https://bad.example/x', 'https://ok.example/'], hosts: ['bad.example'], hashes: ['b'.repeat(64)] }, { fetch: f, authKey: 'uh', cache: new TtlCache() })
    expect(r.status).toBe('ok')
    expect(r.results).toEqual([
      { kind: 'host', indicator: 'bad.example', listed: true, urlStatus: 'online', threat: 'malware_download', tags: undefined, reference: 'https://urlhaus.abuse.ch/url/1/' },
      { kind: 'url', indicator: 'https://bad.example/x', listed: true, urlStatus: 'offline', threat: 'malware_download', tags: ['exe'], reference: 'https://urlhaus.abuse.ch/url/2/' },
    ])
  })

  it('treats 401 as an error, not "not listed"', async () => {
    const f = mockFetch(() => new Response('{"error": "Unauthorized"}', { status: 401, headers: { 'content-type': 'application/octet-stream' } }))
    const r = await lookupUrlhaus({ urls: [], hosts: ['x.example'], hashes: [] }, { fetch: f, authKey: 'bad', cache: new TtlCache() })
    expect(r.status).toBe('error')
  })
})

describe('RDAP', () => {
  it('uses the IANA bootstrap, reads registration dates, and handles unknown TLDs', async () => {
    const day = 86_400_000
    const now = Date.parse('2026-10-13T00:00:00Z')
    const f = mockFetch((url, init) => {
      expect((init!.headers as Record<string, string>)['user-agent']).toMatch(/^GonePhishing/)
      if (url === 'https://data.iana.org/rdap/dns.json') return jsonRes(200, { services: [[['com', 'net'], ['https://rdap.verisign.com/com/v1/']], [['top'], ['http://insecure.example/', 'https://rdap.nic.top/']]] })
      if (url === 'https://rdap.verisign.com/com/v1/domain/new-login.com') return jsonRes(200, { events: [{ eventAction: 'registration', eventDate: new Date(now - 3 * day).toISOString() }] })
      if (url === 'https://rdap.verisign.com/com/v1/domain/gone.com') return jsonRes(404, {})
      if (url === 'https://rdap.nic.top/domain/promo.top') return jsonRes(200, { events: [{ eventAction: 'expiration', eventDate: '2027-01-01T00:00:00Z' }] })
      return jsonRes(500, {})
    })
    const r = await lookupRdap(['new-login.com', 'gone.com', 'promo.top', 'nordap.de'], { fetch: f, cache: new TtlCache(), now: () => now, freshBootstrap: true })
    expect(r.status).toBe('ok')
    expect(r.results).toEqual([
      { domain: 'new-login.com', status: 'ok', registered: new Date(now - 3 * day).toISOString(), ageDays: 3 },
      { domain: 'gone.com', status: 'not_registered' },
      { domain: 'promo.top', status: 'unknown' },
      { domain: 'nordap.de', status: 'unknown' },
    ])
  })

  it('reports the bootstrap failure code', async () => {
    const r = await lookupRdap(['x.com'], { fetch: mockFetch(() => jsonRes(403, {})), cache: new TtlCache(), freshBootstrap: true })
    expect(r).toMatchObject({ status: 'error', message: 'Domain registration data is unavailable right now (HTTP 403).' })
  })
})

describe('handleLookup', () => {
  const env = { GOOGLE_SAFE_BROWSING_API_KEY: 'sb-secret', VIRUSTOTAL_API_KEY: '', URLHAUS_AUTH_KEY: undefined }
  const okFetch = mockFetch((url) => (url.includes('safebrowsing') ? jsonRes(200, {}) : jsonRes(404, {})))
  const req = (body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
    new Request('https://app.example/api/lookup', {
      method,
      headers: { 'content-type': 'application/json', host: 'app.example', 'x-forwarded-for': '203.0.113.5', ...headers },
      ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    })
  const run = (r: Request, limiter = new SlidingWindowLimiter([{ windowMs: 60_000, max: 10 }])) => handleLookup(r, { fetch: okFetch, env, limiter })

  it('serves a lookup with no-store and no key leakage', async () => {
    const res = await run(req({ urls: ['https://testsafebrowsing.appspot.com/s/phishing.html'], domains: ['google.test'] }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    const text = await res.text()
    expect(text).not.toContain('sb-secret')
    const body = JSON.parse(text)
    expect(body.virusTotal.status).toBe('not_configured')
    expect(body.urlhaus.status).toBe('not_configured')
    expect(body.rdap.status).toBe('skipped') // google.test is reserved
    expect(body.safeBrowsing.status).toBe('ok')
  })

  it.each([
    ['GET', req(null, {}, 'GET'), 405],
    ['wrong content type', req('{}', { 'content-type': 'text/plain' }), 415],
    ['bad JSON', req('{nope'), 400],
    ['invalid indicator', req({ urls: ['javascript:alert(1)'] }), 400],
    ['oversize body', req({ urls: ['https://a.example/' + 'x'.repeat(40_000)] }), 413],
    ['cross-site origin', req({ domains: ['a.example'] }, { origin: 'https://evil.example' }), 403],
    ['cross-site fetch metadata', req({ domains: ['a.example'] }, { 'sec-fetch-site': 'cross-site' }), 403],
  ])('rejects %s', async (_name, r, status) => {
    expect((await run(r)).status).toBe(status)
  })

  it('allows same-origin browser requests', async () => {
    const r = req({ domains: ['a.example'] }, { origin: 'https://app.example', 'sec-fetch-site': 'same-origin' })
    expect((await run(r)).status).toBe(200)
  })

  it('rate limits per client IP with Retry-After', async () => {
    const limiter = new SlidingWindowLimiter([{ windowMs: 60_000, max: 1 }])
    expect((await run(req({ domains: ['a.example'] }), limiter)).status).toBe(200)
    const res = await run(req({ domains: ['a.example'] }), limiter)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await run(req({ domains: ['a.example'] }, { 'x-forwarded-for': '198.51.100.9' }), limiter)).status).toBe(200)
  })
})
