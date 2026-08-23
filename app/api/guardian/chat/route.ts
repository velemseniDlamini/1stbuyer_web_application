import { NextResponse } from 'next/server'
import {
  parseGuardianRequest,
  type GuardianContext,
  type GuardianError,
  type GuardianPrivateContext,
  type GuardianResponse,
} from '@/lib/guardian/protocol'
import { buildSystemInstruction } from '@/lib/guardian/system-prompt'
import { retrieve, renderForPrompt } from '@/lib/guardian/retrieval'
import { createToolHandlers } from '@/lib/guardian/tools'
import { renderReply } from '@/lib/guardian/render'
import { askGemini, guardianEnabled, GeminiError } from '@/lib/guardian/gemini'
import { callerKey, checkRateLimit } from '@/lib/guardian/rate-limit'
import { PAGE_PURPOSE, PAGE_ROUTES } from '@/lib/guardian/app-knowledge'
import { VEHICLES } from '@/lib/data'
import { NEW_CARS } from '@/lib/new-cars-source'

/**
 * Guardian's only endpoint.
 *
 * THE SHAPE OF THE TRUST BOUNDARY
 *
 * Everything in the request body is untrusted and is re-parsed by
 * parseGuardianRequest before it is looked at. Nothing from the client becomes
 * an instruction: the system prompt is assembled here from constants, and the
 * client's context reaches the model only as a short factual block and as tool
 * results. A "role":"system" in the body is downgraded, not honoured.
 *
 * The API key never leaves this process. Provider errors are classified into a
 * kind and thrown away, so no upstream message, stack or environment value can
 * reach the browser.
 */

// The Gemini SDK needs Node APIs; this must not be pushed to the edge runtime.
export const runtime = 'nodejs'
// Nothing here is cacheable: every answer depends on the caller's own state.
export const dynamic = 'force-dynamic'

/** One sentence per failure. The user gets these; the log gets the detail. */
const MESSAGES: Record<string, string> = {
  disabled: 'Guardian is not switched on in this environment.',
  rate_limited: 'Guardian is catching up on requests. Give it a few seconds and try again.',
  timeout: 'Guardian took too long to answer. Try asking again.',
  upstream: "Guardian couldn't complete that request. Please try again.",
  bad_request: "Guardian couldn't read that request.",
}

function fail(code: GuardianError['code'], status: number, retryAfter?: number) {
  const body: GuardianError = { error: MESSAGES[code] ?? MESSAGES.upstream, code }
  if (retryAfter) body.retryAfter = retryAfter
  return NextResponse.json(body, {
    status,
    headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
  })
}

export async function POST(request: Request) {
  if (!guardianEnabled()) return fail('disabled', 503)

  const limit = checkRateLimit(callerKey(request))
  if (!limit.allowed) return fail('rate_limited', 429, limit.retryAfterSeconds)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('bad_request', 400)
  }

  const parsed = parseGuardianRequest(body)
  if (!parsed.ok) {
    return NextResponse.json<GuardianError>(
      { error: parsed.error, code: 'bad_request' },
      { status: 400 },
    )
  }

  const { messages, context, private: priv = {} } = parsed.request
  const question = messages[messages.length - 1].text

  // Retrieval runs against the question and the screen, never against anything
  // the client labelled as a "source".
  const sources = renderForPrompt(retrieve(question, context.page))
  const systemInstruction = buildSystemInstruction(describeContext(context, priv), sources)

  try {
    const outcome = await askGemini({
      systemInstruction,
      turns: messages,
      handlers: createToolHandlers(context, priv),
    })

    const rendered = renderReply(outcome.text)
    if (!rendered.reply) return fail('upstream', 502)

    // Deliberately coarse: which tools ran and how many turns. No question
    // text, no answer text, no context. A support log is not a transcript of
    // someone's finances.
    console.info(
      `[guardian] page=${context.page} turns=${messages.length} tools=${outcome.toolsUsed.join(',') || 'none'}`,
    )

    return NextResponse.json<GuardianResponse>(rendered)
  } catch (error) {
    const kind = error instanceof GeminiError ? error.kind : 'unknown'
    // The provider's own words stay here.
    console.error(
      `[guardian] failed kind=${kind} detail=${error instanceof GeminiError ? error.detail : String(error)}`,
    )

    if (kind === 'timeout') return fail('timeout', 504)
    if (kind === 'rate_limited') {
      // The provider usually says how long to wait. Passing that through beats
      // a guess, and the free tier's window is short enough to be worth waiting.
      const wait = error instanceof GeminiError ? error.retryAfterSeconds : undefined
      return fail('rate_limited', 429, wait ?? 30)
    }
    return fail('upstream', 502)
  }
}

/* ------------------------------------------------------------- context --- */

/**
 * The non-sensitive live context block.
 *
 * Note what is NOT here: no credit score, no income, no quotation figures.
 * Those stay in the tool closure until the model asks for them, so an ordinary
 * question about boot space never carries someone's salary to the provider.
 */
function describeContext(context: GuardianContext, priv: GuardianPrivateContext): string {
  const lines: string[] = [
    `Screen: ${context.page} (${PAGE_ROUTES[context.page]}). ${PAGE_PURPOSE[context.page]}`,
  ]

  if (priv.firstName) lines.push(`The user's first name is ${priv.firstName}.`)

  const vehicle = VEHICLES.find((v) => v.id === context.vehicleId)
  if (vehicle) {
    lines.push(
      `The screen is about this used listing: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} (id ${vehicle.id}). Call tools for its figures rather than quoting them from here.`,
    )
  }

  const newCar = NEW_CARS.find((c) => c.id === context.newCarId)
  if (newCar) {
    lines.push(
      `The screen is about this brand-new car: ${newCar.make} ${newCar.model} ${newCar.variant} (id ${newCar.id}).`,
    )
  }

  const comparing = (context.compareIds ?? [])
    .map((id) => VEHICLES.find((v) => v.id === id))
    .filter(Boolean)
  if (comparing.length > 0) {
    lines.push(
      `The user is comparing: ${comparing.map((v) => `${v!.make} ${v!.model} (id ${v!.id})`).join(', ')}.`,
    )
  }

  lines.push(
    priv.creditScore
      ? 'The user has recorded a credit score. Its value is withheld from this block on purpose: call getCreditContext when the answer needs it.'
      : 'The user has NOT recorded a credit score, so instalment and affordability answers stay locked. Confirm with getCreditContext before telling them so.',
  )

  if (priv.quotation) {
    lines.push('The user has analysed a dealer quotation. Call getQuotationAnalysis to read it.')
  }

  return lines.join('\n')
}
