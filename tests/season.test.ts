import { describe, expect, it } from 'vitest'
import { resolveSeason, seasonForDate, seasonFromUrl } from '../src/season'

const d = (m: number, day: number) => new Date(2026, m - 1, day, 12)

describe('seasonForDate', () => {
  it.each([
    [d(8, 31), 'none'],
    [d(9, 1), 'fall'],
    [d(10, 14), 'fall'],
    [d(10, 15), 'halloween'],
    [d(10, 31), 'halloween'],
    [d(11, 1), 'fall'],
    [d(11, 30), 'fall'],
    [d(12, 1), 'winter'],
    [d(1, 31), 'winter'],
    [d(2, 1), 'none'],
    [d(6, 15), 'none'],
  ])('%s -> %s', (date, season) => {
    expect(seasonForDate(date)).toBe(season)
  })
})

describe('seasonFromUrl', () => {
  it('accepts known seasons, case-insensitively', () => {
    expect(seasonFromUrl('?season=halloween')).toBe('halloween')
    expect(seasonFromUrl('?x=1&season=WINTER')).toBe('winter')
    expect(seasonFromUrl('?season=none')).toBe('none')
  })
  it('ignores missing or unknown values', () => {
    expect(seasonFromUrl('')).toBeNull()
    expect(seasonFromUrl('?season=spring')).toBeNull()
    expect(seasonFromUrl('?season=auto')).toBeNull()
  })
})

describe('resolveSeason', () => {
  it('uses the date for auto and the choice otherwise', () => {
    expect(resolveSeason('auto', d(12, 25))).toBe('winter')
    expect(resolveSeason('fall', d(12, 25))).toBe('fall')
    expect(resolveSeason('none', d(10, 31))).toBe('none')
  })
})
