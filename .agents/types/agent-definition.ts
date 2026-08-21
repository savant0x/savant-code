/**
 * SavantCode Agent Type Definitions
 *
 * This file provides TypeScript type definitions for creating custom SavantCode agents.
 * Import these types in your agent files to get full type safety and IntelliSense.
 *
 * Usage in .agents/your-agent.ts:
 *   import { AgentDefinition, ToolName, ModelName } from './types/agent-definition'
 *
 *   const definition: AgentDefinition = {
 *     // ... your agent configuration with full type safety ...
 *   }
 *
 *   export default definition
 */

// ============================================================================
// Agent Definition and Utility Types
// ============================================================================

export interface AgentDefinition {
  /** Unique identifier for this agent. Must contain only lowercase letters, numbers, and hyphens, e.g. 'code-reviewer' */
  id: string

  /** Version string (if not provided, will default to '0.0.1' and be bumped on each publish) */
  version?: string

  /** Publisher ID for the agent. Must be provided if you want to publish the agent. */
  publisher?: string

  /** Human-readable name for the agent */
  displayName: string

  /** AI model to use for this agent. Can be any model in OpenRouter: https://openrouter.ai/models */
  model: ModelName

  /**
   * https://openrouter.ai/docs/use-cases/reasoning-tokens
   * One of `max_tokens` or `effort` is required.
   * If `exclude` is true, reasoning will be removed from the response. Default is false.
   */
  reasoningOptions?: {
    enabled?: boolean
    exclude?: boolean
  } & (
    | {
        max_tokens: number
      }
    | {
        effort: 'high' | 'medium' | 'low' | 'minimal' | 'none'
      }
  )

  /** Provider routing options for OpenRouter. */
  providerOptions?: ProviderOptions

  // ============================================================================
  // Tools and Subagents
  // ============================================================================

  /** MCP servers by name. Names cannot contain `/`. */
  mcpServers?: Record<string, MCPConfig>

  /**
   * Tools this agent can use.
   *
   * By default, all tools are available from any specified MCP server. In
   * order to limit the tools from a specific MCP server, add the tool name(s)
   * in the format `'mcpServerName/toolName1'`, `'mcpServerName/toolName2'`,
   * etc.
   */
  toolNames?: (ToolName | (string & {}))[]

  /**
   * Tools only the handleSteps generator may call — not model-visible. Keeps
   * programmatic capability declarations honest (FID-2026-0803-001 ECHO-2).
   */
  programmaticToolNames?: (ToolName | (string & {}))[]

  /** Other agents this agent can spawn, like 'savant-code/scout@0.0.1'.
   *
   * Use the fully qualified agent id from the agent store, including publisher and version: 'savant-code/scout@0.0.1'
   * (publisher and version are required!)
   *
   * Or, use the agent id from a local agent file in your .agents directory: 'scout'.
   */
  spawnableAgents?: string[]

  // ============================================================================
  // Input and Output
  // ============================================================================

  /** The input schema required to spawn the agent. Provide a prompt string and/or a params object or none.
   * 80% of the time you want just a prompt string with a description:
   * inputSchema: {
   *   prompt: { type: 'string', description: 'A description of what info would be helpful to the agent' }
   * }
   */
  inputSchema?: {
    prompt?: JsonStringSchema
    params?: JsonObjectSchema
  }

  /** How the agent should output a response to its parent (defaults to 'last_message')
   *
   * last_message: The last message from the agent, typically after using tools.
   *
   * all_messages: All messages from the agent, including tool calls and results.
   *
   * structured_output: Make the agent output a JSON object. Can be used with outputSchema or without if you want freeform json output.
   */
  outputMode?: 'last_message' | 'all_messages' | 'structured_output'

  /** JSON schema for structured output (when outputMode is 'structured_output') */
  outputSchema?: JsonObjectSchema

  // ============================================================================
  // Prompts
  // ============================================================================

  /** Prompt for when and why to spawn this agent. Include the main purpose and use cases.
   *
   * This field is key if the agent is intended to be spawned by other agents. */
  spawnerPrompt?: string

  /** Whether to include conversation history from the parent agent in context.
   *
   * Defaults to false.
   * Use this when the agent needs to know all the previous messages in the conversation.
   */
  includeMessageHistory?: boolean

  /** Whether to inherit the parent agent's model instead of using this agent's own model.
   *
   * Defaults to true.
   * Set to false when this agent must always run on a specific model.
   */
  inheritParentModel?: boolean

  /** Whether to inherit the parent agent's system prompt instead of using this agent's own systemPrompt.
   *
   * Defaults to false.
   * Use this when you want to enable prompt caching by preserving the same system prompt prefix.
   * Cannot be used together with the systemPrompt field.
   */
  inheritParentSystemPrompt?: boolean

  /** Background information for the agent. Fairly optional. Prefer using instructionsPrompt for agent instructions. */
  systemPrompt?: string

  /** Instructions for the agent.
   *
   * IMPORTANT: Updating this prompt is the best way to shape the agent's behavior.
   * This prompt is inserted after each user input. */
  instructionsPrompt?: string

  /** Prompt inserted at each agent step.
   *
   * Powerful for changing the agent's behavior, but usually not necessary for smart models.
   * Prefer instructionsPrompt for most instructions. */
  stepPrompt?: string

  // ============================================================================
  // Handle Steps
  // ============================================================================

  /** Programmatically step the agent forward and run tools.
   *
   * You can either yield:
   * - A tool call object with toolName and input properties.
   * - 'STEP' to run agent's model and generate one assistant message.
   * - 'STEP_ALL' to run the agent's model until it uses the end_turn tool or stops includes no tool calls in a message.
   *
   * Or use 'return' to end the turn.
   *
   * Example 1:
   * function* handleSteps({ agentState, prompt, params, logger }) {
   *   logger.info('Starting file read process')
   *   const { toolResult } = yield {
   *     toolName: 'read_files',
   *     input: { paths: ['file1.txt', 'file2.txt'] }
   *   }
   *   yield 'STEP_ALL'
   *
   *   // Optionally do a post-processing step here...
   *   logger.info('Files read successfully, setting output')
   *   yield {
   *     toolName: 'set_output',
   *     input: {
   *       output: 'The files were read successfully.',
   *     },
   *   }
   * }
   *
   * Example 2:
   * handleSteps: function* ({ agentState, prompt, params, logger }) {
   *   while (true) {
   *     logger.debug('Spawning thinker agent')
   *     yield {
   *       toolName: 'spawn_agents',
   *       input: {
   *         agents: [
   *         {
   *           agent_type: 'thinker',
   *           prompt: 'Think deeply about the user request',
   *         },
   *       ],
   *     },
   *   }
   *   const { stepsComplete } = yield 'STEP'
   *   if (stepsComplete) break
   * }
   * }
   */
  handleSteps?:
    | string
    | ((context: AgentStepContext) => Generator<
        ToolCall | 'STEP' | 'STEP_ALL' | StepText | GenerateN,
        void,
        {
          agentState: AgentState
          toolResult: ToolResultOutput[] | undefined
          stepsComplete: boolean
          nResponses?: string[]
        }
      >)
}

import type {
  AgentState,
  AgentStepContext,
  GenerateN,
  StepText,
  ToolCall,
} from './agent-runtime'
import type { ModelName } from './model-name'
import type { ProviderOptions } from './provider-options'
import type { ToolName } from './tools'
import type {
  JsonObjectSchema,
  JsonStringSchema,
  MCPConfig,
  ToolResultOutput,
} from './util-types'

export type { AgentState, AgentStepContext, GenerateN, StepText, ToolCall }
export type {
  AgentTools,
  CodeAnalysisTools,
  FileEditingTools,
  OutputTools,
  TerminalTools,
  WebTools,
} from './available-tools'
export type { ModelName } from './model-name'
export type { ProviderOptions } from './provider-options'
export type { ToolName }
