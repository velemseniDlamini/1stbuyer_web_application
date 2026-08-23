'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Notice, Pill, EmptyState } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import { VEHICLES, VEHICLE_MAKES, DEALERS, type Dealer, type Vehicle } from '@/lib/data'
import { estimateInstalment, rateForScore } from '@/lib/finance'
import { MAX_COMPARE, MIN_COMPARE, compareHref, toggleCompareId } from '@/lib/compare'
import { BottomSheet } from '@/components/bottom-sheet'
import { NewCarsTab } from './new-cars-tab'
import { RivalsTab } from './rivals-tab'
import { formatNumber, formatZAR } from '@/lib/format'
import { Heart, MapPin, Fuel, Cog, ExternalLink, Search, SlidersHorizontal, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CarBadge } from '@/components/car-illustration'

type Tab = 'cars' | 'new' | 'rivals' | 'dealers'

export function ExploreScreen() {
  const { savedVehicleIds, toggleSavedVehicle, markMarketVisited, currentScore } = useStore()
  const [tab, setTab] = useState<Tab>('cars')
  const [query, setQuery] = useState('')
  const [make, setMake] = useState('All')
  const [maxPrice, setMaxPrice] = useState(700000)
  const [savedOnly, setSavedOnly] = useState(false)

  // Opening this screen satisfies the "Know the Market" journey stage.
  useEffect(() => {
    markMarketVisited()
  }, [markMarketVisited])

  // Cars selected for side-by-side comparison. Same tray interaction as the
  // dealer compare below, one pattern, two object types.
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareRejected, setCompareRejected] = useState(false)

  const rate = rateForScore(currentScore)

  const filtered = useMemo(() => {
    return VEHICLES.filter((v) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !q ||
        `${v.make} ${v.model} ${v.variant} ${v.city}`.toLowerCase().includes(q)
      const matchesMake = make === 'All' || v.make === make
      const matchesPrice = v.price <= maxPrice
      const matchesSaved = !savedOnly || savedVehicleIds.includes(v.id)
      return matchesQuery && matchesMake && matchesPrice && matchesSaved
    })
  }, [query, make, maxPrice, savedOnly, savedVehicleIds])

  // Shared with Car Compare, so the same car cannot quote two different
  // instalments on two screens.
  function estimate(v: Vehicle) {
    return estimateInstalment(v.price, currentScore)
  }

  function onToggleCompare(id: string) {
    // Functional update: two taps landing in the same frame must both count,
    // rather than the second overwriting the first from a stale closure.
    setCompareIds((current) => {
      const next = toggleCompareId(current, id)
      setCompareRejected(next.rejected)
      return next.ids
    })
  }

  return (
    <div className="pb-8">
      <ScreenHeader title="Explore" subtitle="Sample listings and dealer branches" />

      <div className="px-4">
        {/* Four tabs will not fit four readable labels at 320px, so the strip
            scrolls rather than wrapping or truncating. */}
        <div
          className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1"
          role="tablist"
        >
          <TabButton active={tab === 'cars'} onClick={() => setTab('cars')}>
            Used
          </TabButton>
          <TabButton active={tab === 'new'} onClick={() => setTab('new')}>
            Brand new
          </TabButton>
          <TabButton active={tab === 'rivals'} onClick={() => setTab('rivals')}>
            Rivals
          </TabButton>
          <TabButton active={tab === 'dealers'} onClick={() => setTab('dealers')}>
            Dealers
          </TabButton>
        </div>

        {tab === 'cars' ? (
          <div className="space-y-4">
            {/* Search + filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search make, model or city"
                  aria-label="Search vehicles"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                />
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {['All', ...VEHICLE_MAKES].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMake(m)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      make === m
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Max price</span>
                    <span className="font-semibold">{formatZAR(maxPrice)}</span>
                  </div>
                  <input
                    type="range"
                    min={150000}
                    max={700000}
                    step={10000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    aria-label="Maximum price"
                    className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  />
                </div>
                <button
                  onClick={() => setSavedOnly((s) => !s)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                    savedOnly ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                  aria-pressed={savedOnly}
                >
                  <Heart className={cn('h-3.5 w-3.5', savedOnly && 'fill-current')} /> Saved
                </button>
              </div>
            </div>

            <Notice tone="muted">
              Sample catalogue for the prototype, illustrative prices and specs, not a live feed.
              Instalments are estimated at {rate.toFixed(2)}% over 72 months with a 10% deposit
              {currentScore ? ' from your credit band' : ' (record a score for a personalised rate)'}.
            </Notice>

            {compareRejected && compareIds.length >= MAX_COMPARE && (
              <Notice tone="warning">
                You can compare {MAX_COMPARE} cars at a time. Remove one to add another. We would
                rather show three cars properly than six badly.
              </Notice>
            )}

            {filtered.length === 0 ? (
              <EmptyState icon={<CarBadge />} title="No cars match your filters">
                Try widening your price range or clearing the make filter.
              </EmptyState>
            ) : (
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {filtered.map((v) => {
                  const saved = savedVehicleIds.includes(v.id)
                  return (
                    <Card key={v.id} className="overflow-hidden">
                      <div className="relative aspect-[16/10] w-full bg-secondary">
                        <Image
                          src={v.image || "/placeholder.svg"}
                          alt={`${v.make} ${v.model} ${v.variant}`}
                          fill
                          sizes="(max-width: 448px) 100vw, 448px"
                          className="object-cover"
                        />
                        <button
                          onClick={() => toggleSavedVehicle(v.id)}
                          aria-label={saved ? 'Remove from saved' : 'Save vehicle'}
                          aria-pressed={saved}
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow backdrop-blur transition hover:scale-105"
                        >
                          <Heart className={cn('h-4.5 w-4.5', saved && 'fill-destructive text-destructive')} />
                        </button>
                        <div className="absolute left-3 top-3">
                          <Pill tone="muted">{v.year}</Pill>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-display text-base font-semibold leading-tight">
                              {v.make} {v.model}
                            </p>
                            <p className="text-xs text-muted-foreground">{v.variant}</p>
                          </div>
                          <p className="font-display text-lg font-semibold">{formatZAR(v.price)}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {v.city}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Fuel className="h-3.5 w-3.5" /> {v.fuel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Cog className="h-3.5 w-3.5" /> {v.transmission}
                          </span>
                          <span>{formatNumber(v.mileage)} km</span>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Est. instalment</span>
                          <span className="text-sm font-semibold">
                            {formatZAR(estimate(v))}
                            <span className="text-xs font-normal text-muted-foreground">/mo</span>
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => onToggleCompare(v.id)}
                            aria-pressed={compareIds.includes(v.id)}
                            disabled={!compareIds.includes(v.id) && compareIds.length >= MAX_COMPARE}
                            className={cn(
                              'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition',
                              compareIds.includes(v.id)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary/40',
                              !compareIds.includes(v.id) &&
                                compareIds.length >= MAX_COMPARE &&
                                'cursor-not-allowed opacity-50',
                            )}
                          >
                            <Scale className="h-3.5 w-3.5" aria-hidden />
                            {compareIds.includes(v.id)
                              ? 'Comparing'
                              : compareIds.length >= MAX_COMPARE
                                ? `Max ${MAX_COMPARE}`
                                : 'Compare'}
                          </button>
                          <button
                            onClick={() => toggleSavedVehicle(v.id)}
                            className={cn(
                              'flex-1 rounded-xl py-2 text-center text-sm font-semibold transition',
                              saved
                                ? 'bg-secondary text-foreground'
                                : 'bg-primary text-primary-foreground hover:opacity-90',
                            )}
                          >
                            {saved ? 'Saved' : 'Save car'}
                          </button>
                        </div>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          Sold by {v.dealer}
                        </p>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

            {compareIds.length > 0 && (
              <div className="sticky bottom-2 z-10 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
                <p className="flex-1 text-sm font-semibold">
                  {compareIds.length} car{compareIds.length === 1 ? '' : 's'} to compare
                </p>
                <button
                  onClick={() => {
                    setCompareIds([])
                    setCompareRejected(false)
                  }}
                  className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-destructive/40"
                >
                  Clear
                </button>
                <Link
                  href={compareHref(compareIds)}
                  aria-disabled={compareIds.length < MIN_COMPARE}
                  onClick={(e) => {
                    if (compareIds.length < MIN_COMPARE) e.preventDefault()
                  }}
                  className={cn(
                    'flex min-h-11 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90',
                    compareIds.length < MIN_COMPARE && 'pointer-events-none opacity-50',
                  )}
                >
                  Compare now
                </Link>
              </div>
            )}
          </div>
        ) : tab === 'new' ? (
          <NewCarsTab />
        ) : tab === 'rivals' ? (
          <RivalsTab />
        ) : (
          <DealersTab />
        )}
      </div>
    </div>
  )
}

function DealersTab() {
  const [selected, setSelected] = useState<string[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)

  const chosen = DEALERS.filter((d) => selected.includes(d.id))
  const full = selected.length >= MAX_COMPARE

  function toggle(id: string) {
    setSelected((s) => toggleCompareId(s, id).ids)
  }

  return (
    <div className="space-y-3">
      <Notice tone="muted">
        Branch information only. 1st Buyer does not rate or rank dealers. We show verifiable facts
        (location and brands) and leave the judgement to you.
      </Notice>

      {DEALERS.map((d) => {
        const picked = selected.includes(d.id)
        const stockCount = VEHICLES.filter((v) => v.dealer === d.name).length
        return (
          <Card key={d.id} className={cn('p-4', picked && 'border-primary/40')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-pretty">{d.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {d.city}, {d.province}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stockCount} listing{stockCount === 1 ? '' : 's'} in this sample catalogue
                </p>
              </div>
              <a
                href={d.website}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${d.name} website`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.brands.map((b) => (
                <Pill key={b} tone="muted">
                  {b}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              onClick={() => toggle(d.id)}
              aria-pressed={picked}
              disabled={!picked && full}
              className={cn(
                'mt-3 min-h-11 w-full rounded-xl border text-sm font-semibold transition',
                picked
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40',
                !picked && full && 'cursor-not-allowed opacity-50',
              )}
            >
              {picked ? 'Selected to compare' : full ? 'Compare list is full (3)' : 'Add to compare'}
            </button>
          </Card>
        )
      })}

      {selected.length > 0 && (
        <div className="sticky bottom-2 z-10 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <p className="flex-1 text-sm font-semibold">
            {selected.length} branch{selected.length === 1 ? '' : 'es'} selected
          </p>
          <button
            onClick={() => setSelected([])}
            className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-destructive/40"
          >
            Clear
          </button>
          <button
            onClick={() => setSheetOpen(true)}
            disabled={selected.length < 2}
            className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Compare now
          </button>
        </div>
      )}

      {sheetOpen && <CompareSheet dealers={chosen} onClose={() => setSheetOpen(false)} />}
    </div>
  )
}

function CompareSheet({ dealers, onClose }: { dealers: Dealer[]; onClose: () => void }) {
  // Uses the shared BottomSheet primitive, the same overlay Car Compare's
  // credit gate opens, so there is one dialog implementation in the app.
  return (
    <BottomSheet title="Branch comparison" onClose={onClose}>
      <div>
        <div className="space-y-3">
          {dealers.map((d) => {
            const stock = VEHICLES.filter((v) => v.dealer === d.name)
            const cheapest = stock.length ? Math.min(...stock.map((v) => v.price)) : null
            return (
              <Card key={d.id} className="p-4">
                <p className="text-sm font-semibold text-pretty">{d.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {d.city}, {d.province}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Line label="Brands" value={d.brands.join(', ')} />
                  <Line label="Listings here" value={String(stock.length)} />
                  <Line
                    label="Cheapest listing"
                    value={cheapest ? formatZAR(cheapest) : 'None in this sample'}
                  />
                </dl>
              </Card>
            )
          })}
        </div>
        <Notice tone="muted">
          We compare only what can be verified: location, brands carried and the listings in this
          sample catalogue. No ratings, no sponsored placement.
        </Notice>
      </div>
    </BottomSheet>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-pretty">{value}</dd>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        'min-h-11 flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
