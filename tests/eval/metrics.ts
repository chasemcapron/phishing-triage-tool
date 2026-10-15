import { analyzeText } from '../../src/engine'
import type { Verdict } from '../../src/engine'
import type { EvalCase } from './types'

export interface CaseResult {
  id: string
  category: string
  expect: EvalCase['expect']
  score: number
  verdict: Verdict
  /** Finding kinds with their weights, e.g. "link-combosquat(35)". */
  findings: string[]
  /** The engine found at least one web link in the text. */
  hasLink: boolean
}

/** Offline engine only: the same analyzeText the browser runs, without reputation or domain-age lookups. */
export function runCases(cases: readonly EvalCase[]): CaseResult[] {
  return cases.map((c) => {
    const r = analyzeText(c.text)
    return {
      id: c.id,
      category: c.category,
      expect: c.expect,
      score: r.score,
      verdict: r.verdict,
      findings: r.findings.map((f) => `${f.kind}(${f.weight})`),
      hasLink: r.links.some((l) => l.scheme === 'http' || l.scheme === 'https'),
    }
  })
}

export interface Rate {
  k: number
  n: number
  /** Lower and upper bounds of the 95% Wilson score interval. */
  low: number
  high: number
}

/** k out of n with a 95% Wilson score interval (sound for small n and for rates near 0 or 1). */
export function wilson(k: number, n: number, z = 1.959964): Rate {
  if (n === 0) return { k, n, low: 0, high: 1 }
  const p = k / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { k, n, low: Math.max(0, center - half), high: Math.min(1, center + half) }
}

export interface SetSummary {
  name: string
  scams: CaseResult[]
  legit: CaseResult[]
  /** Scams that came back Suspicious or High. */
  detected: Rate
  /** Scams that came back High. */
  high: Rate
  /** Detection split by whether the scam contains a web link. */
  withLink: Rate
  withoutLink: Rate
  /** Legitimate texts that came back Suspicious or High. */
  falsePositives: Rate
  /** Legitimate texts that came back High. */
  falseHigh: Rate
}

export function summarize(name: string, scams: readonly EvalCase[], legit: readonly EvalCase[]): SetSummary {
  const s = runCases(scams)
  const l = runCases(legit)
  const flagged = (rows: CaseResult[]) => wilson(rows.filter((r) => r.verdict !== 'none').length, rows.length)
  return {
    name,
    scams: s,
    legit: l,
    detected: flagged(s),
    high: wilson(s.filter((r) => r.verdict === 'high').length, s.length),
    withLink: flagged(s.filter((r) => r.hasLink)),
    withoutLink: flagged(s.filter((r) => !r.hasLink)),
    falsePositives: wilson(l.filter((r) => r.verdict !== 'none').length, l.length),
    falseHigh: wilson(l.filter((r) => r.verdict === 'high').length, l.length),
  }
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`
export const formatRate = (r: Rate) => `${r.k}/${r.n} | ${pct(r.n ? r.k / r.n : 0)} | ${pct(r.low)}–${pct(r.high)}`

function byCategory(rows: CaseResult[]): Map<string, CaseResult[]> {
  const out = new Map<string, CaseResult[]>()
  for (const r of rows) out.set(r.category, [...(out.get(r.category) ?? []), r])
  return out
}

const caseLine = (r: CaseResult) => `| ${r.id} | ${r.score} | ${r.verdict} | ${r.findings.join(', ') || '(none)'} |`

/** Markdown report: headline rates, per-category breakdown, then every miss and false positive. */
export function formatSummary(s: SetSummary): string {
  const lines = [
    `## ${s.name}`,
    '',
    'Offline engine only (analyzeText): no Safe Browsing, VirusTotal, URLhaus or domain-age lookups.',
    '',
    '| Metric | Count | Rate | 95% CI (Wilson) |',
    '| --- | --- | --- | --- |',
    `| Scams flagged (Suspicious or High) | ${formatRate(s.detected)} |`,
    `| Scams rated High | ${formatRate(s.high)} |`,
    `| ...scams with a web link, flagged | ${formatRate(s.withLink)} |`,
    `| ...scams without a web link, flagged | ${formatRate(s.withoutLink)} |`,
    `| Legitimate texts flagged (false positives) | ${formatRate(s.falsePositives)} |`,
    `| Legitimate texts rated High | ${formatRate(s.falseHigh)} |`,
    '',
    '| Scam category | n | Flagged | High |',
    '| --- | --- | --- | --- |',
    ...[...byCategory(s.scams)].map(
      ([cat, rows]) => `| ${cat} | ${rows.length} | ${rows.filter((r) => r.verdict !== 'none').length} | ${rows.filter((r) => r.verdict === 'high').length} |`,
    ),
    '',
    '| Legitimate category | n | Flagged |',
    '| --- | --- | --- |',
    ...[...byCategory(s.legit)].map(([cat, rows]) => `| ${cat} | ${rows.length} | ${rows.filter((r) => r.verdict !== 'none').length} |`),
  ]
  const misses = s.scams.filter((r) => r.verdict === 'none')
  const fps = s.legit.filter((r) => r.verdict !== 'none')
  lines.push('', `Missed scams (${misses.length}):`, '', '| Case | Score | Verdict | Findings |', '| --- | --- | --- | --- |', ...misses.map(caseLine))
  lines.push('', `False positives (${fps.length}):`, '', '| Case | Score | Verdict | Findings |', '| --- | --- | --- | --- |', ...fps.map(caseLine))
  return lines.join('\n')
}
