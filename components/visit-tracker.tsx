'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'
import {
  VISIT_TOKEN_KEY,
  VISIT_TOKEN_TTL_MS,
  deviceClassFor,
  normalisePath,
} from '@/lib/analytics-visits'

/**
 * Records a page view, once per route change.
 *
 * Renders nothing and blocks nothing. The request is fire-and-forget with
 * keepalive, so navigating away mid-flight still delivers it and never delays
 * the next screen.
 *
 * The token it sends is random, lives in localStorage, and rotates every 24
 * hours. It is the only thing linking two page views together, it is hashed
 * before storage, and it cannot be traced to a person. See lib/analytics-visits.
 */
export function VisitTracker() {
  const pathname = usePathname()
  const { account, ready } = useStore()
  // Guards against React strict-mode double effects and against re-firing when
  // the store updates but the route has not changed.
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    // Waiting for `ready` means signed_in is recorded correctly rather than
    // counting every first paint as a signed-out visit.
    if (!ready || !pathname) return

    const path = normalisePath(pathname)
    if (lastSent.current === path) return
    lastSent.current = path

    const token = rotatingToken()
    if (!token) return

    const body = JSON.stringify({
      path,
      device: deviceClassFor(window.innerWidth),
      signedIn: Boolean(account),
      token,
    })

    // keepalive: the browser delivers this even if the page is being unloaded.
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      // Analytics must never surface as an error to the person using the app.
    }).catch(() => {})
  }, [pathname, ready, account])

  return null
}

/**
 * A random token that rotates every 24 hours.
 *
 * Rotating is the point: it lets the dashboard separate "visits" from
 * "visitors" within a day without building a profile that follows someone
 * across days. Returns null when storage is unavailable (private mode, storage
 * disabled), in which case the visit simply is not counted. Under-counting is
 * the correct failure here.
 */
function rotatingToken(): string | null {
  try {
    const now = Date.now()
    const raw = localStorage.getItem(VISIT_TOKEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; at?: number }
      if (parsed?.token && typeof parsed.at === 'number' && now - parsed.at < VISIT_TOKEN_TTL_MS) {
        return parsed.token
      }
    }
    const token = crypto.randomUUID().replace(/-/g, '')
    localStorage.setItem(VISIT_TOKEN_KEY, JSON.stringify({ token, at: now }))
    return token
  } catch {
    return null
  }
}
