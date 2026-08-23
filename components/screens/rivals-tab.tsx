'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, EmptyState, Notice, Pill, SectionTitle } from '@/components/ui-kit'
import { CellSkeleton } from '@/components/skeleton'
import { useStore } from '@/lib/store'
import { fetchNewCars, sourceOf, type CatalogueOrigin } from '@/lib/new-cars'
import { type NewCar } from '@/lib/new-cars-source'
import {
  CLOSENESS_PCT,
  explainMatch,
  findRivals,
  searchNewCars,
  type RivalMatch,
} from '@/lib/rivals'
import { formatDate, formatZAR } from '@/lib/format'
import { track } from '@/lib/analytics'
import { ExternalLink, ImageOff, Search, Swords, Target, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NOT_LISTED = 'Not listed'

/**
 * "Which car are you interested in?"
 *
 * Pick one row and the screen answers with three lists, all of them arithmetic
 * on published figures rather than an opinion about the market:
 *
 *   Rivals      - closest on the axes both cars publish.
 *   Opposites   - furthest on those same axes.
 *   Derivatives - the same nameplate at another trim.
 *
 * Nothing here needs a credit score, because nothing here is an instalment.
 * The moment money-per-month enters the picture the credit gate applies, which
 * is why this screen links to the new-car list for that rather than repeating
 * it without the gate.
 */
export function RivalsTab() {
  const { savedVehicleIds } = useStore()

  const [cars, setCars] = useState<NewCar[]>([])
  const [origin, setOrigin] = useState<CatalogueOrigin>('bundled')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchNewCars().then((result) => {
      if (cancelled) return
      setCars(result.cars)
      setOrigin(result.origin)
      setLoadError(result.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const chosen = useMemo(() => cars.find((c) => c.id === chosenId) ?? null, [cars, chosenId])

  // Typing narrows the picker; an empty box offers the cheapest rows rather
  // than a blank screen, since a first-time buyer usually starts at the bottom.
  const suggestions = useMemo(() => {
    if (query.trim()) return searchNewCars(query, cars)
    return [...cars].sort((a, b) => a.listPrice - b.listPrice).slice(0, 6)
  }, [query, cars])

  const report = useMemo(() => (chosen ? findRivals(chosen, cars) : null), [chosen, cars])

  function choose(car: NewCar) {
    setChosenId(car.id)
    setQuery('')
    track('rivals_car_chosen', { car: car.id })
    // Moves focus to the answer instead of leaving the picker under the thumb.
    requestAnimationFrame(() => resultsRef.current?.focus())
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Card key={i} className="p-4">
            <CellSkeleton />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Notice tone={origin === 'live' ? 'muted' : 'warning'}>
        <strong className="font-semibold">How these lists are built.</strong> Every rival and every
        opposite comes from comparing published figures: list price, engine size, power, claimed
        fuel use, body type and fuel type. Where a car&apos;s source did not state a figure, that
        axis is dropped and the card says so. No one has told us which cars South Africans actually
        cross-shop, so nothing here pretends to know that.
        {loadError ? ` The live catalogue could not be read (${loadError}), so this is the bundled copy.` : ''}
      </Notice>

      {/* ---------------------------------------------------------- picker -- */}
      <Card className="p-4">
        <label htmlFor="rival-search" className="block font-display text-base font-semibold">
          Which car are you interested in?
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
          Type a make or model, or pick one below. {cars.length} new cars are in the catalogue.
        </p>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="rival-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Polo Vivo, Swift, Starlet"
            autoComplete="off"
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-9 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground sm:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {query.trim() && suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground text-pretty">
            No new car in the catalogue matches &ldquo;{query.trim()}&rdquo;. The catalogue holds
            entry-level cars only, so a model above about R320 000 will not be here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {suggestions.map((car) => (
              <li key={car.id}>
                <button
                  type="button"
                  onClick={() => choose(car)}
                  aria-pressed={chosenId === car.id}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition',
                    chosenId === car.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {car.make} {car.model}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {car.variant}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatZAR(car.listPrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --------------------------------------------------------- results -- */}
      <div ref={resultsRef} tabIndex={-1} className="space-y-4 outline-none">
        {!chosen || !report ? (
          <EmptyState icon={<Target className="h-8 w-8" />} title="Pick a car to see its field">
            Choose one above and we will show what it competes with, what sits at the opposite end
            of the catalogue, and which other trims of the same car exist.
          </EmptyState>
        ) : (
          <>
            <ChosenCard car={chosen} saved={savedVehicleIds.includes(chosen.id)} />

            <Section
              icon={<Swords className="h-4 w-4" aria-hidden />}
              title={`Competitors of the ${chosen.make} ${chosen.model}`}
              blurb={`Closest on the figures we hold. Close means within ${CLOSENESS_PCT.price}% on price, ${CLOSENESS_PCT.engine}% on engine size, ${CLOSENESS_PCT.power}% on power and ${CLOSENESS_PCT.consumption}% on claimed fuel use.`}
              matches={report.rivals}
              kind="rival"
              empty="Nothing in the catalogue lands close enough on these figures to call it a competitor."
            />

            <Section
              icon={<Target className="h-4 w-4" aria-hidden />}
              title="At the opposite end"
              blurb="Furthest from your car on the same measured axes. These are not worse cars: they show what a different budget or a different body shape actually buys."
              matches={report.opposites}
              kind="opposite"
              empty="Nothing in the catalogue is far enough away to call it an opposite. These are all entry-level cars within a narrow band."
            />

            {report.derivatives.length > 0 && (
              <Section
                icon={<Swords className="h-4 w-4" aria-hidden />}
                title={`Other ${chosen.model} derivatives`}
                blurb="The same nameplate at a different trim or price. Not a competitor: the same car."
                matches={report.derivatives}
                kind="rival"
                empty=""
              />
            )}

            <Card className="p-4">
              <SectionTitle>What this comparison cannot tell you</SectionTitle>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="text-pretty">
                  Reliability, service cost, resale value and dealer network are not in this data,
                  and they are usually what separates two cars that look identical on paper.
                </li>
                <li className="text-pretty">
                  Consumption figures are manufacturer claims quoted by the source, measured in a
                  laboratory cycle. Real traffic is worse, for every car here.
                </li>
                <li className="text-pretty">
                  Prices are list prices on the date the article ran, and exclude on-the-road fees.
                </li>
                {report.incomparableCount > 0 && (
                  <li className="text-pretty">
                    {report.incomparableCount} rows shared no comparable figure and were left out.
                  </li>
                )}
              </ul>
              <Link
                href="/compare"
                className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline"
              >
                Put two cars side by side in Car Compare
              </Link>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function ChosenCard({ car, saved }: { car: NewCar; saved: boolean }) {
  const source = sourceOf(car)
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary">
          {car.imageUrl ? (
            <Image
              src={car.imageUrl}
              alt={`${car.make} ${car.model}`}
              fill
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your car
          </p>
          <p className="font-display text-base font-semibold leading-tight text-pretty">
            {car.make} {car.model}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {car.variant} · {car.bodyType}
          </p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums">
            {formatZAR(car.listPrice)}
          </p>
        </div>
        {saved && <Pill tone="ok">Saved</Pill>}
      </div>
      <div className="grid grid-cols-3 gap-px bg-border">
        <Figure label="Engine" value={car.engineCc ? `${car.engineCc} cc` : NOT_LISTED} />
        <Figure label="Power" value={car.powerKw ? `${car.powerKw} kW` : NOT_LISTED} />
        <Figure
          label="Fuel use"
          value={car.consumptionL100km ? `${car.consumptionL100km} l/100km` : NOT_LISTED}
        />
      </div>
      <p className="bg-card px-4 py-2 text-[11px] text-muted-foreground">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline"
        >
          {source.publisher}, {formatDate(source.publishedAt)}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  const missing = value === NOT_LISTED
  return (
    <div className="bg-card px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-semibold', missing && 'font-medium text-muted-foreground')}>
        {value}
      </p>
    </div>
  )
}

function Section({
  icon,
  title,
  blurb,
  matches,
  kind,
  empty,
}: {
  icon: React.ReactNode
  title: string
  blurb: string
  matches: RivalMatch[]
  kind: 'rival' | 'opposite'
  empty: string
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-display text-base font-semibold text-pretty">{title}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground text-pretty">{blurb}</p>

      {matches.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground text-pretty">{empty}</p>
        </Card>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {matches.map((m) => (
            <MatchCard key={m.car.id} match={m} kind={kind} />
          ))}
        </div>
      )}
    </section>
  )
}

function MatchCard({ match, kind }: { match: RivalMatch; kind: 'rival' | 'opposite' }) {
  const [open, setOpen] = useState(false)
  const car = match.car

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight text-pretty">
            {car.make} {car.model}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {car.variant} · {car.bodyType}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-base font-semibold tabular-nums">
            {formatZAR(car.listPrice)}
          </p>
          {/* Each list is counted in its own direction, so a bigger number
              always means "more of what this list is for", and the denominator
              is the axes actually measured rather than a notional six. */}
          <p className="text-[10px] text-muted-foreground">
            {match.axes.filter((a) => (kind === 'rival' ? a.close : !a.close)).length} of{' '}
            {match.axes.length} axes {kind === 'rival' ? 'close' : 'differ'}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-pretty">{explainMatch(match, kind)}</p>

      <ul className="mt-2 space-y-1">
        {match.axes.map((axis) => (
          <li key={axis.axis} className="flex items-start gap-2 text-xs">
            <span
              aria-hidden
              className={cn(
                'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                axis.close ? 'bg-success' : 'bg-warning',
              )}
            />
            <span className="min-w-0 text-muted-foreground text-pretty">
              <span className="sr-only">
                {axis.label}, {axis.close ? 'close' : 'different'}:{' '}
              </span>
              {axis.note}
            </span>
          </li>
        ))}
      </ul>

      {match.missingAxes.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 min-h-11 text-left text-[11px] font-semibold text-muted-foreground underline"
          >
            {match.missingAxes.length} of the six axes could not be compared
          </button>
          {open && (
            <p className="mt-1 text-[11px] text-muted-foreground text-pretty">
              Neither source published a figure both cars share for:{' '}
              {match.missingAxes.join(', ')}. Those axes were dropped rather than guessed, so this
              card is built from {match.axes.length} measurements, not six.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
