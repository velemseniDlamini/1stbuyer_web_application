// F-15 Car Compare, vehicle specifications.
//
// This module mirrors the car_specs table (supabase/migrations/…_car_specs.sql)
// field for field, so reconnecting the backend is a data move rather than a
// rewrite.
//
// IMPORTANT, why this registry is empty.
//
// The catalogue in lib/data.ts is clearly-labelled sample data: illustrative
// prices and specs for a prototype. Engine displacement, power, torque, boot
// space and NCAP stars for real, named models are a different matter. Writing
// "81 kW" next to a real Volkswagen Polo without having read it off a source
// would be fabricating a fact about a real product, which is precisely what
// this product refuses to do to its users.
//
// So: no spec is recorded until it arrives with a source, a URL and a capture
// date. Every lookup below therefore returns nulls today, and the comparison
// screen renders "Not listed" and explains why. When a sourced dataset is
// ingested, manufacturer spec sheets, Global NCAP publications, it populates
// SPECS_BY_VEHICLE_ID and the interface fills in with no further code change.

export type Drivetrain = 'FWD' | 'RWD' | 'AWD' | '4x4'
export type NcapProgramme = 'Global NCAP' | 'Euro NCAP' | 'ANCAP'

export type CarSpec = {
  engineCc: number | null
  powerKw: number | null
  torqueNm: number | null
  drivetrain: Drivetrain | null
  seats: number | null
  bootLitres: number | null
  combinedLper100km: number | null
  ncapStars: number | null
  ncapProgramme: NcapProgramme | null
  ncapYear: number | null
  /** Provenance. A spec carrying any value must name all three. */
  source: string | null
  sourceUrl: string | null
  capturedAt: string | null
}

export const EMPTY_SPEC: CarSpec = {
  engineCc: null,
  powerKw: null,
  torqueNm: null,
  drivetrain: null,
  seats: null,
  bootLitres: null,
  combinedLper100km: null,
  ncapStars: null,
  ncapProgramme: null,
  ncapYear: null,
  source: null,
  sourceUrl: null,
  capturedAt: null,
}

/** Populated only from sourced data. Empty until an ingestion exists. */
export const SPECS_BY_VEHICLE_ID: Record<string, CarSpec> = {}

export function specFor(vehicleId: string): CarSpec {
  return SPECS_BY_VEHICLE_ID[vehicleId] ?? EMPTY_SPEC
}

/** True when a spec record carries at least one measured value. */
export function hasAnySpecValue(spec: CarSpec): boolean {
  return (
    spec.engineCc !== null ||
    spec.powerKw !== null ||
    spec.torqueNm !== null ||
    spec.drivetrain !== null ||
    spec.seats !== null ||
    spec.bootLitres !== null ||
    spec.combinedLper100km !== null ||
    spec.ncapStars !== null
  )
}

/**
 * The database enforces this with a check constraint; we enforce it here too so
 * a spec can never reach the interface with a value and no provenance.
 */
export function isCitable(spec: CarSpec): boolean {
  if (!hasAnySpecValue(spec)) return true // an empty spec needs no source
  return Boolean(spec.source && spec.sourceUrl && spec.capturedAt)
}

export const SPEC_SOURCES_NOTE =
  'Specifications are only shown when they come from a manufacturer spec sheet or a published NCAP result, captured with a date. None has been ingested for this catalogue yet, so every specification reads "Not listed" rather than showing a segment average.'
