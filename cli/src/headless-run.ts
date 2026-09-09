import stripAnsi from 'strip-ansi'

import { extractFinalAnswer } from './headless-answer'
import {
  createHeadlessControlPlane,
  PARENT_CANCEL_REASON,
} from './headless-control-plane'
import {
  createNdjsonEmitter,
  type ControlInputStream,
  type FrameWriter,
} from './headless-ndjson'
import { createHeadlessEventTap } from './headless-ndjson-tap'
import {
  applySavantCodeModelOverride,
  resolveAgent,
} from './hooks/helpers/send-message-agent'
import { loadAgentDefinitions } from './utils/local-agent-registry'
import { loadMostRecentChatState } from './utils/run-state-storage'
import { getSavantCodeClient } from './utils/savant-code-client'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentDefinition,
  RunState,
  SavantCodeClient,
} from '@savant-code/sdk'

/**
 * FID-2026-0806-011 — headless / non-interactive run mode.
 * Contract (conventional exit codes):
 *   - 0 = run completed with a final answer (printed to stdout)
 *   - 1 = run errored or timed out (message on stderr)
 *   - 2 = usage error (no prompt provided)
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
  /** FID-2026-0907-004/-005: NDJSON frames — progress taps, artifact at the
   *  answer, error frames; dispatch suppresses the raw write. Unset → v1. */
  jsonMode?: boolean
  /** Injectable frame writer (DI); defaults to `process.stdout.write`. */
  jsonFrameWriter?: FrameWriter
  /** FID-2026-0907-006: injectable control input; defaults to process.stdin. */
  jsonControlInput?: ControlInputStream
}

export type HeadlessRunResult = {
  exitCode: number
  /** Final answer text — present on success. */
  output?: string
  /** Error message — present on failure. */
  error?: string
  /** FID-2026-0907-006: steer notes accepted + parked at control boundaries
   *  (applied to the run in Phase C). Present only when notes were parked. */
  parkedSteerNotes?: string[]
}

export function resolveRunTimeoutMs(envValue: string | undefined): number {
  if (!envValue) return DEFAULT_RUN_TIMEOUT_MS
  const parsed = Number(envValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RUN_TIMEOUT_MS
  return parsed
}

// FID-2026-0907-006: the answer-extraction helpers moved verbatim to
// headless-answer.ts (300-line ceiling; Law 13 re-export hub). The external
// import surface (headless-run.test.ts) is preserved by re-exporting.
export { extractFinalAnswer }

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

  // FID-2026-0907-005: the emitter is hoisted above EVERY exit boundary so
  // usage and init failures can frame too (FID-004 had scoped it after the
  // client init). JSON mode only — non-JSON runs never create it, so they
  // stay byte-identical to v1 by construction.
  const jsonEmitter = params.jsonMode
    ? createNdjsonEmitter({
        // NDJSON wire contract: every frame is ONE line terminated by \n.
        // The default stdout writer owns the delimiter — the handoff matrix
        // (FID-2026-0907-007, case 1, live) caught two frames glued onto a
        // single stdout line here, which the parent's line reader cannot
        // parse. Injected writers (tests, delegation) keep receiving the
        // raw serialized frame.
        write:
          params.jsonFrameWriter ??
          ((line) => process.stdout.write(`${line}\n`)),
      })
    : undefined
  const jsonTap = jsonEmitter ? createHeadlessEventTap(jsonEmitter) : undefined
  const parkedSteerNotes: string[] = []
  /** Frame the failure, shape the nonzero result (BO rules 4-5: error
   *  frames are non-fatal diagnostics; the exit code owns the verdict). */
  const failWith = (exitCode: number, error: string): HeadlessRunResult => {
    jsonEmitter?.emitError(error)
    return {
      exitCode,
      error,
      ...(parkedSteerNotes.length > 0 ? { parkedSteerNotes } : {}),
    }
  }

  if (!prompt || prompt.trim().length === 0) {
    return failWith(
      HEADLESS_EXIT_USAGE,
      '--print requires a prompt (positional argument, --prompt-file, or piped stdin)',
    )
  }

  const client = params.getClient
    ? await params.getClient()
    : await getSavantCodeClient({ headless: true })
  if (!client) {
    return failWith(
      HEADLESS_EXIT_ERROR,
      'Failed to initialize the SDK client. Set a provider key (e.g. OPENROUTER_API_KEY) or run the login flow first.',
    )
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
  // FID-062: --allowed-tools FILTERS the resolved agent's toolNames (never
  // extends; the model is steered off excluded tools by the standard
  // restricted-tool error conversion). Applied AFTER the model override,
  // which re-spreads the registry definition and would discard the filter.
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

  // FID-2026-0907-006/-007: the run-side control plane — ARRIVAL-time cancel
  // abort (a held LLM request yields no stream boundaries), boundary drain,
  // steer parking. Non-JSON runs never create one (byte-identical v1).
  const controlPlane = jsonEmitter
    ? createHeadlessControlPlane({
        input: params.jsonControlInput ?? process.stdin,
        abortController,
        parkedSteerNotes,
      })
    : undefined

  // FID-2026-0907-004: the tap is composed additively into handleEvent so
  // the pre-existing error-event stderr logging is preserved untouched
  // (tap, don't fork). FID-005: error events additionally emit a non-fatal
  // error frame — the deferral recorded in the FID-004 suite.

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
      // default handleEvent throws on error-type events and safeDispatch turns
      // a throwing handler into a full run rejection, so one survivable
      // tool-level denial (sandbox deny, restricted-tool error) kills the run
      // even though the runtime already converted it into a self-correctable
      // user message; interactive sessions survive the same denials and
      // headless must not be stricter. The real outcome comes from runState.
      // FID-2026-0907-007 (live matrix case 4): the SECOND stream lane —
      // per content delta, so mid-stream cancels drain within the grace
      // window even when the model never finishes its response.
      handleStreamChunk: () => {
        controlPlane?.drain()
      },
      handleEvent: (event: PrintModeEvent) => {
        // FID-2026-0907-006 (BO Phase 2): drain parent→child control frames
        // at the step boundary BEFORE the tap — the child's observable
        // per-step yield. cancel → cooperative abort (throw path frames the
        // rule-4 error; exits per the existing run-loop policy; the parent
        // owns the verdict); steer → accepted + parked (Phase C applies);
        // unknown / v≠1 / malformed lines are skipped by the FID-003 parser.
        if (controlPlane?.drain() === true) return
        jsonTap?.(event)
        if (event.type === 'error') {
          jsonEmitter?.emitError(event.message)
          // eslint-disable-next-line no-console -- headless diagnostics go to stderr
          console.error(`[savant-code] ${event.message}`)
        }
      },
    })

    const output = runState.output
    if (output?.type === 'error') {
      // Case 4 (live): frame the parent reason, not the SDK's generic
      // cancellation message, when THIS child consumed the cancel frame.
      return failWith(
        HEADLESS_EXIT_ERROR,
        controlPlane?.isCancelled() === true
          ? PARENT_CANCEL_REASON
          : output.message,
      )
    }

    const answer = extractFinalAnswer(runState)
    const display =
      answer.length > 0 && !answer.endsWith('\n') ? answer + '\n' : answer
    const finalAnswer = process.stdout.isTTY ? display : stripAnsi(display)
    // FID-005 (BO rule 3): exactly one artifact frame per run, at the answer
    // point — data.output IS the --print answer; in JSON mode this frame, not
    // raw stdout, is the parent's answer channel (dispatch suppresses the raw
    // write). FID-006: a run resolving after a drained cancel (completion
    // race) emits NO artifact — no frames after the ack (parent owns verdict).
    if (!(controlPlane?.isCancelled() ?? false)) {
      jsonEmitter?.emitArtifact(finalAnswer)
    }
    return {
      exitCode: HEADLESS_EXIT_OK,
      output: finalAnswer,
      ...(parkedSteerNotes.length > 0 ? { parkedSteerNotes } : {}),
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    // Case 4 (live): the parent-authored reason outranks the SDK's generic
    // cancellation message when THIS child consumed the cancel frame.
    return failWith(
      HEADLESS_EXIT_ERROR,
      controlPlane?.isCancelled() === true ? PARENT_CANCEL_REASON : raw,
    )
  } finally {
    clearTimeout(timer)
  }
}
