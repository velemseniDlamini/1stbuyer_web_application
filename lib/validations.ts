// Runtime validation schemas.
//
// One schema per persisted shape, mirroring the Supabase migrations. They are
// used at the two real trust boundaries in this build, localStorage hydration
// and URL parameters, and they are the contract the backend must satisfy when
// it is reconnected.
//
// The provenance rule from the car_specs migration is expressed here too: a
// spec carrying any value must name its source. Validation and schema agree.

import { z } from 'zod'

/* ------------------------------------------------------------ car_specs -- */

export const drivetrainSchema = z.enum(['FWD', 'RWD', 'AWD', '4x4'])
export const ncapProgrammeSchema = z.enum(['Global NCAP', 'Euro NCAP', 'ANCAP'])

export const carSpecSchema = z
  .object({
    engineCc: z.number().int().min(400).max(8000).nullable(),
    powerKw: z.number().min(10).max(1500).nullable(),
    torqueNm: z.number().min(20).max(2000).nullable(),
    drivetrain: drivetrainSchema.nullable(),
    seats: z.number().int().min(1).max(23).nullable(),
    bootLitres: z.number().int().min(0).max(5000).nullable(),
    combinedLper100km: z.number().min(1).max(40).nullable(),
    ncapStars: z.number().int().min(0).max(5).nullable(),
    ncapProgramme: ncapProgrammeSchema.nullable(),
    ncapYear: z.number().int().min(1997).max(2100).nullable(),
    source: z.string().min(1).nullable(),
    sourceUrl: z.string().url().nullable(),
    capturedAt: z.string().min(4).nullable(),
  })
  .refine(
    (spec) => {
      const hasValue =
        spec.engineCc !== null ||
        spec.powerKw !== null ||
        spec.torqueNm !== null ||
        spec.drivetrain !== null ||
        spec.seats !== null ||
        spec.bootLitres !== null ||
        spec.combinedLper100km !== null ||
        spec.ncapStars !== null
      if (!hasValue) return true
      return Boolean(spec.source && spec.sourceUrl && spec.capturedAt)
    },
    {
      message:
        'A specification carrying any value must cite source, sourceUrl and capturedAt (mirrors car_specs_requires_source).',
    },
  )

export type CarSpecInput = z.infer<typeof carSpecSchema>

/* --------------------------------------------------- saved_comparisons -- */

export const MIN_COMPARISON_CARS = 2
export const MAX_COMPARISON_CARS = 3

export const savedComparisonSchema = z.object({
  id: z.string().min(1),
  carIds: z
    .array(z.string().min(1))
    .min(MIN_COMPARISON_CARS)
    .max(MAX_COMPARISON_CARS)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'A comparison cannot contain the same car twice.',
    }),
  name: z.string().min(1).max(80),
  createdAt: z.string().min(4),
  updatedAt: z.string().min(4).optional(),
})

export type SavedComparisonInput = z.infer<typeof savedComparisonSchema>

/* --------------------------------------------------- comparison_shares -- */

export const comparisonShareSchema = z.object({
  token: z.string().min(16).max(64),
  carIds: z.array(z.string().min(1)).min(MIN_COMPARISON_CARS).max(MAX_COMPARISON_CARS),
  createdAt: z.string().min(4),
  expiresAt: z.string().min(4),
})

export type ComparisonShareInput = z.infer<typeof comparisonShareSchema>

/* --------------------------------------------------- price_snapshots ---- */

export const priceSnapshotSchema = z.object({
  at: z.string().min(4),
  price: z.number().int().positive(),
})

/* ------------------------------------------------------- preferences ---- */

export const criterionIdSchema = z.enum([
  'affordability',
  'runningCost',
  'reliability',
  'dealerDistance',
  'specPreference',
])

export const preferencesSchema = z.object({
  dismissedSuggestionIds: z.array(z.string()).default([]),
  // Partial by design: an unset criterion falls back to its default weight.
  decisionWeights: z.partialRecord(criterionIdSchema, z.number().min(0).max(5)).default({}),
  glanceBarDismissed: z.boolean().default(false),
})

export type PreferencesInput = z.infer<typeof preferencesSchema>

/* ------------------------------------------------------------- helpers -- */

/** Parse or return null, callers at trust boundaries must not throw on bad data. */
export function safeParse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, value: unknown): T | null {
  const result = schema.safeParse(value)
  return result.success ? (result.data as T) : null
}
