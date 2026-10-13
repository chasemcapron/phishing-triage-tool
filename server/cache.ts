/** Small in-memory TTL cache with LRU eviction (per function instance; best-effort). */
export class TtlCache<V> {
  private readonly map = new Map<string, { value: V; expires: number }>()

  constructor(private readonly maxEntries = 5000) {}

  get(key: string, now = Date.now()): V | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.expires <= now) {
      this.map.delete(key)
      return undefined
    }
    // Refresh recency.
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): void {
    if (ttlMs <= 0) return
    this.map.delete(key)
    this.map.set(key, { value, expires: now + ttlMs })
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}
