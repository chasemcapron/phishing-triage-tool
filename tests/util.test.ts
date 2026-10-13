import { domainToUnicode } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTENT_CAP, THRESHOLDS } from '../src/engine/config'
import { FindingSet } from '../src/engine/findings'
import { scoreFindings } from '../src/engine/score'
import { defangUrl, refang } from '../src/engine/util/defang'
import { classifyIp } from '../src/engine/util/domain'
import { decodePunycodeLabel, hostToUnicode } from '../src/engine/util/punycode'
import { editDistance, skeleton } from '../src/engine/util/text'

describe('punycode', () => {
  it.each(['xn--pple-43d.com', 'xn--80ak6aa92e.com', 'xn--mnchen-3ya.de', 'xn--ls8h.la', 'plain.example'])(
    'matches Node domainToUnicode for %s',
    (host) => {
      expect(hostToUnicode(host)).toBe(domainToUnicode(host))
    },
  )

  it('rejects malformed labels', () => {
    expect(() => decodePunycodeLabel('a-?')).toThrow()
  })
})

describe('text helpers', () => {
  it('computes edit distance with transpositions', () => {
    expect(editDistance('microsoft', 'microsfot')).toBe(1)
    expect(editDistance('paypal', 'paypall')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
  })

  it('normalizes confusables to the same skeleton', () => {
    expect(skeleton('rnicr0soft')).toBe(skeleton('microsoft'))
    expect(skeleton('pаypal')).toBe(skeleton('paypal')) // Cyrillic а
    expect(skeleton('paypa1')).toBe(skeleton('paypal'))
  })
})

describe('defang / refang', () => {
  it('defangs scheme and host dots only', () => {
    expect(defangUrl('https://a.b.example/x.y?z=1')).toBe('hxxps[://]a[.]b[.]example/x.y?z=1')
    expect(defangUrl('http://198.51.100.1/')).toBe('hxxp[://]198[.]51[.]100[.]1/')
  })

  it('round-trips', () => {
    expect(refang(defangUrl('https://a.b.example/p'))).toBe('https://a.b.example/p')
    expect(refang('evil(.)example and bad{.}test')).toBe('evil.example and bad.test')
  })
})

describe('classifyIp', () => {
  it.each([
    ['10.1.2.3', 'private'],
    ['172.20.0.1', 'private'],
    ['192.168.4.31', 'private'],
    ['127.0.0.1', 'loopback'],
    ['100.64.1.1', 'cgnat'],
    ['198.51.100.7', 'documentation'],
    ['8.8.8.8', 'public'],
    ['fd00::1', 'private'],
    ['2001:db8::1', 'documentation'],
    ['2607:f8b0::1', 'public'],
  ])('%s → %s', (ip, cls) => {
    expect(classifyIp(ip)).toBe(cls)
  })
})

describe('scoring', () => {
  it('caps content signals', () => {
    const f = new FindingSet()
    f.add('content-urgency', 'x', 'e')
    f.add('content-payment', 'x', 'e')
    f.add('content-credentials', 'x', 'e')
    f.add('content-sensitive-info', 'x', 'e')
    expect(scoreFindings(f.list()).score).toBe(CONTENT_CAP)
    expect(scoreFindings(f.list()).verdict).toBe(CONTENT_CAP >= THRESHOLDS.suspicious ? 'suspicious' : 'none')
  })

  it('maps scores to verdicts', () => {
    const f = new FindingSet()
    expect(scoreFindings(f.list()).verdict).toBe('none')
    f.add('link-raw-ip', 'x', 'e')
    expect(scoreFindings(f.list()).verdict).toBe('suspicious')
    f.add('link-lookalike', 'x', 'e')
    expect(scoreFindings(f.list()).verdict).toBe('high')
  })

  it('forces High on a known-bad reputation hit', () => {
    const f = new FindingSet()
    f.add('link-idn', 'x', 'e', { forceHigh: true })
    expect(scoreFindings(f.list())).toMatchObject({ verdict: 'high', verdictLabel: 'High risk — likely phishing' })
  })

  it('merges repeat hits into one finding with all the evidence', () => {
    const f = new FindingSet()
    f.add('link-raw-ip', 'first', 'a')
    f.add('link-raw-ip', 'second', ['b', 'a'])
    expect(f.list()).toHaveLength(1)
    expect(f.list()[0]).toMatchObject({ explanation: 'first', evidence: ['a', 'b'] })
  })
})
