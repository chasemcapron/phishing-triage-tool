import { parse } from 'tldts'
import type { IpClass } from '../types'
import { hostToUnicode } from './punycode'

/** Reserved TLDs (RFC 2606/6761) accepted so synthetic samples behave like real domains. */
const RESERVED_TLDS = new Set(['test', 'example', 'invalid'])

export interface HostInfo {
  host: string
  unicodeHost: string
  isIp: boolean
  /** Registrable domain per the Public Suffix List, e.g. "example.co.uk". */
  domain: string | null
  /** Registrable domain minus its suffix, e.g. "example". */
  label: string | null
  subdomain: string
  suffix: string | null
  /** The suffix is a real PSL entry or a reserved test TLD. */
  knownSuffix: boolean
}

export function hostInfo(rawHost: string): HostInfo {
  const host = rawHost
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
  const p = parse(host, { allowPrivateDomains: true })
  const suffix = p.publicSuffix
  return {
    host,
    unicodeHost: hostToUnicode(host),
    isIp: Boolean(p.isIp),
    domain: p.domain,
    label: p.domainWithoutSuffix,
    subdomain: p.subdomain ?? '',
    suffix,
    knownSuffix: Boolean(p.isIcann || p.isPrivate || (suffix && RESERVED_TLDS.has(suffix))),
  }
}

/** Registrable domain of a hostname or email address ("a@mail.x.example" → "x.example"). */
export function registrable(hostOrEmail: string | null | undefined): string | null {
  if (!hostOrEmail) return null
  const host = hostOrEmail.includes('@') ? hostOrEmail.slice(hostOrEmail.lastIndexOf('@') + 1) : hostOrEmail
  const info = hostInfo(host.replace(/[<>\s]/g, ''))
  return info.isIp ? info.host : info.domain
}

export function domainOfEmail(address: string | null | undefined): string | null {
  if (!address) return null
  const at = address.lastIndexOf('@')
  return at >= 0
    ? address
        .slice(at + 1)
        .toLowerCase()
        .replace(/[>\s]/g, '')
    : null
}

export function isIPv4(s: string): boolean {
  const parts = s.split('.')
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

export function isIPv6(s: string): boolean {
  return s.includes(':') && /^[0-9a-f:.]+$/i.test(s) && (s.match(/::/g)?.length ?? 0) <= 1 && s.split(':').length <= 8
}

export function classifyIp(ip: string): IpClass {
  if (isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number) as [number, number, number, number]
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private'
    if (a === 127) return 'loopback'
    if (a === 169 && b === 254) return 'link-local'
    if (a === 100 && b >= 64 && b <= 127) return 'cgnat'
    if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return 'documentation'
    if (a === 0 || a >= 224 || (a === 198 && (b === 18 || b === 19))) return 'reserved'
    return 'public'
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1') return 'loopback'
  if (/^f[cd]/.test(v6)) return 'private'
  if (/^fe[89ab]/.test(v6)) return 'link-local'
  if (/^2001:0?db8:/.test(v6)) return 'documentation'
  if (v6 === '::') return 'reserved'
  return 'public'
}

/** Private, loopback, link-local, CGNAT or reserved: never valid on the public internet. */
export function isNonRoutable(cls: IpClass): boolean {
  return cls !== 'public' && cls !== 'documentation'
}
