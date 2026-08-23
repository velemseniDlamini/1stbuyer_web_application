'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Field, inputClass, Notice, Pill, SectionTitle, EmptyState } from '@/components/ui-kit'
import { useStore, type DocItem, type Quotation } from '@/lib/store'
import { ACCEPT_ATTR, assessCurrency, packProgress, validateUpload } from '@/lib/documents'
import { analyseQuotation, buildNegotiationPack, BENCHMARKS_UPDATED } from '@/lib/quotation'
import { PRIME_RATE, targetRateForScore } from '@/lib/finance'
import { formatDate } from '@/lib/format'
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  Paperclip,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'pack' | 'analysis'

export function DocumentsScreen() {
  const [tab, setTab] = useState<Tab>('pack')

  return (
    <div className="pb-8">
      <ScreenHeader title="Documents" subtitle="Your finance pack and your quotation analysis" back />

      <div className="px-4">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" role="tablist">
          <TabButton active={tab === 'pack'} onClick={() => setTab('pack')} controls="panel-pack">
            Finance pack
          </TabButton>
          <TabButton
            active={tab === 'analysis'}
            onClick={() => setTab('analysis')}
            controls="panel-analysis"
          >
            Analyse a quote
          </TabButton>
        </div>

        {tab === 'pack' ? (
          <div id="panel-pack" role="tabpanel">
            <PackTab />
          </div>
        ) : (
          <div id="panel-analysis" role="tabpanel">
            <AnalysisTab />
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ pack -- */

function PackTab() {
  const { documents, authMode, syncError } = useStore()
  const progress = packProgress(documents)

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Finance pack</p>
            <p className="text-xs text-muted-foreground">
              {progress.added} of {progress.total} items recorded
            </p>
          </div>
          <span className="font-display text-2xl font-semibold text-primary">{progress.pct}%</span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.pct}%` }}
            role="progressbar"
            aria-valuenow={progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Finance pack completeness"
          />
        </div>
      </Card>

      {syncError && (
        <Notice tone="destructive">
          <strong className="font-semibold">Your pack did not load.</strong> {syncError}
        </Notice>
      )}

      <Notice tone="warning">
        <strong className="font-semibold">Read this before you attach anything.</strong> 1st Buyer
        records the file name and the date you give it{' '}
        {authMode === 'supabase' ? 'against your account' : 'on this device only'}. The file itself
        is not uploaded, not read and not verified by anyone. This is a checklist that keeps your
        pack straight, not a document store.
      </Notice>

      <div className="space-y-3">
        {documents.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </div>

      <Card className="p-4">
        <SectionTitle>Why the dates matter</SectionTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Lenders reject a proof of residence or bank statement older than three months, and a
          payslip that is not the latest one. Recording the date on each document lets us warn you
          before the dealer does. Finance applications are FICA-regulated, so an incomplete pack is
          the most common reason an approval stalls.
        </p>
      </Card>
    </div>
  )
}

function DocumentRow({ doc }: { doc: DocItem }) {
  const { setDocument } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const currency = assessCurrency(doc)
  const added = doc.status === 'added'

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    // No selection is a no-op; only the first file of a multi-select is used.
    if (!file) return
    const problem = validateUpload(file)
    if (problem) {
      setError(problem)
      e.target.value = ''
      return
    }
    e.target.value = ''
    setBusy(true)
    const result = await setDocument(doc.id, file.name)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'We could not record that document.')
  }

  // A failed write is reported here rather than left to look like it worked.
  async function write(fileName: string | null, docDate?: string) {
    setError('')
    setBusy(true)
    const result = await setDocument(doc.id, fileName, docDate)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'We could not update that document.')
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-pretty">{doc.category}</p>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{doc.hint}</p>
        </div>
        <StatusBadge added={added} state={currency.state} />
      </div>

      {added && (
        <div className="mt-3 space-y-3 rounded-xl bg-secondary/50 p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate font-medium text-foreground">{doc.fileName}</span>
          </p>
          {doc.addedAt && (
            <p className="text-xs text-muted-foreground">Recorded {formatDate(doc.addedAt)}</p>
          )}
          {doc.maxAgeMonths ? (
            <Field
              label="Date on the document"
              htmlFor={`date-${doc.id}`}
              hint={
                currency.state === 'unknown'
                  ? `Needed to check the ${doc.maxAgeMonths}-month currency rule.`
                  : currency.label
              }
            >
              <input
                id={`date-${doc.id}`}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={doc.docDate ?? ''}
                onChange={(e) => void write(doc.fileName, e.target.value)}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={onFile}
        className="sr-only"
        aria-label={`Attach ${doc.category}`}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition',
            added
              ? 'border border-border bg-card hover:border-primary/40'
              : 'bg-primary text-primary-foreground hover:opacity-90',
          )}
        >
          {added ? (
            <RotateCcw className="h-4 w-4" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
          {added ? 'Replace' : 'Add document'}
        </button>
        {added && (
          <button
            type="button"
            onClick={() => void write(null)}
            disabled={busy}
            aria-label={`Remove ${doc.category}`}
            className="flex min-h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </Card>
  )
}

function StatusBadge({
  added,
  state,
}: {
  added: boolean
  state: ReturnType<typeof assessCurrency>['state']
}) {
  if (!added) return <Pill tone="muted">Not added</Pill>
  if (state === 'expired')
    return (
      <Pill tone="destructive">
        <X className="h-3 w-3" aria-hidden /> Out of date
      </Pill>
    )
  if (state === 'expiring')
    return (
      <Pill tone="warning">
        <Clock className="h-3 w-3" aria-hidden /> Expiring
      </Pill>
    )
  if (state === 'unknown')
    return (
      <Pill tone="warning">
        <AlertTriangle className="h-3 w-3" aria-hidden /> Date needed
      </Pill>
    )
  return (
    <Pill tone="success">
      <Check className="h-3 w-3" aria-hidden /> Recorded
    </Pill>
  )
}

/* -------------------------------------------------------------- analysis -- */

type QuoteForm = {
  vehicle: string
  price: string
  depositPct: string
  termMonths: string
  interestRate: string
  initiationFee: string
  adminFeeMonthly: string
  creditLifeMonthly: string
  trackingMonthly: string
  balloonPct: string
}

const EMPTY_FORM: QuoteForm = {
  vehicle: '',
  price: '',
  depositPct: '10',
  termMonths: '72',
  interestRate: '',
  initiationFee: '1207.50',
  adminFeeMonthly: '69',
  creditLifeMonthly: '',
  trackingMonthly: '0',
  balloonPct: '0',
}

function AnalysisTab() {
  const { currentScore, quotations, addQuotation } = useStore()
  const [form, setForm] = useState<QuoteForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
  const [result, setResult] = useState<Quotation | null>(null)

  const targetRate = currentScore ? targetRateForScore(currentScore) : null

  function set<K extends keyof QuoteForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function num(v: string) {
    const n = Number(v)
    return isFinite(n) ? n : 0
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.vehicle.trim()) e.vehicle = 'Name the vehicle so the pack is usable at the desk.'
    if (num(form.price) <= 0) e.price = 'Enter the price on the quotation.'
    if (num(form.interestRate) <= 0) e.interestRate = 'Enter the quoted interest rate.'
    if (num(form.depositPct) < 0 || num(form.depositPct) > 100) e.depositPct = 'Between 0 and 100.'
    if (num(form.balloonPct) < 0 || num(form.balloonPct) > 100) e.balloonPct = 'Between 0 and 100.'
    if (num(form.termMonths) < 12 || num(form.termMonths) > 96)
      e.termMonths = 'Between 12 and 96 months.'
    const feeKeys = ['initiationFee', 'adminFeeMonthly', 'creditLifeMonthly', 'trackingMonthly'] as const
    for (const k of feeKeys) {
      if (num(form[k]) < 0) e[k] = 'Cannot be negative.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function analyse(ev: React.FormEvent) {
    ev.preventDefault()
    setSaveError('')
    if (!validate()) return

    const price = num(form.price)
    const financedAmount = Math.max(0, price - (num(form.depositPct) / 100) * price)
    const { findings, score } = analyseQuotation({
      vehicle: form.vehicle.trim(),
      price,
      interestRate: num(form.interestRate),
      initiationFee: num(form.initiationFee),
      adminFeeMonthly: num(form.adminFeeMonthly),
      creditLifeMonthly: num(form.creditLifeMonthly),
      trackingMonthly: num(form.trackingMonthly),
      balloonPct: num(form.balloonPct),
      financedAmount,
      targetRate,
    })

    const quotation: Quotation = {
      id: crypto.randomUUID(),
      vehicle: form.vehicle.trim(),
      createdAt: new Date().toISOString(),
      findings,
      score,
    }

    setResult(quotation)
    try {
      addQuotation(quotation)
    } catch {
      // The analysis is never lost silently if it cannot be kept.
      setSaveError(
        'This analysis could not be saved to your device, but it is shown below. Download the pack to keep it.',
      )
    }
  }

  if (result) {
    return (
      <QuotationResult
        quotation={result}
        onReset={() => {
          setResult(null)
          setSaveError('')
        }}
        saveError={saveError}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Notice tone="primary">
        Copy the numbers off the dealer&apos;s quotation. Every line is checked against the NCA caps
        and market benchmarks last reviewed on {formatDate(BENCHMARKS_UPDATED)}. You get a written
        list of what to challenge.
      </Notice>

      {!currentScore && (
        <Notice tone="warning">
          You have not recorded a credit score, so your entitled rate is assumed to be Prime + 2.5%
          ({(PRIME_RATE + 2.5).toFixed(2)}%).{' '}
          <Link href="/credit" className="font-semibold underline">
            Record your score
          </Link>{' '}
          for a sharper benchmark.
        </Notice>
      )}

      <Card className="p-4">
        <form onSubmit={analyse} className="space-y-4" noValidate>
          <Field label="Vehicle" htmlFor="q-vehicle" error={errors.vehicle}>
            <input
              id="q-vehicle"
              className={inputClass}
              value={form.vehicle}
              onChange={(e) => set('vehicle', e.target.value)}
              placeholder="e.g. VW Polo 1.0 TSI Life (2023)"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <NumField
              id="q-price"
              label="Vehicle price"
              prefix="R"
              value={form.price}
              onChange={(v) => set('price', v)}
              error={errors.price}
            />
            <NumField
              id="q-deposit"
              label="Deposit"
              suffix="%"
              value={form.depositPct}
              onChange={(v) => set('depositPct', v)}
              error={errors.depositPct}
            />
            <NumField
              id="q-rate"
              label="Interest rate"
              suffix="%"
              step="0.01"
              value={form.interestRate}
              onChange={(v) => set('interestRate', v)}
              error={errors.interestRate}
            />
            <NumField
              id="q-term"
              label="Term"
              suffix="mo"
              value={form.termMonths}
              onChange={(v) => set('termMonths', v)}
              error={errors.termMonths}
            />
            <NumField
              id="q-init"
              label="Initiation fee"
              prefix="R"
              step="0.01"
              value={form.initiationFee}
              onChange={(v) => set('initiationFee', v)}
              error={errors.initiationFee}
            />
            <NumField
              id="q-admin"
              label="Admin fee"
              prefix="R"
              suffix="/mo"
              value={form.adminFeeMonthly}
              onChange={(v) => set('adminFeeMonthly', v)}
              error={errors.adminFeeMonthly}
            />
            <NumField
              id="q-life"
              label="Credit life"
              prefix="R"
              suffix="/mo"
              value={form.creditLifeMonthly}
              onChange={(v) => set('creditLifeMonthly', v)}
              error={errors.creditLifeMonthly}
            />
            <NumField
              id="q-track"
              label="Tracking"
              prefix="R"
              suffix="/mo"
              value={form.trackingMonthly}
              onChange={(v) => set('trackingMonthly', v)}
              error={errors.trackingMonthly}
            />
            <NumField
              id="q-balloon"
              label="Balloon"
              suffix="%"
              value={form.balloonPct}
              onChange={(v) => set('balloonPct', v)}
              error={errors.balloonPct}
            />
          </div>

          <button
            type="submit"
            className="min-h-11 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Analyse this quotation
          </button>
        </form>
      </Card>

      {quotations.length > 0 && <QuotationHistory onOpen={setResult} />}
    </div>
  )
}

function NumField({
  id,
  label,
  value,
  onChange,
  error,
  prefix,
  suffix,
  step,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  prefix?: string
  suffix?: string
  step?: string
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step ?? '1'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, prefix && 'pl-7', suffix && 'pr-12')}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}

function QuotationResult({
  quotation,
  onReset,
  saveError,
}: {
  quotation: Quotation
  onReset: () => void
  saveError?: string
}) {
  const flagged = quotation.findings.filter((f) => f.status !== 'ok')
  const tone = quotation.score >= 80 ? 'success' : quotation.score >= 55 ? 'warning' : 'destructive'

  function download() {
    const text = buildNegotiationPack(quotation.vehicle, quotation.findings, quotation.score)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'negotiation-points.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {saveError && <Notice tone="warning">{saveError}</Notice>}

      <Card className="border-primary/30 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fairness score
        </p>
        <div className="mt-1 flex items-end justify-between">
          <p className="font-display text-5xl font-semibold leading-none">
            {quotation.score}
            <span className="text-lg text-muted-foreground">/100</span>
          </p>
          <Pill tone={tone}>
            {quotation.score >= 80
              ? 'Broadly fair'
              : quotation.score >= 55
                ? 'Push back'
                : 'Negotiate hard'}
          </Pill>
        </div>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {quotation.vehicle} · analysed {formatDate(quotation.createdAt)}.{' '}
          {flagged.length
            ? `${flagged.length} line item${flagged.length > 1 ? 's are' : ' is'} worth challenging.`
            : 'Nothing on this quote breaches a cap or benchmark.'}
        </p>
      </Card>

      <div>
        <SectionTitle>Line by line</SectionTitle>
        <Card className="divide-y divide-border">
          {quotation.findings.map((f) => (
            <div key={f.label} className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{f.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{f.value}</span>
                  <Pill
                    tone={
                      f.status === 'ok' ? 'success' : f.status === 'watch' ? 'warning' : 'destructive'
                    }
                  >
                    {f.status === 'ok' ? 'Fair' : f.status === 'watch' ? 'Question it' : 'Challenge'}
                  </Pill>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground text-pretty">{f.note}</p>
            </div>
          ))}
        </Card>
      </div>

      <div className="flex gap-2">
        <button
          onClick={download}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Download className="h-4 w-4" aria-hidden /> Negotiation pack
        </button>
        <button
          onClick={onReset}
          className="min-h-11 flex-1 rounded-xl border border-border py-3 text-sm font-semibold transition hover:border-primary/40"
        >
          Analyse another
        </button>
      </div>

      <Notice tone="muted">
        Benchmarks last reviewed {formatDate(BENCHMARKS_UPDATED)}; prime taken as {PRIME_RATE}%.
        These are reference points for negotiation, not offers or legal advice.
      </Notice>
    </div>
  )
}

function QuotationHistory({ onOpen }: { onOpen: (q: Quotation) => void }) {
  const { quotations } = useStore()

  const rows = useMemo(
    () =>
      [...quotations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [quotations],
  )

  if (rows.length === 0) {
    return (
      <EmptyState title="No quotations analysed yet">Your analyses will be listed here.</EmptyState>
    )
  }

  return (
    <div>
      <SectionTitle>Previous analyses</SectionTitle>
      <Card className="divide-y divide-border">
        {rows.map((q) => {
          const issues = q.findings.filter((f) => f.status !== 'ok').length
          return (
            <button
              key={q.id}
              onClick={() => onOpen(q)}
              className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{q.vehicle || 'Unnamed vehicle'}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(q.createdAt)} · {issues} item{issues === 1 ? '' : 's'} to challenge
                </p>
              </div>
              <Pill tone={q.score >= 80 ? 'success' : q.score >= 55 ? 'warning' : 'destructive'}>
                {q.score}/100
              </Pill>
            </button>
          )
        })}
      </Card>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  controls,
  children,
}: {
  active: boolean
  onClick: () => void
  controls: string
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-lg py-2 text-sm font-semibold transition',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
