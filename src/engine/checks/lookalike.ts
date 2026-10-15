import { BRANDS, type Brand } from '../data/brands'
import { RISKY_TLDS } from '../data/lists'
import { POPULAR_KNOWN, POPULAR_TARGETS } from '../data/popular'
import { hostInfo } from '../util/domain'
import { editDistance, skeleton } from '../util/text'

export type LookalikeType = 'homoglyph' | 'typo' | 'combosquat' | 'brand-subdomain' | 'brand-tld' | 'idn'

export interface LookalikeHit {
  type: LookalikeType
  brand: string
  /** The part of the host that matched, e.g. "micros0ft" or "usps". */
  matched: string
  /** Registrable domain the link really belongs to. */
  domain: string
  unicodeHost: string
}

const PRIORITY: LookalikeType[] = ['homoglyph', 'typo', 'brand-subdomain', 'combosquat', 'brand-tld', 'idn']

// A country ending: "de", "co.uk", "com.br" (two-letter top level, optionally with a generic second level).
const COUNTRY_ENDING = /^(?:(?:com|co|org|net|gov|ac|edu|or|ne|go)\.)?[a-z]{2}$/

const owns = (b: Brand, d: string) =>
  b.domains.includes(d) ||
  Boolean(b.officialSuffixes?.some((s) => d.endsWith(s))) ||
  Boolean(b.countryDomains && d.startsWith(`${b.countryDomains}.`) && COUNTRY_ENDING.test(d.slice(b.countryDomains.length + 1)))

/** The brand that owns this registrable domain, if any. */
export function officialBrand(domain: string | null): Brand | null {
  if (!domain) return null
  const d = domain.toLowerCase()
  return BRANDS.find((b) => owns(b, d)) ?? null
}

export function isOfficialFor(brand: Brand, domain: string | null): boolean {
  return Boolean(domain && owns(brand, domain.toLowerCase()))
}

const tokensOf = (s: string) => s.split(/[-_]+/).filter(Boolean)

/** A long name (8+) with the same first letter and up to a quarter of its letters changed (a third from 12 letters). */
const looseMatch = (sk: string, kwSk: string) =>
  kwSk.length >= 8 &&
  sk[0] === kwSk[0] &&
  Math.abs(sk.length - kwSk.length) <= 3 &&
  editDistance(sk, kwSk) <= Math.floor(kwSk.length / (kwSk.length >= 12 ? 3 : 4))

/**
 * Checks a hostname against the brand list. Returns the strongest lookalike signal,
 * or null when the host is unrelated or genuinely belongs to the brand.
 */
export function findLookalike(rawHost: string): LookalikeHit | null {
  const info = hostInfo(rawHost)
  if (info.isIp || !info.domain || !info.label) return null
  // A brand's own sites (and, via the Tranco top 10,000, its country sites and infrastructure such
  // as google.de or googleusercontent.com) are never imitations of it.
  if (officialBrand(info.domain) || isKnownPopular(info.domain)) return null

  const label = info.unicodeHost.split('.').slice(-info.domain.split('.').length)[0] ?? info.label
  const isIdn = info.domain.split('.').some((l) => l.startsWith('xn--'))
  const labelSk = skeleton(label)
  const labelFlatSk = skeleton(label.replace(/[-_]/g, ''))
  const labelTokens = tokensOf(label)
  // Fake stores on cheap endings mangle long names harder than phishing kits do ("summrfriseay.shop").
  const cheapEnding = RISKY_TLDS.has(info.domain.slice(info.domain.lastIndexOf('.') + 1))
  // Short-name typos and everyday-word brands ("venom", "chasse", "coach") need a cheap ending or a sales/bait word too.
  const storeContext = cheapEnding || labelTokens.some((t) => BAIT.has(t) || STORE_WORDS.has(t))
  const subLabels = info.subdomain
    ? hostInfo(info.subdomain)
        .unicodeHost.split('.')
        .flatMap(tokensOf)
        .filter((t) => t !== 'www')
    : []

  const hits: LookalikeHit[] = []
  const hit = (type: LookalikeType, brand: Brand, matched: string) =>
    hits.push({ type, brand: brand.name, matched, domain: info.domain!, unicodeHost: info.unicodeHost })

  for (const brand of BRANDS) {
    if (brand.storeOnly && !storeContext) continue
    for (const kw of brand.keywords) {
      const kwSk = skeleton(kw)
      const substringOk = kw.length >= 6 && !brand.tokenOnly?.includes(kw)

      // Whole registrable label.
      if (labelSk === kwSk || labelFlatSk === kwSk) {
        hit(label === kw ? 'brand-tld' : 'homoglyph', brand, label)
        // Typos keep the first letter: "cloud" and "pcloud" are other names, not iCloud misspelled.
      } else if (kw.length >= 6 && labelFlatSk[0] === kwSk[0] && editDistance(labelFlatSk, kwSk) <= (kw.length >= 9 ? 2 : 1)) {
        hit('typo', brand, label)
        // Short names only count a classic typo ("nikee", "temuu"); a plain one-letter change is usually another word.
      } else if (kw.length >= 4 && storeContext && isClassicTypo(labelFlatSk, kwSk)) {
        hit('typo', brand, label)
      } else if (cheapEnding && looseMatch(labelFlatSk, kwSk)) {
        hit('typo', brand, label)
      }

      // Hyphen-separated tokens ("brand-secure-login").
      if (labelTokens.length > 1) {
        for (const t of labelTokens) {
          const tSk = skeleton(t)
          if (tSk === kwSk) hit(t === kw ? 'combosquat' : 'homoglyph', brand, t)
          else if (kw.length >= 6 && t.length >= 6 && editDistance(tSk, kwSk) === 1) hit('homoglyph', brand, t)
          else if (kw.length >= 4 && storeContext && isClassicTypo(tSk, kwSk)) hit('typo', brand, t)
          else if (cheapEnding && looseMatch(tSk, kwSk)) hit('typo', brand, t)
        }
      }
      if (substringOk && labelFlatSk !== kwSk && labelFlatSk.includes(kwSk)) hit('combosquat', brand, label)

      // Brand placed in a subdomain ("paypal.com.account-verify.example").
      for (const s of subLabels) {
        const sSk = skeleton(s)
        if (sSk === kwSk || (substringOk && sSk.includes(kwSk))) hit('brand-subdomain', brand, s)
      }
    }
  }

  if (isIdn && !hits.length) {
    return { type: 'idn', brand: '', matched: label, domain: info.domain, unicodeHost: info.unicodeHost }
  }
  hits.sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))
  return hits[0] ?? null
}

// ---------- Popular sites (Tranco top 1,000) ----------
// A wider but more cautious net than the brand list. Only the classic squatting patterns count:
//   - look-alike characters ("dr0pbox", "instagrarn"),
//   - a classic typo: a doubled letter ("githubb"), a dropped inner letter ("dropbx") or two
//     swapped letters ("gogole"); plain one-letter changes are too often other real names
//     (stripe/stripes, metlife/fetlife),
//   - the exact name plus a bait word ("dropbox-login"); companies' own "samsung-gamelauncher"
//     style domains don't use those words.
// The same name on another ending ("spotify.dk") is not flagged, and nothing in the top 10,000 is
// ever flagged, so popular sites with similar names don't trip over each other.

export interface PopularHit {
  type: 'homoglyph' | 'typo' | 'combosquat'
  /** The popular site imitated, e.g. "dropbox.com". */
  site: string
  matched: string
  domain: string
  unicodeHost: string
}

interface Target {
  site: string
  label: string
  flat: string
  sk: string
}

// prettier-ignore
const BAIT = new Set([
  'login', 'log', 'signin', 'sign', 'verify', 'verification', 'secure', 'security', 'account', 'accounts', 'support',
  'help', 'helpdesk', 'update', 'auth', 'wallet', 'recovery', 'recover', 'billing', 'pay', 'payment', 'unlock',
  'confirm', 'alert', 'alerts', 'free', 'gift', 'giftcard', 'reward', 'rewards', 'bonus', 'promo', 'claim', 'refund',
  'restore', 'reset', 'password', 'id', 'team', 'service', 'center', 'centre', 'official', 'online', 'web', 'app',
  'customer', 'care', 'live', 'chat', 'portal', 'access', 'session', 'validate', 'check', 'invoice', 'prize', 'share', 'shared', 'file', 'files', 'doc', 'docs',
  'document', 'drive', 'meeting', 'invite', 'download',
])

// prettier-ignore
const STORE_WORDS = new Set([
  'outlet', 'outlets', 'sale', 'sales', 'store', 'stores', 'shop', 'shops', 'clearance', 'discount', 'deal', 'deals',
  'factory', 'warehouse', 'mall', 'market', 'us', 'usa', 'uk', 'au', 'ca', 'off', 'cheap', 'buy',
])

let targets: Target[] | null = null
let known: Set<string> | null = null
const popularIndex = () => {
  targets ??= POPULAR_TARGETS.map((site) => {
    const label = site.split('.')[0]!
    const flat = label.replace(/-/g, '')
    return { site, label, flat, sk: skeleton(flat) }
  }).filter((t) => t.flat.length >= 5)
  known ??= new Set([...POPULAR_KNOWN, ...POPULAR_TARGETS])
  return { targets, known }
}

/** In the Tranco top 10,000 (only names close to a brand or target are shipped; see popular.ts). */
export function isKnownPopular(domain: string): boolean {
  return popularIndex().known.has(domain.toLowerCase())
}

/** A doubled letter, a dropped inner letter, or two swapped neighbours (not a plain substitution). */
export function isClassicTypo(candidate: string, target: string): boolean {
  if (candidate.length === target.length + 1) {
    for (let i = 1; i < candidate.length; i++) {
      if (candidate[i] === candidate[i - 1] && candidate.slice(0, i) + candidate.slice(i + 1) === target) return true
    }
    return false
  }
  if (candidate.length === target.length - 1) {
    for (let i = 1; i < target.length - 1; i++) {
      if (target.slice(0, i) + target.slice(i + 1) === candidate) return target.length >= 7
    }
    return false
  }
  if (candidate.length === target.length && candidate !== target) {
    const diff = candidate.split('').flatMap((c, i) => (c === target[i] ? [] : [i]))
    return diff.length === 2 && diff[1] === diff[0]! + 1 && candidate[diff[0]!] === target[diff[1]] && candidate[diff[1]] === target[diff[0]!]
  }
  return false
}

const POPULAR_PRIORITY: PopularHit['type'][] = ['homoglyph', 'typo', 'combosquat']

export function findPopularLookalike(rawHost: string): PopularHit | null {
  const info = hostInfo(rawHost)
  if (info.isIp || !info.domain || !info.label) return null
  const { targets, known } = popularIndex()
  if (known.has(info.domain) || officialBrand(info.domain)) return null

  const label = info.unicodeHost.split('.').slice(-info.domain.split('.').length)[0] ?? info.label
  const flat = label.replace(/[-_]/g, '')
  const flatSk = skeleton(flat)
  const tokens = tokensOf(label)
  const baited = tokens.length > 1 && tokens.some((t) => BAIT.has(t))
  const hits: PopularHit[] = []
  const hit = (type: PopularHit['type'], t: Target, matched: string) =>
    hits.push({ type, site: t.site, matched, domain: info.domain!, unicodeHost: info.unicodeHost })

  for (const t of targets) {
    // Same name, different ending or hyphenation: often the real owner, never flagged here.
    if (flat === t.flat) continue
    if (flatSk === t.sk) hit('homoglyph', t, label)
    else if (t.flat.length >= 6 && isClassicTypo(flat, t.flat)) hit('typo', t, label)
    if (baited && t.flat.length >= 5 && tokens.some((tok) => !BAIT.has(tok) && (tok === t.flat || skeleton(tok) === t.sk))) {
      hit('combosquat', t, label)
    }
  }
  hits.sort((a, b) => POPULAR_PRIORITY.indexOf(a.type) - POPULAR_PRIORITY.indexOf(b.type))
  return hits[0] ?? null
}
