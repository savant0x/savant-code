import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import type { Runner, RunnerResult, AgentStep } from './runner'
import type { AgentDefinition, SavantCodeClient } from '@savant-code/sdk'

const DEBUG_ERROR = true

export class SavantCodeRunner implements Runner {
  private cwd: string
  private env?: Record<string, string>
  private client: SavantCodeClient
  private agentId: string
  private localAgentDefinitions: AgentDefinition[]
  private printEvents: boolean
  private commitId: string
  private parentSha: string
  private signal?: AbortSignal
  private traceSink?: AgentStep[]

  constructor(options: {
    cwd: string
    env?: Record<string, string>
    client: SavantCodeClient
    agentId: string
    localAgentDefinitions: AgentDefinition[]
    printEvents: boolean
    commitId: string
    parentSha: string
    signal?: AbortSignal
    traceSink?: AgentStep[]
  }) {
    this.cwd = options.cwd
    this.env = options.env
    this.client = options.client
    this.agentId = options.agentId
    this.localAgentDefinitions = options.localAgentDefinitions
    this.printEvents = options.printEvents
    this.commitId = options.commitId
    this.parentSha = options.parentSha
    this.signal = options.signal
    this.traceSink = options.traceSink
  }

  async run(prompt: string): Promise<RunnerResult> {
    const steps: AgentStep[] = []
    let totalCostUsd = 0

    const maxAgentSteps = 40
    const result = await this.client.run({
      agent: this.agentId,
      prompt,
      agentDefinitions: this.localAgentDefinitions,
      cwd: this.cwd,
      env: this.env,
      maxAgentSteps,
      signal: this.signal,
      handleEvent: (event) => {
        if (
          (event.type === 'tool_call' || event.type === 'tool_result') &&
          event.toolName === 'set_messages'
        ) {
          return
        }
        if (event.type === 'error') {
          console.error(
            `[${this.commitId}:${this.agentId}] Error event:`,
            event.message,
          )
          if (DEBUG_ERROR && !event.message.startsWith('Invalid JSON')) {
            // Save errors in a file, but not tool calls with invalid json.
            fs.writeFileSync(
              path.join(
                __dirname,
                '..',
                `${this.commitId}-${this.agentId}-error-${Math.random().toString(36).substring(2, 6)}.json`,
              ),
              JSON.stringify(
                {
                  error: event.message,
                  trace: steps,
                },
                null,
                2,
              ),
            )
          }
        } else if (this.printEvents) {
          console.log(
            `[${this.commitId}:${this.agentId}]`,
            JSON.stringify(event, null, 2),
          )
        }
        steps.push(event)
        // FID-2026-0803-007 EV-11: stream steps into the shared trace sink so
        // partial progress survives an abort/timeout.
        this.traceSink?.push(event)
      },
    })

    if (result.output.type === 'error') {
      console.error(
        `[${this.commitId}:${this.agentId}] Error:`,
        result.output.message,
      )
      if (DEBUG_ERROR) {
        // Save errors in a file, but not tool calls with invalid json.
        fs.writeFileSync(
          path.join(
            __dirname,
            '..',
            `${this.commitId}-${this.agentId}-error-${Math.random().toString(36).substring(2, 6)}.json`,
          ),
          JSON.stringify(
            {
              ...result.output,
              trace: steps,
            },
            null,
            2,
          ),
        )
      }
    }

    totalCostUsd = (result.sessionState?.mainAgentState.creditsUsed ?? 0) / 100

    // Get git diff after SavantCode has made changes
    let diff = ''
    try {
      execSync('git add .', { cwd: this.cwd, stdio: 'ignore' })
      diff = execSync(`git diff ${this.parentSha}`, {
        cwd: this.cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      })
    } catch {
      // Ignore git errors
    }

    return {
      steps,
      totalCostUsd,
      diff,
    }
  }
}
