// Request limiting for the Guardian endpoint.
//
// WHAT THIS IS, AND WHAT IT IS NOT
//
// This is an in-process fixed-window counter. It protects a free-tier API key
// from a runaway render loop, a stuck retry, an impatient user hammering send,
// and casual abuse from one browser. That is genuinely most of the risk for
// this app today.
//
// It is NOT protection against a distributed attacker, and it does NOT survive
// a restart or coordinate across instances. On serverless each instance keeps
// its own counter, so the effective limit is per-instance. Anything stronger
// needs shared state (Upstash, Redis, or Supabase with a small table). That is
// written down in docs/guardian.md rather than left as a surprise.

export type RateLimitConfig = {
  /** Requests allowed per window, per key. */
  limit: number
  windowMs: number
  /** Hard ceiling across all callers, so one key cannot be sharded around. */
  globalLimit: number
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: Number(process.env.GUARDIAN_RATE_LIMIT ?? 12),
  windowMs: Number(process.env.GUARDIAN_RATE_WINDOW_MS ?? 60_000),
  globalLimit: Number(process.env.GUARDIAN_GLOBAL_RATE_LIMIT ?? 120),
}

type Window = { count: number; resetAt: number }

const buckets = new Map<string, Window>()
let globalWindow: Window = { count: 0, resetAt: 0 }

/** Bounded so a stream of unique keys cannot grow the map without limit. */
const MAX_TRACKED_KEYS = 5_000

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number; scope: 'caller' | 'global' }

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  now: number = Date.now(),
): RateLimitResult {
  if (globalWindow.resetAt <= now) globalWindow = { count: 0, resetAt: now + config.windowMs }
  if (globalWindow.count >= config.globalLimit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((globalWindow.resetAt - now) / 1000)),
      scope: 'global',
    }
  }

  let window = buckets.get(key)
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + config.windowMs }
    // Evict expired entries before growing. Cheap because it only runs at the
    // ceiling, and it keeps a long-lived process from leaking memory.
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
      if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear()
    }
    buckets.set(key, window)
  }

  if (window.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      scope: 'caller',
    }
  }

  window.count += 1
  globalWindow.count += 1
  return { allowed: true, remaining: config.limit - window.count }
}

/** Test seam. Never called from application code. */
export function resetRateLimits(): void {
  buckets.clear()
  globalWindow = { count: 0, resetAt: 0 }
}

/**
 * Identify the caller.
 *
 * The forwarded headers are spoofable, which is exactly why this is described
 * above as a speed bump rather than a control. It is still the best key
 * available at the edge, and it correctly separates ordinary users.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return ip.slice(0, 64)
}
