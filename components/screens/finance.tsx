'use client'

import { useMemo, useState } from 'react'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Field, inputClass, Notice, Pill, SectionTitle, StatTile } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import {
  assessAffordability,
  calculateFinance,
  PRIME_RATE,
  PRIME_LAST_UPDATED,
  targetRateForScore,
  type FinanceInput,
} from '@/lib/finance'
import { formatDate, formatZAR } from '@/lib/format'
import { Trash2 } from 'lucide-react'

function Slider({
  id,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  id: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        aria-valuetext={`${value}${suffix ?? ''}`}
      />
      <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  )
}

export function FinanceScreen() {
  const { profile, currentScore, scenarios, saveScenario, removeScenario } = useStore()

  const suggestedRate = currentScore
    ? Number(targetRateForScore(currentScore).toFixed(2))
    : Number((PRIME_RATE + 2.5).toFixed(2))

  const [input, setInput] = useState<FinanceInput>({
    price: 285000,
    depositPct: 10,
    annualRatePct: suggestedRate,
    termMonths: 72,
    balloonPct: 0,
  })

  const result = useMemo(() => calculateFinance(input), [input])
  const income = profile?.monthlyIncome ?? 0
  const affordability = useMemo(
    () => assessAffordability(result.monthly, income),
    [result.monthly, income],
  )

  function set<K extends keyof FinanceInput>(key: K, value: FinanceInput[K]) {
    setInput((s) => ({ ...s, [key]: value }))
  }

  function onSave() {
    const name = `${formatZAR(input.price)} · ${input.termMonths}m`
    saveScenario({
      id: crypto.randomUUID(),
      name,
      input,
      result,
      savedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Finance calculator"
        subtitle="Model the real monthly cost before a dealer models it for you."
        back
      />

      <div className="space-y-5 px-4">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Monthly instalment" value={formatZAR(result.monthly)} />
          <StatTile
            label="Affordability"
            value={<span className="text-lg">{affordability.label}</span>}
            tone={affordability.tone === 'success' ? 'success' : affordability.tone === 'destructive' ? 'destructive' : undefined}
            hint={income > 0 ? `${Math.round(affordability.ratio * 100)}% of income` : 'Add income in your profile'}
          />
        </div>

        <Notice tone={affordability.tone === 'success' ? 'success' : affordability.tone === 'destructive' ? 'flag' : 'watch'}>
          {income > 0
            ? affordability.note
            : 'Add your monthly income during onboarding to see an affordability verdict.'}
        </Notice>

        <Card className="space-y-5 p-4">
          <Field label="Vehicle price" htmlFor="price">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R</span>
              <input
                id="price"
                type="number"
                min={0}
                value={input.price}
                onChange={(e) => set('price', Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Deposit" htmlFor="deposit" hint={formatZAR(result.deposit)}>
            <Slider id="deposit" min={0} max={50} step={1} value={input.depositPct} onChange={(v) => set('depositPct', v)} suffix="%" />
          </Field>

          <Field
            label="Interest rate (annual)"
            htmlFor="rate"
            hint={`Prime is ${PRIME_RATE}% (as at ${formatDate(PRIME_LAST_UPDATED)}). ${currentScore ? `Your credit band suggests around ${suggestedRate}%.` : 'Record a credit score to get a personalised target.'}`}
          >
            <Slider id="rate" min={PRIME_RATE} max={PRIME_RATE + 8} step={0.25} value={input.annualRatePct} onChange={(v) => set('annualRatePct', v)} suffix="%" />
          </Field>

          <Field label="Term" htmlFor="term" hint="Longer terms lower the instalment but cost far more interest.">
            <Slider id="term" min={12} max={84} step={6} value={input.termMonths} onChange={(v) => set('termMonths', v)} suffix="m" />
          </Field>

          <Field
            label="Balloon / residual"
            htmlFor="balloon"
            hint={input.balloonPct > 0 ? `${formatZAR(result.balloonDue)} due as a lump sum at the end.` : 'A balloon lowers your instalment but leaves a large payment at the end.'}
          >
            <Slider id="balloon" min={0} max={40} step={5} value={input.balloonPct} onChange={(v) => set('balloonPct', v)} suffix="%" />
          </Field>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle>Cost breakdown</SectionTitle>
          <Row label="Financed amount" value={formatZAR(result.principal)} />
          <Row label="Total interest" value={formatZAR(result.totalInterest)} tone="flag" />
          {input.balloonPct > 0 && <Row label="Balloon due at end" value={formatZAR(result.balloonDue)} tone="watch" />}
          <div className="my-1 border-t border-border" />
          <Row label="Total cost of ownership" value={formatZAR(result.totalCost)} bold />
          <p className="text-xs text-muted-foreground text-pretty">
            Total cost includes your deposit, every instalment and any balloon. Excludes insurance, fuel, licensing and maintenance.
          </p>
        </Card>

        <button
          onClick={onSave}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Save this scenario
        </button>

        {scenarios.length > 0 && (
          <div>
            <SectionTitle>Saved scenarios</SectionTitle>
            <div className="space-y-2">
              {scenarios.map((s) => (
                <Card key={s.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatZAR(s.result.monthly)}/mo · {s.input.annualRatePct}% · saved {formatDate(s.savedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone="muted">{formatZAR(s.result.totalCost)}</Pill>
                    <button
                      onClick={() => removeScenario(s.id)}
                      aria-label={`Delete scenario ${s.name}`}
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string
  value: string
  tone?: 'flag' | 'watch'
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          bold
            ? 'font-display text-base font-semibold'
            : tone === 'flag'
              ? 'font-semibold text-destructive'
              : tone === 'watch'
                ? 'font-semibold text-warning-foreground'
                : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  )
}
