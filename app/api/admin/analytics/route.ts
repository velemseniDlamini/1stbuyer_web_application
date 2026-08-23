import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import type {
  AnalyticsPayload,
  VisitDay,
  VisitDevice,
  VisitPath,
  VisitSummary,
} from '@/lib/analytics-visits'

/**
 * Aggregate visit figures for the super-admin dashboard.
 *
 * WHAT PROTECTS THIS, HONESTLY
 *
 * Nothing but the client-side staff model, which is the same limitation the
 * staff portal already states about itself: it authenticates in the browser
 * and is a workflow model, not an access boundary. Anyone who knows this URL
 * can call it.
 *
 * That is an accepted, documented trade for this build rather than an
 * oversight, and the blast radius was kept small on purpose: every field below
 * is an AGGREGATE. There is no endpoint here that returns an individual visit,
 * a session token, a user, or anything that could identify a person. The worst
 * a stranger learns is how busy the app is.
 *
 * Before this handles anything commercially sensitive, the staff session has to
 * move server-side and this route has to check it. That is recorded in
 * README.md rather than left to be discovered.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DailyRow = { day: string; visits: number | string; visitors: number | string }
type PathRow = { path: string; visits: number | string; visitors: number | string }
type DeviceRow = { device: VisitDevice['device']; visits: number | string }
type SummaryRow = {
  total_visits: number | string
  total_visitors: number | string
  visits_today: number | string
  visitors_today: number | string
  visits_7d: number | string
  visitors_7d: number | string
  signed_in_share: number | string | null
}

/** Postgres returns bigint and numeric as strings; keep null as null. */
function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: Request) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Analytics are not available.' }, { status: 503 })
  }

  const days = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get('days') ?? 30) || 30, 7),
    90,
  )

  const [summary, daily, paths, devices] = await Promise.all([
    admin.rpc('visit_summary'),
    admin.rpc('visit_daily', { days }),
    admin.rpc('visit_top_paths', { limit_count: 8 }),
    admin.rpc('visit_devices'),
  ])

  const failed = [summary, daily, paths, devices].find((r) => r.error)
  if (failed?.error) {
    console.error(`[analytics] ${failed.error.message}`)
    return NextResponse.json({ error: 'Analytics could not be read.' }, { status: 502 })
  }

  const s = (summary.data as SummaryRow[] | null)?.[0]

  const payload: AnalyticsPayload = {
    summary: {
      totalVisits: num(s?.total_visits),
      totalVisitors: num(s?.total_visitors),
      visitsToday: num(s?.visits_today),
      visitorsToday: num(s?.visitors_today),
      visits7d: num(s?.visits_7d),
      visitors7d: num(s?.visitors_7d),
      // Preserved as null: "no visits yet" and "0% signed in" are different
      // facts and the dashboard renders them differently.
      signedInShare:
        s?.signed_in_share === null || s?.signed_in_share === undefined
          ? null
          : num(s.signed_in_share),
    } satisfies VisitSummary,
    daily: ((daily.data as DailyRow[] | null) ?? []).map((r) => ({
      day: String(r.day).slice(0, 10),
      visits: num(r.visits),
      visitors: num(r.visitors),
    })) satisfies VisitDay[],
    topPaths: ((paths.data as PathRow[] | null) ?? []).map((r) => ({
      path: r.path,
      visits: num(r.visits),
      visitors: num(r.visitors),
    })) satisfies VisitPath[],
    devices: ((devices.data as DeviceRow[] | null) ?? []).map((r) => ({
      device: r.device,
      visits: num(r.visits),
    })) satisfies VisitDevice[],
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(payload)
}
