'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ScreenHeader } from '@/components/screen-header'
import { BottomSheet } from '@/components/bottom-sheet'
import { Card, EmptyState, Notice, SectionTitle, inputClass } from '@/components/ui-kit'
import { ComparisonTable } from '@/components/compare/comparison-table'
import {
  DecisionPanel,
  GlanceBar,
  HistorySheet,
  InsuranceRegionNote,
  NaturalLanguageInput,
  PhotoCompare,
  PhotoModeToggle,
  SuggestionChips,
  VehicleInsights,
} from '@/components/compare/compare-panels'
import { useStore } from '@/lib/store'
import { CATALOGUE_SOURCE, VEHICLES } from '@/lib/data'
import {
  COMPARE_ATTRIBUTES,
  MAX_COMPARE,
  MIN_COMPARE,
  buildComparison,
  buildComparisonEvent,
  buildComparisonSummary,
  canPersonalise,
  compareHref,
  lowestInstalmentId,
  parseCompareIds,
  serialiseCompareIds,
  toggleCompareId,
  type CompareContext,
  type CompareSection,
} from '@/lib/compare'
import { buildDiffMatrix, runningCostConflict, similarityGuard } from '@/lib/compare-helpers'
import { dealQuality, MARKET_METHODOLOGY } from '@/lib/market-value'
import { buildInsights, negotiationLeverage } from '@/lib/insights'
import { type ScoreInputs } from '@/lib/decision-score'
import { RELIABILITY_PROVENANCE_NOTE, RELIABILITY_SOURCES, reliabilityFor } from '@/lib/reliability'
import { SPEC_SOURCES_NOTE, specFor } from '@/lib/specs'
import {
  DEFAULT_FUEL_PRICE_ZAR_PER_L,
  DEFAULT_MONTHLY_KM,
  FUEL_PRICE_ASSUMED_AT,
  RUNNING_COST_LABEL,
  TCO_DEFERRED_NOTE,
} from '@/lib/running-cost'
import { createShareToken, SHARE_TTL_HOURS } from '@/lib/share-token'
import { withVehicleContext } from '@/lib/vehicle-context'
import { comparedEvent, track } from '@/lib/analytics'
import { hapticAdd, hapticRemove } from '@/lib/haptics'
import { formatDate, yearsBetween } from '@/lib/format'
import {
  Check,
  Download,
  Gauge,
  History,
  Link2,
  Plus,
  Printer,
  Scale,
  Send,
  Umbrella,
  X,
} from 'lucide-react'

const FUEL_PRICE_MAX = 60
const MONTHLY_KM_MAX = 10000

export function CompareScreen() {
  const store = useStore()
  const {
    ready,
    profile,
    currentScore,
    savedComparisons,
    saveComparison,
    recordComparison,
    createShare,
  } = store
  const router = useRouter()
  const searchParams = useSearchParams()

  const restoreId = searchParams.get('restore')
  const restored = restoreId ? savedComparisons.find((c) => c.id === restoreId) : undefined

  const ids = useMemo(
    () => parseCompareIds(restored ? serialiseCompareIds(restored.carIds) : searchParams.get('cars'), VEHICLES),
    [searchParams, restored],
  )

  const [fuelPrice, setFuelPrice] = useState(DEFAULT_FUEL_PRICE_ZAR_PER_L)
  const [monthlyKm, setMonthlyKm] = useState(DEFAULT_MONTHLY_KM)
  const [mode, setMode] = useState<'data' | 'photos'>('data')
  const [gateOpen, setGateOpen] = useState(false)
  const [gateDismissed, setGateDismissed] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [note, setNote] = useState('')

  const ctx: CompareContext = useMemo(
    () => ({
      score: currentScore,
      monthlyIncome: profile?.monthlyIncome ?? 0,
      driverAge: profile?.dob ? yearsBetween(profile.dob) : null,
      licenceYears: profile?.licenceDate ? yearsBetween(profile.licenceDate) : null,
      fuelPricePerL: fuelPrice,
      monthlyKm,
    }),
    [currentScore, profile, fuelPrice, monthlyKm],
  )

  const vehicles = useMemo(
    () => ids.map((id) => VEHICLES.find((v) => v.id === id)).filter((v) => Boolean(v)) as typeof VEHICLES,
    [ids],
  )
  const comparisons = useMemo(() => buildComparison(vehicles, ctx), [vehicles, ctx])
  const personalised = canPersonalise(ctx)
  const cheapestId = lowestInstalmentId(comparisons)
  const similarity = useMemo(() => similarityGuard(vehicles), [vehicles])

  const diffs = useMemo(
    () =>
      buildDiffMatrix(
        comparisons.map((c) => {
          const spec = specFor(c.vehicle.id)
          return {
            id: c.vehicle.id,
            values: {
              price: c.vehicle.price,
              year: c.vehicle.year,
              mileage: c.vehicle.mileage,
              fuel: c.vehicle.fuel,
              transmission: c.vehicle.transmission,
              engine: spec.engineCc,
              power: spec.powerKw,
              torque: spec.torqueNm,
              drivetrain: spec.drivetrain,
              seats: spec.seats,
              boot: spec.bootLitres,
              instalment: c.instalment,
              runningCost: c.runningCost.total,
            },
          }
        }),
      ),
    [comparisons],
  )

  const costConflict = useMemo(
    () =>
      runningCostConflict(
        comparisons.map((c) => ({
          name: `${c.vehicle.make} ${c.vehicle.model}`,
          basis: c.runningCost.consumptionBasis,
          monthly: c.runningCost.total,
        })),
      ),
    [comparisons],
  )

  // Decision-helper inputs. `null` means "no real value" and is excluded from
  // that car's score rather than counted as zero.
  const scoreEntries: { vehicleId: string; inputs: ScoreInputs }[] = useMemo(
    () =>
      comparisons.map((c) => {
        const spec = specFor(c.vehicle.id)
        return {
          vehicleId: c.vehicle.id,
          inputs: {
            affordability: c.instalment ?? c.vehicle.price,
            runningCost: c.runningCost.total,
            reliability: reliabilityFor(c.vehicle.make, c.vehicle.model) ? 1 : null,
            dealerDistance: null, // no branch coordinates held
            specPreference: spec.powerKw,
          },
        }
      }),
    [comparisons],
  )

  useEffect(() => {
    if (vehicles.length > 0 && ready && !personalised && !gateDismissed) setGateOpen(true)
  }, [vehicles.length, ready, personalised, gateDismissed])

  const loggedRef = useRef<string>('')
  useEffect(() => {
    const key = serialiseCompareIds(ids)
    if (vehicles.length < MIN_COMPARE || loggedRef.current === key) return
    loggedRef.current = key
    recordComparison(buildComparisonEvent(ids, ctx))
    track('cars_compared', comparedEvent(vehicles))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, vehicles.length])

  function setIds(next: string[]) {
    router.replace(compareHref(next), { scroll: false })
  }

  function add(id: string) {
    const next = toggleCompareId(ids, id)
    if (next.rejected) {
      setNote(`You can compare ${MAX_COMPARE} cars at a time, remove one first.`)
      return
    }
    setIds(next.ids)
  }

  function remove(id: string) {
    hapticRemove()
    setIds(ids.filter((x) => x !== id))
  }

  function onSave() {
    const name = saveName.trim() || vehicles.map((v) => `${v.make} ${v.model}`).join(' vs ')
    saveComparison({
      id: crypto.randomUUID(),
      carIds: [...ids],
      name: name.slice(0, 80),
      createdAt: new Date().toISOString(),
    })
    track('comparison_saved', comparedEvent(vehicles))
    hapticAdd()
    setSaveOpen(false)
    setSaveName('')
    setNote('Comparison saved. Find it under My comparisons or on your dashboard.')
  }

  async function onCopyLink() {
    const url = `${window.location.origin}${compareHref(ids)}`
    track('comparison_shared', comparedEvent(vehicles))
    try {
      await navigator.clipboard.writeText(url)
      setNote('Link copied. It reopens this exact comparison.')
    } catch {
      setNote(url)
    }
  }

  async function onAskFriend() {
    const share = createShareToken(ids)
    createShare(share)
    track('comparison_shared', comparedEvent(vehicles))
    const url = `${window.location.origin}/share/${share.token}`
    try {
      await navigator.clipboard.writeText(url)
      setNote(
        `Read-only link copied. It expires in ${SHARE_TTL_HOURS} hours and hides your instalment and credit band.`,
      )
    } catch {
      setNote(url)
    }
  }

  function onExport() {
    const text = buildComparisonSummary(comparisons, ctx)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'car-comparison.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  /* ------------------------------------------------------------- empty -- */

  if (vehicles.length === 0) {
    return (
      <div className="pb-8">
        <ScreenHeader
          title="Compare cars"
          subtitle="Two or three cars, side by side"
          back
          backTo="/explore"
          right={
            savedComparisons.length > 0 ? (
              <button
                onClick={() => setHistoryOpen(true)}
                aria-label="My comparisons"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <History className="h-5 w-5" aria-hidden />
              </button>
            ) : undefined
          }
        />
        <div className="space-y-5 px-4">
          <EmptyState icon={<Scale className="h-8 w-8" />} title="Nothing to compare yet">
            Pick two or three cars in Explore, tap <strong>Compare</strong> on any vehicle card,
            or type what you are weighing up below.
          </EmptyState>
          <NaturalLanguageInput onAdd={add} />
          <Link
            href="/explore"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> Choose cars in Explore
          </Link>
          <Notice tone="muted">{CATALOGUE_SOURCE.detail}</Notice>
        </div>
        {historyOpen && (
          <HistorySheet
            onClose={() => setHistoryOpen(false)}
            onRestore={(c) => {
              setHistoryOpen(false)
              setIds(c.carIds)
            }}
          />
        )}
      </div>
    )
  }

  const sections = Array.from(new Set(COMPARE_ATTRIBUTES.map((a) => a.section))) as CompareSection[]

  return (
    <div className="compare-screen pb-8">
      <ScreenHeader
        title="Compare cars"
        subtitle={`${vehicles.length} of ${MAX_COMPARE} · same questions, same order`}
        back
        backTo="/explore"
        right={
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label="My comparisons"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground print:hidden"
          >
            <History className="h-5 w-5" aria-hidden />
          </button>
        }
      />

      <div className="space-y-5 px-4">
        <GlanceBar
          comparisons={comparisons.map((c) => ({
            id: c.vehicle.id,
            name: `${c.vehicle.make} ${c.vehicle.model}`,
            price: c.vehicle.price,
            verdict: c.affordability?.label ?? null,
          }))}
        />

        {CATALOGUE_SOURCE.kind !== 'live' && (
          <Notice tone="warning">
            <strong className="font-semibold">{CATALOGUE_SOURCE.label}.</strong>{' '}
            {CATALOGUE_SOURCE.detail}
          </Notice>
        )}

        {similarity.similar && (
          <Notice tone="warning">
            <strong className="font-semibold">Very similar listings.</strong> {similarity.message}
          </Notice>
        )}

        {!personalised && (
          <Notice tone="warning">
            Instalment and affordability are locked. We will not estimate what you would pay without
            your credit score. That would mean guessing your interest rate.{' '}
            <Link href="/credit" className="font-semibold underline">
              Record your score
            </Link>
            .
          </Notice>
        )}

        <PhotoModeToggle mode={mode} onChange={setMode} />

        {mode === 'photos' ? (
          <PhotoCompare vehicles={[...vehicles]} />
        ) : (
          <>
            <ComparisonTable
              comparisons={comparisons}
              sections={sections}
              cheapestId={cheapestId}
              diffs={diffs}
              personalisedReady={ready}
              onRemove={remove}
            />

            {costConflict.mixed && (
              <Notice tone="warning">
                <strong className="font-semibold">Not like for like.</strong> {costConflict.message}
              </Notice>
            )}
          </>
        )}

        {vehicles.length < MAX_COMPARE && (
          <SuggestionChips anchor={vehicles[0]} excludeIds={ids} onAdd={add} />
        )}

        <DecisionPanel
          entries={scoreEntries}
          names={Object.fromEntries(
            comparisons.map((c) => [c.vehicle.id, `${c.vehicle.make} ${c.vehicle.model}`]),
          )}
        />

        {/* Running-cost assumptions, the user owns these numbers */}
        <Card className="p-4 print:hidden">
          <SectionTitle>Running-cost assumptions</SectionTitle>
          <p className="mb-3 text-xs text-muted-foreground text-pretty">
            {RUNNING_COST_LABEL}. Fuel is calculated from the two figures below, which are yours to
            change, the default pump price is an assumption from {formatDate(FUEL_PRICE_ASSUMED_AT)},
            not a live feed. Insurance is the cheapest indicative comprehensive premium from the
            Insurance screen. Servicing is excluded because we have no sourced price for it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="fuel-price" className="block text-sm font-medium">
                Fuel price (R/ℓ)
              </label>
              <input
                id="fuel-price"
                type="number"
                inputMode="decimal"
                min={1}
                max={FUEL_PRICE_MAX}
                step="0.10"
                value={fuelPrice}
                onChange={(e) =>
                  setFuelPrice(Math.min(FUEL_PRICE_MAX, Math.max(1, Number(e.target.value) || 0)))
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="monthly-km" className="block text-sm font-medium">
                Distance (km/month)
              </label>
              <input
                id="monthly-km"
                type="number"
                inputMode="numeric"
                min={50}
                max={MONTHLY_KM_MAX}
                step={50}
                value={monthlyKm}
                onChange={(e) =>
                  setMonthlyKm(Math.min(MONTHLY_KM_MAX, Math.max(50, Number(e.target.value) || 0)))
                }
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Per-car verdicts, leverage and South African context */}
        <div>
          <SectionTitle>What this means for you</SectionTitle>
          <div className="space-y-3">
            {comparisons.map((c) => (
              <VehicleInsights
                key={c.vehicle.id}
                vehicle={c.vehicle}
                deal={dealQuality(c.vehicle, VEHICLES)}
                insights={buildInsights({
                  vehicle: c.vehicle,
                  catalogue: VEHICLES,
                  instalment: c.instalment,
                  monthlyIncome: ctx.monthlyIncome,
                  runningCostMonthly: c.runningCost.total,
                })}
                leverage={negotiationLeverage(c.vehicle, VEHICLES)}
                profile={profile}
              />
            ))}
          </div>
        </div>

        <InsuranceRegionNote />

        {/* Per-car actions */}
        <div className="print:hidden">
          <SectionTitle>Take this further</SectionTitle>
          <div className="space-y-2">
            {comparisons.map((c) => (
              <Card key={c.vehicle.id} className="flex items-center gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {c.vehicle.make} {c.vehicle.model}
                </p>
                <Link
                  href={withVehicleContext('/insurance', c.vehicle.id)}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
                >
                  <Umbrella className="h-3.5 w-3.5" aria-hidden /> Insurance
                </Link>
                <Link
                  href="/finance"
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
                >
                  <Gauge className="h-3.5 w-3.5" aria-hidden /> Model
                </Link>
              </Card>
            ))}
          </div>
        </div>

        {/* Set-level controls */}
        <div className="grid grid-cols-2 gap-2 print:hidden">
          <button
            onClick={() => setSaveOpen(true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Check className="h-4 w-4" aria-hidden /> Save comparison
          </button>
          <button
            onClick={onCopyLink}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
          >
            <Link2 className="h-4 w-4" aria-hidden /> Copy link
          </button>
          <button
            onClick={onAskFriend}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
          >
            <Send className="h-4 w-4" aria-hidden /> Ask a friend
          </button>
          <button
            onClick={onExport}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
          >
            <Download className="h-4 w-4" aria-hidden /> Export text
          </button>
          <button
            onClick={() => window.print()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
          >
            <Printer className="h-4 w-4" aria-hidden /> Print / PDF
          </button>
          <button
            onClick={() => setIds([])}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-destructive/40 hover:text-destructive"
          >
            <X className="h-4 w-4" aria-hidden /> Clear all
          </button>
        </div>

        {note && (
          <p role="status" className="text-xs font-medium text-success text-pretty">
            {note}
          </p>
        )}

        <Link
          href="/explore"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground print:hidden"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {vehicles.length >= MAX_COMPARE ? 'Swap a car in Explore' : 'Add another car'}
        </Link>

        <NaturalLanguageInput onAdd={add} />

        {/* Provenance and scope */}
        <div id="methodology" className="scroll-mt-20" />
        <Card className="space-y-3 p-4">
          <SectionTitle>Where these answers come from</SectionTitle>
          <p className="text-xs text-muted-foreground text-pretty">{MARKET_METHODOLOGY.summary}</p>
          <p className="text-xs text-muted-foreground text-pretty">{SPEC_SOURCES_NOTE}</p>
          <p className="text-xs text-muted-foreground text-pretty">{RELIABILITY_PROVENANCE_NOTE}</p>
          <ul className="space-y-1.5">
            {RELIABILITY_SOURCES.map((s) => (
              <li key={s.id} className="text-xs text-muted-foreground text-pretty">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline"
                >
                  {s.name}
                </a>{' '}
               : {s.publisher}. {s.measures}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground text-pretty">{TCO_DEFERRED_NOTE}</p>
        </Card>
      </div>

      {gateOpen && (
        <BottomSheet
          title="We need your credit score first"
          onClose={() => {
            setGateOpen(false)
            setGateDismissed(true)
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-pretty">
              We can&apos;t estimate your instalment or tell you if this is affordable without your
              credit score. It takes two minutes.
            </p>
            <p className="text-xs text-muted-foreground text-pretty">
              Your score sets the interest rate a lender should offer you, and the instalment
              follows from that rate. Guessing it would mean showing you a stranger&apos;s numbers
              with your name on them.
            </p>
            <Link
              href="/credit"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Gauge className="h-4 w-4" aria-hidden /> Record my credit score
            </Link>
            <button
              onClick={() => {
                setGateOpen(false)
                setGateDismissed(true)
              }}
              className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
            >
              Keep comparing without it
            </button>
          </div>
        </BottomSheet>
      )}

      {saveOpen && (
        <BottomSheet title="Save this comparison as…" onClose={() => setSaveOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSave()
            }}
            className="space-y-3"
          >
            <label htmlFor="comparison-name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="comparison-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={vehicles.map((v) => `${v.make} ${v.model}`).join(' vs ')}
              maxLength={80}
              className={inputClass}
              autoFocus
            />
            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save
            </button>
          </form>
        </BottomSheet>
      )}

      {historyOpen && (
        <HistorySheet
          onClose={() => setHistoryOpen(false)}
          onRestore={(c) => {
            setHistoryOpen(false)
            setIds(c.carIds)
          }}
        />
      )}
    </div>
  )
}
