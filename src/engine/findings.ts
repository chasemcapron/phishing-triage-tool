import { CHECKS, SEVERITY_AT, type FindingKind } from './config'
import type { Finding, Severity } from './types'

export function severityFor(weight: number): Severity {
  if (weight >= SEVERITY_AT.high) return 'high'
  if (weight >= SEVERITY_AT.medium) return 'medium'
  return weight > 0 ? 'low' : 'info'
}

/**
 * Collects findings, merging repeat hits of the same check into one finding
 * (first explanation wins, evidence accumulates) so a check counts once in the score.
 */
export class FindingSet {
  private readonly byKind = new Map<FindingKind, Finding>()

  add(
    kind: FindingKind,
    explanation: string,
    evidence: string | string[] = [],
    opts: { forceHigh?: boolean; source?: Finding['source']; threatTypes?: string[] } = {},
  ): Finding {
    const items = (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean)
    const existing = this.byKind.get(kind)
    if (existing) {
      for (const e of items) if (!existing.evidence.includes(e)) existing.evidence.push(e)
      if (opts.forceHigh) existing.forceHigh = true
      if (opts.threatTypes) existing.threatTypes = [...new Set([...(existing.threatTypes ?? []), ...opts.threatTypes])]
      return existing
    }
    const def = CHECKS[kind]
    const finding: Finding = {
      kind,
      category: def.category,
      title: def.title,
      explanation,
      weight: def.weight,
      severity: severityFor(def.weight),
      evidence: [...new Set(items)],
      attack: [],
      ...(opts.forceHigh ? { forceHigh: true } : {}),
      ...(opts.source ? { source: opts.source } : {}),
      ...(opts.threatTypes ? { threatTypes: [...new Set(opts.threatTypes)] } : {}),
    }
    this.byKind.set(kind, finding)
    return finding
  }

  has(kind: FindingKind): boolean {
    return this.byKind.has(kind)
  }

  /** Highest weight first; ties keep insertion order. */
  list(): Finding[] {
    return [...this.byKind.values()].sort((a, b) => b.weight - a.weight)
  }
}
