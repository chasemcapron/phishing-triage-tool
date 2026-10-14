import { describe, expect, it } from 'vitest'
import { analyzeText } from '../src/engine'
import { findPopularLookalike, isClassicTypo } from '../src/engine/checks/lookalike'
import { POPULAR_KNOWN, POPULAR_TARGETS, TRANCO_LIST_ID } from '../src/engine/data/popular'

describe('popular-site data (Tranco)', () => {
  it('has 1,000 targets, most popular first, and only the known domains that could collide', () => {
    expect(TRANCO_LIST_ID).toMatch(/^[A-Z0-9]{5}$/)
    expect(POPULAR_TARGETS).toHaveLength(1000)
    expect(POPULAR_TARGETS[0]).toBe('google.com')
    expect(POPULAR_KNOWN.length).toBeGreaterThan(500)
    expect(POPULAR_KNOWN.length).toBeLessThan(3000)
  })

  it('ships no adult, piracy or infrastructure names (the generator filters them)', () => {
    const shipped = new Set([...POPULAR_TARGETS, ...POPULAR_KNOWN])
    // A sample of what list N26LW contains and the filters must keep out.
    for (const d of [
      'xvideos.com',
      'youjizz.com',
      'xhaccess.com',
      'fetlife.com',
      'beeg.com',
      'skipthegames.com',
      'savefrom.net',
      'root-servers.net',
      'example.com',
      'resolver.arpa',
      'rwwsje.com',
    ]) {
      expect(shipped.has(d), d).toBe(false)
    }
    expect([...shipped].filter((d) => /porn|xxx|fap|jizz|nude|hentai|escort|^xh[a-z]{3,}\./.test(d))).toEqual([])
    // ...without losing ordinary popular sites.
    for (const d of ['youtube.com', 'rutube.ru', 'github.com', 'dropbox.com']) expect(POPULAR_TARGETS, d).toContain(d)
  })
})

describe('classic typos', () => {
  it.each([
    ['githubb', 'github', true], // doubled letter
    ['dropbx', 'dropbox', true], // dropped inner letter
    ['gogole', 'google', true], // swapped neighbours
    ['stripes', 'stripe', false], // plain added letter
    ['metlife', 'fetlife', false], // plain substitution
    ['googl', 'google', false], // dropped last letter
    ['dropbo', 'dropbox', false],
  ])('%s vs %s -> %s', (candidate, target, expected) => {
    expect(isClassicTypo(candidate, target)).toBe(expected)
  })
})

describe('popular-site lookalikes', () => {
  it.each([
    ['dr0pbox.com', 'homoglyph', 'dropbox.com'],
    ['instagrarn.com', 'homoglyph', 'instagram.com'],
    ['steamcommunlty.com', 'homoglyph', 'steamcommunity.com'],
    ['githubb.com', 'typo', 'github.com'],
    ['dropbx.com', 'typo', 'dropbox.com'],
    ['canva-login.net', 'combosquat', 'canva.com'],
    ['tiktok-verify.com', 'combosquat', 'tiktok.com'],
    ['dropbox-share.example', 'combosquat', 'dropbox.com'],
  ])('flags %s (%s of %s)', (host, type, site) => {
    expect(findPopularLookalike(host)).toMatchObject({ type, site })
  })

  it.each([
    'github.com', // the site itself
    'spotify.dk', // same name, another ending
    'stripes.com', // a real site one letter away
    'samsung-gamelauncher.com', // a company's own extra domain, no bait words
    'cloudflare-quic.com',
    'mysite-login.example', // bait word, but no popular name
    'example.com',
  ])('leaves %s alone', (host) => {
    expect(findPopularLookalike(host)).toBeNull()
  })

  it('is Suspicious on its own and explains which site it imitates', () => {
    const r = analyzeText('Your files are ready: https://dropbox-share.example/view')
    const f = r.findings.find((x) => x.kind === 'link-popular-lookalike')
    expect(f?.explanation).toContain('dropbox.com')
    expect(r.verdict).toBe('suspicious')
  })

  it('leaves brand lookalikes to the brand check', () => {
    const kinds = analyzeText('https://paypa1.example/login').findings.map((f) => f.kind)
    expect(kinds).toContain('link-lookalike')
    expect(kinds).not.toContain('link-popular-lookalike')
  })
})

describe('popular sites are never called fakes', () => {
  it('rates every shipped popular domain, as a bare link, as no red flags', () => {
    const flagged = [...POPULAR_TARGETS, ...POPULAR_KNOWN].filter((d) => analyzeText(`https://${d}/`).verdict !== 'none')
    expect(flagged).toEqual([])
  })

  it.each([
    'google.de',
    'google.co.uk',
    'google.com.br',
    'amazon.co.jp',
    'amazon.fr',
    'ticketmaster.co.uk',
    'onmicrosoft.com',
    'googleusercontent.com',
    'cloud.com',
    'pcloud.com',
  ])('%s is not flagged', (d) => {
    expect(analyzeText(`Here you go: https://${d}/`).verdict).toBe('none')
  })

  it('still flags a brand on a country ending it does not own, and a brand named in words', () => {
    expect(analyzeText('https://paypal.de/login').verdict).not.toBe('none')
    const named = analyzeText('Your Amazon order is on hold: https://amazon-orders.example/fix')
    expect(named.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['link-combosquat', 'link-brand-mention']))
    expect(named.verdict).not.toBe('none')
  })
})
