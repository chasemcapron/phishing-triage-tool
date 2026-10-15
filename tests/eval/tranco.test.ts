// False positives on real, popular websites: every domain in a Tranco list, pasted as a bare link,
// should come back "No red flags". Skipped unless you point it at the list:
//   1. Download list N26LW (the one popular.ts was built from): https://tranco-list.eu/download/N26LW/1000000
//   2. TRANCO_CSV=path/to/top-1m.csv npm run eval
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeText } from '../../src/engine'

const CSV = process.env.TRANCO_CSV

describe.skipIf(!CSV)('Tranco false-positive sweep', () => {
  const domains = CSV
    ? readFileSync(CSV, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.split(',')[1]?.trim() ?? '')
    : []
  const flagged = (from: number, to: number) => domains.slice(from - 1, to).filter((d) => d && analyzeText(`https://${d}/`).verdict !== 'none')

  it('flags none of the 10,000 most popular sites', () => {
    expect(flagged(1, 10_000)).toEqual([])
  })

  it('flags under 0.5% of ranks 10,001 to 20,000', () => {
    const hits = flagged(10_001, 20_000)
    console.log(`Ranks 10,001-20,000: ${hits.length}/10,000 flagged\n${hits.join('\n')}`)
    expect(hits.length).toBeLessThan(50)
  })
})
