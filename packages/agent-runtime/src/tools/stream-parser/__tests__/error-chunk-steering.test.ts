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
        // FID-2026-1012-002: the payload ladder belongs to tools the agent
        // actually has — the template must declare the tool it calls, or the
        // call is the unavailable-tool class (corrective text, no payload
        // advice) instead.
        agentTemplate: {
          ...getTemplate(),
          toolNames: [...getTemplate().toolNames, 'code_search'],
        },
        runId: 'test-run',
      })

      expect(result.hasNativeIncompleteToolCall).toBe(true)
      expect(result.lastIncompleteToolName).toBe('code_search')
      expect(errorContentOf(errorMessages[0])).toContain(
        'split the work into multiple smaller tool calls',
      )
    })

    it('(d) keeps the mapped-tool hint at strike 1 (read_files, declared)', () => {
      const errorMessages: Message[] = []
      handleStreamErrorChunk({
        chunk: nativeIncompleteChunk('read_files'),
        errorMessages,
        loggerWarn: () => {},
        agentTemplate: {
          ...getTemplate(),
          toolNames: [...getTemplate().toolNames, 'read_files'],
        },
        runId: 'test-run',
      })

      expect(errorContentOf(errorMessages[0])).toContain(
        'read fewer files at a time',
      )
    })

    // FID-2026-1012-002: the two questions the completeness helper used to
    // answer as one. A tool this agent does not have is not a payload problem:
    // the correction names the tools it does have, and the payload advice that
    // no retry can satisfy is never emitted.
    it('(h) reports the unavailable-tool class instead of payload truncation', () => {
      const errorMessages: Message[] = []
      const result = handleStreamErrorChunk({
        chunk: nativeIncompleteChunk('read_files'),
        errorMessages,
        loggerWarn: () => {},
        agentTemplate: { ...getTemplate(), toolNames: ['code_search', 'write_file'] },
        runId: 'test-run',
      })

      expect(result.hasNativeIncompleteToolCall).toBe(true)
      expect(result.lastIncompleteToolName).toBe('read_files')
      const content = errorContentOf(errorMessages[0])
      expect(content).toContain('read_files is not available to this agent')
      expect(content).toContain(
        'Your available tools for this step are: code_search, write_file',
      )
      expect(content).not.toContain('read fewer files at a time')
      expect(content).not.toContain('file list is too large')
      expect(content).not.toContain('read the next file in a separate call')
    })

    it('(i) keeps the provider-classified message and still names the real tools', () => {
      const errorMessages: Message[] = []
      handleStreamErrorChunk({
        chunk: {
          type: 'error',
          message:
            'Tool read_files is not available to this agent: the model called a tool that was not offered for this step.',
          errorClass: 'tool-unavailable',
          toolName: 'read_files',
        },
        errorMessages,
        loggerWarn: () => {},
        agentTemplate: { ...getTemplate(), toolNames: ['code_search'] },
        runId: 'test-run',
      })

      const content = errorContentOf(errorMessages[0])
      expect(content).toContain('is not available to this agent')
      expect(content).toContain('code_search')
      expect(content).not.toContain('split the work into multiple smaller')
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

      const wrapped = `Error during tool call: Incomplete arguments for tool read_files. ${SUFFIX}`
      handler({ type: 'error', message: wrapped })

      expect(errorMessages).toHaveLength(1)
      const content = errorContentOf(errorMessages[0])
      const occurrences = content.split(SUFFIX).length - 1
      expect(occurrences).toBe(1)
      // True pass-through, not strip-and-rewrap: the wrapped input survives
      // intact (auditor finding — occurrence-count alone cannot distinguish).
      expect(content).toContain(wrapped)
    })

    it('(g) passes a wrapped message WITH its steering suffix through unchanged', () => {
      const errorMessages: Message[] = []
      const handler = createResponseHandler({
        onResponseChunk: () => {},
        errorMessages,
        markToolCallError: () => {},
      })

      const steering = getSteeringMessage('write_file', 1)
      const wrapped = `Error during tool call: Incomplete arguments for tool write_file. ${SUFFIX}${steering}`
      handler({ type: 'error', message: wrapped })

      expect(errorMessages).toHaveLength(1)
      const content = errorContentOf(errorMessages[0])
      // A strip-and-rewrap would drop the steering suffix; pass-through
      // keeps the whole wrapped message intact.
      expect(content).toContain(wrapped)
      expect(content).toContain(steering)
      expect(content.split(SUFFIX).length - 1).toBe(1)
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
