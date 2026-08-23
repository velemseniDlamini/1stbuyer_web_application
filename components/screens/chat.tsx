'use client'

import { useEffect, useRef, useState } from 'react'
import { ScreenHeader } from '@/components/screen-header'
import { useStore, type ChatMessage } from '@/lib/store'
import { askGuardianApi } from '@/lib/guardian/client'
import { useGuardianContext } from '@/lib/guardian/use-guardian-context'
import { LIMITS, type WireMessage } from '@/lib/guardian/protocol'
import Link from 'next/link'
import { Shield, Send, ScrollText, Trash2, AlertTriangle, ArrowRight } from 'lucide-react'
import { GuardianRichText } from '@/components/guardian/rich-text'

/**
 * The full-screen Guardian.
 *
 * Shares one engine with the floating panel through askGuardianApi, so the two
 * surfaces cannot give different answers to the same question. Only the
 * presentation differs: this screen keeps its history in the store, so a
 * conversation started here survives a reload, where the panel's does not.
 */
export function ChatScreen() {
  const { chat, addChat, clearChat } = useStore()
  const { context, private: priv, suggestions } = useGuardianContext()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, busy])

  async function send(question: string) {
    const q = question.trim().slice(0, LIMITS.maxMessageChars)
    if (!q || busy) return

    setError('')
    setText('')
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: q,
      at: new Date().toISOString(),
    }
    addChat(userMsg)
    setBusy(true)

    // The stored thread is what Guardian is given, so a follow-up like "is it
    // expensive to run?" resolves against what was already said.
    const history: WireMessage[] = [...chat, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }))

    const outcome = await askGuardianApi({ messages: history, context, private: priv })
    setBusy(false)

    if (!outcome.ok) {
      // An empty message means the request was aborted, not that it failed.
      if (outcome.message) setError(outcome.message)
      return
    }

    addChat({
      id: crypto.randomUUID(),
      role: 'guardian',
      text: outcome.response.reply,
      // This screen's bubble shows a single citation line. Joining keeps the
      // existing store shape rather than reworking it for one surface.
      citation: outcome.response.citations.map((c) => c.label).join(' / ') || undefined,
      link: outcome.response.link ?? undefined,
      at: new Date().toISOString(),
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      void send(text)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title="Guardian"
        subtitle="Your consumer-rights co-pilot"
        right={
          chat.length > 0 ? (
            <button
              onClick={clearChat}
              aria-label="Clear conversation"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Guardian"
        className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {chat.length === 0 ? (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Shield className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold">
              Ask me anything about your deal
            </h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
              I can help with cars, credit, finance, quotations, your rights, insurance and the
              tools in this app. I work from what this app actually holds, so if it does not have a
              figure I will tell you rather than guess.
            </p>
          </div>
        ) : (
          chat.map((m) => <Bubble key={m.id} message={m} />)
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Shield className="h-4 w-4" aria-hidden />
            </span>
            Guardian is thinking...
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty">
            {error}
          </p>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => void send(s)}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            placeholder="Ask Guardian..."
            aria-label="Ask Guardian a question"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={() => void send(text)}
            disabled={!text.trim() || busy}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
        <Shield className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[85%] space-y-2 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-3">
        {/* `matched` is only set on messages written by the old rule engine,
            which is still what answers when the AI is not configured. */}
        {message.matched === false && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            No sourced answer for that yet
          </p>
        )}
        <GuardianRichText text={message.text} />
        {message.steps && message.steps.length > 0 && (
          <ol className="space-y-1.5 pt-1">
            {message.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-pretty text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        )}
        {message.citation && (
          <p className="flex items-center gap-1.5 border-t border-border pt-2 text-xs font-medium text-primary">
            <ScrollText className="h-3.5 w-3.5" /> {message.citation}
          </p>
        )}
        {message.link && (
          <Link
            href={message.link.href}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
          >
            {message.link.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}
