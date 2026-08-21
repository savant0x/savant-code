import type { ToolName, GetToolParams } from './tools'
import type { JSONValue, Logger, Message } from './util-types'

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
