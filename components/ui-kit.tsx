import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Tone = 'ok' | 'success' | 'primary' | 'warning' | 'watch' | 'destructive' | 'flag' | 'muted'

const toneClasses: Record<Tone, string> = {
  ok: 'bg-success/15 text-success border-success/25',
  success: 'bg-success/15 text-success border-success/25',
  primary: 'bg-primary/20 text-primary-foreground border-primary/30',
  warning: 'bg-warning/20 text-warning-foreground border-warning/35',
  watch: 'bg-warning/20 text-warning-foreground border-warning/35',
  destructive: 'bg-destructive/15 text-destructive border-destructive/25',
  flag: 'bg-destructive/15 text-destructive border-destructive/25',
  muted: 'bg-muted text-muted-foreground border-border',
}

export function Pill({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: any
}) {
  return (
    <Tag className={cn('rounded-2xl border border-border bg-card text-card-foreground', className)}>
      {children}
    </Tag>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-semibold leading-tight',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground text-pretty">{hint}</p>}
    </div>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  error,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground text-pretty">{hint}</p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground'

export function Notice({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3 text-xs leading-relaxed text-pretty',
        toneClasses[tone],
      )}
    >
      {children}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted-foreground text-pretty">{children}</div>}
    </div>
  )
}
