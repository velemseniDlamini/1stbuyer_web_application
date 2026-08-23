'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Card, EmptyState, Notice, Pill, SectionTitle, inputClass } from '@/components/ui-kit'
import { BottomSheet } from '@/components/bottom-sheet'
import { useStore, type SavedComparison } from '@/lib/store'
import type { Vehicle } from '@/lib/data'
import { VEHICLES } from '@/lib/data'
import { parseComparisonPhrase, type VehicleMatch } from '@/lib/fuzzy'
import { suggestAlternatives, SUGGESTION_TRANSPARENCY_NOTE, type Suggestion } from '@/lib/suggestions'
import {
  CRITERIA,
  DECISION_HELPER_NOTE,
  DEFAULT_WEIGHTS,
  scoreVehicles,
  type CriterionId,
  type DecisionScore,
  type ScoreInputs,
} from '@/lib/decision-score'
import {
  DEALER_RATING_ABSENT,
  INSURANCE_REGION_NOTE,
  NO_INSIGHTS_MESSAGE,
  NO_LEVERAGE_MESSAGE,
  chargingNote,
  dealerContext,
  serviceNetworkNote,
  type Insight,
  type Leverage,
} from '@/lib/insights'
import { MARKET_METHODOLOGY, type DealQuality } from '@/lib/market-value'
import { formatDate, formatZAR } from '@/lib/format'
import { hapticAdd, hapticRemove } from '@/lib/haptics'
import {
  ChevronDown,
  Clock,
  Images,
  MapPin,
  Plug,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------- suggestions ----- */

export function SuggestionChips({
  anchor,
  excludeIds,
  onAdd,
}: {
  anchor: Vehicle
  excludeIds: string[]
  onAdd: (id: string) => void
}) {
  const { savedComparisons, preferences, dismissSuggestion } = useStore()
  const [showWhy, setShowWhy] = useState(false)

  // Count-only aggregate: pair frequencies, no user ids, no timestamps.
  const pairCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of savedComparisons) {
      const ids = Array.from(new Set(c.carIds))
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join('|')
          counts[key] = (counts[key] ?? 0) + 1
        }
      }
    }
    return counts
  }, [savedComparisons])

  const suggestions: Suggestion[] = useMemo(
    () =>
      suggestAlternatives({
        anchor,
        catalogue: VEHICLES,
        excludeIds,
        dismissedIds: preferences.dismissedSuggestionIds,
        pairCounts,
      }),
    [anchor, excludeIds, preferences.dismissedSuggestionIds, pairCounts],
  )

  if (suggestions.length === 0) return null

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Also worth comparing
        </p>
        <button
          onClick={() => setShowWhy((s) => !s)}
          aria-expanded={showWhy}
          className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary"
        >
          Why am I seeing this?
        </button>
      </div>

      {showWhy && (
        <p className="mb-3 text-xs text-muted-foreground text-pretty">{SUGGESTION_TRANSPARENCY_NOTE}</p>
      )}

      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <li key={s.vehicle.id} className="flex items-stretch gap-2">
            <button
              onClick={() => {
                hapticAdd()
                onAdd(s.vehicle.id)
              }}
              // min-w-0 is what lets a flex item shrink below its content
              // width, without it the chip refuses to narrow and overflows at
              // 320px, however aggressively the text inside truncates.
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left transition hover:border-primary/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {s.vehicle.make} {s.vehicle.model}
                </span>
                {/* The micro-explanation. Never "Recommended for you". */}
                <span className="block truncate text-xs text-muted-foreground">{s.reason}</span>
              </span>
              <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            </button>
            <button
              onClick={() => dismissSuggestion(s.vehicle.id)}
              aria-label={`Never suggest the ${s.vehicle.make} ${s.vehicle.model} again`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------ natural-language input -- */

export function NaturalLanguageInput({ onAdd }: { onAdd: (id: string) => void }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<{ term: string; matches: VehicleMatch[] }[] | null>(null)

  function run(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    // Same deterministic matcher Guardian uses, one behaviour, two entry points.
    setResults(parseComparisonPhrase(text, VEHICLES, 2))
  }

  return (
    <Card className="p-4">
      <SectionTitle>I want to compare…</SectionTitle>
      <form onSubmit={run} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Polo Vivo vs Corolla Cross"
            aria-label="Describe the cars you want to compare"
            className={cn(inputClass, 'pl-9')}
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Find
        </button>
      </form>

      {results && (
        <div className="mt-3 space-y-3">
          {results.map(({ term, matches }) => (
            <div key={term}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                “{term}”
              </p>
              {matches.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground text-pretty">
                  Nothing in this catalogue matches that. We only search the listings we actually
                  hold. We will not invent a car to satisfy the search.
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {matches.map((m) => (
                    <li key={m.vehicle.id}>
                      <button
                        onClick={() => {
                          hapticAdd()
                          onAdd(m.vehicle.id)
                        }}
                        className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
                      >
                        {m.vehicle.year} {m.vehicle.make} {m.vehicle.model}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {formatZAR(m.vehicle.price)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------- photo mode --- */

export function PhotoCompare({ vehicles }: { vehicles: Vehicle[] }) {
  const [expanded, setExpanded] = useState<Vehicle | null>(null)

  return (
    <div>
      <div
        className="compare-rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-3"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {vehicles.map((v) => (
          <figure
            key={v.id}
            className="w-56 shrink-0 md:w-auto"
            style={{ scrollSnapAlign: 'start' }}
          >
            <button
              onClick={() => setExpanded(v)}
              className="block w-full overflow-hidden rounded-2xl border border-border"
              aria-label={`Expand photo of the ${v.make} ${v.model}`}
            >
              <span className="relative block aspect-[16/10] w-full bg-secondary">
                <Image
                  src={v.image || '/placeholder.svg'}
                  alt={`${v.year} ${v.make} ${v.model} ${v.variant}`}
                  fill
                  sizes="(max-width: 448px) 60vw, 200px"
                  className="object-cover"
                />
              </span>
            </button>
            <figcaption className="mt-2">
              <p className="truncate text-sm font-semibold">
                {v.make} {v.model}
              </p>
              <p className="text-xs text-muted-foreground">{formatZAR(v.price)}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <Notice tone="muted">
        One catalogue photo per listing. We hold no interior galleries or 360° tours for these
        listings, so no &ldquo;view interior&rdquo; action is offered, an empty viewer would be
        worse than none.
      </Notice>

      {expanded && (
        <BottomSheet title={`${expanded.year} ${expanded.make} ${expanded.model}`} onClose={() => setExpanded(null)}>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-secondary">
            <Image
              src={expanded.image || '/placeholder.svg'}
              alt={`${expanded.year} ${expanded.make} ${expanded.model} ${expanded.variant}`}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground text-pretty">
            {expanded.variant} · {formatZAR(expanded.price)} · {expanded.city}
          </p>
        </BottomSheet>
      )}
    </div>
  )
}

/* ------------------------------------------------------ decision helper -- */

export function DecisionPanel({
  entries,
  names,
}: {
  entries: { vehicleId: string; inputs: ScoreInputs }[]
  names: Record<string, string>
}) {
  const { preferences, updatePreferences } = useStore()
  const [open, setOpen] = useState(false)

  const weights = useMemo(
    () => ({ ...DEFAULT_WEIGHTS, ...preferences.decisionWeights }),
    [preferences.decisionWeights],
  )
  const scores: DecisionScore[] = useMemo(() => scoreVehicles(entries, weights), [entries, weights])
  const ranked = [...scores].sort((a, b) => (b.total ?? -1) - (a.total ?? -1))

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Score my choice</span>
          <span className="text-xs text-muted-foreground">
            Weight what matters to you, optional
          </span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs text-muted-foreground text-pretty">{DECISION_HELPER_NOTE}</p>

          <div className="space-y-3">
            {CRITERIA.map((criterion) => (
              <div key={criterion.id}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`w-${criterion.id}`} className="text-sm font-medium">
                    {criterion.label}
                  </label>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {weights[criterion.id]}/5
                  </span>
                </div>
                <input
                  id={`w-${criterion.id}`}
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={weights[criterion.id]}
                  aria-valuetext={`${criterion.label}: weight ${weights[criterion.id]} of 5`}
                  onChange={(e) =>
                    updatePreferences({
                      decisionWeights: {
                        ...preferences.decisionWeights,
                        [criterion.id as CriterionId]: Number(e.target.value),
                      },
                    })
                  }
                  className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground text-pretty">{criterion.hint}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {ranked.map((score, i) => (
              <div key={score.vehicleId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">
                    {i === 0 && score.total !== null ? '1st · ' : ''}
                    {names[score.vehicleId]}
                  </p>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {score.total === null ? 'Not scored' : score.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${score.total ?? 0}%` }}
                  />
                </div>
                {/* Missing data is disclosed per car, not silently zeroed. */}
                {score.disclosure && (
                  <p className="mt-2 text-[11px] text-warning-foreground text-pretty">
                    {score.disclosure}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground text-pretty">
            Scores compare these cars with each other only, 100 means &ldquo;best of this set on
            that criterion&rdquo;, not &ldquo;a good car&rdquo;.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------- insights -- */

export function VehicleInsights({
  vehicle,
  insights,
  leverage,
  deal,
  profile,
}: {
  vehicle: Vehicle
  insights: Insight[]
  leverage: Leverage | null
  deal: DealQuality
  profile: { city?: string; province?: string } | null
}) {
  const dealer = dealerContext(vehicle, profile)
  const charging = chargingNote(vehicle)

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold text-pretty">
          {vehicle.make} {vehicle.model}
        </p>
        <Pill
          tone={
            deal.id === 'below' ? 'success' : deal.id === 'above' ? 'warning' : deal.id === 'at' ? 'muted' : 'muted'
          }
        >
          {deal.label}
        </Pill>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        {deal.detail}{' '}
        <a href={MARKET_METHODOLOGY.href} className="font-semibold text-primary underline">
          How we work this out
        </a>
      </p>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          For this buyer
        </p>
        {insights.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{NO_INSIGHTS_MESSAGE}</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    insight.tone === 'pro' && 'bg-success',
                    insight.tone === 'con' && 'bg-destructive',
                    insight.tone === 'neutral' && 'bg-muted-foreground',
                  )}
                />
                <span className="text-pretty">
                  {/* Tone is stated in words for screen readers, not colour alone. */}
                  <span className="sr-only">
                    {insight.tone === 'pro' ? 'Advantage: ' : insight.tone === 'con' ? 'Risk: ' : 'Note: '}
                  </span>
                  {insight.text}
                  <span className="block text-[11px] text-muted-foreground">from {insight.basis}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Negotiation leverage
        </p>
        {leverage ? (
          <p className="mt-1 text-sm text-pretty">
            {leverage.point}
            <span className="block text-[11px] text-muted-foreground">from {leverage.basis}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{NO_LEVERAGE_MESSAGE}</p>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-foreground">{dealer.label}</span> {dealer.detail}{' '}
            {dealer.directionsUrl && (
              <a
                href={dealer.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline"
              >
                Get directions
              </a>
            )}
          </span>
        </p>
        <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {serviceNetworkNote(vehicle, profile?.province)}
        </p>
        {charging.applicable && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
            <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {charging.text}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground text-pretty">{DEALER_RATING_ABSENT}</p>
      </div>
    </Card>
  )
}

export function InsuranceRegionNote() {
  return <Notice tone="muted">{INSURANCE_REGION_NOTE}</Notice>
}

/* ------------------------------------------------------------ glance bar -- */

export function GlanceBar({
  comparisons,
}: {
  comparisons: { id: string; name: string; price: number; verdict: string | null }[]
}) {
  const { preferences, updatePreferences } = useStore()
  const [visible, setVisible] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  // The app scrolls inside the phone shell's <main>, not the document, so the
  // bar listens to the nearest scrollable ancestor. A passive scroll listener
  // reading one number is cheaper and more predictable inside a nested scroller
  // than an IntersectionObserver rooted on the viewport.
  useEffect(() => {
    const node = sentinel.current
    if (!node) return

    let scroller: HTMLElement | null = node.parentElement
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement
    }
    const target: HTMLElement | Window = scroller ?? window

    function onScroll() {
      const top = node!.getBoundingClientRect().top
      // Shown once the vehicle headers have scrolled off under the header.
      setVisible(top < 80)
    }

    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  if (preferences.glanceBarDismissed) return <div ref={sentinel} aria-hidden />

  return (
    <>
      <div ref={sentinel} aria-hidden />
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-14 z-20 -mx-1 mb-3 flex items-center gap-2 rounded-2xl border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur print:hidden"
        >
          <ul className="compare-rail flex flex-1 gap-3 overflow-x-auto">
            {comparisons.map((c) => (
              <li key={c.id} className="min-w-0 shrink-0">
                <p className="truncate text-xs font-semibold">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatZAR(c.price)}
                  {c.verdict ? ` · ${c.verdict}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <button
            onClick={() => updatePreferences({ glanceBarDismissed: true })}
            aria-label="Hide the summary bar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------- history sheet -- */

export const STALE_AFTER_DAYS = 30

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 0
  return Math.floor((now.getTime() - then) / 86_400_000)
}

export function HistorySheet({
  onClose,
  onRestore,
}: {
  onClose: () => void
  onRestore: (c: SavedComparison) => void
}) {
  const { savedComparisons, renameComparison, removeComparison } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <BottomSheet title="My comparisons" onClose={onClose}>
      {savedComparisons.length === 0 ? (
        <EmptyState title="No saved comparisons yet">
          Save a comparison and it will be listed here, with the date you saved it.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {savedComparisons.map((c) => {
            const age = daysSince(c.updatedAt ?? c.createdAt)
            return (
              <li key={c.id} className="rounded-xl border border-border p-3">
                {editing === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (draft.trim()) renameComparison(c.id, draft.trim().slice(0, 80))
                      setEditing(null)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      aria-label={`New name for ${c.name}`}
                      className={inputClass}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-pretty">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.carIds.length} cars · saved {formatDate(c.createdAt)}
                      {c.updatedAt ? ` · renamed ${formatDate(c.updatedAt)}` : ''}
                    </p>
                    {age >= STALE_AFTER_DAYS && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning-foreground text-pretty">
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Saved {age} days ago, prices and availability may have changed.
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => onRestore(c)}
                        className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => {
                          setEditing(c.id)
                          setDraft(c.name)
                        }}
                        className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          hapticRemove()
                          removeComparison(c.id)
                        }}
                        aria-label={`Delete ${c.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}

export function PhotoModeToggle({
  mode,
  onChange,
}: {
  mode: 'data' | 'photos'
  onChange: (m: 'data' | 'photos') => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 print:hidden" role="tablist">
      {(['data', 'photos'] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition',
            mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {m === 'photos' && <Images className="h-4 w-4" aria-hidden />}
          {m === 'data' ? 'Data' : 'Photos'}
        </button>
      ))}
    </div>
  )
}
