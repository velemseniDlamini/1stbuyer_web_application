'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, EmptyState, Notice, SectionTitle, inputClass } from '@/components/ui-kit'
import { CellSkeleton } from '@/components/skeleton'
import { useStore } from '@/lib/store'
import {
  estimateNewCarCosts,
  fetchNewCars,
  fuelCostPer100km,
  newCarMakes,
  sortNewCars,
  sourceOf,
  type CatalogueOrigin,
  type NewCarSort,
} from '@/lib/new-cars'
import {
  NEW_CAR_PROVENANCE_NOTE,
  PRICE_STALE_AFTER_DAYS,
  SOURCED_FUEL_PRICE,
  type NewCar,
} from '@/lib/new-cars-source'
import { isUsableScore } from '@/lib/finance'
import { DISTANCE_OPTIONS, fuelPriceOptions } from '@/lib/input-choices'
import { formatDate, formatZAR, yearsBetween } from '@/lib/format'
import { AlertTriangle, ExternalLink, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CarBadge } from '@/components/car-illustration'

const NOT_LISTED = 'Not listed'

/**
 * Brand-new cars, read from Supabase with the bundled copy as a fallback.
 *
 * The rule that shapes every cell: a figure appears only where a named,
 * dated source published it. Around half of these rows have no power figure
 * and a quarter have no photograph, so the screen shows what it has and says
 * plainly what it does not. That is the difference between a catalogue and a
 * brochure.
 */
export function NewCarsTab() {
  const { profile, currentScore } = useStore()

  const [cars, setCars] = useState<NewCar[]>([])
  const [origin, setOrigin] = useState<CatalogueOrigin>('bundled')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [make, setMake] = useState('All')
  const [maxPrice, setMaxPrice] = useState(320000)
  const [sort, setSort] = useState<NewCarSort>('price')
  const [monthlyKm, setMonthlyKm] = useState(1200)
  const [fuelPrice, setFuelPrice] = useState(SOURCED_FUEL_PRICE.pricePerLitre)
  const [expanded, setExpanded] = useState<string | null>(null)

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

  const driverAge = profile?.dob ? yearsBetween(profile.dob) : null
  const licenceYears = profile?.licenceDate ? yearsBetween(profile.licenceDate) : null
  const personalised = isUsableScore(currentScore)

  const makes = useMemo(() => newCarMakes(cars), [cars])
  const visible = useMemo(() => {
    const filtered = cars.filter(
      (c) => (make === 'All' || c.make === make) && c.listPrice <= maxPrice,
    )
    return sortNewCars(filtered, sort, fuelPrice)
  }, [cars, make, maxPrice, sort, fuelPrice])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4">
            <CellSkeleton />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Where the data came from, every time. */}
      <Notice tone={origin === 'live' ? 'muted' : 'warning'}>
        <strong className="font-semibold">
          {origin === 'live' ? 'Live from the catalogue database.' : 'Bundled copy, not live.'}
        </strong>{' '}
        {loadError
          ? `The live catalogue could not be read (${loadError}), so these are the rows that ship with the app. They may be out of date.`
          : NEW_CAR_PROVENANCE_NOTE}
      </Notice>

      {!personalised && (
        <Notice tone="warning">
          Instalments are locked. We will not estimate what you would pay without your credit score.{' '}
          <Link href="/credit" className="font-semibold underline">
            Record your score
          </Link>
          .
        </Notice>
      )}

      {/* Controls */}
      <Card className="space-y-3 p-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {['All', ...makes].map((m) => (
            <button
              key={m}
              onClick={() => setMake(m)}
              aria-pressed={make === m}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium transition',
                make === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="new-max-price" className="text-muted-foreground">
              Max list price
            </label>
            <span className="font-semibold">{formatZAR(maxPrice)}</span>
          </div>
          <input
            id="new-max-price"
            type="range"
            min={170000}
            max={320000}
            step={5000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            aria-valuetext={formatZAR(maxPrice)}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1" role="tablist">
          {(
            [
              ['price', 'Cheapest'],
              ['running', 'Cheapest to run'],
              ['power', 'Most power'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={sort === value}
              onClick={() => setSort(value)}
              className={cn(
                'min-h-11 rounded-lg px-2 text-xs font-semibold transition',
                sort === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Both of these were number inputs. Neither is a figure anyone
              knows precisely, and both are asked again on Compare, so they are
              picked from a list instead of typed twice. */}
          <div>
            <label htmlFor="new-fuel-price" className="block text-xs font-medium">
              Fuel price (R/l)
            </label>
            <select
              id="new-fuel-price"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(Number(e.target.value))}
              className={inputClass}
            >
              {fuelPriceOptions(SOURCED_FUEL_PRICE.pricePerLitre).map((price) => (
                <option key={price} value={price}>
                  R {price.toFixed(2)}
                  {price === SOURCED_FUEL_PRICE.pricePerLitre ? ' (sourced)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-monthly-km" className="block text-xs font-medium">
              Distance (km/month)
            </label>
            <select
              id="new-monthly-km"
              value={monthlyKm}
              onChange={(e) => setMonthlyKm(Number(e.target.value))}
              className={inputClass}
            >
              {DISTANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-pretty">
          The default pump price is R{SOURCED_FUEL_PRICE.pricePerLitre} a litre, the figure
          AutoTrader used in its May 2026 running-cost analysis. Change it to what you actually pay.
        </p>
      </Card>

      {visible.length === 0 ? (
        <EmptyState icon={<CarBadge />} title="No new cars match those filters">
          Raise the price ceiling or clear the brand filter.
        </EmptyState>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {visible.map((car) => (
            <NewCarCard
              key={car.id}
              car={car}
              costs={estimateNewCarCosts({
                car,
                score: currentScore,
                monthlyKm,
                fuelPricePerLitre: fuelPrice,
                driverAge,
                licenceYears,
              })}
              fuelPrice={fuelPrice}
              expanded={expanded === car.id}
              onToggle={() => setExpanded((id) => (id === car.id ? null : car.id))}
            />
          ))}
        </div>
      )}

      <Card className="p-4">
        <SectionTitle>What is missing, and why</SectionTitle>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="text-pretty">
            {cars.filter((c) => c.powerKw === null).length} of {cars.length} rows have no power
            figure: the article that published the price did not state one.
          </li>
          <li className="text-pretty">
            {cars.filter((c) => c.imageUrl === null).length} of {cars.length} have no photograph.
            We only show a picture where this app genuinely holds one for that model. A stand-in
            photo of a different car would misrepresent what you are being quoted.
          </li>
          <li className="text-pretty">
            No dealer stock, colours, optional extras or on-the-road fees are included. A list price
            is not a drive-away price.
          </li>
        </ul>
      </Card>
    </div>
  )
}

function NewCarCard({
  car,
  costs,
  fuelPrice,
  expanded,
  onToggle,
}: {
  car: NewCar
  costs: ReturnType<typeof estimateNewCarCosts>
  fuelPrice: number
  expanded: boolean
  onToggle: () => void
}) {
  const source = sourceOf(car)
  // Captured once at mount rather than read during render. Date.now() in a
  // render body is impure, and worse here it is a hydration hazard: the server
  // and the browser can land on different sides of a day boundary and disagree
  // about whether this price is stale.
  const [now] = useState(() => Date.now())
  const ageDays = Math.floor((now - new Date(source.publishedAt).getTime()) / 86_400_000)
  const stale = ageDays > PRICE_STALE_AFTER_DAYS
  const per100 = fuelCostPer100km(car, fuelPrice)

  return (
    <Card className="overflow-hidden">
      {car.imageUrl ? (
        <div className="relative aspect-[16/10] w-full bg-secondary">
          <Image
            src={car.imageUrl}
            alt={`${car.make} ${car.model}`}
            fill
            sizes="(max-width: 448px) 100vw, 360px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 bg-secondary/60 text-muted-foreground">
          <ImageOff className="h-6 w-6" aria-hidden />
          <p className="px-4 text-center text-xs text-pretty">
            No photograph held for this model
          </p>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-tight">
              {car.make} {car.model}
            </p>
            <p className="text-xs text-muted-foreground">
              {car.variant} · {car.bodyType}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold">{formatZAR(car.listPrice)}</p>
            <p className="text-[10px] text-muted-foreground">list price</p>
          </div>
        </div>

        {/* Provenance sits with the price, not in a footnote. */}
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {stale && (
            <span className="inline-flex items-center gap-1 font-semibold text-warning-foreground">
              <AlertTriangle className="h-3 w-3" aria-hidden /> {ageDays} days old
            </span>
          )}
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

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Spec label="Engine" value={car.engineCc ? `${car.engineCc} cc` : NOT_LISTED} />
          <Spec label="Power" value={car.powerKw ? `${car.powerKw} kW` : NOT_LISTED} />
          <Spec
            label="Fuel use"
            value={car.consumptionL100km ? `${car.consumptionL100km} l/100km` : NOT_LISTED}
          />
        </div>

        <div className="mt-3 space-y-1.5 rounded-xl bg-secondary/50 p-3 text-sm">
          <Row
            label="Instalment"
            value={costs.instalment === null ? null : `${formatZAR(costs.instalment)}/mo`}
            lockedNote="Record your credit score"
          />
          <Row
            label="Fuel"
            value={costs.fuel === null ? null : `${formatZAR(costs.fuel)}/mo`}
            lockedNote="No published consumption figure"
          />
          <Row label="Insurance" value={`${formatZAR(costs.insurance)}/mo`} />
          <div className="border-t border-border pt-1.5">
            <Row
              label="Total monthly"
              value={costs.totalMonthly === null ? null : `${formatZAR(costs.totalMonthly)}/mo`}
              lockedNote="Needs a credit score and a consumption figure"
              bold
            />
          </div>
        </div>

        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-3 min-h-11 w-full rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
        >
          {expanded ? 'Hide detail' : 'Full specification'}
        </button>

        {expanded && (
          <dl className="mt-3 space-y-1.5 text-sm">
            <Detail label="Transmission" value={car.transmission ?? NOT_LISTED} />
            <Detail label="Cylinders" value={car.cylinders ? String(car.cylinders) : NOT_LISTED} />
            <Detail label="Torque" value={car.torqueNm ? `${car.torqueNm} Nm` : NOT_LISTED} />
            <Detail label="Tank" value={car.tankLitres ? `${car.tankLitres} l` : NOT_LISTED} />
            <Detail label="Seats" value={car.seats ? String(car.seats) : NOT_LISTED} />
            <Detail label="Boot" value={car.bootLitres ? `${car.bootLitres} l` : NOT_LISTED} />
            <Detail
              label="Safety"
              value={car.ncapStars ? `${car.ncapStars}/5 ${car.ncapProgramme ?? ''}`.trim() : NOT_LISTED}
            />
            <Detail
              label="Fuel per 100km"
              value={per100 === null ? NOT_LISTED : formatZAR(per100)}
            />
            <div className="pt-1.5">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary underline"
              >
                Read the source: {source.title}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </dl>
        )}
      </div>
    </Card>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  const missing = value === NOT_LISTED
  return (
    <div className={cn('rounded-lg bg-secondary/50 p-2', missing && 'opacity-70')}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-semibold', missing && 'font-medium text-muted-foreground')}>
        {value}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  lockedNote,
  bold,
}: {
  label: string
  value: string | null
  lockedNote?: string
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn('text-muted-foreground', bold && 'font-semibold text-foreground')}>
        {label}
      </span>
      {value === null ? (
        <span className="text-right text-xs text-muted-foreground text-pretty">
          {lockedNote ?? NOT_LISTED}
        </span>
      ) : (
        <span className={cn('tabular-nums', bold ? 'font-display text-base font-semibold' : 'font-medium')}>
          {value}
        </span>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right text-pretty', value === NOT_LISTED && 'text-muted-foreground')}>
        {value}
      </dd>
    </div>
  )
}
