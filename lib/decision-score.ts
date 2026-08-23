// F-15, the weighted decision helper.
//
// A tool, not an oracle. Two rules make it honest:
//
//  1. A criterion with no real data for a car is EXCLUDED from that car's
//     score, not scored zero. Scoring a missing reliability figure as zero
//     would silently punish a car for our data gap.
//  2. The score is renormalised over the criteria that actually applied, and
//     the UI states which ones were excluded, per car.
//
// Scores are relative to the compared set only. A 100 means "best of these
// three on this criterion", never "good car".

export type CriterionId =
  | 'affordability'
  | 'runningCost'
  | 'reliability'
  | 'dealerDistance'
  | 'specPreference'

export type Criterion = {
  id: CriterionId
  label: string
  hint: string
  /** Lower raw value is better (cost, distance) vs higher is better (specs). */
  lowerIsBetter: boolean
}

export const CRITERIA: Criterion[] = [
  {
    id: 'affordability',
    label: 'Upfront affordability',
    hint: 'Asking price, and the instalment against your income',
    lowerIsBetter: true,
  },
  {
    id: 'runningCost',
    label: 'Monthly running cost',
    hint: 'Fuel plus indicative insurance',
    lowerIsBetter: true,
  },
  {
    id: 'reliability',
    label: 'Reliability reputation',
    hint: 'Requires a sourced ownership survey figure',
    lowerIsBetter: false,
  },
  {
    id: 'dealerDistance',
    label: 'Dealer proximity',
    hint: 'Requires your location and the branch location',
    lowerIsBetter: true,
  },
  {
    id: 'specPreference',
    label: 'Specification',
    hint: 'Requires sourced engine and body specifications',
    lowerIsBetter: false,
  },
]

export const DEFAULT_WEIGHTS: Record<CriterionId, number> = {
  affordability: 3,
  runningCost: 3,
  reliability: 2,
  dealerDistance: 1,
  specPreference: 1,
}

/** One car's raw inputs. `null` means "we have no real value", not zero. */
export type ScoreInputs = Record<CriterionId, number | null>

export type ScoredCriterion = {
  id: CriterionId
  label: string
  included: boolean
  /** 0-100 within the set; null when excluded. */
  points: number | null
  weight: number
}

export type DecisionScore = {
  vehicleId: string
  /** 0-100, renormalised over the included criteria. Null when nothing applied. */
  total: number | null
  criteria: ScoredCriterion[]
  excludedLabels: string[]
  /** Sentence the UI must render verbatim when something was excluded. */
  disclosure: string
}

/** "a", "a and b", "a, b and c", reads as a sentence, not a machine list. */
export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Normalise one criterion across the set: best = 100, worst = 0. */
function normalise(
  values: (number | null)[],
  lowerIsBetter: boolean,
): (number | null)[] {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (present.length === 0) return values.map(() => null)

  const min = Math.min(...present)
  const max = Math.max(...present)

  return values.map((v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    // Every present car ties when there is no spread, a flat criterion must
    // not tip the decision either way.
    if (max === min) return 50
    const ratio = (v - min) / (max - min)
    return Math.round((lowerIsBetter ? 1 - ratio : ratio) * 100)
  })
}

export function scoreVehicles(
  entries: readonly { vehicleId: string; inputs: ScoreInputs }[],
  weights: Record<CriterionId, number> = DEFAULT_WEIGHTS,
): DecisionScore[] {
  const normalisedByCriterion = new Map<CriterionId, (number | null)[]>()

  for (const criterion of CRITERIA) {
    normalisedByCriterion.set(
      criterion.id,
      normalise(
        entries.map((e) => e.inputs[criterion.id]),
        criterion.lowerIsBetter,
      ),
    )
  }

  return entries.map((entry, index) => {
    const criteria: ScoredCriterion[] = CRITERIA.map((criterion) => {
      const points = normalisedByCriterion.get(criterion.id)![index]
      const weight = Math.max(0, weights[criterion.id] ?? 0)
      return {
        id: criterion.id,
        label: criterion.label,
        included: points !== null && weight > 0,
        points,
        weight,
      }
    })

    const applied = criteria.filter((c) => c.included)
    const weightSum = applied.reduce((sum, c) => sum + c.weight, 0)
    const total =
      weightSum > 0
        ? Math.round(
            applied.reduce((sum, c) => sum + (c.points as number) * c.weight, 0) / weightSum,
          )
        : null

    // Excluded because we hold no data, distinct from excluded because the
    // user set the weight to zero, which is their choice, not our gap.
    const excludedLabels = criteria
      .filter((c) => c.points === null && c.weight > 0)
      .map((c) => c.label)

    return {
      vehicleId: entry.vehicleId,
      total,
      criteria,
      excludedLabels,
      disclosure: excludedLabels.length
        ? `Score excludes ${listJoin(excludedLabels).toLowerCase()}, data not yet available.`
        : '',
    }
  })
}

export const DECISION_HELPER_NOTE =
  'This ranks these cars against each other on the criteria you weight, using only fields we hold real data for. It is a way to see your own priorities clearly, not a verdict, and not advice.'
