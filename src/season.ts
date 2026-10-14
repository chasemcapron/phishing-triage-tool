// Seasonal decorations: which one is showing, and why.
// Precedence: ?season= in the URL (not saved), then the visitor's saved choice, then the local date.

export type Season = 'halloween' | 'fall' | 'winter' | 'none'
export type SeasonChoice = Season | 'auto'

export const SEASONS: readonly Season[] = ['halloween', 'fall', 'winter', 'none']
export const SEASON_LABEL: Record<Season, string> = {
  halloween: 'Halloween',
  fall: 'Fall',
  winter: 'Winter',
  none: 'No season',
}
const STORAGE_KEY = 'season'

const isSeason = (v: unknown): v is Season => typeof v === 'string' && (SEASONS as readonly string[]).includes(v)

/** Halloween Oct 15–31, fall the rest of Sep 1–Nov 30, winter Dec 1–Jan 31, otherwise none (local time). */
export function seasonForDate(d: Date): Season {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 10 && day >= 15) return 'halloween'
  if (m >= 9 && m <= 11) return 'fall'
  if (m === 12 || m === 1) return 'winter'
  return 'none'
}

/** A valid ?season= override, or null. */
export function seasonFromUrl(search: string): Season | null {
  const v = new URLSearchParams(search).get('season')?.toLowerCase()
  return isSeason(v) ? v : null
}

export function readSeasonChoice(): SeasonChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isSeason(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
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
