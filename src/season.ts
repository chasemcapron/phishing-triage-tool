// Seasonal decorations follow the calendar. The only saved choice is "off", set by tapping the
// frog (an easter egg); ?season= in the URL previews a season for that visit (handy for QA).

export type Season = 'halloween' | 'fall' | 'winter' | 'none'
export type SeasonChoice = Season | 'auto'

export const SEASONS: readonly Season[] = ['halloween', 'fall', 'winter', 'none']
const STORAGE_KEY = 'season'

const isSeason = (v: unknown): v is Season => typeof v === 'string' && (SEASONS as readonly string[]).includes(v)

/** Halloween in October, fall in November, winter in December, otherwise none (local time). */
export function seasonForDate(d: Date): Season {
  const m = d.getMonth() + 1
  if (m === 10) return 'halloween'
  if (m === 11) return 'fall'
  if (m === 12) return 'winter'
  return 'none'
}

/** A valid ?season= override, or null. */
export function seasonFromUrl(search: string): Season | null {
  const v = new URLSearchParams(search).get('season')?.toLowerCase()
  return isSeason(v) ? v : null
}

/** 'none' if the frog turned decorations off, else 'auto'. Older saved picks (a season) are dropped. */
export function readSeasonChoice(): SeasonChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'none') return 'none'
    if (v !== null) localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
  return 'auto'
}

export function saveSeasonChoice(choice: SeasonChoice) {
  try {
    if (choice === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

/** The starting choice: a URL override wins for this visit, else the saved choice. */
export function initialSeasonChoice(search = window.location.search): SeasonChoice {
  return seasonFromUrl(search) ?? readSeasonChoice()
}

export function resolveSeason(choice: SeasonChoice, now = new Date()): Season {
  return choice === 'auto' ? seasonForDate(now) : choice
}
