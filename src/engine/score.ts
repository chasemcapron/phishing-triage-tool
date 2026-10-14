import { CONTENT_CAP, THRESHOLDS, VERDICT_LABELS } from './config'
import type { Finding, Verdict } from './types'

export function scoreFindings(findings: Finding[]): { score: number; verdict: Verdict; verdictLabel: string } {
  let content = 0
  let other = 0
  for (const f of findings) {
    if (f.category === 'content') content += f.weight
    else other += f.weight
  }
  let score = other + Math.min(content, CONTENT_CAP)
  const forced = findings.some((f) => f.forceHigh)
  // Authentication can break in transit (forwarding, gateways, mailing lists), so failed checks
  // and relay oddities alone stop at Suspicious: High needs a warning sign of another kind.
  const corroborated = findings.some((f) => f.weight >= 12 && !['auth', 'relay', 'content'].includes(f.category))
  if (!forced && !corroborated) score = Math.min(score, THRESHOLDS.high - 1)
  const verdict: Verdict = forced || score >= THRESHOLDS.high ? 'high' : score >= THRESHOLDS.suspicious ? 'suspicious' : 'none'
  return { score, verdict, verdictLabel: VERDICT_LABELS[verdict] }
}

const LINK_LOOKALIKES = new Set(['link-lookalike', 'link-combosquat', 'link-brand-subdomain', 'link-brand-tld'])

/** A link-lookalike reason that only repeats the sender-domain lookalike adds nothing. */
function redundant(candidate: Finding, chosen: Finding[]): boolean {
  if (!LINK_LOOKALIKES.has(candidate.kind)) return false
  return chosen.some((c) => {
    if (c.kind !== 'sender-lookalike-domain') return false
    const domain = /@([^\s)>]+)/.exec(c.evidence[0] ?? '')?.[1]
    return Boolean(domain && candidate.explanation.includes(domain))
  })
}

/**
 * Two or three plain-English reasons for the Simple view, chosen for variety:
 * forced (reputation) hits first, then the strongest finding from each category,
 * then the heaviest remaining findings, with weak content signals last.
 */
export function topReasons(findings: Finding[], max = 3): string[] {
  const ranked = findings
    .filter((f) => f.weight > 0 || f.forceHigh)
    .sort(
      (a, b) =>
        Number(Boolean(b.forceHigh)) - Number(Boolean(a.forceHigh)) ||
        Number(a.category === 'content') - Number(b.category === 'content') ||
        b.weight - a.weight,
    )
  const chosen: Finding[] = []
  const seen = new Set<string>()
  for (const f of ranked) {
    if (chosen.length >= max) break
    if (f.category === 'content' || seen.has(f.category) || f.weight < 12 || redundant(f, chosen)) continue
    chosen.push(f)
    seen.add(f.category)
  }
  for (const f of ranked) {
    if (chosen.length >= max) break
    if (!chosen.includes(f) && !redundant(f, chosen)) chosen.push(f)
  }
  return chosen
    .sort((a, b) => Number(Boolean(b.forceHigh)) - Number(Boolean(a.forceHigh)) || b.weight - a.weight)
    .map((f) => f.explanation)
}
