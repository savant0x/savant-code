import type { Sandbox } from './sandbox'
import type { TaskDefinition } from './schema'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { CustomToolDefinition, RunState } from '@savant-code/sdk'

/**
 * ECHO phases that the harness tracks.
 * The unknown value is used when a phase has not been observed yet.
 */
export type EchoPhase =
  'idle' | 'red' | 'green' | 'audit' | 'self_correct' | 'complete' | 'unknown'

/**
 * A fault injected by the harness to test agent resilience.
 */
export interface RunFault {
  type: 'tool_failure' | 'network_failure' | 'env_fault'
  message: string
  /** For tool_failure, the tool that should fail. */
  targetTool?: string
}

/**
 * A single event captured during a benchmark run.
 */
export type TraceEvent =
  | {
      type: 'print'
      raw: PrintModeEvent
    }
  | {
      type: 'phase_transition'
      from: EchoPhase
      to: EchoPhase
      toolCallId?: string
    }
  | {
      type: 'subagent_chunk'
      agentId: string
      agentType: string
      chunk: string
    }
  | {
      type: 'reasoning_chunk'
      agentId: string
      ancestorRunIds: string[]
      chunk: string
    }
  | {
      type: 'interactive_prompt'
      request: string
    }
  | {
      type: 'fault_injected'
      fault: RunFault
    }

export interface TraceMetadata {
  /** Wall-clock duration of the run in milliseconds. */
  duration_ms?: number
  /** Total number of PrintMode events captured. */
  total_steps: number
  /** Number of subagent spawns observed. */
  subagent_count: number
  /** Number of tool calls observed. */
  tool_call_count: number
  /** Number of phase transitions observed. */
  phase_transition_count: number
  /** Final phase reached by the agent (unknown if never observed). */
  final_phase: EchoPhase
  /** Credits used (if the runtime reports them). */
  credits_used?: number
  /** Direct credits used (if the runtime reports them). */
  direct_credits_used?: number
  /** Context token count at the end of the run (if available). */
  context_token_count?: number
  /** Approximate cost in USD, derived from credits (1 credit = $0.01). */
  cost_usd?: number
}

/**
 * The canonical trace document produced by a benchmark run.
 */
export interface TraceDocument {
  task_id: string
  run_id: string
  started_at: string
  finished_at?: string
  events: TraceEvent[]
  final_state?: RunState
  current_phase: EchoPhase
  metadata: TraceMetadata
}

export interface RunnerConfig {
  task: TaskDefinition
  sandbox: Sandbox
  /** API key for the Savant backend. Optional when using a mock runner. */
  apiKey?: string
  /** Agent or agent ID to run. Defaults to 'savant'. */
  agentId?: string
  /** Maximum agent steps allowed for a single run. */
  maxAgentSteps?: number
  /** Environment variables merged over the sandbox defaults. */
  env?: Record<string, string>
  /** Custom tools exposed to the agent. */
  customToolDefinitions?: CustomToolDefinition[]
  /** Initial project files for the agent context. */
  projectFiles?: Record<string, string>
  /** Optional steering/drain messages for interactive runs. */
  drainSteeringMessages?: () => string[]
}

/**
 * Unified interface for running an agent against a benchmark task.
 *
 * Implementations exist for the Savant SDK and, in the future, external
 * CLI agents such as Claude Code, Codex, or OpenCode.
 */
export interface AgentRunner {
  /** Bind the runner to a task and sandbox. */
  initialize(config: RunnerConfig): Promise<void>
  /** Execute the prompt and return the final run state. */
  executePrompt(prompt: string): Promise<RunState>
  /** Return the collected trace. */
  collectTrace(): TraceDocument
  /** Respond to an interactive prompt from the agent. */
  handleInteractivePrompt(request: string): Promise<string>
  /** Inject a deterministic fault into the run environment. */
  injectFault(fault: RunFault): Promise<void>
}
