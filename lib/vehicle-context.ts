// Vehicle context passed between screens.
//
// Built for Car Compare's "Compare insurance for this vehicle" action, and used
// by the Insurance screen for its own vehicle selection. One mechanism, two
// callers, which is what closes the old defect where the insurance screen
// priced a hard-coded Corolla Cross for every user regardless of what they were
// actually looking at.
//
// The context travels in the URL (?vehicle=<id>) rather than in memory, so it
// survives a refresh and a shared link, and it is validated against the
// catalogue on arrival: an unknown id falls back to the user's own saved cars
// rather than to a guess.

import type { Vehicle } from './data'

export const VEHICLE_PARAM = 'vehicle'

export function withVehicleContext(path: string, vehicleId: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${VEHICLE_PARAM}=${encodeURIComponent(vehicleId)}`
}

/** Resolve an incoming ?vehicle= param against the catalogue. */
export function resolveVehicleContext(
  param: string | null | undefined,
  catalogue: readonly Vehicle[],
): Vehicle | null {
  if (!param) return null
  return catalogue.find((v) => v.id === param) ?? null
}

/**
 * Which vehicle an insurance-style screen should price, in priority order:
 * an explicit context from the URL, then the user's saved cars, then the first
 * catalogue entry as a visible starting point the user can change.
 */
export function preferredVehicle(params: {
  contextId: string | null | undefined
  savedIds: readonly string[]
  catalogue: readonly Vehicle[]
}): { vehicle: Vehicle | null; basis: 'context' | 'saved' | 'catalogue' | 'none' } {
  const { contextId, savedIds, catalogue } = params
  if (catalogue.length === 0) return { vehicle: null, basis: 'none' }

  const fromContext = resolveVehicleContext(contextId, catalogue)
  if (fromContext) return { vehicle: fromContext, basis: 'context' }

  const firstSaved = catalogue.find((v) => savedIds.includes(v.id))
  if (firstSaved) return { vehicle: firstSaved, basis: 'saved' }

  return { vehicle: catalogue[0], basis: 'catalogue' }
}
