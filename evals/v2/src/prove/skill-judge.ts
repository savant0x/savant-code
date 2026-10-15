/** Isolated model judgment for a behavioral skill trace. */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { SavantCodeClient } from '@savant-code/sdk'

import { TempDirSandbox } from '../sandboxes/tempdir'

import type { AgentDefinition } from '@savant-code/sdk'

export async function defaultJudge(
  prompt: string,
  signal: AbortSignal,
  agentId: string,
  agentDefinitions: AgentDefinition[],
): Promise<string> {
  const sandbox = new TempDirSandbox({ prefix: 'savant-skill-grade-' })
  try {
    await sandbox.prepare()
    const skillsDir = path.join(sandbox.getWorkingDir(), '.empty-skills')
    await mkdir(skillsDir)
    const state = await new SavantCodeClient({}).run({
      agent: agentId,
      prompt,
      cwd: sandbox.getWorkingDir(),
      skillsDir,
      agentDefinitions,
      maxAgentSteps: 2,
      permissionMode: 'safe',
      signal,
    })
    if (state.output.type === 'error')
      throw new Error(`Skill grader failed: ${state.output.message}`)
    if (state.output.type === 'structuredOutput')
      return JSON.stringify(state.output.value)
    return state.output.value
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
  } finally {
    await sandbox.teardown()
  }
}
