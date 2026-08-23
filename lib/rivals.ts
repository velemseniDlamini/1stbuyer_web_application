// "Which car are you interested in?" -> what it competes with, and what sits at
// the other end of the catalogue.
//
// WHAT THIS IS NOT
//
// It is not a market opinion. Nobody here knows which cars South African buyers
// actually cross-shop, and no such list is published in this repository, so
// none is invented. Every relationship below is arithmetic on figures a named,
// dated source published, and every card says which axes produced it.
//
// The words are chosen deliberately:
//
//   RIVAL      - close to the chosen car on the figures we hold.
//   OPPOSITE   - far from it on those same figures. It is the contrast that
//                shows what your money is buying, not a car we think is worse.
//   DERIVATIVE - the same nameplate at a different trim or price.
//
// Where a figure is missing the axis is dropped and reported as dropped. A car
// is never called a rival on the strength of data neither row contains.

import type { NewCar } from './new-cars-source'

export type RivalAxis = 'price' | 'engine' | 'power' | 'consumption' | 'body' | 'fuel'

/** How close two figures must be, in percent, to count as "close" on that axis. */
export const CLOSENESS_PCT: Record<'price' | 'engine' | 'power' | 'consumption', number> = {
  price: 15,
  engine: 20,
  power: 20,
  consumption: 15,
}

/**
 * A car must be at least this far from the chosen one, across the axes that
 * could be measured, before it is presented as an opposite. Below this it is
 * simply a different car, and calling it an opposite would overstate things.
 */
export const OPPOSITE_MIN_DISTANCE = 0.35

export const AXIS_LABEL: Record<RivalAxis, string> = {
  price: 'List price',
  engine: 'Engine size',
  power: 'Power',
  consumption: 'Fuel use',
  body: 'Body type',
  fuel: 'Fuel type',
}

export type AxisResult = {
  axis: RivalAxis
  label: string
  /** Signed percentage difference from the chosen car. Null on categorical axes. */
  deltaPct: number | null
  /** True when the pair is close on this axis, false when far apart. */
  close: boolean
  /** A sentence stating the actual figures, never a verdict. */
  note: string
}

export type RivalMatch = {
  car: NewCar
  /** Share of comparable axes on which the pair is close, 0 to 1. */
  closeness: number
  /** 1 - closeness, kept explicit so the opposite ranking reads plainly. */
  distance: number
  /** Axes both rows published. Never empty for a returned match. */
  axes: AxisResult[]
  /** Axes dropped because one row or both published nothing. */
  missingAxes: RivalAxis[]
}

export type RivalReport = {
  chosen: NewCar
  /** Closest first. */
  rivals: RivalMatch[]
  /** Furthest first. */
  opposites: RivalMatch[]
  /** Other derivatives of the same nameplate, cheapest first. */
  derivatives: RivalMatch[]
  /**
   * Cars sharing no comparable figure with the chosen one at all. Counted
   * rather than hidden, so the screen can say how much could not be judged.
   */
  incomparableCount: number
}

function pctDelta(chosen: number, other: number): number {
  return ((other - chosen) / chosen) * 100
}

function fmtPct(delta: number): string {
  const rounded = Math.abs(Math.round(delta))
  if (rounded === 0) return 'the same'
  return `${rounded}% ${delta > 0 ? 'more' : 'less'}`
}

function numericAxis(
  axis: 'price' | 'engine' | 'power' | 'consumption',
  chosen: number | null,
  other: number | null,
  describe: (delta: number) => string,
): AxisResult | null {
  if (chosen === null || other === null || chosen === 0) return null
  const deltaPct = pctDelta(chosen, other)
  return {
    axis,
    label: AXIS_LABEL[axis],
    deltaPct,
    close: Math.abs(deltaPct) <= CLOSENESS_PCT[axis],
    note: describe(deltaPct),
  }
}

/** Compare one car against another on every axis both of them publish. */
export function compareAxes(
  chosen: NewCar,
  other: NewCar,
): { axes: AxisResult[]; missing: RivalAxis[] } {
  const axes: AxisResult[] = []
  const missing: RivalAxis[] = []

  const price = numericAxis('price', chosen.listPrice, other.listPrice, (d) =>
    Math.abs(Math.round(d)) === 0 ? 'Listed at the same price.' : `Costs ${fmtPct(d)} on list price.`,
  )
  if (price) axes.push(price)
  else missing.push('price')

  const engine = numericAxis(
    'engine',
    chosen.engineCc,
    other.engineCc,
    (d) => `${other.engineCc} cc against ${chosen.engineCc} cc, ${fmtPct(d)}.`,
  )
  if (engine) axes.push(engine)
  else missing.push('engine')

  const power = numericAxis(
    'power',
    chosen.powerKw,
    other.powerKw,
    (d) => `${other.powerKw} kW against ${chosen.powerKw} kW, ${fmtPct(d)}.`,
  )
  if (power) axes.push(power)
  else missing.push('power')

  const consumption = numericAxis(
    'consumption',
    chosen.consumptionL100km,
    other.consumptionL100km,
    (d) =>
      `Claimed ${other.consumptionL100km} l/100km against ${chosen.consumptionL100km}, ${fmtPct(d)} fuel.`,
  )
  if (consumption) axes.push(consumption)
  else missing.push('consumption')

  // Categorical axes are always comparable: every row carries them.
  axes.push({
    axis: 'body',
    label: AXIS_LABEL.body,
    deltaPct: null,
    close: chosen.bodyType === other.bodyType,
    note:
      chosen.bodyType === other.bodyType
        ? `Also a ${other.bodyType.toLowerCase()}.`
        : `A ${other.bodyType.toLowerCase()}, not a ${chosen.bodyType.toLowerCase()}.`,
  })

  axes.push({
    axis: 'fuel',
    label: AXIS_LABEL.fuel,
    deltaPct: null,
    close: chosen.fuel === other.fuel,
    note:
      chosen.fuel === other.fuel
        ? `${other.fuel}, same as the ${chosen.model}.`
        : `${other.fuel}, where the ${chosen.model} is ${chosen.fuel.toLowerCase()}.`,
  })

  return { axes, missing }
}

/** Two rows are the same nameplate when make and model match, whatever the trim. */
export function isSameNameplate(a: NewCar, b: NewCar): boolean {
  return (
    a.make.toLowerCase() === b.make.toLowerCase() && a.model.toLowerCase() === b.model.toLowerCase()
  )
}

function match(chosen: NewCar, other: NewCar): RivalMatch | null {
  const { axes, missing } = compareAxes(chosen, other)
  // The two categorical axes always land; this only guards a future change.
  if (axes.length === 0) return null
  const closeness = axes.filter((a) => a.close).length / axes.length
  return { car: other, closeness, distance: 1 - closeness, axes, missingAxes: missing }
}

/**
 * Build the report for one chosen car.
 *
 * @param limit how many rivals and how many opposites to return.
 */
export function findRivals(chosen: NewCar, catalogue: readonly NewCar[], limit = 4): RivalReport {
  const derivatives: RivalMatch[] = []
  const others: RivalMatch[] = []
  let incomparableCount = 0

  for (const car of catalogue) {
    if (car.id === chosen.id) continue
    const m = match(chosen, car)
    if (!m) {
      incomparableCount += 1
      continue
    }
    if (isSameNameplate(chosen, car)) derivatives.push(m)
    else others.push(m)
  }

  const rivals = [...others]
    .sort(
      (a, b) =>
        b.closeness - a.closeness ||
        // A tie on axes is broken by the figure a first-time buyer feels first.
        Math.abs(a.car.listPrice - chosen.listPrice) - Math.abs(b.car.listPrice - chosen.listPrice),
    )
    .slice(0, limit)

  const opposites = [...others]
    .filter((m) => m.distance >= OPPOSITE_MIN_DISTANCE)
    .sort(
      (a, b) =>
        b.distance - a.distance ||
        // A gap measured across six axes is better evidence than the same gap
        // measured across three, so the fuller comparison wins a tie.
        b.axes.length - a.axes.length ||
        Math.abs(b.car.listPrice - chosen.listPrice) - Math.abs(a.car.listPrice - chosen.listPrice),
    )
    .slice(0, limit)

  return {
    chosen,
    rivals,
    opposites,
    derivatives: derivatives.sort((a, b) => a.car.listPrice - b.car.listPrice),
    incomparableCount,
  }
}

/**
 * One line explaining why a match is where it is, built only from the axes that
 * were actually measured.
 */
export function explainMatch(m: RivalMatch, kind: 'rival' | 'opposite'): string {
  const close = m.axes.filter((a) => a.close).map((a) => a.label.toLowerCase())
  const far = m.axes.filter((a) => !a.close).map((a) => a.label.toLowerCase())
  const list = kind === 'rival' ? close : far
  if (list.length === 0) {
    return kind === 'rival'
      ? 'Nothing we hold puts these two close together.'
      : 'Nothing we hold separates these two.'
  }
  const joined =
    list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
  return kind === 'rival' ? `Close on ${joined}.` : `Differs on ${joined}.`
}

/**
 * Free-text matching over the new-car catalogue. Deliberately the same shape as
 * lib/fuzzy.ts so the two search boxes cannot disagree, but typed for NewCar,
 * which carries a variant string worth matching on.
 */
export function searchNewCars(term: string, catalogue: readonly NewCar[], limit = 6): NewCar[] {
  const q = term
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!q) return []
  const tokens = q.split(' ').filter(Boolean)

  const scored: { car: NewCar; score: number }[] = []
  for (const car of catalogue) {
    const full = `${car.make} ${car.model} ${car.variant}`.toLowerCase()
    const nameplate = `${car.make} ${car.model}`.toLowerCase()
    const model = car.model.toLowerCase()

    let score = 0
    if (q === nameplate || q === model) score = 1
    else if (full.includes(q)) score = 0.9
    else if (model.includes(q) || q.includes(model)) score = 0.75
    else {
      const hits = tokens.filter((t) => t.length > 1 && full.includes(t)).length
      if (hits > 0) score = Math.min(0.6, 0.25 + hits * 0.15)
    }
    if (score > 0) scored.push({ car, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.car.listPrice - b.car.listPrice)
    .slice(0, limit)
    .map((s) => s.car)
}
