const PREFIX = 'memovia_cache_'

interface CacheEntry<T> {
  data: T
  ts: number
}

export interface Cache<T> {
  get(): { data: T; ts: number } | null
  set(data: T): void
  clear(): void
}

function createLocalStorageCache<T>(key: string, ttlMs: number): Cache<T> {
  const lsKey = PREFIX + key
  let memory: CacheEntry<T> | null = null

  return {
    get() {
      if (memory && Date.now() - memory.ts < ttlMs) return memory
      try {
        const raw = localStorage.getItem(lsKey)
        if (!raw) return null
        const entry: CacheEntry<T> = JSON.parse(raw)
        if (Date.now() - entry.ts >= ttlMs) {
          localStorage.removeItem(lsKey)
          return null
        }
        memory = entry
        return entry
      } catch {
        return null
      }
    },
    set(data: T) {
      const entry: CacheEntry<T> = { data, ts: Date.now() }
      memory = entry
      try {
        localStorage.setItem(lsKey, JSON.stringify(entry))
      } catch {
        // localStorage unavailable (private mode, quota exceeded) — in-memory only
      }
    },
    clear() {
      memory = null
      try {
        localStorage.removeItem(lsKey)
      } catch {
        // ignore
      }
    },
  }
}

function createMemoryCache<T>(ttlMs: number): Cache<T> {
  let memory: CacheEntry<T> | null = null
  return {
    get() {
      if (!memory || Date.now() - memory.ts >= ttlMs) return null
      return memory
    },
    set(data: T) {
      memory = { data, ts: Date.now() }
    },
    clear() {
      memory = null
    },
  }
}

export function createCache<T>(key: string, ttlMs: number, opts?: { inMemoryOnly?: boolean }): Cache<T> {
  if (opts?.inMemoryOnly) return createMemoryCache<T>(ttlMs)
  return createLocalStorageCache<T>(key, ttlMs)
}
