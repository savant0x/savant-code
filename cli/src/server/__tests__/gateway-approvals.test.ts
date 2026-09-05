import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  createFakeRunPrompt,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('gateway approval lifecycle', () => {
  test('ask_user surfaces as approval_request and approval_response resolves the run', async () => {
    const runPrompt = createFakeRunPrompt({
      events: [{ type: 'start', messageHistoryLength: 0 }],
      resultId: 'run-approval',
      delayMs: 20,
    })
    const gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // Start a run, then simulate the agent asking a question through the
    // bridge — the gateway should emit an approval_request event.
    await request(socket, 'user_message', { prompt: 'plan this' }, 2)

    // Trigger the bridge request (the AskUserBridge singleton is shared; the
    // gateway's subscriber converts it into an approval_request event).
    const { AskUserBridge } =
      await import('@savant-code/common/utils/ask-user-bridge')
    const responsePromise = AskUserBridge.request('test-tool-call', [
      {
        question: 'Approve?',
        options: [{ label: 'Yes' }, { label: 'No' }],
        multiSelect: false,
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Wait for the approval_request event on the stream.
    const approvalFrame = await new Promise<{
      params?: { approvalId?: string }
    }>((resolve) => {
      const onMessage = (event: MessageEvent): void => {
        const frame = JSON.parse(String(event.data)) as {
          method?: string
          params?: unknown
        }
        if (frame.method === 'event') {
          const events = frame.params as PrintModeEvent[]
          const approval = events.find((e) => e.type === 'approval_request')
          if (approval) {
            socket.offMessage(onMessage)
            resolve({ params: { approvalId: approval.approvalId } })
          }
        }
      }
      socket.onMessage(onMessage)
    })

    // Resolve it via approval_response → the bridge promise resolves.
    await request(
      socket,
      'approval_response',
      {
        approvalId: approvalFrame.params?.approvalId,
        response: { answers: [], skipped: true },
      },
      3,
    )
    const result = await responsePromise
    expect(result).toMatchObject({ skipped: true })
    socket.close()
  })

  test('socket close denies a pending approval fail-closed (skipped recorded)', async () => {
    const gateway = await startTestGateway({
      runPrompt: createFakeRunPrompt({ delayMs: 50 }),
    })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket, 'user_message', { prompt: 'run' }, 2)

    const { AskUserBridge } =
      await import('@savant-code/common/utils/ask-user-bridge')
    const responsePromise = AskUserBridge.request('test-tool-call-2', [
      {
        question: 'Q?',
        options: [{ label: 'A' }, { label: 'B' }],
        multiSelect: false,
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Closing the socket denies the pending approval fail-closed.
    socket.close()
    const result = await responsePromise
    expect(result).toMatchObject({ skipped: true, answers: [] })
  })
})
