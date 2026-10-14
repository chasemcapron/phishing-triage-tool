import { LIMITS, type FindingKind } from '../config'
import { BRANDS, type Brand } from '../data/brands'
import { FREE_HOSTS, REDIRECT_PARAMS, RISKY_TLDS, URL_SHORTENERS } from '../data/lists'
import type { FindingSet } from '../findings'
import type { LinkInfo } from '../types'
import { hostInfo } from '../util/domain'
import { clip } from '../util/text'
import { findLookalike, isOfficialFor, officialBrand, type LookalikeHit } from './lookalike'

export const tldOf = (domain: string) => domain.slice(domain.lastIndexOf('.') + 1).toLowerCase()

const LOGIN_WORDS = /(log-?in|sign-?in|log-?on|verify|account|password|passwd|secure|auth|webmail|owa\b|banking|wp-login)/i

function flag(link: LinkInfo, kind: FindingKind) {
  if (!link.flags.includes(kind)) link.flags.push(kind)
}

export function lookalikeExplanation(hit: LookalikeHit, subject: string): string {
  const where = hit.unicodeHost
  switch (hit.type) {
    case 'homoglyph':
      return `${subject} ${where}, which imitates ${hit.brand} by swapping in look-alike characters ("${hit.matched}"). It is not a ${hit.brand} site.`
    case 'typo':
      return `${subject} ${where}, a misspelling of ${hit.brand} meant to pass at a glance. It is not a ${hit.brand} site.`
    case 'combosquat':
      return `${subject} ${where}, which bolts extra words onto the ${hit.brand} name. It is not an official ${hit.brand} site.`
    case 'brand-subdomain':
      return `${subject} ${where}: "${hit.matched}" is just a prefix to look official, and the site it really belongs to is ${hit.domain}.`
    case 'brand-tld':
      return `${subject} ${where}, which uses the ${hit.brand} name on a domain ${hit.brand} does not use.`
    case 'idn':
      return `${subject} ${where}, an international (punycode) address that can disguise look-alike characters.`
  }
}

export const LOOKALIKE_KIND: Record<LookalikeHit['type'], FindingKind> = {
  homoglyph: 'link-lookalike',
  typo: 'link-lookalike',
  combosquat: 'link-combosquat',
  'brand-subdomain': 'link-brand-subdomain',
  'brand-tld': 'link-brand-tld',
  idn: 'link-idn',
}

/** Parses link display text that itself looks like a URL or domain. */
function displayHost(text: string): string | null {
  const t = text.trim().replace(/[.,;:!?)]+$/, '')
  if (/\s/.test(t) || !/^(https?:\/\/)?[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?([/?#]\S*)?$/iu.test(t)) return null
  try {
    const info = hostInfo(new URL(/^https?:\/\//i.test(t) ? t : `http://${t}`).hostname)
    return info.knownSuffix || info.isIp ? info.host : null
  } catch {
    return null
  }
}

export function checkLinks(links: LinkInfo[], findings: FindingSet): void {
  for (const link of links) {
    if (link.scheme === 'javascript' || link.scheme === 'data' || link.scheme === 'vbscript') {
      flag(link, 'link-script-uri')
      findings.add('link-script-uri', `A link runs code or embedded content (${link.scheme}:) instead of opening a normal web page.`, clip(link.url, 120))
      continue
    }
    const url = new URL(link.url)
    const info = hostInfo(link.host)

    if (link.isIp) {
      flag(link, 'link-raw-ip')
      findings.add('link-raw-ip', `A link points to a bare IP address (${link.host}) instead of a named website, which real companies almost never do.`, link.defanged)
    }
    if (link.registrableDomain && URL_SHORTENERS.has(link.registrableDomain)) {
      flag(link, 'link-shortener')
      findings.add('link-shortener', `A link uses a URL shortener (${link.registrableDomain}), which hides where it really goes. This tool never opens links to find out.`, link.defanged)
    }
    if (url.username || url.password) {
      flag(link, 'link-userinfo')
      findings.add('link-userinfo', `A link contains an "@": everything before it is ignored, and the browser actually opens ${link.host}.`, link.defanged)
    }
    if (info.subdomain && info.subdomain.split('.').length > LIMITS.maxSubdomainLabels) {
      flag(link, 'link-many-subdomains')
      findings.add('link-many-subdomains', 'A web address has an unusually long chain of subdomains, a common way to bury the real domain.', link.defanged)
    }
    for (const [key, value] of url.searchParams) {
      if (!REDIRECT_PARAMS.has(key.toLowerCase()) || !/^(https?:)?\/\//i.test(value)) continue
      let target: string
      try {
        target = new URL(value, 'http://placeholder.invalid').hostname
      } catch {
        continue
      }
      if (hostInfo(target).domain === link.registrableDomain) continue
      flag(link, 'link-redirect-param')
      findings.add('link-redirect-param', `A link carries a second address (${target}) in its "${key}" parameter and may forward you there.`, link.defanged)
    }
    if (link.scheme === 'http' && !link.isBare && LOGIN_WORDS.test(link.host + url.pathname)) {
      flag(link, 'link-http-login')
      findings.add('link-http-login', 'A link looks like a sign-in page but uses unencrypted http://, which real login pages never do.', link.defanged)
    }

    const hit = link.isIp ? null : findLookalike(link.host)
    if (hit) {
      const kind = LOOKALIKE_KIND[hit.type]
      flag(link, kind)
      findings.add(kind, lookalikeExplanation(hit, 'A link goes to'), `${link.defanged} (${hit.type}${hit.brand ? `: ${hit.brand}` : ''})`)
    }

    const host = link.host.toLowerCase()
    const free = FREE_HOSTS.find(
      (h) => (h.exact ? host === h.host : host.endsWith(`.${h.host}`) && !host.startsWith('www.')) && (!h.path || url.pathname.startsWith(h.path)),
    )
    if (free) {
      flag(link, 'link-free-hosting')
      findings.add(
        'link-free-hosting',
        free.kind === 'form'
          ? `A link goes to a ${free.name} form. Anyone can make one in minutes, and real companies never ask you to sign in, verify an account or pay through one.`
          : `A link goes to ${link.unicodeHost}, a page on ${free.name}, where anyone can publish a site for free. Real companies rarely send you to one to sign in or pay.`,
        link.defanged,
      )
    }

    const tld = link.registrableDomain ? tldOf(link.registrableDomain) : ''
    if (RISKY_TLDS.has(tld) && !officialBrand(link.registrableDomain)) {
      flag(link, 'domain-risky-tld')
      findings.add('domain-risky-tld', `A link goes to a .${tld} address. Endings like this are cheap and popular with short-lived fake stores, though many real sites use them too.`, link.defanged)
    }

    for (const text of link.displayTexts) {
      const shown = displayHost(text)
      if (!shown) continue
      const shownDomain = hostInfo(shown).domain ?? shown
      if (shownDomain === (link.registrableDomain ?? link.host)) continue
      flag(link, 'link-text-mismatch')
      findings.add('link-text-mismatch', `The link text shows ${shown}, but clicking it actually goes to ${link.unicodeHost}.`, `shown "${clip(text, 80)}" → real ${link.defanged}`)
    }

    if (link.sources.includes('html-form')) {
      flag(link, 'link-html-form')
      findings.add('link-html-form', `This email has a built-in form that sends whatever you type to ${link.unicodeHost}.`, link.defanged)
    }
  }
}

/** Brands a message or display name claims to be. */
export function mentionedBrands(text: string): Brand[] {
  return BRANDS.filter((b) => b.mentions.length && new RegExp(`(${b.mentions.join('|')})`, 'im').test(text))
}

/** Text mode: the message names a brand but links somewhere that brand doesn't own. */
export function checkBrandMentions(text: string, links: LinkInfo[], findings: FindingSet): void {
  const web = links.filter((l) => l.scheme === 'http' || l.scheme === 'https')
  for (const brand of mentionedBrands(text)) {
    const offsite = web.filter((l) => !isOfficialFor(brand, l.registrableDomain))
    if (!offsite.length) continue
    for (const l of offsite) flag(l, 'link-brand-mention')
    const dest = offsite[0]!.registrableDomain ?? offsite[0]!.host
    findings.add(
      'link-brand-mention',
      `The message claims to be from ${brand.name}, but its link goes to ${dest}, which is not an official ${brand.name} site.`,
      offsite.map((l) => `${brand.name} → ${l.defanged}`),
    )
  }
}
