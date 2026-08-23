// Finite option lists for fields that were free text or a bare number input.
//
// THE PRINCIPLE
//
// If the app already knows the set of sensible answers, the user should not be
// typing one. Typing is slow on a phone, it produces "Jhb" and "joburg" and
// "Johannesburg " as three different values, and one stray zero in a rand
// figure quietly poisons every estimate downstream.
//
// WHERE TYPING IS STILL RIGHT
//
// Not everything becomes a dropdown. The quotation analyser transcribes a
// printed dealer quote, and a real quote says R1 207.50, not "about R1 200".
// Those fields stay numeric on purpose: a picker that cannot express the number
// on the paper in front of you is worse than a keyboard. The rule applied here
// is "offer the choice where the set is genuinely finite", not "remove every
// keyboard".

/** Standard South African vehicle finance terms. */
export const TERM_OPTIONS = [12, 24, 36, 48, 54, 60, 66, 72, 84] as const

export function termLabel(months: number): string {
  const years = months / 12
  const yearPart = Number.isInteger(years)
    ? `${years} year${years === 1 ? '' : 's'}`
    : `${years.toFixed(1)} years`
  return `${months} months (${yearPart})`
}

/**
 * Monthly distance bands.
 *
 * Nobody knows their monthly kilometres to the nearest 50. They know roughly
 * how far they drive, so the options are described in those terms and the
 * value behind each one is the midpoint the running-cost model uses.
 */
export const DISTANCE_OPTIONS = [
  { value: 500, label: '500 km, mostly short trips' },
  { value: 1000, label: '1 000 km, light use' },
  { value: 1200, label: '1 200 km, average' },
  { value: 1500, label: '1 500 km, daily commute' },
  { value: 2000, label: '2 000 km, long commute' },
  { value: 3000, label: '3 000 km, heavy use' },
  { value: 4000, label: '4 000 km, very heavy use' },
] as const

/**
 * Pump prices offered as a choice.
 *
 * Built around the app's own sourced figure so the default is always in the
 * list, and spaced at 50c because that is roughly how South African fuel
 * prices actually move.
 */
export function fuelPriceOptions(sourced: number): number[] {
  const options = new Set<number>()
  for (let p = sourced - 4; p <= sourced + 4; p += 0.5) {
    if (p >= 1) options.add(Number(p.toFixed(2)))
  }
  options.add(sourced)
  return [...options].sort((a, b) => a - b)
}

/** The escape hatch on any list that cannot be exhaustive. */
export const OTHER_OPTION = '__other__'
