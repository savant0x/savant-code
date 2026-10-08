import { SavantCodeClient } from '@savant-code/sdk'

import { TraceCollector } from '../trace'

import type {
  AgentRunner,
  RunnerConfig,
  RunFault,
  TraceDocument,
  UsageSample,
} from '../runner'
import type { AgentDefinition } from '@savant-code/sdk'
import type { Sandbox } from '../sandbox'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

export interface SavantAgentRunnerConfig extends RunnerConfig {
  /**
   * Optional injected SavantCodeClient for testing. If omitted, a real client
   * is constructed with no credential (FID-2026-0929-005: the SDK client has
   * no apiKey surface — inference keys come from the environment).
   */
  savantClient?: Pick<SavantCodeClient, 'run'>
}

/**
 * Savant SDK implementation of the benchmark AgentRunner.
 *
 * Streams every PrintModeEvent and stream chunk into a structured trace,
 * derives ECHO phase transitions by watching `transition_phase` tool calls,
 * and captures cost/token metadata from the final RunState.
 */
export class SavantAgentRunner implements AgentRunner {
  private config?: SavantAgentRunnerConfig
  private client?: Pick<SavantCodeClient, 'run'>
  private sandbox?: Sandbox
  private collector?: TraceCollector
  private finalState?: RunState

  async initialize(config: SavantAgentRunnerConfig): Promise<void> {
    this.config = config
    this.sandbox = config.sandbox
    this.client = config.savantClient ?? new SavantCodeClient({})
    this.finalState = undefined

    await this.sandbox.prepare()

    const runId = crypto.randomUUID()
    const startTime = new Date().toISOString()
    this.collector = new TraceCollector(config.task.task_id, runId, startTime)
    // FID-2026-1007-013: the effective model is the override when set, else
    // the resolved definition's model. Resolved here so a missing definition
    // fails fast at initialize, not mid-run.
    this.collector.recordEffectiveModel(
      config.model ?? this.resolveDefinitionModel(config),
    )
  }

  /**
   * FID-2026-1007-013: resolve the effective model of `agentId` from the
   * registered definitions. Returns undefined when nothing is registered or
   * no definition matches (the SDK will fail the run; the trace just omits
   * the model rather than inventing one).
   */
  private resolveDefinitionModel(
    config: SavantAgentRunnerConfig,
  ): string | undefined {
    if (!config.agentId) return undefined
    const definition = config.agentDefinitions?.find(
      (candidate) => candidate.id === config.agentId,
    )
    return definition?.model
  }

  async executePrompt(prompt: string, signal?: AbortSignal): Promise<RunState> {
    if (!this.config || !this.client || !this.sandbox || !this.collector) {
      throw new Error(
        'Runner has not been initialized. Call initialize() first.',
      )
    }

    // FID-2026-1007-013: per-run model override — an inline clone of the
    // resolved definition with the model swapped. `resolveAgentIdentity`
    // appends inline definitions (cloned) to the registry, so `agents/` on
    // disk is never mutated. Fail fast when no definition resolves.
    let agent: string | AgentDefinition = this.config.agentId ?? 'savant'
    if (this.config.model !== undefined) {
      const base = this.config.agentDefinitions?.find(
        (candidate) => candidate.id === agent,
      )
      if (!base) {
        throw new Error(
          `Model override requested but no agent definition resolved for '${String(agent)}' — register agentDefinitions or drop the override.`,
        )
      }
      agent = { ...base, model: this.config.model }
    }

    const runState = await this.client.run({
      agent,
      prompt,
      cwd: this.sandbox.getWorkingDir(),
      agentDefinitions: this.config.agentDefinitions,
      maxAgentSteps: this.config.maxAgentSteps,
      skillsDir: this.config.skillsDir,
      env: this.config.env,
      // FID-2026-0824-015: eval runs are forced into safe mode by default.
      permissionMode: this.config.permissionMode ?? 'safe',
      signal,
      customToolDefinitions: this.config.customToolDefinitions,
      projectFiles: this.config.projectFiles,
      drainSteeringMessages: this.config.drainSteeringMessages,
      handleEvent: (event: PrintModeEvent) => {
        this.collector?.recordPrintEvent(event)
      },
      handleStreamChunk: (chunk) => {
        this.collector?.recordStreamChunk(chunk)
      },
    })

    this.finalState = runState
    return runState
  }

  collectTrace(): TraceDocument {
    if (!this.config || !this.collector) {
      throw new Error(
        'Runner has not been initialized. Call initialize() first.',
      )
    }

    return this.collector.finalize(this.finalState)
  }

  async handleInteractivePrompt(_request: string): Promise<string> {
    // The Savant SDK does not expose interactive prompts during a run.
    throw new Error(
      'Interactive prompts are not supported by the Savant SDK runner.',
    )
  }

  async injectFault(fault: RunFault): Promise<void> {
    // MVP: record the fault in the trace only. Future work can wire this to
    // overrideTools or sandbox env mutation to affect the live run.
    this.collector?.recordFault(fault)
  }
}
