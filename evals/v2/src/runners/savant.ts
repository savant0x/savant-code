import { SavantCodeClient } from '@savant-code/sdk'

import { TraceCollector } from '../trace'

import type {
  AgentRunner,
  RunnerConfig,
  RunFault,
  TraceDocument,
} from '../runner'
import type { Sandbox } from '../sandbox'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

export interface SavantAgentRunnerConfig extends RunnerConfig {
  /**
   * Optional injected SavantCodeClient for testing. If omitted, a real client
   * is constructed from RunnerConfig.apiKey.
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
    this.client =
      config.savantClient ??
      new SavantCodeClient({
        apiKey: config.apiKey ?? process.env.SAVANT_CODE_API_KEY,
      })
    this.finalState = undefined

    await this.sandbox.prepare()

    const runId = crypto.randomUUID()
    const startTime = new Date().toISOString()
    this.collector = new TraceCollector(config.task.task_id, runId, startTime)
  }

  async executePrompt(prompt: string): Promise<RunState> {
    if (!this.config || !this.client || !this.sandbox || !this.collector) {
      throw new Error(
        'Runner has not been initialized. Call initialize() first.',
      )
    }

    const runState = await this.client.run({
      agent: this.config.agentId ?? 'savant',
      prompt,
      cwd: this.sandbox.getWorkingDir(),
      agentDefinitions: this.config.agentDefinitions,
      maxAgentSteps: this.config.maxAgentSteps,
      env: this.config.env,
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
