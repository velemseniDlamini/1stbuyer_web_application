'use client'

import { useState } from 'react'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Notice, Pill, SectionTitle } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import { RIGHTS_MODULES, type RightsModule } from '@/lib/rights'
import { BookOpen, Check, ChevronDown, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RightsScreen() {
  const { completedRights } = useStore()
  const [openId, setOpenId] = useState<string | null>(RIGHTS_MODULES[0].id)

  const done = completedRights.length

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Know your rights"
        subtitle="South African consumer & credit law, in plain language"
        back
      />

      <div className="space-y-5 px-4">
        <Notice tone="primary">
          These modules explain the Consumer Protection Act (CPA) and National Credit Act (NCA) as
          they apply to buying a car. This is education, not legal advice.
        </Notice>

        <div className="flex items-center justify-between">
          <SectionTitle>Modules</SectionTitle>
          <Pill tone={done === RIGHTS_MODULES.length ? 'success' : 'muted'}>
            {done}/{RIGHTS_MODULES.length} completed
          </Pill>
        </div>

        <div className="space-y-3">
          {RIGHTS_MODULES.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              open={openId === m.id}
              onToggle={() => setOpenId((id) => (id === m.id ? null : m.id))}
              completed={completedRights.includes(m.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModuleCard({
  module,
  open,
  onToggle,
  completed,
}: {
  module: RightsModule
  open: boolean
  onToggle: () => void
  completed: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            completed ? 'bg-success text-white' : 'bg-secondary text-foreground',
          )}
        >
          {completed ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{module.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ScrollText className="h-3 w-3" /> {module.law}
          </span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <p className="text-sm text-foreground text-pretty">{module.summary}</p>
          <ul className="mt-3 space-y-2">
            {module.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-pretty">{p}</span>
              </li>
            ))}
          </ul>
          <Quiz module={module} completed={completed} />
        </div>
      )}
    </Card>
  )
}

function Quiz({ module, completed }: { module: RightsModule; completed: boolean }) {
  const { completeRights } = useStore()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(completed)
  // A module completed on a previous visit starts finished with no answers in
  // this session, so the score line must not claim they scored zero.
  const [attempted, setAttempted] = useState(false)

  const question = module.quiz[step]

  if (finished) {
    return (
      <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-success">
          <Check className="h-4 w-4" /> Module completed
        </p>
        {/* The quiz was already counting correct answers and then throwing the
            number away, so a user finished with no idea how they had done. */}
        {attempted && (
          <p className="mt-1 font-medium">
            You answered {correctCount} of {module.quiz.length} correctly.
          </p>
        )}
        <p className="mt-1 text-muted-foreground text-pretty">
          You have the essentials of {module.title.toLowerCase()}. This helps unlock your journey.
        </p>
      </div>
    )
  }

  function choose(i: number) {
    if (selected !== null) return
    setSelected(i)
    setAttempted(true)
    if (i === question.answer) setCorrectCount((c) => c + 1)
  }

  function next() {
    if (step + 1 < module.quiz.length) {
      setStep((s) => s + 1)
      setSelected(null)
    } else {
      setFinished(true)
      completeRights(module.id)
    }
  }

  const answered = selected !== null

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick check · {step + 1}/{module.quiz.length}
      </p>
      <p className="mt-1.5 text-sm font-medium text-pretty">{question.q}</p>
      <div className="mt-3 space-y-2">
        {question.options.map((opt, i) => {
          const isAnswer = i === question.answer
          const isPicked = i === selected
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={answered}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                !answered && 'border-border bg-card hover:border-primary/40',
                answered && isAnswer && 'border-success bg-success/15 text-success',
                answered && isPicked && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                answered && !isAnswer && !isPicked && 'border-border opacity-60',
              )}
            >
              <span className="text-pretty">{opt}</span>
              {answered && isAnswer && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground text-pretty">{question.explain}</p>
          <button
            onClick={next}
            className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {step + 1 < module.quiz.length ? 'Next question' : 'Finish module'}
          </button>
        </div>
      )}
    </div>
  )
}
