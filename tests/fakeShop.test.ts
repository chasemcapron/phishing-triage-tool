import { describe, expect, it, vi } from 'vitest'
import { analyzeText } from '../src/engine'
import type { LookupResponse } from '../src/engine/lookup-contract'
import { fetchLookup } from '../src/engine/lookupClient'
import { BROWSER_RDAP, fillRdapInBrowser } from '../src/engine/rdapBrowser'
import { applyReputation, buildLookupRequest } from '../src/engine/reputation'
import { readFileSync } from 'node:fs'

const empty = (): LookupResponse => ({
  safeBrowsing: { status: 'ok', results: [] },
  virusTotal: { status: 'ok', results: [] },
  urlhaus: { status: 'ok', results: [] },
  rdap: { status: 'ok', results: [] },
})
const kinds = (r: { findings: { kind: string }[] }) => r.findings.map((f) => f.kind)

// A real fake store that took card details at checkout (Oct 2026), copying Summer Fridays.
const AD = 'Summer Fridays end of season sale! Up to 80% off, today only: www.summrfrideays.shop'

describe('fake online stores', () => {
  it('spots a misspelled retail brand on a cheap domain ending', async () => {
    const r = await analyzeText(AD)
    expect(kinds(r)).toEqual(expect.arrayContaining(['link-lookalike', 'domain-risky-tld', 'content-deal']))
    expect(r.findings.find((f) => f.kind === 'link-lookalike')?.explanation).toMatch(/misspelling of Summer Fridays/)
    expect(r.verdict).not.toBe('none')
  })

  it('reaches High once the domain turns out to be weeks old (longer window for risky endings)', async () => {
    const r = await analyzeText('www.summrfrideays.shop')
    const res = empty()
    res.rdap.results = [{ domain: 'summrfrideays.shop', status: 'ok', registered: '2026-09-19T07:54:22.000Z', ageDays: 50 }]
    const out = applyReputation(r, res, buildLookupRequest(r))
    expect(kinds(out)).toContain('domain-new')
    expect(out.verdict).toBe('high')
  })

  it('does not call a .com of the same age new', async () => {
    const r = await analyzeText('https://www.example-bakery.com/')
    const res = empty()
    res.rdap.results = [{ domain: 'example-bakery.com', status: 'ok', registered: '2026-08-24T00:00:00.000Z', ageDays: 50 }]
    expect(kinds(applyReputation(r, res, buildLookupRequest(r)))).not.toContain('domain-new')
  })

  it('leaves the real retailer sites alone', async () => {
    for (const url of ['https://www.summerfridays.com/', 'https://shop.lululemon.com/', 'https://www.nike.com/', 'https://www.ray-ban.com/usa']) {
      const r = await analyzeText(url)
      expect(r.verdict, url).toBe('none')
    }
  })

  it('does not treat everyday words as brands', async () => {
    for (const url of ['https://pinecrest-target-practice.org/', 'https://www.cosco-shipping.com/', 'https://stanleyparkvancouver.com/']) {
      const r = await analyzeText(url)
      expect(kinds(r), url).not.toContain('link-lookalike')
      expect(kinds(r), url).not.toContain('link-combosquat')
    }
  })
})

describe('browser domain-age fallback', () => {
  const rdapBody = { events: [{ eventAction: 'registration', eventDate: '2026-09-19T07:54:22.0Z' }] }
  const now = Date.parse('2026-10-13T12:00:00Z')

  it('asks the registry directly for domains the server could not check', async () => {
    const res = empty()
    res.rdap = { status: 'error', message: 'Domain registration data is unavailable right now (HTTP 429).', results: [] }
    const f = vi.fn(async () => new Response(JSON.stringify(rdapBody), { status: 200 }))
    const out = await fillRdapInBrowser({ urls: [], domains: ['summrfrideays.shop'], hashes: [] }, res, { fetchImpl: f as unknown as typeof fetch, now })
    expect(f).toHaveBeenCalledOnce()
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://rdap.gmoregistry.net/rdap/domain/summrfrideays.shop')
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
    expect(out.rdap).toEqual({ status: 'ok', results: [{ domain: 'summrfrideays.shop', status: 'ok', registered: '2026-09-19T07:54:22.000Z', ageDays: 24 }] })
  })

  it('skips domains already answered, skipped, reserved or on unlisted registries, and never throws', async () => {
    const res = empty()
    res.rdap = { status: 'ok', results: [{ domain: 'done.com', status: 'unknown' }], skipped: ['later.shop'] }
    const f = vi.fn(async () => {
      throw new TypeError('blocked')
    })
    const req = { urls: [], domains: ['done.com', 'later.shop', 'example.com', 'bank.co.uk', 'x.test', 'fails.top'], hashes: [] }
    const out = await fillRdapInBrowser(req, res, { fetchImpl: f as unknown as typeof fetch, now })
    expect(f).toHaveBeenCalledOnce()
    expect(out).toBe(res)
  })

  it('runs after the server lookup in fetchLookup', async () => {
    const server = empty()
    server.rdap = { status: 'error', message: 'x', results: [] }
    const f = vi.fn(async (url: string) =>
      url === '/api/lookup' ? new Response(JSON.stringify(server), { status: 200 }) : new Response(JSON.stringify(rdapBody), { status: 200 }),
    )
    const out = await fetchLookup({ urls: [], domains: ['summrfrideays.shop'], hashes: [] }, { fetchImpl: f as unknown as typeof fetch })
    expect(f).toHaveBeenCalledTimes(2)
    expect(out.rdap.status).toBe('ok')
  })

  it('every registry host is allowed by the CSP', () => {
    const csp = /connect-src ([^;]+)/.exec(readFileSync('vercel.json', 'utf8'))![1]!.split(' ')
    for (const base of Object.values(BROWSER_RDAP)) expect(csp, base).toContain(new URL(base).origin)
  })
})
