'use client'

// The browser half of Guardian: build the request, call the route, understand
// the reply. Deliberately free of any Gemini import, so nothing about the
// provider or its key can be reached from a client bundle.

import { askGuardian } from '../guardian'
import type {
  GuardianContext,
  GuardianPrivateContext,
  GuardianResponse,
  WireMessage,
} from './protocol'

export type AskOutcome =
  | { ok: true; response: GuardianResponse; source: 'ai' | 'offline' }
  | { ok: false; message: string; retryAfter?: number }

const ENDPOINT = '/api/guardian/chat'

/**
 * Ask Guardian.
 *
 * If the server reports that the AI is not configured, we fall back to the
 * app's original deterministic rule engine rather than showing a dead panel.
 * That engine still cites real statute and still gives concrete steps: it is
 * narrower, not wronger, and the panel labels the answer so the user is never
 * misled about which one replied.
 */
export async function askGuardianApi(params: {
  messages: WireMessage[]
  context: GuardianContext
  private: GuardianPrivateContext
  signal?: AbortSignal
}): Promise<AskOutcome> {
  const question = params.messages[params.messages.length - 1]?.text ?? ''

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: params.messages,
        context: params.context,
        private: params.private,
      }),
      signal: params.signal,
    })
  } catch (error) {
    // An aborted request is the user closing or resetting the panel, not a
    // failure worth showing them.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, message: '' }
    }
    return { ok: false, message: 'Guardian could not be reached. Check your connection.' }
  }

  if (res.status === 503) {
    return { ok: true, response: offlineAnswer(question, params.private), source: 'offline' }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, message: "Guardian couldn't complete that request. Please try again." }
  }

  if (!res.ok) {
    const error = body as { error?: string; retryAfter?: number }
    return {
      ok: false,
      message: error.error ?? "Guardian couldn't complete that request. Please try again.",
      retryAfter: error.retryAfter,
    }
  }

  const response = body as GuardianResponse
  if (!response?.reply) {
    return { ok: false, message: "Guardian couldn't complete that request. Please try again." }
  }
  return { ok: true, response, source: 'ai' }
}

/** The original rule engine, mapped onto the new response shape. */
function offlineAnswer(question: string, priv: GuardianPrivateContext): GuardianResponse {
  const reply = askGuardian(question, {
    firstName: priv.firstName ?? undefined,
    score: priv.creditScore ?? null,
    monthlyIncome: priv.monthlyIncome ?? undefined,
  })

  const steps = reply.steps.length > 0 ? `\n\n${reply.steps.map((s) => `- ${s}`).join('\n')}` : ''

  return {
    reply: `${reply.title}\n\n${reply.body}${steps}`,
    // The rule engine's citation is a plain string rather than a knowledge id,
    // so it carries no href. It is still a real statute reference.
    citations: reply.citation ? [{ id: 'offline', label: reply.citation }] : [],
    link: reply.link ?? null,
  }
}
