import { describe, expect, it } from 'vitest'
import { analyzeText } from '../src/engine'
import { adviceFor } from '../src/engine/advice'
import { friendSummary, SITE_URL } from '../src/engine/export'

const kinds = (t: string) => analyzeText(t).findings.map((f) => f.kind)

describe('free website and form builders', () => {
  it('flags a brand page on a free host and a sign-in form', () => {
    expect(kinds('Your Netflix account is on hold: https://netflix-billing.pages.dev/')).toContain('link-free-hosting')
    const form = analyzeText('Verify your Microsoft 365 account here https://forms.gle/abc123')
    expect(form.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['link-free-hosting', 'link-brand-mention']))
    expect(form.verdict).toBe('suspicious')
    expect(kinds('https://docs.google.com/forms/d/e/1FAIpQ/viewform')).toContain('link-free-hosting')
  })

  it('is a weak signal on its own and ignores the platforms themselves', () => {
    expect(analyzeText('my portfolio: https://jane-doe.github.io/').verdict).toBe('none')
    for (const t of ['https://www.wordpress.com/', 'https://github.io/', 'https://docs.google.com/document/d/1abc/edit', 'https://pages.dev/']) {
      expect(kinds(t), t).not.toContain('link-free-hosting')
    }
  })
})

describe('hidden characters', () => {
  it('finds a link hidden behind a direction override and flags it', () => {
    const r = analyzeText('Open your invoice: https://exa‮mple.test/gpj.exe')
    expect(r.links.map((l) => l.host)).toEqual(['example.test'])
    expect(r.findings.map((f) => f.kind)).toContain('text-bidi-override')
    expect(r.findings.find((f) => f.kind === 'text-bidi-override')?.evidence[0]).toContain('[U+202E]')
  })

  it('flags zero-width characters splitting a brand name', () => {
    expect(kinds('Your pay​pal account is limited: https://paypal-help.test/')).toContain('text-invisible-chars')
  })

  it('leaves emoji joiners and a leading byte-order mark alone', () => {
    expect(kinds('﻿See you soon 👨‍👩‍👧')).toEqual([])
  })
})

describe('scams without a link', () => {
  it('spots "wrong number" openers', () => {
    for (const t of ['Hi, is this Emily? We met at the conference last week', 'Hello are you Mr. Chen? My assistant gave me this number', 'Sorry, wrong number! Anyway, how is your day?']) {
      const r = analyzeText(t)
      expect(r.findings.map((f) => f.kind), t).toContain('sms-wrong-number')
      expect(r.verdict, t).toBe('suspicious')
    }
  })

  it('spots callback numbers about an account', () => {
    const r = analyzeText('Your Amazon account has been locked. Call 1-888-555-0199 immediately to restore access.')
    expect(r.findings.map((f) => f.kind)).toContain('sms-callback-number')
    expect(r.verdict).toBe('suspicious')
  })

  it('leaves ordinary texts alone', () => {
    for (const t of [
      'Hey, are you coming to dinner tonight?',
      'Call me at 555-201-3344 when you land',
      'Hi Sam, this is Dr. Lee’s office confirming your appointment Tuesday at 3pm.',
      'Is this weekend still good for the move?',
    ]) {
      expect(analyzeText(t).verdict, t).toBe('none')
    }
  })
})

describe('advice and reporting', () => {
  it('matches the advice to the scam', () => {
    const shop = adviceFor(analyzeText('Summer Fridays end of season sale! Up to 80% off, today only: www.summrfrideays.shop'))
    expect(shop.kind).toBe('shop')
    expect(shop.steps[0]).toMatch(/Don't buy/)
    expect(shop.report.map((r) => r.href)).toEqual([
      'https://safebrowsing.google.com/safebrowsing/report_phish/?url=http%3A%2F%2Fwww.summrfrideays.shop%2F',
      'https://reportfraud.ftc.gov/',
      'https://www.ic3.gov/',
    ])
    expect(adviceFor(analyzeText('E-ZPass: you have an unpaid toll balance. Pay now at ezpass-tollpay-services.test')).kind).toBe('toll')
    expect(adviceFor(analyzeText('USPS: your package is on hold, confirm your address at usps-redelivery.test/track')).kind).toBe('delivery')
    const wrong = adviceFor(analyzeText('Hi, is this Emily? We met at the conference last week'))
    expect(wrong.kind).toBe('wrong-number')
    expect(wrong.report.some((r) => r.href.includes('safebrowsing'))).toBe(false)
    const tracked = adviceFor(analyzeText('PayPal: confirm now https://paypa1-login.test/verify?victim=jane@example.com#step2'))
    expect(tracked.report[0]!.href).toBe('https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fpaypa1-login.test%2Fverify')
  })

  it('has nothing to report on a clean result', () => {
    expect(adviceFor(analyzeText('See you at 7!')).report).toEqual([])
  })
})

describe('summary to send someone', () => {
  it('is plain English with every host defanged except our own address', () => {
    const s = friendSummary(analyzeText('Summer Fridays sale, 80% off today only: https://www.summrfrideays.shop/deal'))
    expect(s).toMatch(/^Gone Phishing checked this message: (High risk|Suspicious)/)
    expect(s).toContain('www[.]summrfrideays[.]shop')
    expect(s).toContain("What to do: Don't buy anything from this site.")
    const withoutOurs = s.replace(SITE_URL, '')
    expect(withoutOurs).not.toMatch(/https?:\/\//)
    expect(withoutOurs).not.toMatch(/\b[a-z0-9-]+\.(shop|com|test)\b/i)
  })
})
