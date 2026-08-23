'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronDown,
  RotateCcw,
  ScrollText,
  Send,
  Shield,
  X,
} from 'lucide-react'
import { askGuardianApi } from '@/lib/guardian/client'
import { GUARDIAN_IDENTITY } from '@/lib/guardian/system-prompt'
import { useGuardianContext } from '@/lib/guardian/use-guardian-context'
import { LIMITS, type GuardianCitation, type WireMessage } from '@/lib/guardian/protocol'
import { GuardianRichText } from './rich-text'
import { cn } from '@/lib/utils'

type Turn = {
  id: string
  role: 'user' | 'guardian'
  text: string
  citations?: GuardianCitation[]
  link?: { label: string; href: string } | null
  /** Set when the deterministic fallback answered instead of the model. */
  offline?: boolean
}

/**
 * The Guardian conversation.
 *
 * Lives in its own chunk: the launcher only imports it once the user opens
 * Guardian, so the fetch logic and this markup stay out of the first paint of
 * every screen.
 *
 * Conversation memory is per-session and in memory only. Closing the panel
 * keeps it (so navigating between screens does not lose the thread); a reload
 * clears it. Nothing here is written to disk or to the database, because a
 * conversation about someone's credit position is not something to persist by
 * default.
 */
export function GuardianPanel({
  open,
  onClose,
  onMinimise,
}: {
  open: boolean
  onClose: () => void
  onMinimise: () => void
}) {
  const { context, private: priv, suggestions } = useGuardianContext()
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  // Escape closes, from anywhere inside the panel.
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // A request in flight when the panel unmounts is abandoned, not left to
  // resolve into a component that is gone.
  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim().slice(0, LIMITS.maxMessageChars)
      if (!trimmed || busy) return

      setError('')
      setText('')
      const userTurn: Turn = { id: crypto.randomUUID(), role: 'user', text: trimmed }
      const history = [...turns, userTurn]
      setTurns(history)
      setBusy(true)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const wire: WireMessage[] = history.map((t) => ({ role: t.role, text: t.text }))
      const outcome = await askGuardianApi({
        messages: wire,
        context,
        private: priv,
        signal: controller.signal,
      })

      setBusy(false)
      if (!outcome.ok) {
        // An empty message is an aborted request: the user did something else.
        if (outcome.message) setError(outcome.message)
        return
      }

      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'guardian',
          text: outcome.response.reply,
          citations: outcome.response.citations,
          link: outcome.response.link,
          offline: outcome.source === 'offline',
        },
      ])
    },
    [busy, turns, context, priv],
  )

  function reset() {
    abortRef.current?.abort()
    setTurns([])
    setError('')
    setText('')
    setBusy(false)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Guardian, your car-buying assistant"
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl',
        // Phone: a sheet anchored to the bottom, clear of the bottom bar and
        // the home indicator. Wide: a panel in the bottom-left corner.
        'inset-x-2 bottom-2 max-h-[min(78dvh,40rem)] rounded-2xl',
        // Clears the 240px sidebar for the same reason the launcher does.
        'wide:inset-x-auto wide:left-[calc(15rem+1.25rem)] wide:bottom-5 wide:h-[min(38rem,78dvh)] wide:w-[24rem] wide:max-h-none',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200',
        !open && 'hidden',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight">
            {GUARDIAN_IDENTITY.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {GUARDIAN_IDENTITY.tagline}
          </p>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={reset}
            aria-label="Start a new conversation"
            title="New conversation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Minimise Guardian"
          title="Minimise"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Guardian"
          title="Close"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {/* Conversation */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Guardian"
        className="no-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-3.5"
      >
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-pretty">{GUARDIAN_IDENTITY.greeting}</p>
            <p className="text-xs text-muted-foreground text-pretty">
              I work from what this app actually holds. If it does not have a figure, I will tell
              you that rather than guess.
            </p>
          </div>
        ) : (
          turns.map((turn) => <Bubble key={turn.id} turn={turn} />)
        )}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Shield className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="flex items-center gap-1">
              Guardian is thinking
              <Dots />
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive text-pretty">
            {error}
          </p>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggestions: only before the conversation starts, so they never push
          the thread around mid-exchange. */}
      {turns.length === 0 && !busy && (
        <div className="no-scrollbar shrink-0 overflow-x-auto px-3.5 pb-2">
          <ul className="flex gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => send(suggestion)}
                  className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-border bg-background px-3 text-xs font-medium transition hover:border-primary/50 hover:text-primary"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          send(text)
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-2.5"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={LIMITS.maxMessageChars}
          placeholder="Ask Guardian..."
          aria-label="Ask Guardian a question"
          disabled={busy}
          className="min-h-11 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60 placeholder:text-muted-foreground sm:text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send question"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}

/** Three dots that hold their width, so the label does not jitter. */
function Dots() {
  return (
    <span aria-hidden className="inline-flex w-4 gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground text-pretty">
          {turn.text}
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
        <Shield className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 max-w-[88%] space-y-2 rounded-2xl rounded-tl-md border border-border bg-background px-3.5 py-2.5">
        <GuardianRichText text={turn.text} />

        {turn.citations && turn.citations.length > 0 && (
          <ul className="space-y-1 border-t border-border pt-2">
            {turn.citations.map((citation) => (
              <li key={citation.id}>
                <Cite citation={citation} />
              </li>
            ))}
          </ul>
        )}

        {turn.link && (
          <Link
            href={turn.link.href}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
          >
            {turn.link.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}

        {turn.offline && (
          <p className="text-[11px] text-muted-foreground text-pretty">
            Answered by this app&apos;s built-in rules, not the AI assistant, which is not switched on
            here.
          </p>
        )}
      </div>
    </div>
  )
}

function Cite({ citation }: { citation: GuardianCitation }) {
  const content = (
    <>
      <ScrollText className="h-3 w-3 shrink-0" aria-hidden />
      <span className="text-pretty">{citation.label}</span>
    </>
  )
  const className = 'flex items-start gap-1.5 text-[11px] font-medium text-primary'

  if (citation.url) {
    return (
      <a href={citation.url} target="_blank" rel="noopener noreferrer" className={`${className} underline`}>
        {content}
      </a>
    )
  }
  if (citation.href) {
    return (
      <Link href={citation.href} className={`${className} underline`}>
        {content}
      </Link>
    )
  }
  return <p className={className}>{content}</p>
}
