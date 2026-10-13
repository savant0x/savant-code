import { describe, expect, test } from 'bun:test'

import { createClientToolBridge } from './client-tool-bridge'
import { inspectToolResultFailure } from './tool-result-errors'

import type { ClientToolCall } from '@savant-code/common/tools/list'

/**
 * FID-2026-1012-023 — the site that produced the recorded class
 * `run_readonly_command — Tool call aborted: run_terminal_command`: the record
 * named the caller while the message named the executed tool. These pins bind
 * the bridge's abort receipt to the capture inspection that reads it, so the
 * attribution cannot drift back into prose.
 */

const TERMINAL_CALL: ClientToolCall<'run_terminal_command'> = {
  toolName: 'run_terminal_command',
  toolCallId: 'call-1',
  input: {
    command: 'bun run typecheck',
    mode: 'assistant',
    process_type: 'SYNC',
    timeout_seconds: 30,
  },
}

/** The executor supplies a real dispatcher; these pins need its call count. */
function bridgeFor(
  signal: AbortSignal,
  onDispatch: () => void,
  dispatched: unknown = [{ type: 'json', value: { command: 'ok' } }],
) {
  return createClientToolBridge<'run_terminal_command'>({
    signal,
    userInputId: 'ui-1',
    requestToolCall: (async () => {
      onDispatch()
      return { output: dispatched }
    }) as never,
  })
}

describe('client-tool bridge abort attribution (FID-2026-1012-023)', () => {
  test('an aborted call names the executed tool and never dispatches it', async () => {
    const controller = new AbortController()
    controller.abort()
    let dispatches = 0

    const output = await bridgeFor(controller.signal, () => {
      dispatches += 1
    })(TERMINAL_CALL)

    expect(dispatches).toBe(0)
    expect(output[0]).toMatchObject({
      type: 'json',
      value: {
        errorMessage: 'Tool call aborted: run_terminal_command',
        executionOutcome: 'cancelled',
        executionStarted: false,
        executedToolName: 'run_terminal_command',
        terminationState: 'not-started',
      },
    })
  })

  test('the abort receipt carries the identity the capture record stores', async () => {
    const controller = new AbortController()
    controller.abort()

    const output = await bridgeFor(controller.signal, () => {})(TERMINAL_CALL)
    const inspection = inspectToolResultFailure(output)

    expect(inspection.failed).toBe(true)
    expect(inspection.line).toBe('Tool call aborted: run_terminal_command')
    expect(inspection.commandExecution).toMatchObject({
      executionOutcome: 'cancelled',
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
    })
  })

  test('a live call passes the client tool result through unchanged', async () => {
    const controller = new AbortController()
    let dispatches = 0

    const output = await bridgeFor(controller.signal, () => {
      dispatches += 1
    })(TERMINAL_CALL)

    expect(dispatches).toBe(1)
    expect(output).toEqual([{ type: 'json', value: { command: 'ok' } }])
    expect(inspectToolResultFailure(output).failed).toBe(false)
  })
})
