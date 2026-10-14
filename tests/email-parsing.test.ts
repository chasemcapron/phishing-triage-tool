import { describe, expect, it } from 'vitest'
import { analyzeEmail, InputError } from '../src/engine'
import { methodResult, parseAuthResultsValue } from '../src/engine/parse/authResults'
import { extractAddress, parseHeaders } from '../src/engine/parse/headers'
import { parseReceivedChain, parseReceivedValue } from '../src/engine/parse/received'

describe('parseHeaders', () => {
  it('unfolds continuation lines and keeps order', () => {
    const h = parseHeaders('Received: from a\r\n  by b; Mon, 1 Jan 2026 00:00:00 +0000\r\nSubject: hi\r\n\tthere\r\n\r\nbody: no')
    expect(h).toEqual([
      { name: 'received', value: 'from a by b; Mon, 1 Jan 2026 00:00:00 +0000' },
      { name: 'subject', value: 'hi there' },
    ])
  })

  it('extracts addresses', () => {
    expect(extractAddress('"Name" <A@B.example>')).toBe('a@b.example')
    expect(extractAddress('<bounce+x@b.example>')).toBe('bounce+x@b.example')
    expect(extractAddress('plain@c.example')).toBe('plain@c.example')
  })
})

describe('parseAuthResultsValue', () => {
  it('parses a Google header, ignoring comments', () => {
    const h = parseAuthResultsValue(
      'mx.google.com; dkim=pass header.i=@x.example header.s=s1; spf=pass (google.com: domain of a@x.example designates 192.0.2.1 as permitted sender) smtp.mailfrom=a@x.example; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=x.example',
      'auth',
    )
    expect(h.authservId).toBe('mx.google.com')
    expect(h.methods.map((m) => `${m.method}=${m.result}`)).toEqual(['dkim=pass', 'spf=pass', 'dmarc=pass'])
    expect(h.methods[2]!.props['header.from']).toBe('x.example')
  })

  it('parses the Microsoft 365 format with no authserv-id', () => {
    const h = parseAuthResultsValue(
      'spf=fail (sender IP is 203.0.113.9) smtp.mailfrom=x.example; dkim=none (message not signed) header.d=none;dmarc=fail action=quarantine header.from=x.example;compauth=fail reason=000',
      'auth',
    )
    expect(h.authservId).toBeNull()
    expect(h.methods.map((m) => `${m.method}=${m.result}`)).toEqual(['spf=fail', 'dkim=none', 'dmarc=fail', 'compauth=fail'])
  })

  it('strips the instance tag from ARC headers', () => {
    const h = parseAuthResultsValue('i=1; mx.google.com; spf=pass smtp.mailfrom=x.example', 'arc')
    expect(h.authservId).toBe('mx.google.com')
  })

  it('treats any passing DKIM signature as a pass', () => {
    const h = { ...parseAuthResultsValue('mx.example; dkim=fail header.d=a.example; dkim=pass header.d=b.example', 'auth'), index: 0, trusted: true }
    expect(methodResult(h, 'dkim')).toBe('pass')
  })
})

describe('parseReceivedValue', () => {
  it('prefers the connecting IP over the HELO literal', () => {
    const hop = parseReceivedValue(
      'from [10.0.0.5] (unknown [198.51.100.23]) by mail.example (Postfix) with ESMTPSA id X; Tue, 13 Oct 2026 14:41:55 +0000 (UTC)',
    )
    expect(hop).toMatchObject({ from: '[10.0.0.5]', fromIp: '198.51.100.23', by: 'mail.example', protocol: 'ESMTPSA', date: '2026-10-13T14:41:55.000Z' })
  })

  it('reads IPv6 and bare parenthesized IPs', () => {
    expect(parseReceivedValue('from a.example (2001:db8::1:12) by b.example with SMTP; Tue, 13 Oct 2026 13:05:31 +0000').fromIp).toBe('2001:db8::1:12')
    expect(parseReceivedValue('from a.example (203.0.113.9) by b.example; Tue, 13 Oct 2026 13:05:31 +0000').fromIp).toBe('203.0.113.9')
  })
})

const msg = (headers: string, body = 'Hello Jordan,\r\nsee you.') => `${headers.trim().replace(/\n/g, '\r\n')}\r\n\r\n${body}`

describe('analyzeEmail checks', () => {
  it('flags a private IP at the provider boundary', async () => {
    const r = await analyzeEmail(
      msg(`Received: from attacker.example (attacker.example [10.1.2.3]) by mx.google.com; Tue, 13 Oct 2026 10:00:00 +0000
Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=a@x.example; dkim=pass header.d=x.example; dmarc=pass header.from=x.example
From: A <a@x.example>
Subject: hi`),
    )
    expect(r.findings.map((f) => f.kind)).toContain('relay-private-ip-boundary')
  })

  it('flags display-name tricks and free webmail brand claims', async () => {
    const r = await analyzeEmail(
      msg(`From: "PayPal Support <service@paypal.com>" <paypal.support.desk@gmail.com>
Subject: Account notice`),
    )
    const kinds = r.findings.map((f) => f.kind)
    expect(kinds).toEqual(expect.arrayContaining(['sender-display-brand', 'sender-display-email', 'sender-freemail-org']))
    expect(r.findings.find((f) => f.kind === 'sender-display-brand')?.explanation).toMatch(/free personal email/)
  })

  it('does not flag Return-Path/Message-ID differences when DMARC passes', async () => {
    const r = await analyzeEmail(
      msg(`Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=b@esp.example; dkim=pass header.d=brand.example; dmarc=pass header.from=brand.example
Return-Path: <b@esp.example>
Message-ID: <1@esp.example>
From: Brand <news@brand.example>
Subject: Weekly`),
    )
    expect(r.findings.map((f) => f.kind)).not.toEqual(expect.arrayContaining(['sender-return-path-mismatch']))
    expect(r.findings.map((f) => f.kind)).not.toContain('sender-message-id-mismatch')
  })

  it('reports extra (non-conflicting) authentication headers', async () => {
    const r = await analyzeEmail(
      msg(`Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=a@x.example; dkim=pass header.d=x.example; dmarc=pass header.from=x.example
Authentication-Results: relay.other.example; spf=pass smtp.mailfrom=a@x.example
From: <a@x.example>`),
    )
    const kinds = r.findings.map((f) => f.kind)
    expect(kinds).toContain('auth-extra-results')
    expect(kinds).not.toContain('auth-conflicting-results')
  })

  it('reports missing authentication results as info only', async () => {
    const r = await analyzeEmail(msg('From: <a@x.example>\nSubject: hi'))
    const f = r.findings.find((x) => x.kind === 'auth-missing')
    expect(f?.weight).toBe(0)
    expect(r.verdict).toBe('none')
  })

  it('accepts headers-only input', async () => {
    const r = await analyzeEmail('From: "Microsoft" <alerts@micr0soft-alerts.example>\nSubject: Sign-in alert')
    expect(r.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['sender-lookalike-domain', 'sender-display-brand']))
  })

  it('rejects input that is not an email', async () => {
    await expect(analyzeEmail('just some words')).rejects.toBeInstanceOf(InputError)
  })

  it('rejects messages over the size limit', async () => {
    await expect(analyzeEmail(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(InputError)
  })

  it('orders hops chronologically and computes delays', () => {
    const hops = parseReceivedChain(
      parseHeaders(`Received: from b.example (b.example [203.0.113.2]) by mx.google.com; Tue, 13 Oct 2026 12:00:00 +0000
Received: from a.example (a.example [192.0.2.1]) by b.example; Tue, 13 Oct 2026 10:00:00 +0000
From: x@y.example`),
    )
    expect(hops.map((h) => [h.by, h.delaySeconds])).toEqual([
      ['b.example', null],
      ['mx.google.com', 7200],
    ])
  })
})
