'use client'

import { useEffect, useState } from 'react'
import { Card, Notice, SectionTitle } from '@/components/ui-kit'
import { AreaChart, BarChart, DonutChart } from '@/components/charts'
import { trendPct, type AnalyticsPayload } from '@/lib/analytics-visits'
import { formatRelative } from '@/lib/format'
import { Activity, ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Real traffic, for the super admin.
 *
 * Every number here comes from the app_visits table, which is written by the
 * server on each page view. Nothing is modelled, sampled or seeded, so an empty
 * database renders zeros and says so rather than showing a plausible curve.
 */
export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/analytics?days=${range}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(body?.error ?? 'Analytics could not be read.')
          setData(null)
        } else {
          setData(body as AnalyticsPayload)
          setError('')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Analytics could not be reached.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  if (loading && !data) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          Reading traffic...
        </div>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Notice tone="destructive">
        <strong className="font-semibold">Traffic could not be loaded.</strong> {error}
      </Notice>
    )
  }

  const { summary, daily, topPaths, devices } = data

  // Week on week, computed from the same series the chart draws so the badge
  // and the curve can never disagree.
  const lastSeven = daily.slice(-7).reduce((n, d) => n + d.visits, 0)
  const priorSeven = daily.slice(-14, -7).reduce((n, d) => n + d.visits, 0)
  const weekTrend = trendPct(lastSeven, priorSeven)

  const empty = summary.totalVisits === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Traffic</SectionTitle>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-0.5" role="tablist">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              role="tab"
              aria-selected={range === days}
              onClick={() => setRange(days)}
              className={cn(
                'min-h-8 rounded-md px-2.5 text-xs font-semibold transition',
                range === days ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {empty && (
        <Notice tone="muted">
          <strong className="font-semibold">No visits recorded yet.</strong> Every figure below is
          zero because the table is empty, not because the panel failed. Open the app in another
          tab and this fills in.
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Visits, all time" value={summary.totalVisits} />
        <Kpi label="Visitors, all time" value={summary.totalVisitors} hint="rotating 24h token" />
        <Kpi label="Visits today" value={summary.visitsToday} />
        <Kpi
          label="Visits, last 7 days"
          value={summary.visits7d}
          trend={weekTrend}
          trendLabel="vs previous 7"
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Visits per day</h3>
        </div>
        <AreaChart
          data={daily.map((d) => ({
            // Rendered as "23 Aug" rather than an ISO date: the axis is read at
            // a glance, not parsed.
            label: new Date(`${d.day}T00:00:00Z`).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            }),
            value: d.visits,
            secondary: d.visitors,
          }))}
          label="Visits"
          secondaryLabel="Visitors"
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Most visited screens</SectionTitle>
          <BarChart
            data={topPaths.map((p) => ({
              label: p.path,
              value: p.visits,
              hint: `${p.visitors} visitor${p.visitors === 1 ? '' : 's'}`,
            }))}
            format={(n) => `${n} visit${n === 1 ? '' : 's'}`}
            emptyNote="No screens recorded yet."
          />
        </Card>

        <Card className="p-4">
          <SectionTitle>Device mix</SectionTitle>
          <DonutChart data={devices.map((d) => ({ label: d.device, value: d.visits }))} />
          <p className="mt-3 text-xs text-muted-foreground text-pretty">
            Classified by viewport width at the moment of the visit, using the same breakpoints as
            the layout: under 768px is a phone, under 1280px a tablet.
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle>How these numbers are collected</SectionTitle>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="text-pretty">
            Recorded per page view: the route, a device class, whether the visitor was signed in,
            and the time. <strong>No IP address, no user agent, no user id, no location.</strong>
          </li>
          <li className="text-pretty">
            &ldquo;Visitors&rdquo; counts a random token that the browser rotates every 24 hours,
            stored hashed. Someone who returns tomorrow is counted twice, and that is the deliberate
            cost of not tracking people across days.
          </li>
          <li className="text-pretty">
            Share links are recorded as <code>/share/[token]</code>, never with the live token in
            it.
          </li>
          {summary.signedInShare !== null && (
            <li className="text-pretty">
              {summary.signedInShare}% of visits were from a signed-in account.
            </li>
          )}
          <li className="text-pretty">
            Read {formatRelative(data.generatedAt)}. Visits blocked by a browser with storage
            disabled are not counted, so treat these as a floor, not a precise total.
          </li>
        </ul>
      </Card>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  trend,
  trendLabel,
}: {
  label: string
  value: number
  hint?: string
  trend?: number | null
  trendLabel?: string
}) {
  const Icon = trend === null || trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const tone =
    trend === null || trend === undefined || trend === 0
      ? 'text-muted-foreground'
      : trend > 0
        ? 'text-success'
        : 'text-destructive'

  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
        {value.toLocaleString('en-ZA')}
      </p>
      {trend !== undefined && (
        <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', tone)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {/* A null trend means there is no previous period to compare with,
              which is not the same as "no change". */}
          {trend === null ? 'No prior period' : `${Math.abs(trend)}% ${trendLabel ?? ''}`}
        </p>
      )}
      {hint && !trend && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
