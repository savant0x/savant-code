import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import { runHookCommand } from './runner'

import type { HookInputData, HookRunResult } from './types'
import type { HookConfig, HookEvent } from '@savant-code/common/types/hooks'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0814-003 — hook engine: per-event matching, parallel execution,
 * block aggregation, and the cached project-scoped factory.
 *
 * - `triggerBlock` runs matching hooks in parallel and aggregates: ANY hook
 *   that blocks blocks the action; failures fail-open.
 * - `fireAndForgetTrigger` is the observation path (session/subagent/compact
 *   events, PostToolUse): it never blocks and never throws.
 * - The factory caches one engine per project cwd (same precedent as the
 *   transition-phase max-iterations cache); tests construct engines directly.
 */

export type HookTriggerResult = {
  blocked: boolean
  reasons: string[]
  /** Individual run results (observability). */
  runs: HookRunResult[]
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
    let hooks = this.getHooksFor(input.hook_event_name, input.tool_name)
    // Dedupe identical (cwd + command) declarations WITHIN a single trigger so
    // one command runs once per event; the same command declared for a
    // different event still fires for that event.
    const seen = new Set<string>()
    hooks = hooks.filter((config) => {
      const key = `${config.cwd ?? ''}|${config.command}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (hooks.length === 0) {
      return { blocked: false, reasons: [], runs: [] }
    }
    const results = await Promise.all(
      hooks.map((config) =>
        runHookCommand(config, input).catch((error): HookRunResult => ({
          outcome: 'allowed',
          spawnError: error instanceof Error ? error.message : String(error),
        })),
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
  subagentType?: string
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
    ...(params.subagentType !== undefined
      ? { subagent_type: params.subagentType }
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
