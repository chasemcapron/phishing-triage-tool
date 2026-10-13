import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { analyzeEmail, analyzeText, type Report } from '../src/engine'
import { reportTechniques, TECHNIQUES } from '../src/engine/attack'
import { defangedIocList, iocJson, mdCode, mdEscape, ticketSummary } from '../src/engine/export'
import type { LookupResponse } from '../src/engine/lookup-contract'
import { fetchLookup, LookupError } from '../src/engine/lookupClient'
import { applyReputation, buildLookupRequest, stripUrl } from '../src/engine/reputation'

const sample = (file: string) => readFileSync(`samples/${file}`)
const email = (file: string) => analyzeEmail(new Uint8Array(sample(file)))
const text = (file: string) => analyzeText(sample(file).toString('utf8'))

const empty = (): LookupResponse => ({
  safeBrowsing: { status: 'ok', results: [] },
  virusTotal: { status: 'ok', results: [] },
  urlhaus: { status: 'ok', results: [] },
  rdap: { status: 'ok', results: [] },
})

describe('buildLookupRequest', () => {
  it('strips query strings and fragments by default', async () => {
    const r = await email('01-m365-credential-phish.eml')
    const req = buildLookupRequest(r)
    expect(req.urls).toContain('https://login.micros0ft-online.example/common/reset')
    expect(req.urls.some((u) => u.includes('?') || u.includes('#'))).toBe(false)
    expect(buildLookupRequest(r, { stripQuery: false }).urls.some((u) => u.includes('?redirect='))).toBe(true)
  })

  it('sends only links, domains and hashes, most suspicious first, skipping free webmail', async () => {
    const r = await email('03-invoice-attachments.eml')
    const req = buildLookupRequest(r)
    expect(Object.keys(req).sort()).toEqual(['domains', 'hashes', 'urls'])
    expect(req.hashes).toHaveLength(2)
    expect(req.domains).toContain('vendor-billing.test')
    const recruiter = buildLookupRequest(await email('02-fake-recruiter.eml'))
    expect(recruiter.domains).not.toContain('gmail.com')
    expect(recruiter.domains).toContain('northwind-careers.test')
    const m365 = buildLookupRequest(await email('01-m365-credential-phish.eml'))
    expect(m365.urls[0]).toContain('micros0ft-online.example') // lookalike outranks the rest
  })

  it('removes credentials from URLs', () => {
    expect(stripUrl('https://u:p@x.example/a?b#c')).toBe('https://x.example/a')
  })
})

describe('applyReputation', () => {
  it('forces High on a Safe Browsing hit with advisory wording and source', () => {
    const r = text('07-safe-browsing-test.txt')
    expect(r.verdict).toBe('suspicious')
    const req = buildLookupRequest(r)
    const res = empty()
    res.safeBrowsing.results = [{ url: 'https://testsafebrowsing.appspot.com/s/phishing.html', threatTypes: ['SOCIAL_ENGINEERING'] }]
    const out = applyReputation(r, res, req)
    expect(out.verdict).toBe('high')
    const f = out.findings.find((x) => x.kind === 'rep-safe-browsing')!
    expect(f).toMatchObject({ forceHigh: true, source: 'google-safe-browsing', threatTypes: ['SOCIAL_ENGINEERING'] })
    expect(f.explanation).toMatch(/suspected phishing/)
    expect(out.links.find((l) => l.host === 'testsafebrowsing.appspot.com')?.reputation?.safeBrowsing).toEqual(['SOCIAL_ENGINEERING'])
    expect(out.reasons[0]).toBe(f.explanation)
    expect(out.reputation?.providers.map((p) => p.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(out.findings.filter((x) => x.source === 'google-safe-browsing')).toHaveLength(1)
  })

  it('explains a new domain together with the brand it imitates', async () => {
    const r = await email('01-m365-credential-phish.eml')
    const res = empty()
    res.rdap.results = [{ domain: 'micros0ft-online.example', status: 'ok', registered: '2026-10-10T00:00:00.000Z', ageDays: 3 }]
    const out = applyReputation(r, res, buildLookupRequest(r))
    expect(out.findings.find((f) => f.kind === 'domain-new')?.explanation).toBe(
      'This claims to be from Microsoft, but the link goes to a domain registered 3 days ago.',
    )
  })

  it('maps VirusTotal counts: 2+ malicious forces High, 1 is a weak signal', async () => {
    const r = await email('04-legit-newsletter.eml')
    const mk = (malicious: number): LookupResponse => {
      const res = empty()
      res.virusTotal.results = [{ kind: 'domain', indicator: 'contoso.example', found: true, stats: { malicious, suspicious: 0, harmless: 70, undetected: 5 }, link: 'https://www.virustotal.com/gui/domain/contoso.example' }]
      return res
    }
    expect(applyReputation(r, mk(3), buildLookupRequest(r)).verdict).toBe('high')
    const weak = applyReputation(r, mk(1), buildLookupRequest(r))
    expect(weak.findings.map((f) => f.kind)).toEqual(['rep-virustotal-suspicious'])
    expect(weak.findings[0]!.forceHigh).toBeUndefined()
    expect(applyReputation(r, mk(0), buildLookupRequest(r)).findings).toEqual([])
  })

  it('annotates attachments from hash lookups and is idempotent', async () => {
    const r = await email('03-invoice-attachments.eml')
    const exe = r.email!.attachments[1]!.sha256
    const res = empty()
    res.urlhaus.results = [{ kind: 'payload', indicator: exe, listed: true, threat: 'malware_download', reference: 'https://urlhaus.abuse.ch/browse.php?search=x' }]
    const once = applyReputation(r, res, buildLookupRequest(r))
    const twice = applyReputation(once, res, buildLookupRequest(r))
    expect(once.email!.attachments[1]!.urlhaus?.threat).toBe('malware_download')
    expect(twice.findings.filter((f) => f.kind === 'rep-urlhaus')).toHaveLength(1)
    expect(r.findings.some((f) => f.kind === 'rep-urlhaus')).toBe(false) // original untouched
  })
})

describe('ATT&CK tagging', () => {
  it('only uses pinned, current techniques (T1656 and T1672 are revoked)', async () => {
    const reports: Report[] = [
      await email('01-m365-credential-phish.eml'),
      await email('02-fake-recruiter.eml'),
      await email('03-invoice-attachments.eml'),
      text('05-smishing-toll.txt'),
      text('06-smishing-package.txt'),
    ]
    for (const r of reports) {
      for (const f of r.findings) for (const id of f.attack) expect(TECHNIQUES[id], `${f.kind} → ${id}`).toBeDefined()
    }
    const all = reports.flatMap((r) => r.findings.flatMap((f) => f.attack))
    expect(all).not.toContain('T1656')
    expect(all).not.toContain('T1672')
    for (const t of Object.values(TECHNIQUES)) expect(t.url).toMatch(/^https:\/\/attack\.mitre\.org\/techniques\/T\d{4}(\/\d{3})?\/$/)
  })

  it('tags each sample plausibly', async () => {
    const ids = (r: Report) => reportTechniques(r).map((t) => t.id)
    expect(ids(await email('01-m365-credential-phish.eml'))).toEqual(expect.arrayContaining(['T1583.001', 'T1598.003', 'T1684.001', 'T1684.002']))
    expect(ids(await email('03-invoice-attachments.eml'))).toEqual(expect.arrayContaining(['T1566.001', 'T1204.002', 'T1036.007', 'T1036.008']))
    expect(ids(await email('02-fake-recruiter.eml'))).toEqual(expect.arrayContaining(['T1684.001', 'T1585.002']))
    const sms = ids(text('05-smishing-toll.txt'))
    expect(sms).toContain('T1660')
    expect(sms.some((id) => id.startsWith('T1566') || id.startsWith('T1204'))).toBe(false)
    expect((await email('04-legit-newsletter.eml')).findings.flatMap((f) => f.attack)).toEqual([])
  })
})

describe('exports', () => {
  it('defanged IOC list never contains a clickable URL', async () => {
    const list = defangedIocList(await email('01-m365-credential-phish.eml'))
    expect(list).toContain('hxxps[://]login[.]micros0ft-online[.]example')
    expect(list).toContain('security-noreply[@]micros0ft-online[.]example')
    expect(list).not.toMatch(/https?:\/\//)
  })

  it('JSON export carries raw and defanged values plus ATT&CK', async () => {
    const doc = JSON.parse(iocJson(await email('03-invoice-attachments.eml')))
    expect(doc.verdict).toBe('high')
    expect(doc.indicators.find((i: { type: string }) => i.type === 'sha256')).toBeDefined()
    expect(doc.attack.techniques.length).toBeGreaterThan(0)
  })

  it('ticket summary has verdict, IOCs, tags and actions, with nothing clickable', async () => {
    const md = ticketSummary(await email('01-m365-credential-phish.eml'))
    expect(md).toContain('## Phishing triage: High risk — likely phishing')
    expect(md).toContain('### Indicators (defanged)')
    expect(md).toContain('[T1684.001 Social Engineering: Impersonation](https://attack.mitre.org/techniques/T1684/001/)')
    expect(md).toContain('### Recommended actions')
    // The only real links are attack.mitre.org technique pages.
    const links = [...md.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0])
    expect(links.every((l) => l.startsWith('https://attack.mitre.org/'))).toBe(true)
  })

  it('escapes attacker-controlled Markdown', () => {
    expect(mdEscape('[click](https://evil.example) ![x](y) <b>`code`</b>')).toBe(
      '\\[click\\](hxxps[://]evil[.]example) \\!\\[x\\](y) \\<b\\>\\`code\\`\\</b\\>',
    )
    expect(mdCode('a ` b `` c')).toBe('``` a ` b `` c ```')
  })
})

describe('fetchLookup', () => {
  it('posts JSON to our own endpoint', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(empty()), { status: 200 }))
    await fetchLookup({ urls: [], domains: ['a.example'], hashes: [] }, { fetchImpl: f as unknown as typeof fetch })
    expect(f).toHaveBeenCalledWith('/api/lookup', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }))
  })

  it('maps 429 and network failures to friendly errors', async () => {
    const limited = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }))
    await expect(fetchLookup({ urls: [], domains: ['a.example'], hashes: [] }, { fetchImpl: limited as unknown as typeof fetch })).rejects.toMatchObject({
      retryAfter: 30,
    })
    const down = vi.fn(async () => {
      throw new TypeError('network')
    })
    await expect(fetchLookup({ urls: [], domains: ['a.example'], hashes: [] }, { fetchImpl: down as unknown as typeof fetch })).rejects.toBeInstanceOf(LookupError)
  })
})
