'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Field, inputClass, Notice, Pill, SectionTitle } from '@/components/ui-kit'
import { useStore, type Profile } from '@/lib/store'
import { StaffGate } from '@/components/staff/staff-gate'
import { PROVINCES, EMPLOYMENT_STATUSES, BUYING_GOALS } from '@/lib/data'
import { bandForScore, targetRateForScore } from '@/lib/finance'
import { formatDate, formatZAR, yearsBetween } from '@/lib/format'
import {
  ChevronDown,
  Download,
  FileText,
  Gauge,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProfileScreen() {
  const store = useStore()
  const {
    account,
    profile,
    currentScore,
    theme,
    setTheme,
    signOut,
    deleteAccount,
    exportData,
    systemSettings,
  } = store
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!profile || !account) return null

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()
  const band = currentScore != null ? bandForScore(currentScore) : null

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '1st-buyer-data.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function onSignOut() {
    signOut()
    router.replace('/login')
  }

  function onDelete() {
    deleteAccount()
    router.replace('/login')
  }

  return (
    <div className="pb-8">
      <ScreenHeader title="Profile" subtitle="Your account, your data, your settings" />

      <div className="space-y-5 px-4">
        {/* Identity */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
              {initials || 'B'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{account.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                With 1st Buyer since {formatDate(account.since)}
              </p>
            </div>
          </div>
        </Card>

        {/* Buyer profile tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Tile
            icon={Gauge}
            label="Credit score"
            value={currentScore != null ? String(currentScore) : 'Not recorded'}
            hint={
              band
                ? `${band.label} · target ~${targetRateForScore(currentScore!).toFixed(2)}%`
                : 'Record it to unlock your rate'
            }
            href="/credit"
          />
          <Tile
            icon={Wallet}
            label="Monthly income"
            value={formatZAR(profile.monthlyIncome)}
            hint={profile.employment}
          />
          <Tile
            icon={ShieldCheck}
            label="Licence held"
            value={`${yearsBetween(profile.licenceDate)} yr`}
            hint={`Age ${yearsBetween(profile.dob)}`}
          />
          <Tile
            icon={FileText}
            label="Buying goal"
            value={profile.goal || 'Not set'}
            hint={`${profile.city}${profile.province ? `, ${profile.province}` : ''}`}
          />
        </div>

        {/* Personal details */}
        <Card className="overflow-hidden">
          <button
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Personal details</span>
              <span className="text-xs text-muted-foreground">
                Update anything that changes, every estimate follows it
              </span>
            </span>
            <ChevronDown
              className={cn('h-5 w-5 shrink-0 text-muted-foreground transition', editing && 'rotate-180')}
              aria-hidden
            />
          </button>
          {editing && <ProfileForm onDone={() => setEditing(false)} />}
        </Card>

        {/* Preferences */}
        <div>
          <SectionTitle>Appearance</SectionTitle>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4" aria-hidden />
                  ) : (
                    <Sun className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold">Dark theme</p>
                  <p className="text-xs text-muted-foreground">Saved on this device.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                aria-label="Dark theme"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn(
                  'relative h-7 w-12 shrink-0 rounded-full border transition',
                  theme === 'dark' ? 'border-primary bg-primary' : 'border-border bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all',
                    theme === 'dark' ? 'left-6' : 'left-0.5',
                  )}
                  aria-hidden
                />
              </button>
            </div>
          </Card>
        </div>

        {/* Your data */}
        <div>
          <SectionTitle>Your data</SectionTitle>
          <Card className="divide-y divide-border">
            <button
              onClick={download}
              className="flex min-h-11 w-full items-center gap-3 p-4 text-left transition hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                <Download className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Export everything</span>
                <span className="text-xs text-muted-foreground">
                  Profile, credit history, scenarios, quotations and documents as JSON
                </span>
              </span>
            </button>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {store.authMode === 'supabase' ? 'Clear this device and sign out' : 'Delete my account and data'}
                  </p>
                  <p className="text-xs text-muted-foreground text-pretty">
                    {store.authMode === 'supabase'
                      ? 'Erases everything held in this browser and signs you out. Your account row in our database is not removed by this button: deleting an auth user needs an administrator, so email us and we will do it and confirm.'
                      : 'Removes everything from this device immediately. It cannot be undone.'}
                  </p>
                </div>
              </div>
              {confirmDelete ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={onDelete}
                    className="min-h-11 flex-1 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
                  >
                    Yes, delete everything
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
                  >
                    Keep my data
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-destructive/40 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                >
                  Delete account
                </button>
              )}
            </div>
          </Card>
        </div>

        <Notice tone="muted">
          {store.authMode === 'supabase' ? (
            <>
              <strong className="font-semibold">Where your data lives.</strong> Your account and the
              profile details above are stored in our database, and row level security means only
              you can read them. Everything else you record here, your credit history, documents,
              comparisons and tickets, is still held only in this browser and is not synced yet.
              Nothing is sold or shared, and 1st Buyer takes no commission from any dealer, bank or
              insurer.{' '}
            </>
          ) : (
            <>
              Everything you record stays in this browser on this device. Nothing is uploaded, sold
              or shared, and 1st Buyer takes no commission from any dealer, bank or insurer.{' '}
            </>
          )}
          <Link href="/rights" className="font-semibold underline">
            Know your rights
          </Link>
          .
        </Notice>

        <button
          onClick={onSignOut}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold transition hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>

        <p className="pt-1 text-center text-xs text-muted-foreground">
          1st Buyer · v1.0 · Not affiliated with any dealership, bank or insurer.
        </p>

        {/* The second staff entrance. The trigger used to live only on the
            login screen, which meant a signed-in buyer had no route to the
            portal at all without signing out first. Same component, same
            three-click trigger, same fine-print styling: this adds a way in,
            not a second way to authenticate. */}
        <StaffGate triggerText={systemSettings.triggerText} />
      </div>
    </div>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Gauge
  label: string
  value: string
  hint?: string
  href?: string
}) {
  const body = (
    <Card className="h-full p-4 transition hover:border-primary/40">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p>}
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const { profile, updateProfile } = useStore()
  const [form, setForm] = useState<Profile>(profile!)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required.'
    if (!form.city.trim()) e.city = 'Required.'
    if (!form.monthlyIncome || form.monthlyIncome < 1000)
      e.monthlyIncome = 'Enter your gross monthly income (at least R1 000).'
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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError('')
    const result = await updateProfile(form)
    setSaving(false)
    if (!result.ok) {
      // A failed write must not look like a successful one.
      setSaveError(result.error ?? 'We could not save your changes. Try again.')
      return
    }
    setSaved(true)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border p-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="p-first" error={errors.firstName}>
          <input
            id="p-first"
            className={inputClass}
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
        </Field>
        <Field label="Last name" htmlFor="p-last">
          <input
            id="p-last"
            className={inputClass}
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </Field>
        <Field label="City / town" htmlFor="p-city" error={errors.city}>
          <input
            id="p-city"
            className={inputClass}
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </Field>
        <Field label="Province" htmlFor="p-province">
          <select
            id="p-province"
            className={inputClass}
            value={form.province}
            onChange={(e) => set('province', e.target.value)}
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Employment status" htmlFor="p-employment">
        <select
          id="p-employment"
          className={inputClass}
          value={form.employment}
          onChange={(e) => set('employment', e.target.value)}
        >
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Gross monthly income"
        htmlFor="p-income"
        error={errors.monthlyIncome}
        hint="Before deductions. Drives affordability and buying power."
      >
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R
          </span>
          <input
            id="p-income"
            type="number"
            inputMode="numeric"
            min={0}
            className={`${inputClass} pl-7`}
            value={form.monthlyIncome || ''}
            onChange={(e) => set('monthlyIncome', Number(e.target.value))}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth" htmlFor="p-dob" error={errors.dob}>
          <input
            id="p-dob"
            type="date"
            className={inputClass}
            value={form.dob}
            onChange={(e) => set('dob', e.target.value)}
          />
        </Field>
        <Field label="Licence issued" htmlFor="p-licence" error={errors.licenceDate}>
          <input
            id="p-licence"
            type="date"
            className={inputClass}
            value={form.licenceDate}
            onChange={(e) => set('licenceDate', e.target.value)}
          />
        </Field>
      </div>

      <Field label="What are you buying for?" htmlFor="p-goal">
        <select
          id="p-goal"
          className={inputClass}
          value={form.goal}
          onChange={(e) => set('goal', e.target.value)}
        >
          {BUYING_GOALS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>

      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <Pill tone="success">Saved</Pill>}
      </div>
    </form>
  )
}
