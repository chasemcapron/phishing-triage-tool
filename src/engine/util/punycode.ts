// Minimal RFC 3492 punycode decoder for displaying and checking IDN (xn--) labels.
// Browsers expose no domainToUnicode(), and this avoids a dependency.

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128

function adapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)
  let k = 0
  while (delta > ((BASE - TMIN) * TMAX) >> 1) {
    delta = Math.floor(delta / (BASE - TMIN))
    k += BASE
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW))
}

function digit(code: number): number {
  if (code >= 48 && code <= 57) return code - 22
  if (code >= 65 && code <= 90) return code - 65
  if (code >= 97 && code <= 122) return code - 97
  return BASE
}

/** Decodes one punycode label (without the "xn--" prefix). Throws on malformed input. */
export function decodePunycodeLabel(input: string): string {
  const output: number[] = []
  let n = INITIAL_N
  let i = 0
  let bias = INITIAL_BIAS

  const basic = Math.max(input.lastIndexOf('-'), 0)
  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j)
    if (code >= 0x80) throw new Error('invalid punycode')
    output.push(code)
  }

  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) throw new Error('invalid punycode')
      const d = digit(input.charCodeAt(idx++))
      if (d >= BASE) throw new Error('invalid punycode')
      i += d * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (d < t) break
      w *= BASE - t
    }
    const len = output.length + 1
    bias = adapt(i - oldi, len, oldi === 0)
    n += Math.floor(i / len)
    if (n > 0x10ffff) throw new Error('invalid punycode')
    i %= len
    output.splice(i++, 0, n)
  }
  return String.fromCodePoint(...output)
}

/** Converts every xn-- label of a hostname to Unicode, leaving invalid labels as-is. */
export function hostToUnicode(host: string): string {
  return host
    .split('.')
    .map((label) => {
      if (!label.toLowerCase().startsWith('xn--')) return label
      try {
        return decodePunycodeLabel(label.slice(4))
      } catch {
        return label
      }
    })
    .join('.')
}
