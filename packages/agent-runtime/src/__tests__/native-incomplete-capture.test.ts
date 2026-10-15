// FID-2026-0909-008 Step 5 pin — native-incomplete stream errors become
// experience-ledger records. The truncation class was invisible to the
// recurrence engine: stream-layer errors never execute a tool, so the
// PostToolUseFailure capture path never saw them (0 records despite ~11
// incidents the day this FID was authored).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import {
  getBaseParams,
  getLlmCallCount,
  getTemplate,
  incrLlmCallCount,
  loopAgentSteps,
  promptSuccess,
  registerLoopAgentStepsPartFLifecycle,
} from './loop-agent-steps-part-f-test-harness'
import { getHookEngine } from '../hooks/engine'

const tempDirectories: string[] = []

function projectRootFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-capture-'))
  tempDirectories.push(dir)
  // Declare the production capture hook (mirrors protocol.config.yaml) so
  // the hook engine wires the builtin sink in this fixture root.
  fs.writeFileSync(
    path.join(dir, 'protocol.config.yaml'),
    'hooks:\n  - event: PostToolUseFailure\n    action: experience-capture\n',
    'utf8',
  )
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  // Re-read the real protocol config for the harness's static root so this
  // suite's per-test engine can never leak into sibling suites.
  getHookEngine('/test', { refresh: true })
})

function ledgerRecords(root: string): string[] {
  const file = path.join(root, 'dev', 'experiences', 'raw-traces.jsonl')
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
}

describe('native-incomplete experience capture (FID-2026-0909-008 Step 5)', () => {
  registerLoopAgentStepsPartFLifecycle()

  it('appends one tool_failure record per native-incomplete step', async () => {
    const root = projectRootFixture()
    const llmOnlyTemplate = {
      ...getTemplate(),
      handleSteps: undefined,
    }

    const base = getBaseParams()
    base.fileContext = {
      ...base.fileContext,
      projectRoot: root,
      cwd: root,
    }
    base.promptAiSdkStream = async function* () {
      incrLlmCallCount()
      yield {
        type: 'error' as const,
        message: 'Incomplete arguments for tool write_file',
        errorClass: 'native-incomplete' as const,
        toolName: 'write_file',
      }
      // Unconditional success return (matches the part-f strike harness
      // contract): the generator must always return a PromptResult.
      return promptSuccess(`capture-${getLlmCallCount()}`)
    }

    await loopAgentSteps({
      ...base,
      agentTemplate: llmOnlyTemplate,
      localAgentTemplates: { 'test-agent': llmOnlyTemplate },
    })

    // The strike ladder runs to exhaustion (3 strikes for write_file):
    // three LLM steps, each yielding one native-incomplete chunk — one
    // capture record per occurrence is the recurrence grain.
    const records = ledgerRecords(root)
    expect(records.length).toBe(3)
    const first = JSON.parse(records[0]) as {
      triggerType: string
      toolName: string
      errorFirstLine: string
      contextHash: string
      sessionId: string
    }
    expect(first.triggerType).toBe('tool_failure')
    expect(first.toolName).toBe('write_file')
    expect(first.errorFirstLine).toContain('Incomplete arguments')
    // No tool_input exists at the stream layer — no raw payload is ever
    // persisted (the context-hash contract of the capture sink).
    expect(first.contextHash).toBe('')
    expect(typeof first.sessionId).toBe('string')
  })
})
