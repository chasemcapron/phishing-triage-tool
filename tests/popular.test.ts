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
    expect([...POPULAR_TARGETS, ...POPULAR_KNOWN].some((d) => /porn|xvideo/.test(d))).toBe(false)
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
