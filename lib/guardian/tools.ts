// The only doorway between the model and this application's data.
//
// DESIGN RULES, ALL OF THEM DELIBERATE
//
// 1. Every tool is READ ONLY. Guardian cannot write a row, change a setting,
//    send a mail or run a query. There is no tool that takes SQL, a URL, a
//    file path or a shell string, so there is nothing for a prompt injection
//    to aim at. The worst a compromised model can do here is read the user's
//    own data back to them.
//
// 2. Every tool reuses the app's real logic. The instalment comes from
//    lib/finance's estimateInstalment, the rivals from lib/rivals, the running
//    costs from lib/running-cost. Guardian therefore cannot quote a number
//    that disagrees with the screen the user is looking at, which is the whole
//    reason to have tools rather than let the model do arithmetic.
//
// 3. The sensitive slice is withheld until asked for. The user's score and
//    income never enter the prompt: they sit in the handler closure and only
//    reach the model if it calls getCreditContext. A question about boot space
//    does not ship someone's salary to Google.
//
// 4. Missing data is returned as an explicit "not held" with a reason, never
//    as a zero, a blank or an average.

import { VEHICLES } from '../data'
import { NEW_CARS, type NewCar } from '../new-cars-source'
import {
  CREDIT_BANDS,
  PRIME_RATE,
  bandForScore,
  estimateInstalment,
  isUsableScore,
  targetRateForScore,
  assessAffordability,
} from '../finance'
import {
  DEFAULT_FUEL_PRICE_ZAR_PER_L,
  DEFAULT_MONTHLY_KM,
  calculateRunningCost,
} from '../running-cost'
import { dealQuality, marketRangeFor } from '../market-value'
import { findRivals, searchNewCars, explainMatch } from '../rivals'
import { JOURNEY_STAGES } from '../journey'
import { COVER_TYPES } from '../insurance'
import { matchVehicles } from '../fuzzy'
import type { GuardianContext, GuardianPrivateContext } from './protocol'
import { PAGE_PURPOSE } from './app-knowledge'

/** What the model sees. Shapes follow the Gemini function-declaration format. */
export type ToolDeclaration = {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

const NOT_HELD = (reason: string) => ({ held: false as const, reason })

/* ------------------------------------------------------------ shaping ---- */

function shapeUsedVehicle(v: (typeof VEHICLES)[number]) {
  return {
    id: v.id,
    name: `${v.year} ${v.make} ${v.model} ${v.variant}`,
    priceZAR: v.price,
    year: v.year,
    mileageKm: v.mileage,
    fuel: v.fuel,
    transmission: v.transmission,
    city: v.city,
    source: 'Sample prototype catalogue: illustrative, not a live listing.',
  }
}

function shapeNewCar(car: NewCar) {
  // Nulls are preserved and labelled. A "0 kW" or an omitted key would both
  // read to the model as a fact it can work with; "not stated by the source"
  // cannot be mistaken for one.
  const figure = (value: number | null, unit: string) =>
    value === null ? 'not stated by the source' : `${value} ${unit}`
  return {
    id: car.id,
    name: `${car.make} ${car.model} ${car.variant}`,
    bodyType: car.bodyType,
    listPriceZAR: car.listPrice,
    fuel: car.fuel,
    transmission: car.transmission ?? 'not stated by the source',
    engine: figure(car.engineCc, 'cc'),
    power: figure(car.powerKw, 'kW'),
    torque: figure(car.torqueNm, 'Nm'),
    claimedConsumption: figure(car.consumptionL100km, 'l/100km'),
    seats: figure(car.seats, 'seats'),
    boot: figure(car.bootLitres, 'litres'),
    safety:
      car.ncapStars === null
        ? 'not stated by the source'
        : `${car.ncapStars}/5 ${car.ncapProgramme ?? ''}`.trim(),
    note: 'List price as published on the source date. Not a drive-away price and not a dealer quote.',
  }
}

/* -------------------------------------------------------- declarations --- */

export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    type: 'function',
    name: 'findVehicle',
    description:
      'Look up cars in this app by name, for example "Polo Vivo" or "Suzuki Swift". Searches both the used listings and the brand-new catalogue. Use this before saying anything about a specific car.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A make, model or derivative name.' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'getCurrentContext',
    description:
      'What the user is looking at right now: the screen, and the specific car or comparison it is about. Use this when the user says "this car", "these two" or "this page".',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'getCreditContext',
    description:
      "The user's recorded credit score, rate band and monthly income, exactly as this app holds them. This is withheld until you ask for it. Call it whenever the answer depends on their financial position, including any instalment or affordability question.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'estimateMonthlyCost',
    description:
      "Run this app's own calculator for a car: estimated instalment at the user's recorded credit band, fuel, insurance and an affordability verdict. Returns locked values if the user has no recorded score. Never do this arithmetic yourself.",
    parameters: {
      type: 'object',
      properties: {
        vehicleId: {
          type: 'string',
          description: 'An id returned by findVehicle or getCurrentContext.',
        },
      },
      required: ['vehicleId'],
    },
  },
  {
    type: 'function',
    name: 'getRivals',
    description:
      'For a brand-new car, the competitors closest to it on published figures, the cars at the opposite end, and other derivatives of the same nameplate. Use for "what else should I look at" or "what competes with this".',
    parameters: {
      type: 'object',
      properties: {
        newCarId: { type: 'string', description: 'A brand-new catalogue id from findVehicle.' },
      },
      required: ['newCarId'],
    },
  },
  {
    type: 'function',
    name: 'getMarketContext',
    description:
      'Whether a used listing is priced well against comparable listings in this app, and by how much. Says so plainly when there are too few comparable cars to judge.',
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string', description: 'A used listing id from findVehicle.' },
      },
      required: ['vehicleId'],
    },
  },
  {
    type: 'function',
    name: 'getQuotationAnalysis',
    description:
      "The user's most recent dealer quotation analysis from this app: the fairness score and every line it flagged, with the reason.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'getJourneyProgress',
    description:
      'Which of the seven buying stages the user has completed and what the next one is. Use for "where am I" or "what should I do next".',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'getInsuranceOptions',
    description:
      'The cover types this app compares and what each one covers, plus how its indicative premiums are modelled.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]

/* ------------------------------------------------------------ handlers --- */

export type ToolResult = Record<string, unknown>

/**
 * Build the handler set for one request.
 *
 * The private context is captured in this closure and never returned except
 * through getCreditContext, which is the single audited exit point for it.
 */
export function createToolHandlers(
  context: GuardianContext,
  priv: GuardianPrivateContext,
): Record<string, (args: Record<string, unknown>) => ToolResult> {
  function usedById(id: unknown) {
    return typeof id === 'string' ? VEHICLES.find((v) => v.id === id) ?? null : null
  }
  function newById(id: unknown) {
    return typeof id === 'string' ? NEW_CARS.find((c) => c.id === id) ?? null : null
  }

  return {
    findVehicle(args) {
      const query = typeof args.query === 'string' ? args.query.slice(0, 100) : ''
      if (!query.trim()) return { matches: [], note: 'No search term was given.' }

      const used = matchVehicles(query, VEHICLES).slice(0, 4).map((m) => shapeUsedVehicle(m.vehicle))
      const brandNew = searchNewCars(query, NEW_CARS, 4).map(shapeNewCar)

      if (used.length === 0 && brandNew.length === 0) {
        return {
          matches: [],
          note: `Nothing in this app's catalogue matches "${query}". The catalogue is a small sample plus entry-level new cars, so most models are simply not in it. Say that rather than describing the car from memory.`,
        }
      }
      return { usedListings: used, brandNewCars: brandNew }
    },

    getCurrentContext() {
      const vehicle = usedById(context.vehicleId)
      const newCar = newById(context.newCarId)
      const comparing = (context.compareIds ?? [])
        .map((id) => VEHICLES.find((v) => v.id === id))
        .filter((v): v is (typeof VEHICLES)[number] => Boolean(v))
        .map(shapeUsedVehicle)

      return {
        screen: context.page,
        screenPurpose: PAGE_PURPOSE[context.page],
        vehicleInFocus: vehicle ? shapeUsedVehicle(vehicle) : null,
        newCarInFocus: newCar ? shapeNewCar(newCar) : null,
        comparing: comparing.length > 0 ? comparing : null,
      }
    },

    getCreditContext() {
      const score = priv.creditScore ?? null
      if (!isUsableScore(score)) {
        return {
          hasRecordedScore: false,
          monthlyIncomeZAR: priv.monthlyIncome ?? null,
          reason:
            'The user has not recorded a credit score in this app. Do not estimate an instalment or a rate for them, and do not guess a score. Point them at the Credit screen to record one.',
          bandsForReference: CREDIT_BANDS.map((b) => `${b.label} ${b.min}-${b.max}: Prime + ${b.spread}%`),
        }
      }
      const band = bandForScore(score)
      return {
        hasRecordedScore: true,
        score,
        bandLabel: band.label,
        bandSummary: band.summary,
        primeRate: PRIME_RATE,
        targetRate: Number(targetRateForScore(score).toFixed(2)),
        monthlyIncomeZAR: priv.monthlyIncome ?? null,
        note: 'Self-reported by the user from their own bureau report. This app did not pull it from a bureau and no lender has seen it. The target rate is a negotiating benchmark, not an offer.',
      }
    },

    estimateMonthlyCost(args) {
      const vehicle = usedById(args.vehicleId)
      const newCar = newById(args.vehicleId)
      const price = vehicle?.price ?? newCar?.listPrice ?? null
      if (price === null) {
        return NOT_HELD('No car in this app has that id. Use findVehicle first.')
      }

      const score = priv.creditScore ?? null
      const name = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        : `${newCar!.make} ${newCar!.model}`

      if (!isUsableScore(score)) {
        return {
          vehicle: name,
          priceZAR: price,
          instalment: null,
          locked: true,
          reason:
            'This app will not estimate an instalment without a recorded credit score, because the rate would be a guess. Tell the user that and point them at the Credit screen.',
        }
      }

      // The app's own calculator, not the model's arithmetic.
      const instalment = Math.round(estimateInstalment(price, score))
      const running = vehicle
        ? calculateRunningCost({
            vehicle,
            spec: null,
            monthlyKm: DEFAULT_MONTHLY_KM,
            fuelPricePerL: DEFAULT_FUEL_PRICE_ZAR_PER_L,
            driverAge: null,
            licenceYears: null,
          })
        : null
      const affordability = priv.monthlyIncome
        ? assessAffordability(instalment, priv.monthlyIncome)
        : null

      return {
        vehicle: name,
        priceZAR: price,
        estimatedInstalmentZAR: instalment,
        assumptions: `Estimated at the user's ${bandForScore(score).label} band rate of about ${targetRateForScore(score).toFixed(2)}%, over 72 months with a 10% deposit.`,
        runningCosts: running
          ? { fuelZAR: running.fuel, insuranceZAR: running.insurance, note: 'Indicative, not a quote.' }
          : 'Running costs are only modelled for used listings in this app.',
        affordability: affordability
          ? { verdict: affordability.label, detail: affordability.note }
          : 'The user has not recorded a monthly income, so affordability cannot be assessed.',
        warning: 'An estimate from this app, not a quotation. No lender has priced this deal.',
      }
    },

    getRivals(args) {
      const chosen = newById(args.newCarId)
      if (!chosen) {
        return NOT_HELD(
          'Rivals are only computed for the brand-new catalogue. Use findVehicle and pass a brand-new car id.',
        )
      }
      const report = findRivals(chosen, NEW_CARS, 4)
      const line = (m: (typeof report.rivals)[number], kind: 'rival' | 'opposite') => ({
        name: `${m.car.make} ${m.car.model} ${m.car.variant}`,
        listPriceZAR: m.car.listPrice,
        why: explainMatch(m, kind),
        measuredOn: m.axes.map((a) => a.note),
        axesNotComparable: m.missingAxes,
      })
      return {
        chosen: shapeNewCar(chosen),
        competitors: report.rivals.map((m) => line(m, 'rival')),
        opposites: report.opposites.map((m) => line(m, 'opposite')),
        otherDerivatives: report.derivatives.map((m) => ({
          name: `${m.car.make} ${m.car.model} ${m.car.variant}`,
          listPriceZAR: m.car.listPrice,
        })),
        method:
          'Computed from published figures only: list price, engine size, power, claimed consumption, body type and fuel type. This app holds no data on which cars South Africans actually cross-shop, so do not claim to know that.',
      }
    },

    getMarketContext(args) {
      const vehicle = usedById(args.vehicleId)
      if (!vehicle) return NOT_HELD('That id is not a used listing in this app.')

      const range = marketRangeFor(vehicle, VEHICLES)
      const quality = dealQuality(vehicle, VEHICLES)
      if (!range) {
        return {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          askingPriceZAR: vehicle.price,
          verdict: null,
          reason:
            'This app holds too few comparable listings to state a price range for this car, so it does not claim one. Say that rather than judging the price.',
        }
      }
      return {
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        askingPriceZAR: vehicle.price,
        comparableRange: {
          low: range.low,
          median: range.median,
          high: range.high,
          peers: range.peerCount,
          basis: range.basis,
        },
        verdict: quality.label,
        detail: quality.detail,
        percentFromMedian: quality.deltaPct,
        caveat:
          'Compared against this app\'s own sample catalogue, not the national market. It describes this data set only.',
      }
    },

    getQuotationAnalysis() {
      const q = priv.quotation
      if (!q) {
        return NOT_HELD(
          'The user has not analysed a dealer quotation in this app yet. Point them at the Documents screen, Analyse a quote tab.',
        )
      }
      return {
        vehicle: q.vehicle,
        fairnessScoreOutOf100: q.score,
        lines: q.findings.map((f) => ({
          item: f.label,
          quoted: f.value,
          status: f.status,
          appComment: f.note,
        })),
        guidance:
          'A flagged line is something to ask the dealer to explain in writing. It is not evidence of wrongdoing: these are lawful charges and the question is whether this one is reasonable.',
      }
    },

    getJourneyProgress() {
      const done = new Set(priv.completedStages ?? [])
      const stages = JOURNEY_STAGES.map((s) => ({
        step: s.index,
        title: s.title,
        done: done.has(s.id),
        screen: s.href,
        unlockedBy: s.unlockedBy,
      }))
      const next = stages.find((s) => !s.done) ?? null
      return {
        completed: stages.filter((s) => s.done).length,
        total: stages.length,
        stages,
        nextStage: next,
      }
    },

    getInsuranceOptions() {
      return {
        coverTypes: COVER_TYPES.map((c) => ({ type: c.label, covers: c.blurb })),
        method:
          'This app models indicative monthly premiums from placeholder base rates, adjusted for vehicle value, driver age, licence years, tracking and garaging. No insurer has priced this risk, so these are not quotes.',
        note: 'A financed car normally must carry comprehensive cover for the whole term as a condition of the finance agreement.',
      }
    },
  }
}
