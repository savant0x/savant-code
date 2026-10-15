import { describe, expect, it } from 'bun:test'

import {
  getBaseParams,
  getLlmCallCount,
  getTemplate,
  incrLlmCallCount,
  loopAgentSteps,
  promptSuccess,
  registerLoopAgentStepsPartFLifecycle,
} from './loop-agent-steps-part-f-test-harness'

import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'

const REJECTED: StreamErrorChunk = {
  type: 'error',
  errorClass: 'native-incomplete',
  toolName: 'read_files',
  message: 'The provider rejected the arguments.',
  finishReason: 'tool-calls',
}

async function runFailures(chunks: StreamErrorChunk[], available = true) {
  const template = {
    ...getTemplate(),
    handleSteps: undefined,
    toolNames: available ? ['read_files'] : ['code_search'],
  }
  getBaseParams().promptAiSdkStream = async function* () {
    incrLlmCallCount()
    yield* chunks
    return promptSuccess(`rejection-${getLlmCallCount()}`)
  }
  return loopAgentSteps({
    ...getBaseParams(),
    agentTemplate: template,
    localAgentTemplates: { 'test-agent': template },
  })
}

describe('native rejection through the production loop (FID-2026-1012-017)', () => {
  registerLoopAgentStepsPartFLifecycle()

  it.each([
    ['completed response', REJECTED],
    [
      'schema issue without a finish reason',
      {
        type: 'error',
        errorClass: 'native-incomplete',
        toolName: 'read_files',
        message: 'The arguments failed schema validation.',
        schemaIssue: 'paths — invalid_type (expected array)',
      } satisfies StreamErrorChunk,
    ],
  ])(
    'preserves %s through escalation and exhaustion',
    async (_label, chunk) => {
      const result = await runFailures([chunk])
      expect(getLlmCallCount()).toBe(3)
      expect(result.output.type).toBe('error')
      if (result.output.type !== 'error') throw new Error('Expected exhaustion')
      expect(result.output.message).toContain('rejected')
      expect(result.output.message).toContain('schema')
      expect(result.output.message).not.toContain('split into smaller steps')
      const escalation = result.agentState.messageHistory.find((message) =>
        JSON.stringify(message.content).includes(
          'Native tool call still failing',
        ),
      )
      expect(escalation).toBeDefined()
      expect(JSON.stringify(escalation)).toContain('No truncation was observed')
      expect(JSON.stringify(escalation)).not.toContain('file list is too large')
    },
  )

  it('retains size steering when truncation overrides completion evidence', async () => {
    const result = await runFailures([
      { ...REJECTED, argumentsTruncated: true },
    ])
    expect(getLlmCallCount()).toBe(3)
    const history = JSON.stringify(result.agentState.messageHistory)
    expect(history).toContain('file list is too large')
    expect(history).not.toContain('No truncation was observed')
  })

  it('uses the last native failure cause when one stream contains both causes', async () => {
    const result = await runFailures([
      REJECTED,
      { ...REJECTED, finishReason: 'length' },
    ])
    const escalation = result.agentState.messageHistory.find((message) =>
      JSON.stringify(message.content).includes(
        'Native tool call still failing',
      ),
    )
    expect(JSON.stringify(escalation)).toContain('file list is too large')
    expect(JSON.stringify(escalation)).not.toContain(
      'No truncation was observed',
    )
  })

  it('does not discard rejection cause for a later unrelated stream error', async () => {
    const result = await runFailures([
      REJECTED,
      { type: 'error', message: 'Unrelated stream diagnostic' },
    ])
    expect(result.output.type).toBe('error')
    if (result.output.type !== 'error') throw new Error('Expected exhaustion')
    expect(result.output.message).toContain('schema')
  })

  it('keeps unavailable-tool handling ahead of the reported rejection cause', async () => {
    const result = await runFailures([REJECTED], false)
    expect(getLlmCallCount()).toBe(2)
    expect(result.output.type).toBe('error')
    if (result.output.type !== 'error') throw new Error('Expected exhaustion')
    expect(result.output.message).toContain('does not have')
    expect(result.output.message).toContain('code_search')
  })
})
