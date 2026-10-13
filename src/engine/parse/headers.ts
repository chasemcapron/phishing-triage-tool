export interface RawHeader {
  /** Lowercased header name. */
  name: string
  /** Unfolded value with runs of whitespace collapsed. */
  value: string
}

/** Splits a raw message into its header block and body at the first blank line. */
export function splitMessage(raw: string): { headerBlock: string; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/^\s+/, '')
  const m = /\r?\n\r?\n/.exec(text)
  if (!m) return { headerBlock: text, body: '' }
  return { headerBlock: text.slice(0, m.index), body: text.slice(m.index + m[0].length) }
}

/** Parses headers in order (topmost first), unfolding continuation lines. */
export function parseHeaders(raw: string): RawHeader[] {
  const { headerBlock } = splitMessage(raw)
  const headers: RawHeader[] = []
  let current: { name: string; parts: string[] } | null = null
  const flush = () => {
    if (current) headers.push({ name: current.name, value: current.parts.join(' ').replace(/\s+/g, ' ').trim() })
  }
  for (const line of headerBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && current) {
      current.parts.push(line.trim())
      continue
    }
    const m = /^([!-9;-~]+):[ \t]?(.*)$/.exec(line)
    flush()
    current = m ? { name: m[1]!.toLowerCase(), parts: [m[2] ?? ''] } : null
  }
  flush()
  return headers
}

export function headerValues(headers: RawHeader[], name: string): string[] {
  return headers.filter((h) => h.name === name).map((h) => h.value)
}

export function firstHeader(headers: RawHeader[], name: string): string | null {
  return headers.find((h) => h.name === name)?.value ?? null
}

/** Pulls the bare address out of "Name <a@b>" or "<a@b>". */
export function extractAddress(value: string | null): string | null {
  if (!value) return null
  const angle = /<([^<>\s]+@[^<>\s]+)>/.exec(value)
  if (angle) return angle[1]!.toLowerCase()
  const bare = /[^\s<>"',;]+@[^\s<>"',;]+/.exec(value)
  return bare ? bare[0].toLowerCase() : null
}
