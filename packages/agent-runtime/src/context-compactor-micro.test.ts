/**
 * FID-2026-0814-004 H-05 / H-06 — micro-compact config behavior:
 * - H-05: `compression.microCompact: false` (off-switch) → microCompact is a
 *   no-op (evidence preservation); enabled → clears stale tool results.
 * - H-06: below the configurable token floor, micro-compact keeps ALL evidence
 *   regardless of the count-only gate; above the floor it clears, and the
 *   verification-tool placeholder preserves the exit code.
 */
import { describe, expect, test } from 'bun:test'

import { ContextCompactor } from './context-compactor'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
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

function toolResult(
  toolName: string,
  value: JSONValue,
  toolCallId: string,
): ToolMessage {
  return {
    role: 'tool',
    toolCallId,
    toolName,
    content: [{ type: 'json', value }],
  }
}

/** N tool results interleaved with user messages (4 tool results total). */
function buildHistory(): Message[] {
  return [
    { role: 'user', content: [{ type: 'text', text: 'start' }] },
    toolResult('run_readonly_command', { command: 'ls', exitCode: 0 }, 't1'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('run_readonly_command', { command: 'cat x', exitCode: 1 }, 't2'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('read_files', { paths: ['a'] }, 't3'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('read_files', { paths: ['b'] }, 't4'),
    { role: 'user', content: [{ type: 'text', text: 'end' }] },
  ]
}

describe('ContextCompactor.microCompact — FID-2026-0814-004 H-05 off-switch', () => {
  test('disabled: never clears tool results (evidence preservation)', () => {
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: false,
    })
    const history = buildHistory()
    const result = compactor.microCompact(history, 100_000)
    expect(result.messagesCleared).toBe(0)
    expect(result.messages).toEqual(history)
    expect(history.filter((m) => m.role === 'tool')).toHaveLength(4)
  })

  test('enabled with keep-recent 3: clears the oldest tool result', () => {
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: true,
      microCompactMaxKeepRecent: 3,
    })
    const history = buildHistory()
    const result = compactor.microCompact(history, 100_000)
    expect(result.messagesCleared).toBe(1)
    // The oldest (t1) is compacted to the placeholder; the newer results keep
    // their full payloads (exit code preserved on t2).
    const toolMessages = result.messages.filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(4)
    expect(toolMessages[0]).toMatchObject({
      toolCallId: 't1',
      toolName: 'run_readonly_command',
    })
    expect(toolMessages[0].content).toEqual([
      {
        type: 'json',
        value: { compacted: true, command: 'ls', exitCode: 0 },
      },
    ])
    expect(toolMessages[1]).toMatchObject({
      toolCallId: 't2',
      toolName: 'run_readonly_command',
      content: [{ type: 'json', value: { command: 'cat x', exitCode: 1 } }],
    })
  })
})

describe('ContextCompactor.microCompact — FID-2026-0814-004 H-06 pressure gate', () => {
  test('below the floor: keeps ALL evidence even with > keep-recent results', () => {
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: true,
      microCompactMaxKeepRecent: 3,
      microCompactFloorTokens: 200_000,
    })
    const history = buildHistory()
    const result = compactor.microCompact(history, 50_000)
    expect(result.messagesCleared).toBe(0)
    expect(result.messages).toEqual(history)
  })

  test('above the floor: clears with the exit-code-preserving placeholder', () => {
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: true,
      microCompactMaxKeepRecent: 3,
      microCompactFloorTokens: 100_000,
    })
    const history = buildHistory()
    const result = compactor.microCompact(history, 250_000)
    expect(result.messagesCleared).toBe(1)
    const cleared = result.messages.find((m) => m.role === 'tool')
    expect(cleared).toBeDefined()
    expect(cleared!.content).toEqual([
      {
        type: 'json',
        value: {
          compacted: true,
          command: 'ls',
          exitCode: 0,
        },
      },
    ])
  })

  test('configurable keep-recent raises the count gate', () => {
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: true,
      microCompactMaxKeepRecent: 6,
    })
    const history = buildHistory()
    const result = compactor.microCompact(history, 250_000)
    // 4 tool results ≤ keep-recent 6 → nothing cleared.
    expect(result.messagesCleared).toBe(0)
    expect(result.messages).toEqual(history)
  })
})
