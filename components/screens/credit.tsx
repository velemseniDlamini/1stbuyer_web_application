'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { CREDIT_BANDS, bandForScore, targetRateForScore, PRIME_RATE } from '@/lib/finance'
import { CREDIT_BUREAUS } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Pill, Field, inputClass, Notice, SectionTitle, EmptyState } from '@/components/ui-kit'
import { ExternalLink, Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function CreditScreen() {
  const { credit, currentScore, addCredit, syncError } = useStore()
  const [score, setScore] = useState('')
  const [bureau, setBureau] = useState(CREDIT_BUREAUS[0].name)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const n = Number(score)
    if (!n || n < 0 || n > 999) {
      setError('Enter a score between 0 and 999.')
      return
    }
    setSaving(true)
    // The score is only cleared from the form once the write has been accepted,
    // so a failure leaves the number the user typed on screen to retry.
    const result = await addCredit({ score: n, bureau, date: new Date().toISOString() })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'We could not save that score.')
      return
    }
    setScore('')
  }

  const band = currentScore != null ? bandForScore(currentScore) : null

  return (
    <div>
      <ScreenHeader title="Credit position" subtitle="Self-reported from your bureau" back />

      <div className="space-y-6 px-4 py-4">
        {syncError && (
          <Notice tone="destructive">
            <strong className="font-semibold">Your history did not load.</strong> {syncError}
          </Notice>
        )}

        {/* Current band */}
        {currentScore != null && band ? (
          <Card className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your score
                  </p>
                  <p className="font-display text-5xl font-semibold leading-none">{currentScore}</p>
                </div>
                <Pill tone={band.tone}>{band.label}</Pill>
              </div>
              <div className="mt-4">
                <ScoreBar score={currentScore} />
              </div>
              <div className="mt-4 rounded-xl bg-secondary/60 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Target interest rate
                </p>
                <p className="font-display text-2xl font-semibold text-primary-foreground">
                  ~ Prime + {(targetRateForScore(currentScore) - PRIME_RATE).toFixed(1)}%
                  <span className="ml-2 text-base text-muted-foreground">
                    ({targetRateForScore(currentScore).toFixed(2)}%)
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground text-pretty">{band.summary}</p>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState icon={<Gauge className="h-8 w-8" />} title="No score recorded yet">
            Get your score from a bureau below, then enter it to unlock your target interest-rate
            band.
          </EmptyState>
        )}

        {/* Record a score */}
        <Card className="p-4">
          <SectionTitle>Record a new score</SectionTitle>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Score (0-999)" htmlFor="score" error={error}>
                <input
                  id="score"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  className={inputClass}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </Field>
              <Field label="Bureau" htmlFor="bureau">
                <select
                  id="bureau"
                  className={inputClass}
                  value={bureau}
                  onChange={(e) => setBureau(e.target.value)}
                >
                  {CREDIT_BUREAUS.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save score'}
            </button>
          </form>
        </Card>

        {/* Get your score */}
        <div>
          <SectionTitle>Get your score</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {CREDIT_BUREAUS.map((b) => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-sm font-medium transition hover:border-primary/40"
              >
                <span className="truncate">{b.name}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </a>
            ))}
          </div>
          <Notice tone="muted">
            You are entitled to one free credit report per year from each registered bureau (NCA
            s72). 1st Buyer records what you report. It does not score you.
          </Notice>
        </div>

        {/* History */}
        <div>
          <SectionTitle>Score history</SectionTitle>
          {credit.length === 0 ? (
            <EmptyState title="No history yet">
              Record a score above and it will be tracked here over time.
            </EmptyState>
          ) : credit.length === 1 ? (
            <Card className="p-4">
              <HistoryRow entry={credit[0]} prev={null} />
              <Notice tone="muted">
                Record another score later to start seeing your trend over time.
              </Notice>
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {[...credit].reverse().map((c, i, arr) => (
                <div key={c.date} className="p-3.5">
                  <HistoryRow entry={c} prev={arr[i + 1] ?? null} />
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Band reference */}
        <div>
          <SectionTitle>Rate bands</SectionTitle>
          <Card className="divide-y divide-border">
            {CREDIT_BANDS.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3.5">
                <div>
                  <p className="text-sm font-semibold">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.min}-{b.max === 999 ? '999' : b.max}
                  </p>
                </div>
                <Pill tone={b.tone}>Prime + {b.spread}%</Pill>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 999) * 100)
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-destructive via-warning to-success" />
      <div className="relative -mt-2.5 h-2.5">
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>500</span>
        <span>999</span>
      </div>
    </div>
  )
}

function HistoryRow({
  entry,
  prev,
}: {
  entry: { score: number; bureau: string; date: string }
  prev: { score: number } | null
}) {
  const delta = prev ? entry.score - prev.score : 0
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold">{entry.score}</p>
        <p className="text-xs text-muted-foreground">
          {entry.bureau} · {formatDate(entry.date)}
        </p>
      </div>
      {prev ? (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold ${
            delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {delta > 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : delta < 0 ? (
            <TrendingDown className="h-4 w-4" />
          ) : (
            <Minus className="h-4 w-4" />
          )}
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ) : (
        <Pill tone="muted">First entry</Pill>
      )}
    </div>
  )
}
