// Detection evaluation: prints the metrics tables and guards against regressions.
// Run just this file with `npx vitest run tests/eval` (it also runs as part of `npm test`).
import { describe, expect, it } from 'vitest'
import { HOLDOUT_LEGIT, HOLDOUT_SCAMS } from './holdout'
import { formatSummary, summarize } from './metrics'
import { REDTEAM_LEGIT, REDTEAM_SCAMS } from './redteam'
import type { EvalCase } from './types'

// Floors from the last measured run (2026-10-15). Raise them when detection improves; a drop
// below them, or a new false positive, fails the suite.
const SETS = [
  { name: 'Holdout set', scams: HOLDOUT_SCAMS, legit: HOLDOUT_LEGIT, minFlagged: 38, maxFalsePositives: 2 },
  { name: 'Red-team set (development)', scams: REDTEAM_SCAMS, legit: REDTEAM_LEGIT, minFlagged: 24, maxFalsePositives: 0 },
]

describe('offline detection eval', () => {
  for (const set of SETS) {
    it(`${set.name}: ${set.scams.length} scams, ${set.legit.length} legitimate texts`, () => {
      const s = summarize(`${set.name} (${set.scams.length} scams, ${set.legit.length} legitimate)`, set.scams, set.legit)
      // The eval exists to print these tables.
      // oxlint-disable-next-line no-console
      console.log(formatSummary(s))
      expect(s.detected.k, 'scams flagged').toBeGreaterThanOrEqual(set.minFlagged)
      expect(s.falsePositives.k, 'legitimate texts flagged').toBeLessThanOrEqual(set.maxFalsePositives)
    })
  }

  it('corpus hygiene: unique ids, labels match their set, fictional phone numbers only', () => {
    const all: EvalCase[] = [...HOLDOUT_SCAMS, ...HOLDOUT_LEGIT, ...REDTEAM_SCAMS, ...REDTEAM_LEGIT]
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
    for (const c of [...HOLDOUT_SCAMS, ...REDTEAM_SCAMS]) expect(c.expect, c.id).toBe('flag')
    for (const c of [...HOLDOUT_LEGIT, ...REDTEAM_LEGIT]) expect(c.expect, c.id).toBe('clean')
    // US numbers must be fictional: 555-0100 to 555-0199, or the unassigned area code 555.
    for (const c of all) {
      for (const m of c.text.matchAll(/\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g)) {
        const fictional = (m[2] === '555' && /^01\d\d$/.test(m[3] ?? '')) || m[1] === '555'
        expect(fictional, `${c.id}: ${m[0]}`).toBe(true)
      }
    }
  })
})
