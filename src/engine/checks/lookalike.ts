import { BRANDS, type Brand } from '../data/brands'
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

/** The brand that owns this registrable domain, if any. */
export function officialBrand(domain: string | null): Brand | null {
  if (!domain) return null
  const d = domain.toLowerCase()
  return BRANDS.find((b) => b.domains.includes(d) || b.officialSuffixes?.some((s) => d.endsWith(s))) ?? null
}

export function isOfficialFor(brand: Brand, domain: string | null): boolean {
  if (!domain) return false
  const d = domain.toLowerCase()
  return brand.domains.includes(d) || Boolean(brand.officialSuffixes?.some((s) => d.endsWith(s)))
}

const tokensOf = (s: string) => s.split(/[-_]+/).filter(Boolean)

/**
 * Checks a hostname against the brand list. Returns the strongest lookalike signal,
 * or null when the host is unrelated or genuinely belongs to the brand.
 */
export function findLookalike(rawHost: string): LookalikeHit | null {
  const info = hostInfo(rawHost)
  if (info.isIp || !info.domain || !info.label) return null
  if (officialBrand(info.domain)) return null

  const label = info.unicodeHost.split('.').slice(-(info.domain.split('.').length))[0] ?? info.label
  const isIdn = info.domain.split('.').some((l) => l.startsWith('xn--'))
  const labelSk = skeleton(label)
  const labelFlatSk = skeleton(label.replace(/[-_]/g, ''))
  const labelTokens = tokensOf(label)
  const subLabels = info.subdomain
    ? hostInfo(info.subdomain).unicodeHost.split('.').flatMap(tokensOf).filter((t) => t !== 'www')
    : []

  const hits: LookalikeHit[] = []
  const hit = (type: LookalikeType, brand: Brand, matched: string) =>
    hits.push({ type, brand: brand.name, matched, domain: info.domain!, unicodeHost: info.unicodeHost })

  for (const brand of BRANDS) {
    for (const kw of brand.keywords) {
      const kwSk = skeleton(kw)
      const substringOk = kw.length >= 6 && !brand.tokenOnly?.includes(kw)

      // Whole registrable label.
      if (labelSk === kwSk || labelFlatSk === kwSk) {
        hit(label === kw ? 'brand-tld' : 'homoglyph', brand, label)
      } else if (kw.length >= 6 && editDistance(labelFlatSk, kwSk) <= (kw.length >= 9 ? 2 : 1)) {
        hit('typo', brand, label)
      }

      // Hyphen-separated tokens ("brand-secure-login").
      if (labelTokens.length > 1) {
        for (const t of labelTokens) {
          const tSk = skeleton(t)
          if (tSk === kwSk) hit(t === kw ? 'combosquat' : 'homoglyph', brand, t)
          else if (kw.length >= 6 && t.length >= 6 && editDistance(tSk, kwSk) === 1) hit('homoglyph', brand, t)
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
