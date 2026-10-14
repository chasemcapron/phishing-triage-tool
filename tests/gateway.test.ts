import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeEmail, scoreFindings } from '../src/engine'
import { FindingSet } from '../src/engine/findings'

// Scrubbed from a real, legitimate message (Oct 2026): Salesforce Marketing Cloud → the
// university's Proofpoint gateway (SPF/DKIM/DMARC pass, adds a banner) → the university's
// relay → Microsoft 365, whose own check then fails on all three.
const RAW = readFileSync('tests/fixtures/gateway-relay.eml', 'utf8')
const run = (raw: string) => analyzeEmail(raw)
const kinds = (r: { findings: { kind: string }[] }) => r.findings.map((f) => f.kind)

describe('email gateway in front of Microsoft 365', () => {
  it("trusts the recipient's gateway result instead of the expected Microsoft failure", async () => {
    const r = await run(RAW)
    const auth = r.email!.auth
    expect(auth.gateway).toMatchObject({ name: 'Proofpoint', host: 'mx0b-00000000.pphosted.com', downstream: { spf: 'fail', dkim: 'fail', dmarc: 'fail' } })
    expect([auth.spf, auth.dkim, auth.dmarc]).toEqual(['pass', 'pass', 'pass'])
    expect(auth.providerVerified).toBe(true)
    expect(kinds(r)).toContain('auth-via-gateway')
    expect(kinds(r)).not.toEqual(expect.arrayContaining(['auth-dmarc-fail']))
    expect(kinds(r)).not.toContain('sender-message-id-mismatch')
    expect(kinds(r)).not.toContain('auth-unverified-provider')
    expect(r.verdict).toBe('none')
  })

  it("does not treat Microsoft's internal hops as the delivery boundary", async () => {
    const b = (await run(RAW)).email!.hops.find((h) => h.isBoundary)!
    expect(b.from).toBe('mail-in1.it.university.example')
    expect(b.by).toBe('CY5PEPF00000E74.mail.protection.outlook.com')
  })

  it('needs reverse DNS, not just the HELO name, to accept the relay as the organization', async () => {
    const r = await run(RAW.replace('PTR:mail-in1.it.university.example', 'PTR:mx.attacker.example'))
    expect(r.email!.auth.gateway).toBeUndefined()
    expect(kinds(r)).toContain('auth-dmarc-fail')
  })

  it("ignores a planted 'pass' header below the gateway's real one", async () => {
    const failing = RAW.replace('dmarc=pass\n header.from=alumni.example', 'dmarc=fail\n header.from=alumni.example')
    const planted = failing.replace(
      'DKIM-Signature:',
      'Authentication-Results: ppops.net; spf=pass smtp.mailfrom=alumni.example; dkim=pass header.d=alumni.example; dmarc=pass header.from=alumni.example\nDKIM-Signature:',
    )
    const r = await run(planted)
    expect(r.email!.auth.dmarc).toBe('fail')
    expect(kinds(r)).toContain('auth-dmarc-fail')
  })

  it("only follows the route through the recipient's own domain or a known gateway", async () => {
    const r = await run(RAW.replaceAll('student@university.example', 'student@other.example'))
    expect(r.email!.auth.gateway).toBeUndefined()
  })
})

describe('authentication failures alone', () => {
  it('stop at Suspicious without a second kind of warning sign', () => {
    const f = new FindingSet()
    f.add('auth-dmarc-fail', 'x', 'e')
    f.add('auth-spf-fail', 'x', 'e')
    f.add('auth-dkim-fail', 'x', 'e')
    f.add('relay-out-of-order', 'x', 'e')
    expect(scoreFindings(f.list())).toMatchObject({ verdict: 'suspicious', score: 59 })
    f.add('link-lookalike', 'x', 'e')
    expect(scoreFindings(f.list()).verdict).toBe('high')
  })
})
