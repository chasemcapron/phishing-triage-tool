import { LIMITS } from '../config'
import type { LinkInfo, LinkSource } from '../types'
import { defangUrl } from '../util/defang'
import { hostInfo } from '../util/domain'

export interface RawLink {
  href: string
  displayText?: string
  source: LinkSource
  isBare?: boolean
}

// TLDs that are also common file extensions; a bare "invoice.zip" in a message is a filename.
const FILE_LIKE_TLDS = new Set(['zip', 'mov', 'md', 'py', 'sh'])

const SCHEME_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`{}|\\^]+/gi
const SCRIPT_URI_RE = /\b(?:javascript:[^\s<>"']+|data:[a-z]+\/[a-z0-9.+-]+[;,][^\s<>"']*)/gi
const BARE_HOST_RE =
  /(?<![\p{L}\p{N}@._/-])((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,63}|xn--[a-z0-9-]{2,59}))(?![\p{L}\p{N}@-])(:\d{2,5})?(\/[^\s<>"'`]*)?/giu
const BARE_IP_RE = /(?<![\w.\/:])((?:\d{1,3}\.){3}\d{1,3})(:\d{2,5})?(\/[^\s<>"'`]*)/g

/** Trims trailing punctuation that belongs to the sentence, not the URL. */
function trimTrailing(url: string): string {
  let u = url
  for (;;) {
    const last = u.at(-1)
    if (!last) return u
    if ('.,;:!?\'"*'.includes(last)) u = u.slice(0, -1)
    else if (last === ')' && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1)
    else if ((last === ']' || last === '}' || last === '>') && !u.includes(last === ']' ? '[' : last === '}' ? '{' : '<'))
      u = u.slice(0, -1)
    else return u
  }
}

/** Finds URLs, script/data URIs, bare domains ("delivery-update.top/track") and bare IP links in plain text. */
export function extractTextLinks(text: string): RawLink[] {
  const found: (RawLink & { at: number })[] = []
  let rest = text
  const blank = (m: RegExpMatchArray) => {
    rest = rest.slice(0, m.index!) + ' '.repeat(m[0].length) + rest.slice(m.index! + m[0].length)
  }

  for (const m of [...rest.matchAll(SCRIPT_URI_RE)]) {
    found.push({ href: trimTrailing(m[0]), source: 'text', at: m.index! })
    blank(m)
  }
  for (const m of [...rest.matchAll(SCHEME_URL_RE)]) {
    const raw = trimTrailing(m[0])
    found.push({ href: /^www\./i.test(raw) ? `http://${raw}` : raw, source: 'text', isBare: /^www\./i.test(raw), at: m.index! })
    blank(m)
  }
  for (const m of [...rest.matchAll(BARE_IP_RE)]) {
    found.push({ href: `http://${trimTrailing(m[0])}`, source: 'text', isBare: true, at: m.index! })
    blank(m)
  }
  for (const m of rest.matchAll(BARE_HOST_RE)) {
    const host = m[1]!
    const path = m[3] ?? ''
    let info
    try {
      info = hostInfo(new URL(`http://${host}`).hostname)
    } catch {
      continue
    }
    if (!info.knownSuffix || !info.domain) continue
    if (!path && info.suffix && FILE_LIKE_TLDS.has(info.suffix)) continue
    found.push({ href: `http://${trimTrailing(m[0])}`, source: 'text', isBare: true, at: m.index! })
  }
  return found.sort((a, b) => a.at - b.at).map(({ at: _at, ...link }) => link)
}

export type HtmlParser = (html: string) => Document

/**
 * Parses HTML into an inert document (DOMParser never runs scripts or loads resources
 * and the result is never attached to the page).
 */
export const inertParser: HtmlParser = (html) => new DOMParser().parseFromString(html, 'text/html')

const collapse = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

export function extractHtmlLinks(html: string, parseHtml: HtmlParser = inertParser): RawLink[] {
  const doc = parseHtml(html)
  const out: RawLink[] = []
  // One selector so results stay in document order.
  for (const el of doc.querySelectorAll('a[href], area[href], form[action]')) {
    if (el.localName === 'form') {
      out.push({ href: collapse(el.getAttribute('action')), source: 'html-form' })
      continue
    }
    const href = collapse(el.getAttribute('href'))
    let text = collapse(el.textContent)
    if (!text) text = collapse(el.querySelector('img[alt]')?.getAttribute('alt'))
    out.push({ href, displayText: text || undefined, source: 'html-link' })
  }
  return out
}

/** Visible text of an HTML document, for content checks when there is no text/plain part. */
export function htmlToText(html: string, parseHtml: HtmlParser = inertParser): string {
  const doc = parseHtml(html)
  doc.querySelectorAll('script, style, head').forEach((n) => n.remove())
  return collapse(doc.body?.textContent)
}

const IGNORED_SCHEMES = /^(mailto|tel|sms|cid|mid|about|#)/i

/** Normalizes, de-duplicates and annotates raw links. Relative and mailto/tel links are skipped. */
export function normalizeLinks(raw: RawLink[]): LinkInfo[] {
  const byUrl = new Map<string, LinkInfo>()
  for (const r of raw) {
    const href = r.href.trim()
    if (!href || IGNORED_SCHEMES.test(href) || href.startsWith('#')) continue
    const script = /^(javascript|data|vbscript):/i.exec(href)
    let link: LinkInfo
    if (script) {
      const url = href.slice(0, 2000)
      link = byUrl.get(url) ?? {
        url, defanged: defangUrl(url), host: '', unicodeHost: '', registrableDomain: null,
        scheme: script[1]!.toLowerCase(), isIp: false, isBare: false, displayTexts: [], sources: [], flags: [],
      }
    } else {
      let parsed: URL
      try {
        parsed = new URL(href)
      } catch {
        continue
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
      const url = parsed.href
      const info = hostInfo(parsed.hostname)
      link = byUrl.get(url) ?? {
        url, defanged: defangUrl(url), host: info.host, unicodeHost: info.unicodeHost,
        registrableDomain: info.isIp ? null : info.domain, scheme: parsed.protocol.slice(0, -1), isIp: info.isIp,
        isBare: Boolean(r.isBare), displayTexts: [], sources: [], flags: [],
      }
      if (!r.isBare) link.isBare = false
    }
    if (r.displayText && !link.displayTexts.includes(r.displayText)) link.displayTexts.push(r.displayText)
    if (!link.sources.includes(r.source)) link.sources.push(r.source)
    byUrl.set(link.url, link)
    if (byUrl.size >= LIMITS.maxLinks) break
  }
  return [...byUrl.values()]
}
