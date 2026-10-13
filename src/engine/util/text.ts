/** Optimal string alignment distance (Levenshtein plus adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[] = new Array(rows * cols).fill(0)
  const at = (i: number, j: number) => d[i * cols + j]!
  for (let i = 0; i < rows; i++) d[i * cols] = i
  for (let j = 0; j < cols; j++) d[j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, at(i - 2, j - 2) + 1)
      d[i * cols + j] = v
    }
  }
  return at(a.length, b.length)
}

// Characters commonly swapped in to imitate Latin letters: Cyrillic and Greek
// look-alikes, digits and symbols. Applied to both sides of every comparison.
const CONFUSABLES: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l',
  ԛ: 'q', ԝ: 'w', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', ո: 'n', ս: 'u', ɡ: 'g', ı: 'i', ɩ: 'i',
  α: 'a', ο: 'o', ν: 'v', ρ: 'p', τ: 't', ε: 'e', κ: 'k', ι: 'i', υ: 'u',
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '$': 's', '@': 'a', '|': 'l',
}

/**
 * Normalizes a string to a "skeleton" so visually confusable strings compare equal:
 * strips accents, maps look-alike characters, folds i/1/l together and rn→m, vv→w.
 */
export function skeleton(input: string): string {
  let s = input.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  s = Array.from(s, (ch) => CONFUSABLES[ch] ?? ch).join('')
  return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/i/g, 'l')
}

/** Shortens untrusted text for evidence lists. */
export function clip(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
