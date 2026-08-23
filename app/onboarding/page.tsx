'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore, type Profile } from '@/lib/store'
import { EMPLOYMENT_STATUSES, BUYING_GOALS } from '@/lib/data'
import { IncomeField, ProvinceAndCity } from '@/components/profile-fields'
import { yearsBetween } from '@/lib/format'
import { Field, inputClass, Notice } from '@/components/ui-kit'
import { PhoneShell } from '@/components/app-frame'

const EMPTY: Profile = {
  firstName: '',
  lastName: '',
  city: '',
  province: '',
  employment: '',
  monthlyIncome: 0,
  dob: '',
  licenceDate: '',
  goal: '',
}

export default function OnboardingPage() {
  const { ready, account, profile, saveProfile } = useStore()
  const router = useRouter()
  const [form, setForm] = useState<Profile>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace('/login')
    else if (profile) router.replace('/')
  }, [ready, account, profile, router])

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required.'
    if (!form.city) e.city = 'Select your city or town.'
    if (!form.province) e.province = 'Select your province.'
    if (!form.employment) e.employment = 'Select your employment status.'
    if (!form.monthlyIncome || form.monthlyIncome < 1000)
      e.monthlyIncome = 'Enter your net monthly income (at least R1 000).'
    if (!form.dob) e.dob = 'Required.'
    else {
      const age = yearsBetween(form.dob)
      if (age < 18) e.dob = 'You must be at least 18 to finance a vehicle.'
      if (age > 100) e.dob = 'Please check this date.'
    }
    if (!form.licenceDate) e.licenceDate = 'Required.'
    else if (new Date(form.licenceDate) > new Date()) e.licenceDate = 'Cannot be in the future.'
    else if (form.dob && new Date(form.licenceDate) < new Date(form.dob))
      e.licenceDate = 'A licence cannot pre-date your birth.'
    if (!form.goal) e.goal = 'Tell us what you are buying for.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // The profile is written to the database before we navigate. Navigating
  // first would bounce the user straight back here when the gate found no
  // profile, with no explanation of what went wrong.
  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError('')
    const result = await saveProfile(form)
    setSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? 'We could not save your profile. Try again.')
      return
    }
    router.replace('/')
  }

  return (
    <PhoneShell>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <header className="border-b border-border px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1 of 1</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-balance">
            Let&apos;s set up your buyer profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            We use this to personalise your interest-rate targets and instalment estimates, nothing
            more.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4 px-5 py-5" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="firstName" error={errors.firstName}>
              <input
                id="firstName"
                className={inputClass}
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <input
                id="lastName"
                className={inputClass}
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
          </div>

          <ProvinceAndCity
            province={form.province}
            city={form.city}
            onProvince={(v) => set('province', v)}
            onCity={(v) => set('city', v)}
            errors={{ province: errors.province, city: errors.city }}
          />

          <Field label="Employment status" htmlFor="employment" error={errors.employment}>
            <select
              id="employment"
              className={inputClass}
              value={form.employment}
              onChange={(e) => set('employment', e.target.value)}
            >
              <option value="">Select…</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <IncomeField
            value={form.monthlyIncome}
            onChange={(v) => set('monthlyIncome', v)}
            error={errors.monthlyIncome}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" htmlFor="dob" error={errors.dob}>
              <input
                id="dob"
                type="date"
                className={inputClass}
                value={form.dob}
                onChange={(e) => set('dob', e.target.value)}
              />
            </Field>
            <Field
              label="Licence issued"
              htmlFor="licence"
              error={errors.licenceDate}
              hint="Affects some estimates."
            >
              <input
                id="licence"
                type="date"
                className={inputClass}
                value={form.licenceDate}
                onChange={(e) => set('licenceDate', e.target.value)}
              />
            </Field>
          </div>

          <Field label="What are you buying for?" htmlFor="goal" error={errors.goal}>
            <select
              id="goal"
              className={inputClass}
              value={form.goal}
              onChange={(e) => set('goal', e.target.value)}
            >
              <option value="">Select…</option>
              {BUYING_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>

          <Notice tone="muted">
            Why we ask: income and credit band set your affordability and target rate; age and
            licence tenure affect insurance estimates. Your data stays on this device and is never
            sold.
          </Notice>

          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="min-h-11 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? 'Saving your profile…' : 'Enter 1st Buyer'}
          </button>
        </form>
      </div>
    </PhoneShell>
  )
}
