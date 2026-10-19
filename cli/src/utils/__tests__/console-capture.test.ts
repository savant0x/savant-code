import { afterEach, describe, expect, test } from 'bun:test'

import {
  formatConsoleArguments,
  installConsoleCapture,
  resetConsoleCaptureState,
} from '../console-capture'

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  resetConsoleCaptureState()
})

describe('console capture — formatting', () => {
  test('joins strings, errors and objects without throwing on cycles', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' }
    cyclic.self = cyclic
    const error = new Error('boom')
    const text = formatConsoleArguments(['prefix', error, cyclic, 7])
    expect(text).toContain('prefix')
    expect(text).toContain('boom')
    expect(text).toContain('7')
  })
})

describe('console capture — installation', () => {
  test('console.error and console.warn reach the durable sink', () => {
    const errors: string[] = []
    const warns: string[] = []
    dispose = installConsoleCapture({
      error: (message) => errors.push(message),
      warn: (message) => warns.push(message),
      passthrough: false,
    })
    console.error('render failed', 42)
    console.warn('deprecated path')
    expect(errors).toEqual(['render failed 42'])
    expect(warns).toEqual(['deprecated path'])
  })

  // OpenTUI's renderer activation replaces console.error with its own capture,
  // which is why the first wrapper never saw a React failure. A rewrap must
  // sit on top of the replacement and still call through to it.
  test('a rewrap captures after another layer replaced the console', () => {
    const errors: string[] = []
    dispose = installConsoleCapture({
      error: (message) => errors.push(message),
      warn: () => {},
      passthrough: false,
    })
    const overlays: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      overlays.push(String(args[0]))
    }
    try {
      expect(
        installConsoleCapture({
          error: (message) => errors.push(message),
          warn: () => {},
          rewrap: true,
        }),
      ).toBeInstanceOf(Function)
      console.error('react commit failed')
      expect(errors).toEqual(['react commit failed'])
      expect(overlays).toEqual(['react commit failed'])
    } finally {
      console.error = originalError
    }
  })

  test('installing twice is a no-op and disposal restores the originals', () => {
    const errors: string[] = []
    dispose = installConsoleCapture({
      error: (message) => errors.push(message),
      warn: () => {},
      passthrough: false,
    })
    const second = installConsoleCapture({
      error: () => {},
      warn: () => {},
    })
    second()
    console.error('once')
    expect(errors).toEqual(['once'])
  })
})
