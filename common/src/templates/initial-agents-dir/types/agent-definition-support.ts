import type { ToolName, GetToolParams } from './tools'
import type { Message, Logger, JSONValue } from './util-types'

export type { ToolName, GetToolParams }

// ============================================================================
// Supporting Types
// ============================================================================

export interface AgentState {
  agentId: string
  runId?: string
  parentId?: string

  /** The agent's conversation history: messages from the user and the assistant. */
  messageHistory: Message[]

  /** The last value set by the set_output tool. This is a plain object or undefined if not set. */
  output?: Record<string, JSONValue>

  /** The system prompt for this agent. */
  systemPrompt: string

  /** The tool definitions for this agent. */
  toolDefinitions: Record<
    string,
    { description: string | undefined; inputSchema: JSONValue }
  >

  /**
   * The token count from the Anthropic API.
   * This is updated on every agent step via the /api/v1/token-count endpoint.
   */
  contextTokenCount: number

  /**
   * FID-2026-0725-085: Resolved context window for this model.
   * Set by the CLI via CTX-007 wiring. Used by handleSteps to determine
   * when to trigger context-pruner spawning (auto-compact Layer 3).
   * Falls back to hardcoded defaults if not set.
   */
  maxContextLength?: number

  /**
   * FID-2026-0813-023/0814-001: live compaction status (read by the CLI
   * heartbeat from the snapshot's mainAgentState). Written by the serialized
   * savant handleSteps (compacting) and the runtime spawn boundary
   * (pruned/warning); phases: idle, compacting, compacted (micro), pruned
   * (full context-pruner summarization), warning.
   */
  compactionStatus?: {
    /**
     * FID-2026-0821-001 P0-1/P0-2: extended with the runtime-emitted
     * terminal phases. Structural twin of the canonical CompactionStatus in
     * `common/src/types/session-state.ts` — this template file stays
     * dependency-free by design, so keep the unions in sync when either
     * side changes.
     */
    phase:
      | 'idle'
      | 'compacting'
      | 'compacted'
      | 'pruned'
      | 'warning'
      | 'ineffective'
      | 'blocked'
    percentUsed?: number
    tokensSaved?: number
    /** Present iff phase === 'blocked'. Twin of CompactionBlockReason. */
    blockReason?:
      | 'circuit-breaker-open'
      | 'cooldown'
      | 'escalation-hold'
      | 'pruner-unavailable'
      | 'compaction-disabled'
  }

  /**
   * FID-2026-0814-001: wall-clock stamp of the last context-pruner
   * completion. The serialized savant handleSteps reads it to back off the
   * proactive 0.8 spawn during a cooldown after an ineffective run.
   */
  lastPrunerCompletionAt?: number

  /**
   * FID-2026-0814-011: single trigger authority for auto-compaction. Set
   * every step by the runtime from the proven `shouldAutoCompact` verdict
   * and consumed by the serialized savant handleSteps so the context-pruner
   * spawn fires exactly when the warning path fires — the generator's own
   * ratio arithmetic is only a fallback.
   */
  autoCompactDue?: boolean

  /**
   * FID-2026-0821-005 A10: one-shot terminal-output excerpt parked by this
   * handleSteps and injected beside the summarizer STEP_PROMPT by
   * run-agent-step/step.ts (consume-once). Structural twin of the canonical
   * optional `relayDigest` in `common/src/types/session-state.ts` — this
   * template file stays dependency-free by design, so keep both sides in
   * sync when either changes.
   */
  relayDigest?: string
}

/**
 * Context provided to handleSteps generator function
 */
export interface AgentStepContext {
  agentState: AgentState
  prompt?: string
  params?: Record<string, JSONValue>
  logger: Logger
}

export type StepText = { type: 'STEP_TEXT'; text: string }
export type GenerateN = { type: 'GENERATE_N'; n: number }

/**
 * Tool call object for handleSteps generator
 */
export type ToolCall<T extends ToolName = ToolName> = {
  [K in T]: {
    toolName: K
    input: GetToolParams<K>
    includeToolCall?: boolean
  }
}[T]

// ============================================================================
// Available Tools
// ============================================================================

/**
 * File operation tools
 */
export type FileEditingTools = 'read_files' | 'write_file' | 'str_replace'

/**
 * Code analysis tools
 */
export type CodeAnalysisTools = 'code_search' | 'find_files' | 'read_files'

/**
 * Terminal and system tools
 */
export type TerminalTools = 'run_terminal_command' | 'code_search'

/**
 * Web and browser tools
 */
export type WebTools = 'web_search' | 'read_docs' | 'read_url'

/**
 * Agent management tools
 */
export type AgentTools = 'spawn_agents'

/**
 * Output and control tools
 */
export type OutputTools = 'set_output'
