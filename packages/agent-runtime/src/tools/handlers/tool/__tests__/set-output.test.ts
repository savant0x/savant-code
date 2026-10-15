import { redactSecrets } from '@savant-code/common/util/redact'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'

import { formatValueForError } from '../../../../util/format-value'
import { formatZodIssues, handleSetOutput } from '../set-output'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  LogValue,
  Logger,
} from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

function createCaptureLogger(logs: string[]): Logger {
  const capture = (value: LogValue): void => {
    logs.push(JSON.stringify(value))
  }
  return { debug: capture, info: capture, warn: capture, error: capture }
}

function makeAgentState(agentType: string): AgentState {
  return {
    agentId: 'agent-1',
    agentType,
    agentContext: {},
    ancestorRunIds: [],
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: 10,
    creditsUsed: 0,
    directCreditsUsed: 0,
    output: undefined,
    parentId: undefined,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 0,
  }
}

function makeTemplate(
  outputSchema: AgentTemplate['outputSchema'],
): AgentTemplate {
  return {
    id: 'typed-agent',
    displayName: 'Typed Agent',
    spawnerPrompt: '',
    model: 'claude-sonnet-4-5',
    inputSchema: {},
    outputMode: 'structured_output',
    outputSchema,
    includeMessageHistory: false,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: ['set_output'],
    spawnableAgents: [],
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  }
}

describe('handleSetOutput (FID-2026-1013-010 W1-5)', () => {
  test('formats ZodError issues as path: message and redacts secrets in error message and logs', async () => {
    const logs: string[] = []
    const logger = createCaptureLogger(logs)
    const schema = z.object({
      summary: z.string(),
      count: z.number(),
    })
    const template: AgentTemplate = {
      id: 'typed-agent',
      displayName: 'Typed Agent',
      spawnerPrompt: '',
      model: 'claude-sonnet-4-5',
      inputSchema: {},
      outputMode: 'structured_output',
      outputSchema: schema,
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['set_output'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    const secretToken = 'sk-ant-abcdefgh'
    const agentState = makeAgentState('typed-agent')

    const result = await handleSetOutput({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'set_output',
        toolCallId: 'call-1',
        input: {
          summary: 123,
          leakedKey: secretToken,
        },
      },
      agentState,
      localAgentTemplates: { 'typed-agent': template },
      logger,
    })

    const outputText = JSON.stringify(result.output)
    expect(outputText).toContain('summary:')
    expect(outputText).toContain('count:')
    expect(outputText).not.toContain(secretToken)
    expect(logs.join('\n')).not.toContain(secretToken)
    expect(agentState.output).toBeUndefined()
  })

  test('sets agentState.output unredacted when schema validation passes', async () => {
    const logs: string[] = []
    const logger = createCaptureLogger(logs)
    const schema = z.object({
      summary: z.string(),
    })
    const template: AgentTemplate = {
      id: 'typed-agent',
      displayName: 'Typed Agent',
      spawnerPrompt: '',
      model: 'claude-sonnet-4-5',
      inputSchema: {},
      outputMode: 'structured_output',
      outputSchema: schema,
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames: ['set_output'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    const agentState = makeAgentState('typed-agent')

    const result = await handleSetOutput({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'set_output',
        toolCallId: 'call-2',
        input: { summary: 'All checks passed' },
      },
      agentState,
      localAgentTemplates: { 'typed-agent': template },
      logger,
    })

    expect(JSON.stringify(result.output)).toContain('Output set')
    expect(agentState.output).toEqual({ summary: 'All checks passed' })
  })

  test('formatZodIssues handles root-level issues and non-Zod errors', () => {
    expect(
      formatZodIssues({
        issues: [{ path: [], message: 'Expected object, received null' }],
      }),
    ).toBe('<root>: Expected object, received null')
    expect(formatZodIssues(new Error('plain failure'))).toBe('plain failure')
  })

  test('redacts and bounds custom validation errors in results and both logged attempts', async () => {
    const logs: string[] = []
    const secret = 'sk-test-12345678'
    const schema = z
      .object({ summary: z.string() })
      .superRefine((_value, context) => {
        context.addIssue({
          code: 'custom',
          message: `${secret} ${'detail '.repeat(500)}`,
        })
      })
    const result = await handleSetOutput({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'set_output',
        toolCallId: 'custom-error',
        input: { summary: 'invalid', data: { summary: 'invalid' } },
      },
      agentState: makeAgentState('typed-agent'),
      localAgentTemplates: { 'typed-agent': makeTemplate(schema) },
      logger: createCaptureLogger(logs),
    })
    const rendered = JSON.stringify(result.output)
    expect(rendered).not.toContain(secret)
    expect(rendered.length).toBeLessThan(2000)
    expect(logs.join('\n')).not.toContain(secret)
    expect(logs.join('\n').length).toBeLessThan(2500)
  })

  test('redacts a credential before the diagnostic cap can cut its prefix', () => {
    const secret = 'sk-test-12345678'
    const formatted = formatValueForError(
      `${'x'.repeat(491)} ${secret}`,
      500,
      redactSecrets,
    )
    expect(formatted).not.toContain('sk-test')
  })
})
