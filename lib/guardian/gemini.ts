// The only module that touches the Gemini API key.
//
// `import 'server-only'` makes the boundary a build error rather than a code
// review question: if any client component ever imports this file, even
// transitively, the build fails instead of shipping the key to a browser. Same
// guard lib/supabase-admin.ts uses for the service role.

import 'server-only'
import { GoogleGenAI, Interactions } from '@google/genai'
import { TOOL_DECLARATIONS, type ToolResult } from './tools'

export type GuardianModelConfig = {
  model: string
  /** Wall-clock budget for the whole exchange, tool round trips included. */
  timeoutMs: number
  /** How many times the model may call tools before we stop looping. */
  maxToolRounds: number
}

export function modelConfig(): GuardianModelConfig {
  return {
    // Configurable so the model can be changed without a code change.
    //
    // The default is Flash-Lite, chosen after measuring both against this
    // app's own prompts: on the free tier gemini-3.5-flash allows only 5
    // requests a minute, which is about one user at a time, while Flash-Lite
    // answered the same questions in ~2s instead of ~10s with the refusal and
    // honesty rules holding on every adversarial case. Note that 2.x model
    // names are retired and now 404, so this must never fall back to one.
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    timeoutMs: Number(process.env.GUARDIAN_TIMEOUT_MS ?? 25_000),
    maxToolRounds: Number(process.env.GUARDIAN_MAX_TOOL_ROUNDS ?? 3),
  }
}

export function guardianEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}

/** Categories the route maps to a user-facing sentence. Never raw provider text. */
export type GeminiFailure =
  | 'timeout'
  | 'rate_limited'
  | 'auth'
  | 'model_unavailable'
  | 'empty'
  | 'unknown'

export class GeminiError extends Error {
  constructor(
    readonly kind: GeminiFailure,
    /** Kept for the server log only. Never returned to the browser. */
    readonly detail: string,
    /** Seconds the provider asked us to wait, when it said. */
    readonly retryAfterSeconds?: number,
  ) {
    super(kind)
  }
}

/**
 * Pull the wait out of a provider quota message.
 *
 * Only the NUMBER is taken. The surrounding text stays server side, so telling
 * the user how long to wait cannot become a channel for leaking a provider
 * string that might carry a project id or a key fragment.
 */
function retryHint(message: string): number | undefined {
  const match = /retry in ([0-9]+(?:\.[0-9]+)?)s/i.exec(message)
  if (!match) return undefined
  const seconds = Math.ceil(Number(match[1]))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : undefined
}

/**
 * Classify a provider error without leaking it.
 *
 * The message is inspected here and then thrown away: the caller gets a kind,
 * so there is no path by which a provider string containing a key fragment, a
 * project id or an internal URL reaches the client.
 */
function classify(error: unknown): GeminiError {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('deadline')) {
    return new GeminiError('timeout', message)
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return new GeminiError('rate_limited', message, retryHint(message))
  }
  if (lower.includes('api key') || lower.includes('401') || lower.includes('403') || lower.includes('permission')) {
    return new GeminiError('auth', message)
  }
  if (lower.includes('404') || lower.includes('not available') || lower.includes('not found')) {
    return new GeminiError('model_unavailable', message)
  }
  return new GeminiError('unknown', message)
}

/* ----------------------------------------------------------- the call ---- */

// The SDK's own step union. Using it rather than a loose record is what makes
// the "replay every step verbatim" rule below type-checked instead of hoped for.
type InputItem = Interactions.Step

export type AskParams = {
  systemInstruction: string
  /** Conversation so far, oldest first, already validated. */
  turns: { role: 'user' | 'guardian'; text: string }[]
  handlers: Record<string, (args: Record<string, unknown>) => ToolResult>
}

export type AskOutcome = {
  text: string
  /** Which tools ran, for the server log. Arguments are not logged. */
  toolsUsed: string[]
}

/**
 * One Guardian exchange, including any tool round trips.
 *
 * Runs stateless (`store: false`): Google keeps no server-side copy of the
 * conversation, and the history is resent each turn from the browser. For an
 * app holding someone's credit position that is the right trade, and it also
 * means there is no interaction id to leak or clean up.
 */
export async function askGemini(params: AskParams): Promise<AskOutcome> {
  const config = modelConfig()
  const ai = getClient()
  const toolsUsed: string[] = []

  // The conversation, oldest first. Guardian's own past replies come back as
  // model turns so it can resolve "it" and "that one" across the exchange.
  const input: InputItem[] = params.turns.map((turn) =>
    turn.role === 'user'
      ? { type: 'user_input', content: [{ type: 'text', text: turn.text }] }
      : { type: 'model_output', content: [{ type: 'text', text: turn.text }] },
  )

  const deadline = Date.now() + config.timeoutMs

  try {
    for (let round = 0; round <= config.maxToolRounds; round += 1) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new GeminiError('timeout', 'budget exhausted before response')

      const interaction = await withTimeout(
        ai.interactions.create({
          model: config.model,
          store: false,
          system_instruction: params.systemInstruction,
          input,
          tools: TOOL_DECLARATIONS,
        }),
        remaining,
      )

      const steps: InputItem[] = interaction.steps ?? []
      const calls = steps.filter(
        (step): step is Interactions.FunctionCallStep => step.type === 'function_call',
      )

      if (calls.length === 0) {
        const text = String(interaction.output_text ?? '').trim()
        if (!text) throw new GeminiError('empty', 'model returned no text')
        return { text, toolsUsed }
      }

      // Stateless tool calling: every step comes back verbatim, then the
      // results are appended. Reordering or dropping a step breaks the chain.
      for (const step of steps) input.push(step)

      for (const call of calls) {
        const handler = call.name ? params.handlers[call.name] : undefined
        // An unknown tool name is answered with an error object rather than
        // thrown: the model recovers by explaining what it cannot do, instead
        // of the whole request failing.
        const result: ToolResult = handler
          ? safeRun(handler, call.arguments)
          : { error: 'No such tool exists.' }
        if (call.name) toolsUsed.push(call.name)

        input.push({
          type: 'function_result',
          name: call.name,
          call_id: call.id,
          result: [{ type: 'text', text: JSON.stringify(result) }],
        })
      }
    }

    // Tool rounds exhausted. Rather than loop forever on a model that keeps
    // asking for data, stop and let the route report a clean failure.
    throw new GeminiError('unknown', `exceeded ${config.maxToolRounds} tool rounds`)
  } catch (error) {
    throw error instanceof GeminiError ? error : classify(error)
  }
}

/** A handler must never take the request down. */
function safeRun(
  handler: (args: Record<string, unknown>) => ToolResult,
  args: unknown,
): ToolResult {
  try {
    const parsed =
      args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
    return handler(parsed)
  } catch {
    return { error: 'That lookup failed inside the app.' }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new GeminiError('timeout', `no response in ${ms}ms`)), ms),
    ),
  ])
}
