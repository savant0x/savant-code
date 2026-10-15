import { afterEach, describe, expect, test } from 'bun:test'

import {
  getCurrentSchedule,
  registerLoopDueHandler,
  startLoop,
  stopLoop,
} from '../../hooks/use-loop-scheduler'
import { handleLoopCommand } from '../loop'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

let unregisterHandler: (() => void) | null = null

afterEach(() => {
  unregisterHandler?.()
  unregisterHandler = null
  stopLoop()
})

const flushSchedulerPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('handleLoopCommand', () => {
  test('starts a loop through the registered handler', async () => {
    const messages: ChatMessage[] = []
    const prompts: string[] = []
    const params = {
      inputValue: '/loop 1s run tests',
      setMessages: (update: Parameters<RouterParams['setMessages']>[0]) => {
        const next = typeof update === 'function' ? update(messages) : update
        messages.splice(0, messages.length, ...next)
      },
      saveToHistory: () => {},
      setInputValue: () => {},
      scrollToLatest: () => {},
    } as unknown as RouterParams

    unregisterHandler = registerLoopDueHandler((schedule) => {
      prompts.push(schedule.prompt)
    })
    await handleLoopCommand(params, '1s run tests')
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(prompts).toEqual(['run tests'])
    expect(getCurrentSchedule()?.runCount).toBe(1)
    expect(messages.at(-1)?.content).toContain('First run executing now')
  })

  test('leaves a first run pending when no handler is mounted', async () => {
    const params = {
      inputValue: '/loop 1s run tests',
      setMessages: () => {},
      saveToHistory: () => {},
      setInputValue: () => {},
      scrollToLatest: () => {},
    } as unknown as RouterParams

    await handleLoopCommand(params, '1s run tests')

    expect(getCurrentSchedule()?.runCount).toBe(0)
    expect(getCurrentSchedule()?.lastRunAt).toBeUndefined()
  })

  test('reports an immediate run as pending until its send settles', async () => {
    const messages: ChatMessage[] = []
    const params = {
      inputValue: '/loop status',
      setMessages: (update: Parameters<RouterParams['setMessages']>[0]) => {
        const next = typeof update === 'function' ? update(messages) : update
        messages.splice(0, messages.length, ...next)
      },
      saveToHistory: () => {},
      setInputValue: () => {},
    } as unknown as RouterParams

    unregisterHandler = registerLoopDueHandler(
      () => new Promise<void>(() => {}),
    )
    startLoop(30_000, '30s', 'run tests')
    await handleLoopCommand(params, 'status')

    const statusMessage = messages.at(-1)?.content ?? ''
    expect(statusMessage).toContain('Status: ⏳ pending')
  })
})
