export interface Window {
  windowMs: number
  max: number
}

/**
 * Per-key sliding-window rate limiter kept in memory. On Vercel each function instance
 * has its own copy, so this is best-effort abuse protection, not a global guarantee.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly longest: number

  constructor(
    private readonly windows: Window[],
    private readonly maxKeys = 10_000,
  ) {
    this.longest = Math.max(...windows.map((w) => w.windowMs))
  }

  /** Records a hit if allowed. Returns retryAfter (seconds) when the key is over a limit. */
  check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.longest)
    for (const w of this.windows) {
      const inWindow = recent.filter((t) => t > now - w.windowMs)
      if (inWindow.length >= w.max) {
        const retryAfter = Math.max(1, Math.ceil((inWindow[0]! + w.windowMs - now) / 1000))
        this.hits.set(key, recent)
        return { ok: false, retryAfter }
      }
    }
    recent.push(now)
    this.hits.delete(key)
    this.hits.set(key, recent)
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value
      if (oldest !== undefined) this.hits.delete(oldest)
    }
    return { ok: true }
  }
}

/**
 * Token budget for an upstream quota (e.g. VirusTotal public API: 4/min, 500/day).
 * Per instance; the real quota is still enforced upstream (429s are handled too).
 */
export class QuotaBudget {
  private minute: number[] = []
  private dayStart = 0
  private dayCount = 0

  constructor(
    private readonly perMinute: number,
    private readonly perDay: number,
  ) {}

  take(now = Date.now()): boolean {
    this.minute = this.minute.filter((t) => t > now - 60_000)
    if (now - this.dayStart >= 86_400_000) {
      this.dayStart = now
      this.dayCount = 0
    }
    if (this.minute.length >= this.perMinute || this.dayCount >= this.perDay) return false
    this.minute.push(now)
    this.dayCount++
    return true
  }

  /** Marks the minute window as exhausted (after an upstream 429). */
  exhaust(now = Date.now()): void {
    while (this.minute.length < this.perMinute) this.minute.push(now)
  }
}
