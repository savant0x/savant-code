import stripAnsi from 'strip-ansi'

import {
  applySavantCodeModelOverride,
  resolveAgent,
} from './hooks/helpers/send-message-agent'
import { loadAgentDefinitions } from './utils/local-agent-registry'
import { loadMostRecentChatState } from './utils/run-state-storage'
import { getSavantCodeClient } from './utils/savant-code-client'

import type {
  AgentDefinition,
  RunState,
  SavantCodeClient,
} from '@savant-code/sdk'

/**
 * FID-2026-0806-011 — headless / non-interactive run mode.
 *
 * Contract (conventional exit codes):
 *   - 0 = run completed with a final answer (printed to stdout)
 *   - 1 = run errored or timed out (message on stderr)
 *   - 2 = usage error (no prompt provided)
 *
 * ANSI codes are stripped from the printed answer when stdout is not a TTY.
 */
export const HEADLESS_EXIT_OK = 0
export const HEADLESS_EXIT_ERROR = 1
export const HEADLESS_EXIT_USAGE = 2

/** Env var that overrides the headless run timeout (FID-2026-0806-011). */
export const RUN_TIMEOUT_ENV = 'SAVANT_CODE_RUN_TIMEOUT_MS'
export const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000

export type HeadlessRunParams = {
  prompt: string
  agentId?: string
  /** FID-062: comma-separated tool allowlist. Filters the resolved agent's
   *  toolNames so a delegating parent can pin the child's tool surface. */
  allowedTools?: string
  continueChat?: boolean
  continueId?: string | null
  /** Timeout in ms. Defaults to SAVANT_CODE_RUN_TIMEOUT_MS or 10 minutes. */
  timeoutMs?: number
  /** Injectable client factory (DI over module mocking — see docs/testing.md). */
  getClient?: () => Promise<SavantCodeClient | null>
  /** Pre-resolved agent definition; skips resolveAgent + model override. */
  resolvedAgent?: AgentDefinition | string
  /** Agent definitions; defaults to loadAgentDefinitions(). */
  agentDefinitions?: AgentDefinition[]
  /** Pre-loaded previous run state; otherwise loaded on --continue. */
  previousRun?: RunState
}

export type HeadlessRunResult = {
  exitCode: number
  /** Final answer text — present on success. */
  output?: string
  /** Error message — present on failure. */
  error?: string
}

export function resolveRunTimeoutMs(envValue: string | undefined): number {
  if (!envValue) return DEFAULT_RUN_TIMEOUT_MS
  const parsed = Number(envValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RUN_TIMEOUT_MS
  return parsed
}

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  return (
    part !== null &&
    typeof part === 'object' &&
    (part as { type?: unknown }).type === 'text' &&
    typeof (part as { text?: unknown }).text === 'string'
  )
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join('')
}

/** Last assistant message with non-empty text, scanning backwards. */
function lastAssistantText(messages: unknown[] | undefined): string {
  if (!messages || messages.length === 0) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { role?: string; content?: unknown }
    if (message?.role !== 'assistant') continue
    const text = textFromContent(message.content)
    if (text.trim().length > 0) return text
  }
  return ''
}

/**
 * Extract the final answer from a completed RunState. Prefers the run output
 * (lastMessage/allMessages), then the full session message history.
 */
export function extractFinalAnswer(runState: RunState): string {
  const output = runState.output
  if (output) {
    if (output.type === 'lastMessage' || output.type === 'allMessages') {
      const fromOutput = lastAssistantText(output.value as unknown[])
      if (fromOutput) return fromOutput
    }
    if (output.type === 'structuredOutput' && output.value) {
      const value = output.value as Record<string, unknown>
      if (typeof value.message === 'string' && value.message.trim()) {
        return value.message
      }
      if (typeof value.summary === 'string' && value.summary.trim()) {
        return value.summary
      }
    }
  }
  return lastAssistantText(
    runState.sessionState?.mainAgentState?.messageHistory as
      unknown[] | undefined,
  )
}

/**
 * Run a single prompt headlessly through the SDK and return the outcome. This
 * never enters the TUI and never hangs: a run that exceeds the timeout aborts
 * with an error result.
 */
export async function runHeadlessPrint(
  params: HeadlessRunParams,
): Promise<HeadlessRunResult> {
  const { prompt, agentId, allowedTools, continueChat, continueId } = params
  const timeoutMs =
    params.timeoutMs ?? resolveRunTimeoutMs(process.env[RUN_TIMEOUT_ENV])

  if (!prompt || prompt.trim().length === 0) {
    return {
      exitCode: HEADLESS_EXIT_USAGE,
      error:
        '--print requires a prompt (positional argument, --prompt-file, or piped stdin)',
    }
  }

  const client = params.getClient
    ? await params.getClient()
    : await getSavantCodeClient({ headless: true })
  if (!client) {
    return {
      exitCode: HEADLESS_EXIT_ERROR,
      error:
        'Failed to initialize the SDK client. Set a provider key (e.g. OPENROUTER_API_KEY) or run the login flow first.',
    }
  }

  const agentDefinitions = params.agentDefinitions ?? loadAgentDefinitions()
  // FID-2026-0814-004 H-12: every headless run resolves the SAME way — the
  // model always comes from the UI model store (resolveActiveModel via
  // applySavantCodeModelOverride). The `resolvedAgent` DI escape hatch only
  // supplies the agent *shape* (definition/id); the model is still overridden
  // so a headless run can never bill a bundled paid default.
  const resolved: AgentDefinition | string =
    params.resolvedAgent ?? resolveAgent('HYBRID', agentId, agentDefinitions)
  const overridden = applySavantCodeModelOverride(resolved, agentDefinitions)
  // FID-062: a delegating parent can pin the child's tool surface via
  // --allowed-tools. Filtering (never extending) the resolved agent's
  // toolNames keeps this a restriction: the union of tools can only shrink,
  // so the flag cannot grant a tool the agent does not already have. The
  // model is steered away from excluded tools by the runtime's standard
  // restricted-tool error → user-message conversion (survivable, unlike a
  // sandbox crash). Ignored when it would be a no-op or empty. Applied AFTER
  // the model override — applySavantCodeModelOverride re-spreads the registry
  // definition, which would otherwise discard this filter.
  let agent: AgentDefinition | string = overridden
  if (typeof agent === 'object' && allowedTools?.trim()) {
    const allow = new Set(
      allowedTools
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    )
    if (allow.size > 0) {
      agent = {
        ...agent,
        toolNames: (agent.toolNames ?? []).filter((t) => allow.has(t)),
      }
    }
  }

  let previousRun: RunState | undefined = params.previousRun
  if (previousRun === undefined && continueChat) {
    const saved = loadMostRecentChatState(continueId ?? undefined)
    previousRun = saved?.runState ?? undefined
  }

  const abortController = new AbortController()
  const timeoutSeconds = Math.round(timeoutMs / 1000)
  const timer = setTimeout(() => {
    abortController.abort(new Error(`Run timed out after ${timeoutSeconds}s`))
  }, timeoutMs)
  if (typeof timer.unref === 'function') timer.unref()

  try {
    const runState = await client.run({
      agent,
      prompt,
      agentDefinitions,
      previousRun,
      signal: abortController.signal,
      // Headless runs are scripted — never pause for interactive approval.
      permissionMode: 'safe',
      // Harness contract (ECHO.md) for headless runs — the single-agent
      // variant is an SDK opt-in for outside agents, not the CLI default
      // (operator directive 2026-08-10).
      protocolVariant: 'harness',
      devMode: false,
      // FID-062: observe error events instead of aborting on them. The SDK's
      // default handleEvent throws on error-type events, and safeDispatch
      // turns a throwing handler into a full run rejection — so one
      // survivable tool-level denial (sandbox deny in safe mode, a
      // restricted-tool error) kills the entire run even though the runtime
      // has already converted it into a user message the model can
      // self-correct from. Interactive sessions pass a real handler and
      // survive the same denials; headless must not be stricter than the TUI.
      // The run's real outcome still comes from runState.output below.
      handleEvent: (event) => {
        if (event.type === 'error') {
          // eslint-disable-next-line no-console -- headless diagnostics go to stderr
          console.error(`[savant-code] ${event.message}`)
        }
      },
    })

    const output = runState.output
    if (output?.type === 'error') {
      return {
        exitCode: HEADLESS_EXIT_ERROR,
        error: output.message,
      }
    }

    const answer = extractFinalAnswer(runState)
    const display =
      answer.length > 0 && !answer.endsWith('\n') ? answer + '\n' : answer
    return {
      exitCode: HEADLESS_EXIT_OK,
      output: process.stdout.isTTY ? display : stripAnsi(display),
    }
  } catch (error) {
    return {
      exitCode: HEADLESS_EXIT_ERROR,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}
