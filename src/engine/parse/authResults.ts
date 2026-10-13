import type { AuthMethodResult, AuthResultsHeader } from '../types'
import type { RawHeader } from './headers'

/** Removes RFC 5322 comments "(…)", including nested ones. */
function stripComments(s: string): string {
  let out = ''
  let depth = 0
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0) out += ch
  }
  return out
}

const METHOD_RE = /^([a-z][a-z0-9_-]*)\s*=\s*([a-z]+)\b(.*)$/i
const PROP_RE = /([a-z]+\.[a-z0-9_-]+)\s*=\s*("[^"]*"|[^\s;]+)/gi

/**
 * Parses one Authentication-Results (RFC 8601) or ARC-Authentication-Results value.
 * Microsoft 365 omits the authserv-id, so a value that starts with "method=result"
 * gets authservId = null.
 */
export function parseAuthResultsValue(value: string, kind: 'auth' | 'arc'): Omit<AuthResultsHeader, 'index' | 'trusted'> {
  const parts = stripComments(value)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  if (kind === 'arc' && parts[0] && /^i\s*=\s*\d+$/i.test(parts[0])) parts.shift()

  let authservId: string | null = null
  if (parts[0] && !METHOD_RE.test(parts[0])) {
    authservId = parts.shift()!.split(/\s+/)[0]!.toLowerCase()
  }

  const methods: AuthMethodResult[] = []
  for (const part of parts) {
    // Microsoft packs several methods into one segment without ";" in some versions.
    for (const segment of part.split(/\s+(?=[a-z][a-z0-9_-]*=(?:pass|fail|none|neutral|softfail|temperror|permerror|policy|bestguesspass)\b)/i)) {
      const m = METHOD_RE.exec(segment.trim())
      if (!m) continue
      const props: Record<string, string> = {}
      for (const p of m[3]!.matchAll(PROP_RE)) props[p[1]!.toLowerCase()] = p[2]!.replace(/^"|"$/g, '')
      methods.push({ method: m[1]!.toLowerCase(), result: m[2]!.toLowerCase(), props })
    }
  }
  return { kind, authservId, methods, raw: value }
}

export function parseAllAuthResults(headers: RawHeader[]): AuthResultsHeader[] {
  const out: AuthResultsHeader[] = []
  let authIndex = 0
  for (const h of headers) {
    if (h.name === 'authentication-results') {
      out.push({ ...parseAuthResultsValue(h.value, 'auth'), index: authIndex++, trusted: false })
    } else if (h.name === 'arc-authentication-results') {
      out.push({ ...parseAuthResultsValue(h.value, 'arc'), index: -1, trusted: false })
    }
  }
  return out
}

/** Result of a method in one header. For DKIM with several signatures, any pass wins. */
export function methodResult(header: AuthResultsHeader, method: string): string | null {
  const all = header.methods.filter((m) => m.method === method)
  if (!all.length) return null
  return all.find((m) => m.result === 'pass')?.result ?? all[0]!.result
}

/** Microsoft 365 / Exchange Online writes compauth= and dmarc "action=" with no authserv-id. */
export function looksLikeMicrosoft(header: AuthResultsHeader): boolean {
  return header.authservId === null && (header.methods.some((m) => m.method === 'compauth') || /\baction=/i.test(header.raw))
}

export function providerName(header: AuthResultsHeader): string {
  const id = header.authservId
  if (!id) return looksLikeMicrosoft(header) ? 'Microsoft 365 / Exchange Online' : 'Unknown (no authserv-id)'
  if (id === 'mx.google.com') return 'Google (mx.google.com)'
  if (/(^|\.)protection\.outlook\.com$/.test(id)) return `Microsoft 365 (${id})`
  if (/yahoo|aol/.test(id)) return `Yahoo / AOL (${id})`
  if (/icloud|apple/.test(id)) return `iCloud (${id})`
  return id
}
