'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Field, inputClass, Notice, Pill, SectionTitle } from '@/components/ui-kit'
import { useStore, type Profile } from '@/lib/store'
import { StaffGate } from '@/components/staff/staff-gate'
import { EMPLOYMENT_STATUSES, BUYING_GOALS } from '@/lib/data'
import {
  IncomeField,
  LockedIdentityFields,
  ProvinceAndCity,
} from '@/components/profile-fields'
import { bandForScore, targetRateForScore } from '@/lib/finance'
import { formatDate } from '@/lib/format'
import {
  ChevronDown,
  Download,
  FileText,
  Gauge,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { AffordabilityAdvice } from '@/components/affordability-advice'
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
    exportData,
    systemSettings,
  } = store
  const router = useRouter()
  const [editing, setEditing] = useState(false)

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

        {/* The point of this screen is advice, not a read-out of what the user
            already told us. The four tiles that used to sit here restated
            income, licence years and a buying goal; this answers what those
            figures mean for what they can afford. */}
        <div>
          <SectionTitle>What this means for you</SectionTitle>
          <AffordabilityAdvice monthlyIncome={profile.monthlyIncome} score={currentScore} />
        </div>

        {/* Credit score stays as a tile: it is the one figure that gates the
            rest of the app, so it needs a visible route to the screen that
            records it. */}
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
            {/* Account deletion was removed from the product. The button and its
                confirmation flow are gone, and store.deleteAccount no longer
                exists, so there is no code path left that wipes an account
                from the interface. A buyer who genuinely wants their data
                removed raises a ticket and a human does it, which also leaves
                an audit trail. */}
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Closing your account</p>
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                  Accounts are closed by our support team rather than from this screen, so your
                  credit history and finance pack cannot be erased by a mistap.{' '}
                  <Link href="/support" className="font-semibold underline">
                    Raise a request
                  </Link>{' '}
                  and we will confirm once it is done.
                </p>
              </div>
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
          <Link href="/chat" className="font-semibold underline">
            Ask Chatbot about your rights
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

  // Only the editable fields are validated. Name, date of birth and licence
  // date are locked, so a rule about them could only ever block a save the
  // user has no way to fix.
  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.province) e.province = 'Select your province.'
    if (!form.city) e.city = 'Select your city or town.'
    if (!form.monthlyIncome || form.monthlyIncome < 1000)
      e.monthlyIncome = 'Enter your net monthly income (at least R1 000).'
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
      <LockedIdentityFields
        firstName={form.firstName}
        lastName={form.lastName}
        dob={form.dob}
        licenceDate={form.licenceDate}
      />

      <ProvinceAndCity
        province={form.province}
        city={form.city}
        onProvince={(v) => set('province', v)}
        onCity={(v) => set('city', v)}
        errors={{ province: errors.province, city: errors.city }}
      />

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

      <IncomeField
        value={form.monthlyIncome}
        onChange={(v) => set('monthlyIncome', v)}
        error={errors.monthlyIncome}
      />

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
