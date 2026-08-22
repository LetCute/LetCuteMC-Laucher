/**
 * queryCache.ts — Centralized in-memory TTL cache for renderer-side requests.
 *
 * Usage:
 *   const data = await queryCache.get('key', () => fetchData(), 30_000)
 *   queryCache.invalidate('key')
 *   queryCache.invalidatePrefix('mods:')
 */

interface CacheEntry<T> {
  data: T
  fetchedAt: number
  ttl: number // ms, 0 = infinite
}

class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private inflight = new Map<string, Promise<unknown>>()
  private readonly maxSize: number

  constructor(maxSize = 256) {
    this.maxSize = maxSize
  }

  /**
   * Get a cached value or fetch it if missing / stale.
   * @param key     Unique cache key
   * @param fetcher Async function that returns fresh data
   * @param ttl     Time-to-live in ms. 0 = cache forever. Default: 30s
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl = 30_000): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined

    // Cache hit and still fresh
    if (entry) {
      const isForever = entry.ttl === 0
      const age = Date.now() - entry.fetchedAt
      if (isForever || age < entry.ttl) {
        return entry.data
      }
    }

    // Deduplicate concurrent requests for the same key
    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>
    }

    const promise = fetcher()
      .then((data) => {
        this._set(key, data, ttl)
        this.inflight.delete(key)
        return data
      })
      .catch((err) => {
        this.inflight.delete(key)
        throw err
      })

    this.inflight.set(key, promise as Promise<unknown>)
    return promise
  }

  /** Manually write a value into cache */
  set<T>(key: string, data: T, ttl = 30_000): void {
    this._set(key, data, ttl)
  }

  /** Remove a specific key */
  invalidate(key: string): void {
    this.store.delete(key)
    this.inflight.delete(key)
  }

  /** Remove all keys with a given prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) {
        this.inflight.delete(key)
      }
    }
  }

  /** Check if a key exists and is still fresh */
  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.ttl === 0) return true
    return Date.now() - entry.fetchedAt < entry.ttl
  }

  /** Clear all cache entries */
  clear(): void {
    this.store.clear()
    this.inflight.clear()
  }

  /** Return cache stats for debugging */
  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: Array.from(this.store.keys()) }
  }

  private _set<T>(key: string, data: T, ttl: number): void {
    // Evict oldest entry if at capacity (simple LRU-like eviction)
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value
      if (firstKey !== undefined) this.store.delete(firstKey)
    }

    this.store.set(key, { data, fetchedAt: Date.now(), ttl })
  }
}

/** Singleton cache instance used across the entire renderer */
export const queryCache = new QueryCache(256)

// ── TTL constants ──────────────────────────────────────────────────────────────
export const CACHE_TTL = {
  /** File-derived metadata (mod jar) — cache forever unless explicitly invalidated */
  MOD_META: 0,
  /** Directory scan results (mods / resourcepacks / shaderpacks / worlds / screenshots) */
  SCAN: 30_000,
  /** Modrinth search results */
  STORE_SEARCH: 5 * 60_000,
  /** Modrinth version list per project */
  STORE_VERSIONS: 5 * 60_000,
  /** Store installed items list */
  STORE_INSTALLATIONS: 15_000,
  /** Stats / playtime data */
  STATS: 60_000,
} as const
