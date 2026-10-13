import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeEmail, analyzeText, type Report } from '../src/engine'

interface Sample {
  id: string
  file: string
  mode: 'email' | 'text'
  expectedLocalVerdict: Report['verdict']
  expectedSignals: string[]
  expectNoFindings?: boolean
}

const manifest = JSON.parse(readFileSync('samples/manifest.json', 'utf8')) as { samples: Sample[] }

async function run(s: Sample): Promise<Report> {
  const raw = readFileSync(`samples/${s.file}`)
  return s.mode === 'email' ? analyzeEmail(new Uint8Array(raw)) : analyzeText(raw.toString('utf8'))
}

describe.each(manifest.samples)('sample $id', (s) => {
  it(`has local verdict "${s.expectedLocalVerdict}"`, async () => {
    expect((await run(s)).verdict).toBe(s.expectedLocalVerdict)
  })

  it('triggers every expected signal', async () => {
    const kinds = (await run(s)).findings.map((f) => f.kind)
    expect(kinds).toEqual(expect.arrayContaining(s.expectedSignals))
  })

  if (s.expectNoFindings) {
    it('produces no findings at all (false-positive guard)', async () => {
      expect((await run(s)).findings).toEqual([])
    })
  }

  it('gives every finding evidence-backed, plain-English output', async () => {
    const r = await run(s)
    for (const f of r.findings) {
      expect(f.explanation.length).toBeGreaterThan(20)
      expect(f.weight).toBeGreaterThanOrEqual(0)
      if (f.weight > 0) expect(f.evidence.length).toBeGreaterThan(0)
    }
    if (r.verdict !== 'none') expect(r.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('never says "safe"', async () => {
    const r = await run(s)
    expect(JSON.stringify([r.verdictLabel, r.reasons, r.findings.map((f) => f.explanation)])).not.toMatch(/\bsafe\b/i)
  })
})

describe('email sample details', () => {
  const byId = (id: string) => manifest.samples.find((s) => s.id === id)!

  it('trusts only the provider header in the M365 phish', async () => {
    const auth = (await run(byId('m365-credential-phish'))).email!.auth
    expect(auth.trusted?.authservId).toBe('mx.google.com')
    expect(auth.providerVerified).toBe(true)
    expect(auth.dmarc).toBe('fail')
    expect(auth.headers.filter((h) => h.kind === 'auth')).toHaveLength(2)
  })

  it('handles the Microsoft 365 header with no authserv-id', async () => {
    const auth = (await run(byId('invoice-attachments'))).email!.auth
    expect(auth.trusted?.authservId).toBeNull()
    expect(auth.provider).toMatch(/Microsoft 365/)
    expect(auth.providerVerified).toBe(true)
    expect([auth.spf, auth.dkim, auth.dmarc]).toEqual(['pass', 'none', 'none'])
  })

  it('builds a chronological hop timeline with the boundary hop', async () => {
    const hops = (await run(byId('legit-newsletter'))).email!.hops
    expect(hops.map((h) => h.by)).toEqual(['o1.news.contoso.example', 'mx.google.com', '2001:db8:4f::21'])
    expect(hops.find((h) => h.isBoundary)?.fromIp).toBe('198.51.100.10')
    expect(hops[0]!.ipClass).toBe('private')
    expect(hops.slice(1).every((h) => h.delaySeconds !== null && h.delaySeconds >= 0)).toBe(true)
  })

  it('hashes attachments and detects their real type', async () => {
    const atts = (await run(byId('invoice-attachments'))).email!.attachments
    expect(atts.map((a) => [a.filename, a.detectedType])).toEqual([
      ['Invoice_88412.html', 'html'],
      ['Invoice_88412.pdf.exe', 'exe'],
    ])
    for (const a of atts) expect(a.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('picks varied Simple-view reasons', async () => {
    const m365 = (await run(byId('m365-credential-phish'))).reasons
    expect(m365).toHaveLength(3)
    expect(m365[0]).toMatch(/sender address uses micros0ft-online/)
    expect(m365.some((r) => /DMARC/.test(r))).toBe(true)
    expect(m365.filter((r) => /micros0ft-online\.example, which imitates/.test(r))).toHaveLength(1)
    const invoice = (await run(byId('invoice-attachments'))).reasons
    expect(invoice.some((r) => /Invoice_88412\.html/.test(r))).toBe(true)
  })

  it('collects defanged-ready IOCs', async () => {
    const iocs = (await run(byId('m365-credential-phish'))).iocs
    expect(iocs.domains).toEqual(expect.arrayContaining(['micros0ft-online.example']))
    expect(iocs.ips).toEqual(expect.arrayContaining(['198.51.100.23', '203.0.113.45']))
    expect(iocs.emails).toEqual(expect.arrayContaining(['security-noreply@micros0ft-online.example', 'it-helpdesk@account-verify.test']))
  })

  it('never inserts email HTML into the live document', async () => {
    await run(byId('m365-credential-phish'))
    expect(document.body.innerHTML).toBe('')
  })
})
