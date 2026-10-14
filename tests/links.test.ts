import { describe, expect, it } from 'vitest'
import { analyzeText } from '../src/engine'
import { extractHtmlLinks, extractTextLinks, normalizeLinks } from '../src/engine/links/extract'

const urls = (text: string) => normalizeLinks(extractTextLinks(text)).map((l) => l.url)

describe('extractTextLinks', () => {
  it('finds scheme URLs and trims sentence punctuation', () => {
    expect(urls('Go to https://example.com/a?b=1, then (see https://x.test/p).')).toEqual(['https://example.com/a?b=1', 'https://x.test/p'])
  })

  it('finds bare domains with paths, as sent in SMS', () => {
    expect(urls('Pay now: delivery-update.top/track or www.example.com')).toEqual(['http://delivery-update.top/track', 'http://www.example.com/'])
  })

  it('finds bare IP links with a path', () => {
    expect(urls('use 203.0.113.77/usps now')).toEqual(['http://203.0.113.77/usps'])
  })

  it('ignores email addresses, prices, abbreviations, versions and filenames', () => {
    expect(urls('Email jordan.lee@university.example about the $6.89 fee, e.g. v2.0.1, see invoice.zip or notes.md')).toEqual([])
  })

  it('keeps file-like TLDs when a path makes them clearly links', () => {
    expect(urls('open invoice.zip/download')).toEqual(['http://invoice.zip/download'])
  })

  it('refangs defanged indicators in text mode', () => {
    const r = analyzeText('IOC: hxxps[://]bad-site[.]example/login')
    expect(r.links.map((l) => l.url)).toEqual(['https://bad-site.example/login'])
  })

  it('finds javascript: and data: URIs', () => {
    const links = normalizeLinks(extractTextLinks('x javascript:alert(1) y data:text/html;base64,PHNjcmlwdD4='))
    expect(links.map((l) => l.scheme)).toEqual(['javascript', 'data'])
  })
})

describe('extractHtmlLinks', () => {
  it('reads anchors, image-map areas and form actions with their display text', () => {
    const links = extractHtmlLinks(`
      <a href="https://evil.example/x">https://www.paypal.com/</a>
      <a href="https://a.example/"><img alt="Pay invoice" src="cid:1"></a>
      <map><area href="https://b.example/" alt="b"></map>
      <form action="https://collect.example/post"><input name="pw"></form>
      <a href="mailto:x@y.example">mail</a><a href="#top">top</a>`)
    expect(links.map((l) => [l.source, l.href, l.displayText])).toEqual([
      ['html-link', 'https://evil.example/x', 'https://www.paypal.com/'],
      ['html-link', 'https://a.example/', 'Pay invoice'],
      ['html-link', 'https://b.example/', undefined],
      ['html-form', 'https://collect.example/post', undefined],
      ['html-link', 'mailto:x@y.example', 'mail'],
      ['html-link', '#top', 'top'],
    ])
    expect(normalizeLinks(links).map((l) => l.url)).not.toContain('mailto:x@y.example')
  })

  it('does not execute scripts while parsing', () => {
    ;(globalThis as Record<string, unknown>).__pwned = false
    extractHtmlLinks('<script>globalThis.__pwned = true</script><img src=x onerror="globalThis.__pwned=true">')
    expect((globalThis as Record<string, unknown>).__pwned).toBe(false)
  })
})

describe('URL heuristics (via analyzeText)', () => {
  const kinds = (text: string) => analyzeText(text).findings.map((f) => f.kind)

  it.each([
    ['http://198.51.100.9/login', 'link-raw-ip'],
    ['https://bit.ly/3abcXYZ', 'link-shortener'],
    ['https://www.example.com@evil.example/', 'link-userinfo'],
    ['https://a.b.c.d.evil.example/', 'link-many-subdomains'],
    ['https://tracker.example/click?url=https%3A%2F%2Fevil.example%2F', 'link-redirect-param'],
    ['http://portal.example/account/signin', 'link-http-login'],
    ['javascript:alert(document.cookie)', 'link-script-uri'],
    ['https://xn--mnchen-3ya.example/', 'link-idn'],
  ])('%s → %s', (url, kind) => {
    expect(kinds(url)).toContain(kind)
  })

  it('does not treat same-site redirect parameters as a redirect', () => {
    expect(kinds('https://shop.example/login?next=https://shop.example/cart')).not.toContain('link-redirect-param')
  })

  it.each(['https://www.paypal.com/signin', 'https://accounts.google.com/', 'https://login.microsoftonline.com/common/oauth2'])(
    'raises nothing for a plain official link: %s',
    (url) => {
      expect(analyzeText(url).findings).toEqual([])
      expect(analyzeText(url).verdict).toBe('none')
    },
  )

  it('flags a brand claim whose link goes elsewhere', () => {
    const r = analyzeText('Netflix: your payment failed, update at https://billing-update.example/nf')
    expect(r.findings.map((f) => f.kind)).toContain('link-brand-mention')
    expect(r.findings.find((f) => f.kind === 'link-brand-mention')?.explanation).toMatch(/claims to be from Netflix/)
  })

  it('does not flag a brand claim when the link is official', () => {
    expect(analyzeText('Your Amazon order shipped: https://www.amazon.com/orders').findings.map((f) => f.kind)).not.toContain('link-brand-mention')
  })

  it('defangs every link', () => {
    expect(analyzeText('https://evil.example/a.b').links[0]!.defanged).toBe('hxxps[://]evil[.]example/a.b')
  })

  it('counts a repeated check once in the score', () => {
    const one = analyzeText('http://198.51.100.1/x').score
    const three = analyzeText('http://198.51.100.1/x http://198.51.100.2/x http://198.51.100.3/x').score
    expect(three).toBe(one)
  })
})
