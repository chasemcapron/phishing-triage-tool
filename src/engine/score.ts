import { CONTENT_CAP, THRESHOLDS, VERDICT_LABELS } from './config'
import type { Finding, Verdict } from './types'

export function scoreFindings(findings: Finding[]): { score: number; verdict: Verdict; verdictLabel: string } {
  let content = 0
  let other = 0
  for (const f of findings) {
    if (f.category === 'content') content += f.weight
    else other += f.weight
  }
  const score = other + Math.min(content, CONTENT_CAP)
  const forced = findings.some((f) => f.forceHigh)
  const verdict: Verdict = forced || score >= THRESHOLDS.high ? 'high' : score >= THRESHOLDS.suspicious ? 'suspicious' : 'none'
  return { score, verdict, verdictLabel: VERDICT_LABELS[verdict] }
}

/**
 * Plain-English reasons for the Simple view: forced (reputation) hits first, then the
 * heaviest non-content findings, then content signals if there is still room.
 */
export function topReasons(findings: Finding[], max = 3): string[] {
  const ranked = findings
    .filter((f) => f.weight > 0 || f.forceHigh)
    .sort((a, b) => Number(Boolean(b.forceHigh)) - Number(Boolean(a.forceHigh)) || Number(a.category === 'content') - Number(b.category === 'content') || b.weight - a.weight)
  return ranked.slice(0, max).map((f) => f.explanation)
}
