// F-15 Car Compare, comparison analysis helpers.
//
// Thresholds here are DATA-DRIVEN, not taste. Each one is derived from the
// compared set itself or from a stated real-world rule, and each carries the
// reasoning in a comment, because "material difference" is a claim about the
// user's money and must be defensible.

import type { Vehicle } from './data'
import type { CarSpec } from './specs'

/* ------------------------------------------------------- spec materiality -- */

/**
 * A difference is material when it changes the driving or ownership experience,
 * not when it merely differs. Thresholds:
 *
 *  power/torque, 15% relative difference. Below roughly 10-15% a power gap is
 *    not perceptible in normal driving, which is why manufacturers themselves
 *    market variants in ~15% steps. Expressed as a ratio, not an absolute, so a
 *    2 kW gap on a 60 kW hatch (3%) is noise while 40 kW on the same car is not.
 *  engine capacity, 20%: the difference between segment classes (1.0 vs 1.4).
 *  boot space, 15%: about one suitcase on a hatchback boot.
 *  seats, any difference is material (5 vs 7 changes what the car is for).
 *  transmission/drivetrain/fuel, any difference is categorical, not degree.
 *  price/mileage, see MEANINGFUL_PRICE_DELTA / MEANINGFUL_MILEAGE_DELTA.
 */
export const MATERIAL_RELATIVE_DELTA: Record<string, number> = {
  powerKw: 0.15,
  torqueNm: 0.15,
  engineCc: 0.2,
  bootLitres: 0.15,
  combinedLper100km: 0.1, // 10% of consumption is real rands over a year
}

/** Categorical fields where any difference at all is material. */
export const CATEGORICAL_FIELDS = ['drivetrain', 'seats', 'transmission', 'fuel'] as const

/** 5% is the "too similar to bother" bound used by the similarity guard. */
export const SIMILARITY_TOLERANCE = 0.05

/**
 * Price differences below 5% of the cheaper car are inside normal negotiating
 * range, they are not a reason to choose one car over another.
 */
export const MEANINGFUL_PRICE_DELTA = 0.05

/**
 * 15 000 km is roughly one South African year of average use (the AA and
 * insurers both use ~15 000-20 000 km/year as a standard annual mileage), so a
 * gap that size is about a year of life, not rounding.
 */
export const MEANINGFUL_MILEAGE_DELTA_KM = 15000

export type DeltaVerdict = {
  material: boolean
  /** Human sentence for the title attribute, e.g. "40 kW more than the Swift". */
  explanation: string
  /** Direction relative to the best value in the set: 'best' | 'worse' | 'equal'. */
  standing: 'best' | 'worse' | 'equal'
}

function relativeDelta(a: number, b: number): number {
  const base = Math.min(Math.abs(a), Math.abs(b))
  if (base === 0) return a === b ? 0 : 1
  return Math.abs(a - b) / base
}

/**
 * Compare one numeric spec across the whole set. Cars missing the value are
 * excluded from the comparison entirely, they do not count as zero, and they
 * do not make another car look better by default.
 */
export function numericDelta(params: {
  field: keyof CarSpec | 'price' | 'mileage'
  value: number | null
  allValues: (number | null)[]
  higherIsBetter: boolean
  format: (v: number) => string
}): DeltaVerdict {
  const { field, value, allValues, higherIsBetter, format } = params
  const present = allValues.filter((v): v is number => typeof v === 'number')

  if (value === null || present.length < 2) {
    return { material: false, explanation: '', standing: 'equal' }
  }

  const best = higherIsBetter ? Math.max(...present) : Math.min(...present)
  const worst = higherIsBetter ? Math.min(...present) : Math.max(...present)

  const threshold =
    field === 'price'
      ? MEANINGFUL_PRICE_DELTA
      : (MATERIAL_RELATIVE_DELTA[field as string] ?? MEANINGFUL_PRICE_DELTA)

  const spread =
    field === 'mileage'
      ? Math.abs(best - worst) >= MEANINGFUL_MILEAGE_DELTA_KM
      : relativeDelta(best, worst) >= threshold

  if (!spread) {
    return {
      material: false,
      explanation: 'Difference across these cars is too small to matter.',
      standing: 'equal',
    }
  }

  const isBest = value === best
  const gap = Math.abs(value - (isBest ? worst : best))
  const explanation = isBest
    ? `Best of the set, ${format(gap)} ${higherIsBetter ? 'more' : 'less'} than the weakest here.`
    : `${format(gap)} ${higherIsBetter ? 'less' : 'more'} than the best of the set.`

  return { material: true, explanation, standing: isBest ? 'best' : 'worse' }
}

/** Categorical difference: material whenever the set is not unanimous. */
export function categoricalDelta(value: string | null, allValues: (string | null)[]): DeltaVerdict {
  const present = allValues.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (value === null || present.length < 2) {
    return { material: false, explanation: '', standing: 'equal' }
  }
  const unanimous = present.every((v) => v === present[0])
  return unanimous
    ? { material: false, explanation: 'Same across these cars.', standing: 'equal' }
    : {
        material: true,
        explanation: `Differs across the set: ${Array.from(new Set(present)).join(' vs ')}.`,
        standing: 'equal',
      }
}

/* --------------------------------------------------------- diff matrix --- */

/** The attributes worth diffing, with the direction that counts as better. */
export type DiffField = {
  attrId: string
  kind: 'numeric' | 'categorical'
  higherIsBetter?: boolean
  /** True when neither direction is "better" (engine size, seat count). */
  neutral?: boolean
  format?: (v: number) => string
}

const zar = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(v)
const km = (v: number) => `${new Intl.NumberFormat('en-ZA').format(v)} km`

export const DIFF_FIELDS: DiffField[] = [
  { attrId: 'price', kind: 'numeric', higherIsBetter: false, format: zar },
  { attrId: 'year', kind: 'numeric', higherIsBetter: true, format: (v) => `${v} year${Math.abs(v) === 1 ? '' : 's'}` },
  { attrId: 'mileage', kind: 'numeric', higherIsBetter: false, format: km },
  { attrId: 'fuel', kind: 'categorical' },
  { attrId: 'transmission', kind: 'categorical' },
  { attrId: 'engine', kind: 'numeric', higherIsBetter: true, neutral: true, format: (v) => `${v} cc` },
  { attrId: 'power', kind: 'numeric', higherIsBetter: true, format: (v) => `${v} kW` },
  { attrId: 'torque', kind: 'numeric', higherIsBetter: true, format: (v) => `${v} Nm` },
  { attrId: 'drivetrain', kind: 'categorical' },
  { attrId: 'seats', kind: 'numeric', higherIsBetter: true, neutral: true, format: (v) => `${v} seat${Math.abs(v) === 1 ? '' : 's'}` },
  { attrId: 'boot', kind: 'numeric', higherIsBetter: true, format: (v) => `${v} ℓ` },
  { attrId: 'instalment', kind: 'numeric', higherIsBetter: false, format: (v) => `${zar(v)}/mo` },
  { attrId: 'runningCost', kind: 'numeric', higherIsBetter: false, format: (v) => `${zar(v)}/mo` },
]

export type DiffCar = {
  id: string
  values: Record<string, number | string | null>
}

/**
 * Per-attribute, per-car verdicts. Only fields in DIFF_FIELDS are diffed, and
 * only where at least two cars carry the value, a lone number is not a delta.
 */
export function buildDiffMatrix(cars: readonly DiffCar[]): Record<string, Record<string, DeltaVerdict>> {
  const matrix: Record<string, Record<string, DeltaVerdict>> = {}

  for (const field of DIFF_FIELDS) {
    const row: Record<string, DeltaVerdict> = {}
    const raw = cars.map((c) => c.values[field.attrId] ?? null)

    if (field.kind === 'categorical') {
      const all = raw.map((v) => (typeof v === 'string' ? v : null))
      cars.forEach((car, i) => {
        row[car.id] = categoricalDelta(all[i], all)
      })
    } else {
      const all = raw.map((v) => (typeof v === 'number' ? v : null))
      cars.forEach((car, i) => {
        const verdict = numericDelta({
          field: field.attrId as never,
          value: all[i],
          allValues: all,
          higherIsBetter: field.higherIsBetter ?? true,
          format: field.format ?? ((v) => String(v)),
        })
        row[car.id] = field.neutral ? { ...verdict, standing: 'equal' } : verdict
      })
    }

    matrix[field.attrId] = row
  }

  return matrix
}

/* --------------------------------------------------- "too similar" guard -- */

export type SimilarityWarning = {
  similar: boolean
  pairs: string[]
  message: string
}

/**
 * Two listings of the same brand, model and year, within 5% on both price and
 * mileage, are effectively the same purchase. Comparing them on this screen
 * tells the user nothing, the decision is about the dealer, the service history
 * and the location, so we say that instead of pretending the table helps.
 */
export function similarityGuard(vehicles: readonly Vehicle[]): SimilarityWarning {
  const pairs: string[] = []

  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i]
      const b = vehicles[j]
      const sameCar =
        a.make === b.make && a.model === b.model && a.year === b.year
      if (!sameCar) continue
      const priceClose = relativeDelta(a.price, b.price) <= SIMILARITY_TOLERANCE
      const mileageClose = relativeDelta(a.mileage, b.mileage) <= SIMILARITY_TOLERANCE
      if (priceClose && mileageClose) {
        pairs.push(`${a.year} ${a.make} ${a.model}`)
      }
    }
  }

  return {
    similar: pairs.length > 0,
    pairs,
    message: pairs.length
      ? 'These listings are very similar, check dealer reputation, service history, and location to decide.'
      : '',
  }
}

/* ------------------------------------------- running-cost parity conflict -- */

export type RunningCostConflict = {
  /** True when at least one car has a sourced figure and at least one does not. */
  mixed: boolean
  sourcedNames: string[]
  assumedNames: string[]
  message: string
}

/**
 * The dangerous case for a comparison table: one car's running cost is built
 * from a manufacturer figure and another's from a class assumption. The numbers
 * then look equally solid while resting on different ground. We say so.
 */
export function runningCostConflict(
  rows: readonly { name: string; basis: 'manufacturer' | 'assumption'; monthly: number }[],
): RunningCostConflict {
  const sourced = rows.filter((r) => r.basis === 'manufacturer')
  const assumed = rows.filter((r) => r.basis === 'assumption')
  const mixed = sourced.length > 0 && assumed.length > 0

  return {
    mixed,
    sourcedNames: sourced.map((r) => r.name),
    assumedNames: assumed.map((r) => r.name),
    message: mixed
      ? `Not like for like: consumption is a manufacturer figure for ${sourced
          .map((r) => r.name)
          .join(', ')}, but a class assumption for ${assumed
          .map((r) => r.name)
          .join(', ')}, consumption not listed for ${assumed
          .map((r) => r.name)
          .join(', ')}, so the estimate falls back to the editable class assumption (clearly marked).`
      : '',
  }
}
