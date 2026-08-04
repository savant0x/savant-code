import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

import { withTimeout } from '@savant-code/common/util/promise'

import { withTestRepo } from '../subagents/test-repo-utils'
import { ClaudeRunner } from './runners/claude'
import { CodexRunner } from './runners/codex'
import { OpenCodeRunner } from './runners/opencode'
import { SavantCodeRunner } from './runners/savant'

import type { Runner, AgentStep } from './runners/runner'
import type { EvalCommitV2, FinalCheckOutput } from './types'
import type { AgentDefinition, SavantCodeClient } from '@savant-code/sdk'

export type { AgentStep }

export type ExternalAgentType = 'claude' | 'codex' | 'opencode'

export async function runAgentOnCommit({
  client,
  agentId,
  commit,
  repoUrl,
  initCommand,
  env,
  localAgentDefinitions,
  printEvents,
  finalCheckCommands,
  externalAgentType,
}: {
  client: SavantCodeClient
  agentId: string
  commit: EvalCommitV2
  repoUrl: string
  initCommand?: string
  env?: Record<string, string>
  localAgentDefinitions: AgentDefinition[]
  printEvents: boolean
  finalCheckCommands?: string[]
  externalAgentType?: ExternalAgentType
}): Promise<{
  diff: string
  contextFiles: Record<string, string>
  durationMs: number
  cost: number
  error?: string
  trace: AgentStep[]
  finalCheckOutputs?: FinalCheckOutput[]
}> {
  console.log(`[${commit.id}] Running agent ${agentId}...`)
  const startTime = Date.now()
  let diff = ''
  let contextFiles: Record<string, string> = {}
  let error: string | undefined
  let cost = 0
  const trace: AgentStep[] = []
  let finalCheckOutputs: FinalCheckOutput[] | undefined

  try {
    const timeoutMs = 60 * 60 * 1000 // 60 minutes
    // FID-2026-0803-007 EV-3/EV-11: an abort signal that fires at the same
    // deadline as the withTimeout wrapper — SavantCodeRunner threads it into
    // client.run so the LLM loop actually stops (withTimeout only raced it),
    // and the traceSink keeps partial steps if the run is aborted.
    const signal = AbortSignal.timeout(timeoutMs)
    await withTimeout(
      withTestRepo(
        {
          repoUrl,
          parentSha: commit.parentSha,
          initCommand,
          env,
        },
        async (repoDir) => {
          // Select the appropriate runner
          let runner: Runner
          if (externalAgentType === 'claude') {
            runner = new ClaudeRunner(repoDir, env)
          } else if (externalAgentType === 'codex') {
            runner = new CodexRunner(repoDir, env)
          } else if (externalAgentType === 'opencode') {
            runner = new OpenCodeRunner(repoDir, env)
          } else {
            runner = new SavantCodeRunner({
              cwd: repoDir,
              env,
              client,
              agentId,
              localAgentDefinitions,
              printEvents,
              commitId: commit.id,
              parentSha: commit.parentSha,
              signal,
              traceSink: trace,
            })
          }

          console.log(
            `[${commit.id}] Running agent: ${externalAgentType || 'savant-code'}`,
          )

          const result = await runner.run(commit.prompt)
          // FID-2026-0803-007 EV-11: SavantCodeRunner already streams events
          // into the shared `trace` sink in real time, so don't double-push on
          // success; external runners only surface steps on success.
          if (externalAgentType !== undefined) {
            trace.push(...result.steps)
          }
          cost = result.totalCostUsd
          diff = result.diff

          const contextFilePaths = new Set<string>([
            ...commit.supplementalFiles,
            ...commit.fileDiffs.map((fd) => fd.path),
          ])
          for (const { status, path } of commit.fileDiffs) {
            if (status === 'added') {
              contextFilePaths.delete(path)
            }
          }

          for (const filePath of contextFilePaths) {
            try {
              const content = execSync(
                `git show ${commit.parentSha}:${JSON.stringify(filePath)}`,
                {
                  cwd: repoDir,
                  encoding: 'utf-8',
                  maxBuffer: 10 * 1024 * 1024,
                },
              )
              contextFiles[filePath] = content
            } catch (error) {
              contextFiles[filePath] = ''
            }
          }

          // Run final check commands if specified
          if (finalCheckCommands && finalCheckCommands.length > 0) {
            console.log(
              `[${commit.id}] Running ${finalCheckCommands.length} final check commands...`,
            )
            finalCheckOutputs = await runFinalCheckCommands(
              finalCheckCommands,
              repoDir,
              env,
            )
          }
        },
      ),
      timeoutMs,
      `Agent ${agentId} timed out after ${timeoutMs / 1000} seconds`,
    )
  } catch (e) {
    error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
  }

  const durationMs = Date.now() - startTime

  return {
    diff,
    contextFiles,
    durationMs,
    cost,
    error,
    trace,
    finalCheckOutputs,
  }
}

async function runFinalCheckCommands(
  commands: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<FinalCheckOutput[]> {
  const results: FinalCheckOutput[] = []

  for (const command of commands) {
    console.log(`  Running: ${command}`)
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: { ...process.env, ...env },
      })
      results.push({
        command,
        exitCode: 0,
        stdout,
        stderr,
      })
      console.log(`  ✓ Command succeeded: ${command}`)
    } catch (error) {
      // Command failed, but we still capture the output.
      // FID-2026-0803-007 EV-6: narrow the exec error shape instead of `any`.
      const execError = error as {
        code?: number
        stdout?: string
        stderr?: string
        message?: string
      }
      results.push({
        command,
        exitCode: execError.code || 1,
        stdout: execError.stdout || '',
        stderr: execError.stderr || execError.message || '',
      })
      console.log(`  ✗ Command failed (exit ${execError.code}): ${command}`)
    }
  }

  return results
}
