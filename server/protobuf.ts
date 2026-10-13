// Minimal protobuf decoding for Safe Browsing v5 SearchUrlsResponse. v5 only returns
// protobuf ("Unsupported Output Format" for alt=json), and the message is tiny:
//   SearchUrlsResponse { repeated ThreatUrl threats = 1; Duration cache_duration = 2; }
//   ThreatUrl          { string url = 1; repeated ThreatType threat_types = 2; }
//   Duration           { int64 seconds = 1; int32 nanos = 2; }

/** Enum order from Google's discovery document (THREAT_TYPE_UNSPECIFIED = 0). */
export const THREAT_TYPES = ['THREAT_TYPE_UNSPECIFIED', 'MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'] as const

class Reader {
  pos = 0
  constructor(private readonly buf: Uint8Array) {}
  get done(): boolean {
    return this.pos >= this.buf.length
  }
  varint(): number {
    let result = 0
    let shift = 0
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.buf.length) throw new Error('truncated varint')
      const b = this.buf[this.pos++]!
      if (shift < 49) result += (b & 0x7f) * 2 ** shift
      if (!(b & 0x80)) return result
      shift += 7
    }
    throw new Error('varint too long')
  }
  bytes(): Uint8Array {
    const len = this.varint()
    if (this.pos + len > this.buf.length) throw new Error('truncated field')
    const out = this.buf.subarray(this.pos, this.pos + len)
    this.pos += len
    return out
  }
  skip(wire: number): void {
    if (wire === 0) this.varint()
    else if (wire === 1) this.pos += 8
    else if (wire === 2) this.bytes()
    else if (wire === 5) this.pos += 4
    else throw new Error(`unsupported wire type ${wire}`)
  }
}

export interface DecodedThreat {
  url: string
  threatTypes: string[]
}

function decodeThreatUrl(buf: Uint8Array): DecodedThreat {
  const r = new Reader(buf)
  let url = ''
  const types: number[] = []
  while (!r.done) {
    const tag = r.varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 1 && wire === 2) url = new TextDecoder().decode(r.bytes())
    else if (field === 2 && wire === 0) types.push(r.varint())
    else if (field === 2 && wire === 2) {
      const packed = new Reader(r.bytes())
      while (!packed.done) types.push(packed.varint())
    } else r.skip(wire)
  }
  return { url, threatTypes: types.map((n) => THREAT_TYPES[n] ?? 'THREAT_TYPE_UNSPECIFIED') }
}

function decodeDuration(buf: Uint8Array): number {
  const r = new Reader(buf)
  let seconds = 0
  let nanos = 0
  while (!r.done) {
    const tag = r.varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 1 && wire === 0) seconds = r.varint()
    else if (field === 2 && wire === 0) nanos = r.varint()
    else r.skip(wire)
  }
  return seconds * 1000 + Math.round(nanos / 1e6)
}

/** Returns threats and the cache duration in ms (null when absent). Throws on malformed input. */
export function decodeSearchUrlsResponse(buf: Uint8Array): { threats: DecodedThreat[]; cacheMs: number | null } {
  const r = new Reader(buf)
  const threats: DecodedThreat[] = []
  let cacheMs: number | null = null
  while (!r.done) {
    const tag = r.varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 1 && wire === 2) threats.push(decodeThreatUrl(r.bytes()))
    else if (field === 2 && wire === 2) cacheMs = decodeDuration(r.bytes())
    else r.skip(wire)
  }
  return { threats, cacheMs }
}

/** Encoder used only by tests to build fixtures shaped like Google's responses. */
export function encodeSearchUrlsResponse(threats: { url: string; types: number[] }[], seconds: number): Uint8Array {
  const out: number[] = []
  const varint = (n: number, into: number[]) => {
    while (n > 127) {
      into.push((n & 0x7f) | 0x80)
      n = Math.floor(n / 128)
    }
    into.push(n)
  }
  const len = (field: number, bytes: number[], into: number[]) => {
    varint(field * 8 + 2, into)
    varint(bytes.length, into)
    into.push(...bytes)
  }
  for (const t of threats) {
    const msg: number[] = []
    len(1, [...new TextEncoder().encode(t.url)], msg)
    const packed: number[] = []
    t.types.forEach((x) => varint(x, packed))
    len(2, packed, msg)
    len(1, msg, out)
  }
  const dur: number[] = []
  varint(8, dur)
  varint(seconds, dur)
  len(2, dur, out)
  return new Uint8Array(out)
}
