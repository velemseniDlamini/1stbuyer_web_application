'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Notice, Pill, SectionTitle } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import { VEHICLES } from '@/lib/data'
import {
  COVER_TYPES,
  GARAGED_DISCOUNT,
  TRACKER_DISCOUNT,
  PREMIUMS_REVIEWED,
  annualSpread,
  driverLoading,
  quoteAll,
  type CoverTypeId,
} from '@/lib/insurance'
import { preferredVehicle, resolveVehicleContext, VEHICLE_PARAM } from '@/lib/vehicle-context'
import { formatDate, formatZAR, yearsBetween } from '@/lib/format'
import { ExternalLink, MapPin, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const INSURER_SITES: Record<string, string> = {
  'Discovery Insure': 'https://www.discovery.co.za/car-insurance',
  OUTsurance: 'https://www.outsurance.co.za/car-insurance/',
  'King Price': 'https://www.kingprice.co.za/car-insurance/',
  MiWay: 'https://www.miway.co.za/car-insurance',
  Santam: 'https://www.santam.co.za/car-insurance/',
  'Momentum Insure': 'https://www.momentum.co.za/momentum/insure/car-insurance',
}

export function InsuranceScreen() {
  const { profile, savedVehicleIds, markInsuranceCompared } = useStore()
  const searchParams = useSearchParams()

  // The priced vehicle comes from the user's own context, in priority order:
  // an explicit ?vehicle= handed over by Car Compare, then a saved vehicle,
  // then a catalogue entry the user can change. Nothing is hard-coded.
  const contextId = searchParams.get(VEHICLE_PARAM)
  const savedVehicles = useMemo(
    () => VEHICLES.filter((v) => savedVehicleIds.includes(v.id)),
    [savedVehicleIds],
  )
  const contextVehicle = resolveVehicleContext(contextId, VEHICLES)
  const options = useMemo(() => {
    const base = savedVehicles.length ? savedVehicles : VEHICLES
    return contextVehicle && !base.some((v) => v.id === contextVehicle.id)
      ? [contextVehicle, ...base]
      : base
  }, [savedVehicles, contextVehicle])

  const preferred = preferredVehicle({ contextId, savedIds: savedVehicleIds, catalogue: options })
  const [vehicleId, setVehicleId] = useState(preferred.vehicle?.id ?? options[0].id)

  // A comparison handing over a different car re-points the screen at it.
  useEffect(() => {
    if (contextVehicle) setVehicleId(contextVehicle.id)
  }, [contextVehicle])

  const vehicle = options.find((v) => v.id === vehicleId) ?? options[0]
  const basis = contextVehicle && vehicle.id === contextVehicle.id ? 'context' : preferred.basis

  const [cover, setCover] = useState<CoverTypeId>('comprehensive')
  const [tracker, setTracker] = useState(true)
  const [garaged, setGaraged] = useState(true)

  useEffect(() => {
    markInsuranceCompared()
  }, [markInsuranceCompared])

  const driverAge = profile?.dob ? yearsBetween(profile.dob) : null
  const licenceYears = profile?.licenceDate ? yearsBetween(profile.licenceDate) : null
  const loading = driverLoading(driverAge, licenceYears)

  const quotes = useMemo(
    () =>
      quoteAll({
        cover,
        tracker,
        garaged,
        vehiclePrice: vehicle.price,
        driverAge,
        licenceYears,
      }),
    [cover, tracker, garaged, vehicle.price, driverAge, licenceYears],
  )

  const spread = annualSpread(quotes)
  const coverType = COVER_TYPES.find((c) => c.id === cover) ?? COVER_TYPES[0]

  return (
    <div className="pb-8">
      <ScreenHeader title="Insurance" subtitle="Indicative premiums across six insurers" back />

      <div className="space-y-5 px-4">
        <Card className="border-primary/30 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cheapest vs dearest, over a year
          </p>
          <p className="mt-1 font-display text-4xl font-semibold leading-none">
            {formatZAR(spread)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Same car, same cover, six insurers. That gap is what shopping around is worth. It is
            not a discount anyone will offer you unprompted.
          </p>
        </Card>

        {/* Vehicle context */}
        <Card className="p-4">
          <SectionTitle>Vehicle being priced</SectionTitle>
          <label htmlFor="ins-vehicle" className="sr-only">
            Vehicle to price
          </label>
          <select
            id="ins-vehicle"
            value={vehicle.id}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.variant}, {formatZAR(v.price)}
              </option>
            ))}
          </select>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {profile?.city || vehicle.city}
            {profile?.province ? `, ${profile.province}` : ''} ·{' '}
            {basis === 'context'
              ? 'carried over from your comparison'
              : basis === 'saved'
                ? 'from your saved cars'
                : 'no saved cars yet, pick one to price'}
          </p>
          {!savedVehicles.length && (
            <Link href="/explore" className="mt-2 inline-block text-xs font-semibold text-primary">
              Save a car in Explore →
            </Link>
          )}
        </Card>

        {/* Cover type */}
        <Card className="p-4">
          <SectionTitle>Cover type</SectionTitle>
          <div role="radiogroup" aria-label="Cover type" className="space-y-2">
            {COVER_TYPES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={cover === c.id}
                onClick={() => setCover(c.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  cover === c.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{c.label}</span>
                  {cover === c.id && <Pill tone="primary">Selected</Pill>}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground text-pretty">
                  {c.blurb}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip pressed={tracker} onClick={() => setTracker((t) => !t)}>
              Tracking device (−{Math.round(TRACKER_DISCOUNT * 100)}%)
            </Chip>
            <Chip pressed={garaged} onClick={() => setGaraged((g) => !g)}>
              Garaged overnight (−{Math.round(GARAGED_DISCOUNT * 100)}%)
            </Chip>
          </div>

          {loading > 0 && (
            <p className="mt-3 text-xs text-muted-foreground text-pretty">
              A loading of {Math.round(loading * 100)}% is applied for your age
              {driverAge !== null ? ` (${driverAge})` : ''} and licence tenure
              {licenceYears !== null ? ` (${licenceYears} year${licenceYears === 1 ? '' : 's'})` : ''}.
              Every insurer prices this; we show it rather than burying it.
            </p>
          )}
        </Card>

        <Notice tone="warning">
          These are <strong className="font-semibold">indicative estimates</strong>, not quotes. No
          insurer has seen your details. Base premiums were last reviewed{' '}
          {formatDate(PREMIUMS_REVIEWED)} and are adjusted openly for cover type, vehicle value,
          tracker, garaging and driver profile. 1st Buyer earns nothing from these links.
        </Notice>

        {/* Providers */}
        <div>
          <SectionTitle>
            {coverType.label} · {quotes.length} insurers
          </SectionTitle>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {quotes.map((q, i) => (
              <Card
                key={q.insurer.id}
                className={cn('p-4', i === 0 && 'border-primary/40 ring-1 ring-primary/20')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold">
                      {q.insurer.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{q.insurer.name}</p>
                      <p className="text-xs text-muted-foreground text-pretty">{q.insurer.note}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-semibold leading-tight">
                      {formatZAR(q.monthly)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">per month</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {i === 0 && <Pill tone="success">Lowest estimate</Pill>}
                  <Pill tone="muted">Excess {formatZAR(q.insurer.excess)}</Pill>
                  <Pill tone="muted">{formatZAR(q.annual)}/year</Pill>
                </div>

                <a
                  href={INSURER_SITES[q.insurer.name] ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
                >
                  Get a real quote from {q.insurer.name}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Card>
            ))}
          </div>
        </div>

        <Card className="p-4">
          <SectionTitle>What the law expects</SectionTitle>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-pretty">
                Comprehensive cover is compulsory while a vehicle is financed. The lender is noted
                as an interested party until the debt is settled.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-pretty">
                The Road Accident Fund covers personal injury only. It pays nothing towards your
                car, so it is not a substitute for insurance.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-pretty">
                You may not be forced to take the dealership&apos;s policy or its credit life cover,
                National Credit Act s106 lets you substitute your own.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40',
      )}
    >
      {children}
    </button>
  )
}
