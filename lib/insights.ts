// F-15, per-vehicle insights: pros/cons, negotiation leverage, and the South
// African context notes (dealer proximity, service network, charging, province).
//
// Every line produced here is tied to a real data point or a real user
// attribute. There is no filler: when nothing can be said, the caller renders
// the honest-empty message rather than a generic pleasantry.

import type { Dealer, Vehicle } from './data'
import { DEALERS } from './data'
import { assessAffordability, type AffordabilityVerdict } from './finance'
import { dealQuality, type DealQuality } from './market-value'
import { reliabilityFor } from './reliability'
import { MEANINGFUL_MILEAGE_DELTA_KM } from './compare-helpers'

export type InsightTone = 'pro' | 'con' | 'neutral'

export type Insight = {
  tone: InsightTone
  text: string
  /** The data point this came from, for the transparency note. */
  basis: string
}

export const NO_INSIGHTS_MESSAGE = 'No strong advantages or risks identified yet'

/** SA average annual mileage used to judge whether a car is over-driven. */
export const AVERAGE_KM_PER_YEAR = 20000

export type InsightContext = {
  vehicle: Vehicle
  catalogue: readonly Vehicle[]
  instalment: number | null
  monthlyIncome: number
  runningCostMonthly: number
  currentYear?: number
}

/**
 * "For this buyer", derived from the user's own income, credit-based
 * instalment and the listing's own facts. Nothing here fires without both.
 */
export function buildInsights(ctx: InsightContext): Insight[] {
  const { vehicle, catalogue, instalment, monthlyIncome, runningCostMonthly } = ctx
  const year = ctx.currentYear ?? new Date().getFullYear()
  const out: Insight[] = []

  // Affordability, only with a real instalment and a real income.
  if (typeof instalment === 'number' && monthlyIncome > 0) {
    const verdict: AffordabilityVerdict = assessAffordability(instalment, monthlyIncome)
    const pct = Math.round(verdict.ratio * 100)
    out.push({
      tone: verdict.id === 'comfortable' ? 'pro' : verdict.id === 'stretch' ? 'neutral' : 'con',
      text: `Instalment is ${pct}% of your income, ${verdict.label.toLowerCase()}`,
      basis: 'your recorded income and credit band',
    })

    // The true monthly cost, which buyers routinely under-count.
    if (runningCostMonthly > 0) {
      const totalPct = Math.round(((instalment + runningCostMonthly) / monthlyIncome) * 100)
      out.push({
        tone: totalPct > 35 ? 'con' : totalPct > 25 ? 'neutral' : 'pro',
        text: `With fuel and insurance the real cost is about ${totalPct}% of your income`,
        basis: 'instalment plus indicative running cost',
      })
    }
  }

  // Deal quality, only when a peer-backed range exists.
  const deal = dealQuality(vehicle, catalogue)
  if (deal.id === 'below') {
    out.push({ tone: 'pro', text: deal.label, basis: deal.range?.basis ?? 'catalogue peers' })
  } else if (deal.id === 'above') {
    out.push({ tone: 'con', text: deal.label, basis: deal.range?.basis ?? 'catalogue peers' })
  }

  // Mileage against age, pure arithmetic on listed facts.
  const age = Math.max(1, year - vehicle.year)
  const expected = age * AVERAGE_KM_PER_YEAR
  if (vehicle.mileage - expected >= MEANINGFUL_MILEAGE_DELTA_KM) {
    out.push({
      tone: 'con',
      text: `${Math.round((vehicle.mileage - expected) / 1000)} 000 km above average for a ${vehicle.year} model`,
      basis: `listed mileage vs ${AVERAGE_KM_PER_YEAR.toLocaleString('en-ZA')} km/year`,
    })
  } else if (expected - vehicle.mileage >= MEANINGFUL_MILEAGE_DELTA_KM) {
    out.push({
      tone: 'pro',
      text: `Lower mileage than typical for a ${vehicle.year} model`,
      basis: `listed mileage vs ${AVERAGE_KM_PER_YEAR.toLocaleString('en-ZA')} km/year`,
    })
  }

  // Service history is not in the catalogue at all, that absence is itself a
  // real, actionable fact for a used-car buyer.
  out.push({
    tone: 'neutral',
    text: 'No service plan or service history listed. Ask for full records before viewing',
    basis: 'the listing carries no service-history field',
  })

  // Reliability only if sourced.
  const reliability = reliabilityFor(vehicle.make, vehicle.model)
  if (reliability) {
    out.push({
      tone: 'pro',
      text: `${reliability.figure}, ${reliability.measure}`,
      basis: `${reliability.sourceId} ${reliability.year}`,
    })
  }

  return out
}

/* ------------------------------------------------------------- leverage -- */

export type Leverage = {
  point: string
  basis: string
  href?: string
}

export const NO_LEVERAGE_MESSAGE = 'No obvious negotiation flags identified'

/**
 * One honest negotiation point, from the same pure functions the rest of the
 * screen uses. Priority: price above market, then excess mileage, then the
 * missing service history.
 */
export function negotiationLeverage(
  vehicle: Vehicle,
  catalogue: readonly Vehicle[],
  currentYear = new Date().getFullYear(),
): Leverage | null {
  const deal: DealQuality = dealQuality(vehicle, catalogue)

  if (deal.id === 'above' && deal.deltaPct !== null) {
    return {
      point: `Listed ${Math.round(deal.deltaPct * 100)}% above the market estimate, ask them to justify it or meet the median`,
      basis: deal.range?.basis ?? 'catalogue peers',
      href: '#methodology',
    }
  }

  const age = Math.max(1, currentYear - vehicle.year)
  const excess = vehicle.mileage - age * AVERAGE_KM_PER_YEAR
  if (excess >= MEANINGFUL_MILEAGE_DELTA_KM) {
    return {
      point: `Mileage is about ${Math.round(excess / 1000)} 000 km above average for this year, that is worth money off`,
      basis: `listed mileage vs ${AVERAGE_KM_PER_YEAR.toLocaleString('en-ZA')} km/year`,
    }
  }

  return {
    point: 'No service history is listed, request full records before you make an offer',
    basis: 'the listing carries no service-history field',
  }
}

/* ----------------------------------------------- South African context --- */

export type DealerContext = {
  dealer: Dealer | null
  proximity: 'same-city' | 'same-province' | 'other-province' | 'unknown'
  label: string
  detail: string
  directionsUrl: string | null
  /** Ratings are never fabricated; this stays null until a sourced feed exists. */
  rating: null
}

export function dealerContext(
  vehicle: Vehicle,
  profile: { city?: string; province?: string } | null,
): DealerContext {
  const dealer = DEALERS.find((d) => d.name === vehicle.dealer) ?? null
  const directionsUrl = dealer
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${dealer.name}, ${dealer.city}, ${dealer.province}`)}`
    : null

  if (!dealer) {
    return {
      dealer: null,
      proximity: 'unknown',
      label: 'Branch details not listed',
      detail: 'We hold no branch record for this listing.',
      directionsUrl: null,
      rating: null,
    }
  }

  if (!profile?.city && !profile?.province) {
    return {
      dealer,
      proximity: 'unknown',
      label: 'Add your city to see how far this branch is',
      detail: `${dealer.city}, ${dealer.province}. We do not hold branch coordinates, so we compare your city and province rather than showing a distance we cannot measure.`,
      directionsUrl,
      rating: null,
    }
  }

  const sameCity = profile.city && dealer.city.toLowerCase() === profile.city.toLowerCase()
  const sameProvince =
    profile.province && dealer.province.toLowerCase() === profile.province.toLowerCase()

  if (sameCity) {
    return {
      dealer,
      proximity: 'same-city',
      label: `In your city (${dealer.city})`,
      detail: 'Same city as your profile address.',
      directionsUrl,
      rating: null,
    }
  }
  if (sameProvince) {
    return {
      dealer,
      proximity: 'same-province',
      label: `In your province, different city (${dealer.city})`,
      detail: `${dealer.city}, ${dealer.province}.`,
      directionsUrl,
      rating: null,
    }
  }
  return {
    dealer,
    proximity: 'other-province',
    label: `Another province, ${dealer.province}`,
    detail: `Budget for collection, delivery, or a licensing change from ${profile.province ?? 'your province'}.`,
    directionsUrl,
    rating: null,
  }
}

export const DEALER_RATING_ABSENT =
  'We publish no dealer rating. We have no sourced, verifiable rating data, and an invented star would be worse than none.'

/** Service-network proximity: no licensed dataset, so this states its absence. */
export const SERVICE_NETWORK_ABSENT = 'Service network data not yet available'

export function serviceNetworkNote(vehicle: Vehicle, province?: string): string {
  return `${SERVICE_NETWORK_ABSENT} for ${vehicle.make}${province ? ` in ${province}` : ''}. Where you service the car matters as much as the price, confirm the nearest authorised centre with the dealer before you buy.`
}

/* ------------------------------------------------------ electrification -- */

export type ChargingNote = {
  applicable: boolean
  text: string
}

/**
 * Only for cars that actually plug in. Our catalogue records fuel as
 * Petrol/Diesel/Hybrid and does not say whether a hybrid is plug-in, so a
 * hybrid gets an honest "we cannot tell" rather than a charging lecture that
 * may not apply.
 */
export function chargingNote(vehicle: Vehicle): ChargingNote {
  const fuel = String(vehicle.fuel)

  if (fuel === 'Electric') {
    return {
      applicable: true,
      text: 'Electric: confirm charging at your home and check your load-shedding schedule. A scheduled outage during your usual charging window changes daily practicality. We hold no public-charger dataset, so we cannot count stations near you.',
    }
  }

  if (fuel === 'Hybrid') {
    return {
      applicable: true,
      text: 'Hybrid: the listing does not say whether this model plugs in. If it is a plug-in, load-shedding will affect home charging; if it is self-charging, it does not. Confirm with the dealer.',
    }
  }

  return { applicable: false, text: '' }
}

/* ----------------------------------------------------- insurance region -- */

export const INSURANCE_REGION_NOTE =
  'Insurance figures here are not province-specific: our indicative pricing model adjusts for cover, vehicle value, tracker, garaging and driver profile, but not for where you live. Your registered address will change a real quote.'
