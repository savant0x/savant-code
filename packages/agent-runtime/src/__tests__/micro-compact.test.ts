import { describe, expect, test } from 'bun:test'

import { runMicroCompact } from '../context-compactor/micro-compact'
import { countTokensJson } from '../util/token-counter'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function makeToolResult(
  toolCallId: string,
  toolName: string,
  payload: string,
): ToolMessage {
  return {
    role: 'tool',
    toolCallId,
    toolName,
    content: [{ type: 'json', value: { output: payload } }],
  }
}

describe('runMicroCompact token delta accounting (FID-2026-1013-010 W1-4)', () => {
  test('computes actual token savings instead of hardcoded messagesCleared * 200', () => {
    const largePayload = 'const alpha = 1;\n'.repeat(300)
    const msg1 = makeToolResult('call-1', 'read_files', largePayload)
    const msg2 = makeToolResult('call-2', 'read_files', 'recent-1')
    const msg3 = makeToolResult('call-3', 'read_files', 'recent-2')

    const result = runMicroCompact({
      messages: [msg1, msg2, msg3],
      enabled: true,
      maxKeepRecent: 2,
      floorTokens: undefined,
      logger: noopLogger,
    })

    const expectedDelta =
      countTokensJson(msg1.content) -
      countTokensJson([{ type: 'json', value: '[compacted]' }])

    expect(result.messagesCleared).toBe(1)
    expect(result.tokensSaved).toBe(expectedDelta)
    expect(result.tokensSaved).toBeGreaterThan(500)
  })

  test('skips clearing a tiny tool result whose token count is already <= the placeholder', () => {
    const tinyMsg: Message = {
      role: 'tool',
      toolCallId: 'call-tiny',
      toolName: 'run_readonly_command',
      content: [{ type: 'json', value: { exitCode: 0 } }],
    }
    const recent1 = makeToolResult('call-2', 'read_files', 'recent-1')
    const recent2 = makeToolResult('call-3', 'read_files', 'recent-2')

    const result = runMicroCompact({
      messages: [tinyMsg, recent1, recent2],
      enabled: true,
      maxKeepRecent: 2,
      floorTokens: undefined,
      logger: noopLogger,
    })

    expect(result.messagesCleared).toBe(0)
    expect(result.tokensSaved).toBe(0)
    expect(result.messages[0]).toBe(tinyMsg)
  })
})
