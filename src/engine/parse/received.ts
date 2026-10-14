import { PROVIDER_FAMILIES } from '../data/lists'
import type { Hop } from '../types'
import { classifyIp, isIPv4, isIPv6, registrable } from '../util/domain'
import type { RawHeader } from './headers'

function validIp(candidate: string): string | null {
  const s = candidate.replace(/^IPv6:/i, '').trim()
  if (isIPv4(s)) return s
  if (isIPv6(s)) return s.toLowerCase()
  return null
}

function firstIp(s: string): string | null {
  for (const m of s.matchAll(/\[([^\]]+)\]/g)) {
    const ip = validIp(m[1]!)
    if (ip) return ip
  }
  const v4 = /(?<![\d.])((?:\d{1,3}\.){3}\d{1,3})(?![\d.])/.exec(s)
  if (v4 && isIPv4(v4[1]!)) return v4[1]!
  const v6 = /(?<![\w:])([0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7})(?![\w:])/i.exec(s)
  return v6 ? validIp(v6[1]!) : null
}

/**
 * The connecting IP: prefer the one inside the parenthesized TCP-info comment
 * ("from helo (rdns [ip])"), since the HELO name/literal is chosen by the sender.
 */
function connectingIp(fromPart: string): string | null {
  for (const c of fromPart.match(/\(([^()]*)\)/g) ?? []) {
    const ip = firstIp(c)
    if (ip) return ip
  }
  return firstIp(fromPart)
}

export function parseReceivedValue(value: string): Omit<Hop, 'index' | 'delaySeconds' | 'isBoundary'> {
  const semi = value.lastIndexOf(';')
  const clauses = semi >= 0 ? value.slice(0, semi) : value
  const dateText = semi >= 0 ? value.slice(semi + 1).replace(/\([^)]*\)/g, '').trim() : ''
  const time = dateText ? Date.parse(dateText) : NaN

  const fromMatch = /^\s*from\s+(\S+)/i.exec(clauses)
  const byIdx = clauses.search(/\sby\s/i)
  const fromPart = fromMatch ? clauses.slice(0, byIdx >= 0 ? byIdx : undefined) : ''
  const by = /(?:^|\s)by\s+(\S+)/i.exec(clauses)?.[1] ?? null
  const protocol = /\swith\s+(\S+)/i.exec(clauses)?.[1] ?? null
  const fromIp = fromPart ? connectingIp(fromPart) : null

  return {
    from: fromMatch ? fromMatch[1]!.replace(/[;.]$/, '') : null,
    fromIp,
    ipClass: fromIp ? classifyIp(fromIp) : null,
    by: by ? by.replace(/[;.]$/, '') : null,
    protocol: protocol ? protocol.replace(/;$/, '') : null,
    date: Number.isNaN(time) ? null : new Date(time).toISOString(),
    raw: value,
  }
}

/** The organization a host belongs to; every domain of one mail provider counts as one. */
export const orgOf = (host: string | null) => {
  if (!host || host.startsWith('[')) return null
  const d = registrable(host)
  return (d && PROVIDER_FAMILIES.find((f) => f.includes(d))?.[0]) ?? d
}

/** Reverse-DNS name the receiving server recorded, as in "from helo (name.example. [192.0.2.1])". */
export function reverseName(hop: Pick<Hop, 'raw'>): string | null {
  const m = /^\s*from\s+\S+\s+\(([a-z0-9][a-z0-9.-]*[a-z0-9])\.?\s+\[/i.exec(hop.raw)
  return m ? m[1]!.toLowerCase() : null
}

/**
 * Returns hops in chronological order (bottom Received header first), with the delay
 * from the previous hop and the boundary hop marked: the newest hop where the message
 * crossed from one organization's servers into another's (normally sender → your
 * provider). That hop's connecting IP is the one the provider actually saw.
 */
export function parseReceivedChain(headers: RawHeader[]): Hop[] {
  const topDown = headers.filter((h) => h.name === 'received').map((h) => parseReceivedValue(h.value))

  let boundaryTopIndex = topDown.findIndex((h) => {
    if (!h.fromIp || !h.by) return false
    const a = orgOf(h.from)
    return !a || a !== orgOf(h.by)
  })
  if (boundaryTopIndex < 0) boundaryTopIndex = topDown.findIndex((h) => h.fromIp)

  const chronological = topDown.map((h, i) => ({ ...h, isBoundary: i === boundaryTopIndex })).reverse()
  let prevTime: number | null = null
  return chronological.map((h, index) => {
    const t = h.date ? Date.parse(h.date) : null
    const delaySeconds = t !== null && prevTime !== null ? Math.round((t - prevTime) / 1000) : null
    if (t !== null) prevTime = t
    return { ...h, index, delaySeconds }
  })
}
