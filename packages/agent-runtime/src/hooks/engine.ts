import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import { runDenyMutatingTerminal } from './deny-mutating-terminal'
import { runExperienceCapture } from './experience-capture'
import { runExposureCapture } from './exposure-capture'
import { runHookCommand } from './runner'

import type { HookInputData, HookRunResult } from './types'
import type {
  ExperienceErrorClass,
  ExperienceExpectedness,
} from '@savant-code/common/types/experience'
import type { HookConfig, HookEvent } from '@savant-code/common/types/hooks'
import type { JSONValue } from '@savant-code/common/types/json'
import type { CommandExecutionMetadata } from '@savant-code/common/util/command-execution'

/**
 * FID-2026-0814-003 — hook engine: per-event matching, parallel execution,
 * block aggregation, and the cached project-scoped factory.
 *
 * - `triggerBlock` runs matching hooks in parallel and aggregates: ANY hook
 *   that blocks blocks the action; failures fail-open.
 * - `fireAndForgetTrigger` is the observation path — every event except
 *   `PreToolUse`: it never blocks and never throws. As of FID-2026-0919-031 that
 *   is the session/subagent/compaction/terminal set (`SessionStart`,
 *   `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`,
 *   `Stop`, `Interrupt`, `Notification`) plus the post-tool events; see
 *   `FIRED_HOOK_EVENTS` in `common/src/types/hooks.ts` for the authority.
 * - FID-2026-0824-012: configs declaring a builtin `action` dispatch to the
 *   in-process sink (experience-capture) instead of spawning a process.
 * - The factory caches one engine per project cwd (same precedent as the
 *   transition-phase max-iterations cache); tests construct engines directly.
 */

/**
 * Dispatch one hook config: builtin in-process actions run in-process
 * (no spawn); everything else is the external-command runner. Never throws.
 */
export function runHook(
  config: HookConfig,
  input: HookInputData,
  failureCaptureConfigured = false,
) {
  if (config.action === 'experience-capture') {
    return Promise.resolve(runExperienceCapture(input))
  }
  if (config.action === 'exposure-capture') {
    // FID-2026-1012-024: the success-side sink. Fail-open like every other
    // observation hook; the caller's catch keeps it from affecting execution.
    return Promise.resolve(runExposureCapture(input, failureCaptureConfigured))
  }
  if (config.action === 'deny-mutating-terminal') {
    // FID-2026-1001-003 step 1: in-process deny sink; the engine's catch
    // wrapper keeps it fail-open.
    return Promise.resolve(runDenyMutatingTerminal(input))
  }
  return runHookCommand(config, input)
}

export type HookTriggerResult = {
  blocked: boolean
  reasons: string[]
  /** Individual run results (observability). */
  runs: HookRunResult[]
}

/** Distinct builtins must not collapse onto their absent command field. */
function dedupeHooks(configs: readonly HookConfig[]): HookConfig[] {
  const seen = new Set<string>()
  return configs.filter((config) => {
    const key = JSON.stringify([
      config.cwd ?? '',
      config.action === undefined ? 'command' : 'action',
      config.action ?? config.command,
    ])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export class HookEngine {
  private readonly configs: HookConfig[]

  constructor(configs: HookConfig[]) {
    this.configs = configs
  }

  /** Hooks declared for the event, optionally filtered by tool matcher. */
  getHooksFor(event: HookEvent, toolName?: string): HookConfig[] {
    return this.configs.filter((config) => {
      if (config.event !== event) return false
      if (toolName === undefined) return true
      if (config.matcher === undefined) return true
      try {
        return new RegExp(config.matcher).test(toolName)
      } catch {
        // An invalid matcher pattern never matches (fail-safe).
        return false
      }
    })
  }

  hasHooks(event: HookEvent): boolean {
    return this.configs.some((config) => config.event === event)
  }

  /** Run matching hooks in parallel; aggregate blocks. Never throws. */
  async triggerBlock(input: HookInputData): Promise<HookTriggerResult> {
    const hooks = dedupeHooks(
      this.getHooksFor(input.hook_event_name, input.tool_name),
    )
    if (hooks.length === 0) {
      return { blocked: false, reasons: [], runs: [] }
    }
    const failureCaptureConfigured = dedupeHooks(
      this.getHooksFor('PostToolUseFailure', input.tool_name),
    ).some((config) => config.action === 'experience-capture')
    const results = await Promise.all(
      hooks.map((config) =>
        runHook(config, input, failureCaptureConfigured).catch(
          (error): HookRunResult => ({
            outcome: 'allowed',
            spawnError: error instanceof Error ? error.message : String(error),
          }),
        ),
      ),
    )
    const blocked = results.filter((r) => r.outcome === 'blocked')
    return {
      blocked: blocked.length > 0,
      reasons: blocked
        .map((r) => r.reason)
        .filter((reason): reason is string => Boolean(reason)),
      runs: results,
    }
  }

  /** Observation path: fire and forget, never blocks, never throws. */
  fireAndForgetTrigger(input: HookInputData): void {
    if (!this.hasHooks(input.hook_event_name)) return
    void this.triggerBlock(input).catch(() => {
      // Observational hooks must never affect execution.
    })
  }
}

/** Payload builder shared by the wiring sites. */
export function buildHookInput(params: {
  event: HookEvent
  sessionId: string
  cwd: string
  toolName?: string
  toolInput?: Record<string, JSONValue>
  toolResult?: JSONValue
  errorMessage?: string
  errorClass?: ExperienceErrorClass
  expectedness?: ExperienceExpectedness
  argumentsTruncated?: boolean
  finishReason?: string
  subagentType?: string
  /** FID-2026-1012-023: narrowed identity of a failed command execution. */
  commandExecution?: CommandExecutionMetadata
}): HookInputData {
  return {
    hook_event_name: params.event,
    session_id: params.sessionId,
    cwd: params.cwd,
    ...(params.toolName !== undefined ? { tool_name: params.toolName } : {}),
    ...(params.toolInput !== undefined ? { tool_input: params.toolInput } : {}),
    ...(params.toolResult !== undefined
      ? { tool_result: params.toolResult }
      : {}),
    ...(params.errorMessage !== undefined
      ? { error_message: params.errorMessage }
      : {}),
    ...(params.errorClass !== undefined
      ? { error_class: params.errorClass }
      : {}),
    ...(params.expectedness !== undefined
      ? { expectedness: params.expectedness }
      : {}),
    ...(params.argumentsTruncated !== undefined
      ? { arguments_truncated: params.argumentsTruncated }
      : {}),
    ...(params.finishReason !== undefined
      ? { finish_reason: params.finishReason }
      : {}),
    ...(params.subagentType !== undefined
      ? { subagent_type: params.subagentType }
      : {}),
    ...(params.commandExecution !== undefined
      ? { command_execution: params.commandExecution }
      : {}),
  }
}

const engineCache = new Map<string, HookEngine>()

/**
 * Get (or create) the project-scoped hook engine for a cwd. Cached per cwd —
 * the same precedent as the transition-phase max-iterations cache. Pass
 * `refresh: true` to re-read `protocol.config.yaml` (tests, config edits).
 */
export function getHookEngine(
  cwd: string,
  options?: { refresh?: boolean },
): HookEngine {
  let engine = engineCache.get(cwd)
  if (!engine || options?.refresh) {
    engine = new HookEngine(readProtocolConfig(cwd).hooks)
    engineCache.set(cwd, engine)
  }
  return engine
}

/**
 * Test isolation: clears the per-cwd hook-engine cache — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002).
 */
export function resetEngineCache(): void {
  engineCache.clear()
}
