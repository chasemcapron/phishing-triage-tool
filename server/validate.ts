import { LOOKUP_LIMITS, type LookupRequest } from '../src/engine/lookup-contract.js'

export type Validated = { ok: true; value: LookupRequest } | { ok: false; error: string }

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/
const SHA256_RE = /^[a-f0-9]{64}$/

/** http(s) only, no credentials, ASCII (punycode) host, bounded length. Returns the normalized URL. */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > LOOKUP_LIMITS.urlLength) return null
  let u: URL
  try {
    u = new URL(input)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (!u.hostname) return null
  u.username = ''
  u.password = ''
  const out = u.href
  return out.length <= LOOKUP_LIMITS.urlLength ? out : null
}

export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const d = input.trim().toLowerCase().replace(/\.$/, '')
  return HOST_RE.test(d) ? d : null
}

export function normalizeHash(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const h = input.trim().toLowerCase()
  return SHA256_RE.test(h) ? h : null
}

function list(value: unknown, max: number, normalize: (v: unknown) => string | null): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) return null
  const out: string[] = []
  for (const v of value) {
    const n = normalize(v)
    if (n === null) return null
    if (!out.includes(n)) out.push(n)
  }
  return out
}

/** Strict validation: any unexpected shape rejects the whole request. */
export function validateLookupRequest(body: unknown): Validated {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Invalid request.' }
  const keys = Object.keys(body)
  if (keys.some((k) => k !== 'urls' && k !== 'domains' && k !== 'hashes')) return { ok: false, error: 'Invalid request.' }
  const b = body as Record<string, unknown>
  const urls = list(b.urls, LOOKUP_LIMITS.urls, normalizeUrl)
  const domains = list(b.domains, LOOKUP_LIMITS.domains, normalizeDomain)
  const hashes = list(b.hashes, LOOKUP_LIMITS.hashes, normalizeHash)
  if (!urls || !domains || !hashes) return { ok: false, error: 'Only http(s) links, domain names and SHA-256 hashes are accepted, within the size limits.' }
  if (!urls.length && !domains.length && !hashes.length) return { ok: false, error: 'Nothing to look up.' }
  return { ok: true, value: { urls, domains, hashes } }
}

const RESERVED = /(^|\.)(test|example|invalid|localhost|local)$|^example\.(com|net|org)$/

/** Reserved/test names have no registration or reputation data worth querying. */
export function isReservedDomain(domain: string): boolean {
  return RESERVED.test(domain)
}
