'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { JOURNEY_STAGES } from '@/lib/journey'
import { daysSince } from '@/components/compare/compare-panels'
import { bandForScore, targetRateForScore, estimateBuyingPower, isUsableScore } from '@/lib/finance'
import { formatDate, formatZAR } from '@/lib/format'
import { BrandMark } from '@/components/screen-header'
import { Card, Pill, StatTile, SectionTitle } from '@/components/ui-kit'
import {
  Gauge,
  Scale,
  Calculator,
  FileSearch,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  CircleDot,
  Bell,
  Umbrella,
  Compass,
} from 'lucide-react'

const TIPS = [
  {
    tip: 'A "voetstoots" clause does not remove your 6-month implied warranty from a registered dealer.',
    law: 'Consumer Protection Act, s56',
  },
  {
    tip: 'A lender must assess whether you can afford the finance. Skipping it can be reckless credit.',
    law: 'National Credit Act, s80-83',
  },
  {
    tip: 'You can settle vehicle finance early and pay less total interest.',
    law: 'National Credit Act, s125',
  },
  {
    tip: 'Change of ownership must be lodged within 21 days at a registering authority via eNaTIS.',
    law: 'National Road Traffic Act',
  },
]

export function Dashboard() {
  const store = useStore()
  const { profile, currentScore, journeyDone, savedVehicleIds } = store

  const tip = useMemo(() => TIPS[new Date().getDate() % TIPS.length], [])

  const doneCount = Object.values(journeyDone).filter(Boolean).length
  const progress = Math.round((doneCount / JOURNEY_STAGES.length) * 100)
  const nextStage = JOURNEY_STAGES.find((s) => !journeyDone[s.id]) ?? JOURNEY_STAGES[JOURNEY_STAGES.length - 1]

  const buyingPower = estimateBuyingPower({
    monthlyIncome: profile?.monthlyIncome ?? 0,
    score: currentScore,
  })

  return (
    <div>
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <BrandMark />
        <div className="flex items-center gap-1.5">
        <NotificationBell />
        {/* 44px hit area around a 36px avatar: the touch target meets the bar
            without inflating the header. */}
        <Link
          href="/profile"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          aria-label="Profile"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {profile?.firstName?.[0]?.toUpperCase() ?? 'B'}
          </span>
        </Link>
        </div>
      </header>

      <div className="px-4">
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="font-display text-2xl font-semibold leading-tight">
          {profile?.firstName || 'Buyer'}
        </h1>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4 lg:grid-cols-4">
        {currentScore ? (
          <StatTile
            label="Credit score"
            value={currentScore}
            hint={`${bandForScore(currentScore).label} · target ~${targetRateForScore(currentScore).toFixed(2)}%`}
          />
        ) : (
          <Link href="/credit" className="col-span-1">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-primary/40 bg-primary/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/80">
                Credit score
              </p>
              <p className="mt-1 text-sm font-medium text-foreground text-pretty">
                Record it to unlock your target rate
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Start <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        )}
        <StatTile
          label="Est. buying power"
          value={buyingPower > 0 ? formatZAR(buyingPower) : 'Not yet'}
          /* Without a recorded score there is no band, so the hint must not
             claim one. The figure still helps, but only if the user knows it
             rests on an assumed average rate rather than on their own. */
          hint={
            buyingPower === 0
              ? 'Add income to estimate'
              : isUsableScore(currentScore)
                ? 'Based on your income and credit band'
                : 'Assumes an average rate. Record your score for your own number.'
          }
        />
        <StatTile label="Journey" value={`${progress}%`} hint={`${doneCount} of ${JOURNEY_STAGES.length} stages`} />
        <StatTile
          label="Saved cars"
          value={savedVehicleIds.length}
          hint={savedVehicleIds.length ? 'View in Explore' : 'None saved yet'}
        />
      </div>

      {/* Current stage */}
      <div className="mt-6 px-4">
        <SectionTitle
          action={
            <Link href="/journey" className="text-xs font-semibold text-primary">
              View all
            </Link>
          }
        >
          Your next step
        </SectionTitle>
        <Link href={nextStage.href}>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display text-lg font-bold text-primary-foreground">
                {nextStage.index}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-semibold">{nextStage.title}</p>
                  {progress === 100 && <Pill tone="success">Complete</Pill>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{nextStage.blurb}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <div className="h-1.5 w-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="mt-6 px-4">
        <SectionTitle>Tools</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <QuickAction href="/credit" icon={Gauge} label="Credit" desc="Track your score" />
          <QuickAction href="/finance" icon={Calculator} label="Finance" desc="Model a deal" />
          <QuickAction href="/documents" icon={FileSearch} label="Analyse quote" desc="Spot mark-ups" />
          <QuickAction href="/insurance" icon={Umbrella} label="Insurance" desc="Compare cover" />
          <QuickAction href="/explore" icon={Compass} label="Explore" desc="Cars & dealers" />
          <QuickAction href="/rights" icon={Scale} label="Know your rights" desc="CPA & NCA" />
        </div>
      </div>

      {/* Saved comparison, rendered only when one genuinely exists. This
          screen has enough tiles; it does not need another that shows
          something the user never did. */}
      <RecentComparison />

      {/* Legal tip */}
      <div className="mt-6 px-4">
        <SectionTitle>Legal tip of the day</SectionTitle>
        <Card className="bg-accent/40 p-4">
          <p className="text-sm leading-relaxed text-pretty">{tip.tip}</p>
          <p className="mt-2 text-xs font-semibold text-primary">{tip.law}</p>
        </Card>
      </div>

      {/* Activity */}
      <div className="mt-6 px-4 pb-2">
        <SectionTitle>Recent activity</SectionTitle>
        <RecentActivity />
      </div>
    </div>
  )
}

/** "today" / "3 days ago" / a date once it is old enough to want the date. */
function lastUpdatedLabel(iso: string, now: Date = new Date()): string {
  const days = daysSince(iso, now)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(iso)
}

function RecentComparison() {
  const { savedComparisons } = useStore()
  const latest = savedComparisons[0]
  if (!latest) return null

  return (
    <div className="mt-6 px-4">
      <SectionTitle
        action={
          <Link href="/compare" className="text-xs font-semibold text-primary">
            All comparisons
          </Link>
        }
      >
        Your last comparison
      </SectionTitle>
      <Link href={`/compare?restore=${latest.id}`}>
        <Card className="flex items-center gap-3 p-4 transition hover:border-primary/40">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Scale className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{latest.name}</p>
            <p className="text-xs text-muted-foreground">
              {latest.carIds.length} cars · last updated {lastUpdatedLabel(latest.updatedAt ?? latest.createdAt)}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </Card>
      </Link>
    </div>
  )
}

function NotificationBell() {
  const { notifications, markNotificationsRead } = useStore()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  function toggle() {
    if (!open) markNotificationsRead()
    setOpen((o) => !o)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : `Notifications, ${notifications.length} items`
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-secondary-foreground transition hover:text-foreground"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-30 w-72 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-pretty">
              Nothing needs your attention. We only tell you about things that actually happened in
              your account.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? '/'}
                    onClick={() => setOpen(false)}
                    className="block p-3.5 transition hover:bg-muted/60"
                  >
                    <p className="text-sm font-semibold text-pretty">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string
  icon: typeof Gauge
  label: string
  desc: string
}) {
  return (
    <Link href={href}>
      <Card className="flex h-full items-start gap-3 p-4 transition hover:border-primary/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </Card>
    </Link>
  )
}

function RecentActivity() {
  const { credit, scenarios, quotations, completedRights, documents, savedVehicleIds } = useStore()

  const items: { icon: typeof TrendingUp; text: string; when: string }[] = []
  documents
    .filter((d) => d.status === 'added' && d.addedAt)
    .slice(-2)
    .forEach((d) => items.push({ icon: FileSearch, text: `Added ${d.category} to your pack`, when: d.addedAt! }))
  if (savedVehicleIds.length) {
    items.push({
      icon: Compass,
      text: `${savedVehicleIds.length} car${savedVehicleIds.length > 1 ? 's' : ''} saved in Explore`,
      when: new Date().toISOString(),
    })
  }
  credit.slice(-2).forEach((c) =>
    items.push({ icon: TrendingUp, text: `Recorded a ${c.bureau} score of ${c.score}`, when: c.date }),
  )
  scenarios.slice(0, 2).forEach((s) =>
    items.push({ icon: Calculator, text: `Saved finance scenario "${s.name}"`, when: s.savedAt }),
  )
  quotations.slice(0, 2).forEach((q) =>
    items.push({ icon: FileSearch, text: `Analysed a quote (${q.score}/100)`, when: q.createdAt }),
  )
  completedRights.slice(-1).forEach(() =>
    items.push({ icon: Scale, text: `Completed a rights module`, when: new Date().toISOString() }),
  )

  items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())

  if (items.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <CircleDot className="h-4 w-4" aria-hidden />
          No activity yet, your real actions will show up here as you use the app.
        </div>
      </Card>
    )
  }

  return (
    <Card className="divide-y divide-border">
      {items.slice(0, 5).map((it, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
            <it.icon className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-sm text-pretty">{it.text}</p>
        </div>
      ))}
    </Card>
  )
}
