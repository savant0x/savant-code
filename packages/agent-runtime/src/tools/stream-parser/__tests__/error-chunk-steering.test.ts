// FID-2026-0909-007: strike-one steering pins. RED-first suite — pins (a),
// (c), and (e) fail against the pre-fix machinery (missing map entries,
// Set-gated strike-1 steering, unguarded relay re-wrap) and pass once the
// three surgical changes land. Siblings: loop-agent-steps-part-f*.test.ts
// pin the strike caps; this suite pins the steering TEXT surface.
import { describe, expect, it } from 'bun:test'

import {
  getTemplate,
  registerLoopAgentStepsPartFLifecycle,
} from '../../../__tests__/loop-agent-steps-part-f-test-harness'
import {
  getSteeringMessage,
  NATIVE_TOOL_CALL_STEERING_MESSAGES,
} from '../../../run-agent-step/constants'
import { handleStreamErrorChunk } from '../error-chunk'
import { createResponseHandler } from '../response-handler'

import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

function errorContentOf(message: Message | undefined): string {
  if (message === undefined) return ''
  return typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content)
}

function nativeIncompleteChunk(toolName: string): StreamErrorChunk {
  return {
    type: 'error',
    message: `Incomplete arguments for tool ${toolName}`,
    errorClass: 'native-incomplete',
    toolName,
  }
}

describe('native-incomplete strike-one steering (FID-2026-0909-007)', () => {
  registerLoopAgentStepsPartFLifecycle()

  describe('steering map coverage', () => {
    it('(a) covers the three session-failing tools at every strike tier', () => {
      const tools = [
        'spawn_agents',
        'run_readonly_command',
        'sequentialthinking',
      ] as const
      for (const toolName of tools) {
        expect(NATIVE_TOOL_CALL_STEERING_MESSAGES[toolName]).toBeDefined()
        for (const strike of [1, 2, 3] as const) {
          expect(getSteeringMessage(toolName, strike)).not.toBe('')
        }
      }
      // Substantive hints, not empty shells:
      expect(getSteeringMessage('spawn_agents', 1)).toContain('inherit')
      expect(getSteeringMessage('spawn_agents', 2)).toContain('too large')
      expect(getSteeringMessage('run_readonly_command', 1)).toContain(
        'ONE command',
      )
      expect(getSteeringMessage('sequentialthinking', 1)).toContain(
        'history persists',
      )
    })

    it('(b) returns non-empty steering for a known unmapped tool at strike 1', () => {
      expect(getSteeringMessage('code_search', 1)).not.toBe('')
    })
  })

  describe('handleStreamErrorChunk — ungated strike-1 steering', () => {
    it('(c) steers an unmapped known tool on the first strike', () => {
      const errorMessages: Message[] = []
      const result = handleStreamErrorChunk({
        chunk: nativeIncompleteChunk('code_search'),
        errorMessages,
        loggerWarn: () => {},
        agentTemplate: getTemplate(),
        runId: 'test-run',
      })

      expect(result.hasNativeIncompleteToolCall).toBe(true)
      expect(result.lastIncompleteToolName).toBe('code_search')
      expect(errorContentOf(errorMessages[0])).toContain(
        'split the work into multiple smaller tool calls',
      )
    })

    it('(d) keeps the mapped-tool hint at strike 1 (read_files)', () => {
      const errorMessages: Message[] = []
      handleStreamErrorChunk({
        chunk: nativeIncompleteChunk('read_files'),
        errorMessages,
        loggerWarn: () => {},
        agentTemplate: getTemplate(),
        runId: 'test-run',
      })

      expect(errorContentOf(errorMessages[0])).toContain(
        'read fewer files at a time',
      )
    })
  })

  describe('createResponseHandler — wrap idempotence', () => {
    const SUFFIX = 'Please check the tool name and arguments and try again.'

    it('(e) does not double-wrap an already-wrapped error message', () => {
      const errorMessages: Message[] = []
      const handler = createResponseHandler({
        onResponseChunk: () => {},
        errorMessages,
        markToolCallError: () => {},
      })

      handler({
        type: 'error',
        message: `Error during tool call: Incomplete arguments for tool read_files. ${SUFFIX}`,
      })

      expect(errorMessages).toHaveLength(1)
      const occurrences =
        errorContentOf(errorMessages[0]).split(SUFFIX).length - 1
      expect(occurrences).toBe(1)
    })

    it('(f) wraps an unwrapped error exactly once', () => {
      const errorMessages: Message[] = []
      const handler = createResponseHandler({
        onResponseChunk: () => {},
        errorMessages,
        markToolCallError: () => {},
      })

      handler({ type: 'error', message: 'Something failed' })

      expect(errorMessages).toHaveLength(1)
      const content = errorContentOf(errorMessages[0])
      expect(content).toContain('Error during tool call: Something failed.')
      expect(content.split(SUFFIX).length - 1).toBe(1)
    })
  })
})
