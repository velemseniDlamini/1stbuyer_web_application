'use client'

import { Lock } from 'lucide-react'
import { Field, inputClass } from '@/components/ui-kit'
import { CITIES_BY_PROVINCE, citiesFor, OTHER_CITY } from '@/lib/data'
import { formatDate, formatZAR } from '@/lib/format'

/**
 * Form controls shared by onboarding and the profile editor, so the two cannot
 * drift apart on what is editable, what is locked, or how income is captured.
 */

/**
 * A field that cannot be changed after the account is created.
 *
 * Rendered as text rather than a disabled input on purpose. A greyed-out input
 * still looks like something you are meant to be able to fix, and people fight
 * with it; a plain value with a lock and a reason reads as settled. The value
 * is also not in the form at all, so there is no disabled control for a
 * devtools user to re-enable and submit.
 */
export function LockedField({
  label,
  value,
  reason,
}: {
  label: string
  value: string
  reason: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
      </div>
      <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-2.5 text-sm">
        {value || 'Not recorded'}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground text-pretty">{reason}</p>
    </div>
  )
}

/** Why each locked field is locked. Written once, shown wherever it appears. */
export const LOCK_REASONS = {
  name: 'Your name is part of your identity check. Support can change it if it is wrong.',
  dob: 'Your date of birth sets your age for insurance pricing and the minimum age for finance, so it is fixed after sign-up.',
  licence: 'Your licence date sets how long you have been driving, which insurers price on. Support can correct it.',
} as const

export function LockedIdentityFields({
  firstName,
  lastName,
  dob,
  licenceDate,
}: {
  firstName: string
  lastName: string
  dob: string
  licenceDate: string
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fixed after sign-up
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <LockedField
          label="Full name"
          value={`${firstName} ${lastName}`.trim()}
          reason={LOCK_REASONS.name}
        />
        <LockedField
          label="Date of birth"
          value={dob ? formatDate(dob) : ''}
          reason={LOCK_REASONS.dob}
        />
        <LockedField
          label="Licence issued"
          value={licenceDate ? formatDate(licenceDate) : ''}
          reason={LOCK_REASONS.licence}
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-pretty">
        Something wrong here? Raise a support request and we will correct it, so there is a record
        of the change.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- city --- */

/**
 * Province and city as two linked selects.
 *
 * City depends on province, so changing province clears a city that no longer
 * belongs to it rather than leaving "Cape Town, Gauteng" on the record.
 */
export function ProvinceAndCity({
  province,
  city,
  onProvince,
  onCity,
  errors,
}: {
  province: string
  city: string
  onProvince: (value: string) => void
  onCity: (value: string) => void
  errors?: { province?: string; city?: string }
}) {
  const cities = citiesFor(province)

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Province" htmlFor="p-province" error={errors?.province}>
        <select
          id="p-province"
          className={inputClass}
          value={province}
          onChange={(e) => {
            onProvince(e.target.value)
            // A city from the old province would otherwise stay selected.
            onCity('')
          }}
        >
          <option value="">Select province</option>
          {Object.keys(CITIES_BY_PROVINCE).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="City / town"
        htmlFor="p-city"
        error={errors?.city}
        hint={city === OTHER_CITY ? 'We will use your province for local figures.' : undefined}
      >
        <select
          id="p-city"
          className={inputClass}
          value={city}
          disabled={!province}
          onChange={(e) => onCity(e.target.value)}
        >
          <option value="">{province ? 'Select city' : 'Choose a province first'}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

/* -------------------------------------------------------------- income --- */

/** Steps the income slider moves in. Fine at the bottom, coarser at the top. */
function stepFor(value: number): number {
  if (value < 20_000) return 500
  if (value < 50_000) return 1_000
  return 5_000
}

export const INCOME_MIN = 1_000
export const INCOME_MAX = 150_000

/**
 * Net monthly income, entered with a slider rather than a keyboard.
 *
 * Typing a rand amount on a phone is slow and error-prone, and one stray zero
 * turns every affordability figure in the app into nonsense. A slider cannot
 * produce R450000 by accident, and it shows the number it is producing.
 *
 * The number input is kept alongside for anyone who knows their exact figure,
 * because a slider alone cannot hit R18 450.
 */
export function IncomeField({
  value,
  onChange,
  error,
}: {
  value: number
  onChange: (value: number) => void
  error?: string
}) {
  const safe = Number.isFinite(value) && value > 0 ? value : 0

  return (
    <Field
      label="Net monthly income"
      htmlFor="p-income"
      error={error}
      hint="What actually lands in your account each month, after tax and deductions."
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl font-semibold tabular-nums">
            {safe ? formatZAR(safe) : 'Not set'}
          </span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              R
            </span>
            <input
              id="p-income-exact"
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Net monthly income, exact amount"
              value={safe || ''}
              onChange={(e) => onChange(Number(e.target.value))}
              className="h-9 w-28 rounded-lg border border-input bg-background pl-6 pr-2 text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <input
          id="p-income"
          type="range"
          min={INCOME_MIN}
          max={INCOME_MAX}
          step={stepFor(safe)}
          value={Math.min(Math.max(safe || INCOME_MIN, INCOME_MIN), INCOME_MAX)}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={formatZAR(safe)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{formatZAR(INCOME_MIN)}</span>
          <span>{formatZAR(INCOME_MAX)}+</span>
        </div>
      </div>
    </Field>
  )
}
