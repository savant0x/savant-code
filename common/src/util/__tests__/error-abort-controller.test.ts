import { describe, expect, it } from 'bun:test'

import {
  AbortError,
  isAbortError,
  promptAborted,
  promptSuccess,
  type PromptResult,
} from '../error'

describe('AbortController integration', () => {
  describe('signal.aborted check pattern', () => {
    async function mockLlmCallWithSignal(
      signal: AbortSignal,
    ): Promise<PromptResult<string>> {
      if (signal.aborted) {
        return promptAborted('Signal was already aborted')
      }
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (signal.aborted) {
        return promptAborted('Signal aborted during operation')
      }
      return promptSuccess('Operation completed')
    }

    it('returns success when signal is not aborted', async () => {
      const controller = new AbortController()
      const result = await mockLlmCallWithSignal(controller.signal)
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toBe('Operation completed')
      }
    })

    it('returns aborted when signal is pre-aborted', async () => {
      const controller = new AbortController()
      controller.abort()
      const result = await mockLlmCallWithSignal(controller.signal)
      expect(result.aborted).toBe(true)
      if (result.aborted) {
        expect(result.reason).toBe('Signal was already aborted')
      }
    })
  })

  describe('sequential operations with abort', () => {
    const callLog: string[] = []

    async function step1(signal: AbortSignal): Promise<PromptResult<string>> {
      callLog.push('step1')
      if (signal.aborted) return promptAborted('step1 aborted')
      return promptSuccess('step1 result')
    }

    async function step2(signal: AbortSignal): Promise<PromptResult<string>> {
      callLog.push('step2')
      if (signal.aborted) return promptAborted('step2 aborted')
      return promptSuccess('step2 result')
    }

    async function step3(signal: AbortSignal): Promise<PromptResult<string>> {
      callLog.push('step3')
      if (signal.aborted) return promptAborted('step3 aborted')
      return promptSuccess('step3 result')
    }

    async function runSequentialSteps(
      signal: AbortSignal,
    ): Promise<PromptResult<string[]>> {
      const results: string[] = []

      const r1 = await step1(signal)
      if (r1.aborted) return r1
      results.push(r1.value)

      const r2 = await step2(signal)
      if (r2.aborted) return r2
      results.push(r2.value)

      const r3 = await step3(signal)
      if (r3.aborted) return r3
      results.push(r3.value)

      return promptSuccess(results)
    }

    it('completes all steps when not aborted', async () => {
      callLog.length = 0
      const controller = new AbortController()
      const result = await runSequentialSteps(controller.signal)
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toEqual([
          'step1 result',
          'step2 result',
          'step3 result',
        ])
      }
      expect(callLog).toEqual(['step1', 'step2', 'step3'])
    })

    it('stops at first step when pre-aborted', async () => {
      callLog.length = 0
      const controller = new AbortController()
      controller.abort()
      const result = await runSequentialSteps(controller.signal)
      expect(result.aborted).toBe(true)
      // Only step1 should be called, and it should return aborted immediately
      expect(callLog).toEqual(['step1'])
    })
  })

  describe('fallback should NOT occur on abort (user intent)', () => {
    let fallbackCalled = false

    async function primaryModel(
      signal: AbortSignal,
    ): Promise<PromptResult<string>> {
      if (signal.aborted) {
        return promptAborted('User cancelled')
      }
      return promptSuccess('Primary model response')
    }

    async function fallbackModel(
      signal: AbortSignal,
    ): Promise<PromptResult<string>> {
      fallbackCalled = true
      if (signal.aborted) {
        return promptAborted('User cancelled')
      }
      return promptSuccess('Fallback model response')
    }

    async function callWithFallbackOnError(
      signal: AbortSignal,
      primaryShouldThrowError: boolean,
      primaryShouldAbort: boolean,
    ): Promise<PromptResult<string>> {
      try {
        if (primaryShouldThrowError) {
          throw new Error('Primary provider unavailable')
        }
        const primaryResult = primaryShouldAbort
          ? promptAborted('User cancelled primary')
          : await primaryModel(signal)

        // Key pattern: if aborted, do NOT fall back - abort represents user intent
        if (primaryResult.aborted) {
          return primaryResult
        }
        return primaryResult
      } catch (error) {
        // Don't fall back on abort errors
        if (isAbortError(error)) {
          throw error
        }
        // Try fallback for other errors
        return fallbackModel(signal)
      }
    }

    it('returns primary result when not aborted', async () => {
      fallbackCalled = false
      const controller = new AbortController()
      const result = await callWithFallbackOnError(
        controller.signal,
        false,
        false,
      )
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toBe('Primary model response')
      }
      expect(fallbackCalled).toBe(false)
    })

    it('propagates abort without fallback (respects user intent)', async () => {
      fallbackCalled = false
      const controller = new AbortController()
      const result = await callWithFallbackOnError(
        controller.signal,
        false,
        true,
      )
      expect(result.aborted).toBe(true)
      // Verify fallback was never called - abort means user wants to stop, not retry
      expect(fallbackCalled).toBe(false)
    })

    it('uses fallback on non-abort error', async () => {
      fallbackCalled = false
      const controller = new AbortController()
      const result = await callWithFallbackOnError(
        controller.signal,
        true,
        false,
      )
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toBe('Fallback model response')
      }
      // Verify fallback WAS called for non-abort error
      expect(fallbackCalled).toBe(true)
    })
  })

  describe('DOMException from AbortController', () => {
    it('native abort reason is detected by isAbortError', () => {
      const controller = new AbortController()
      controller.abort()
      // When you call controller.abort(), signal.reason becomes a DOMException
      // with name 'AbortError'
      const reason = controller.signal.reason
      expect(reason).toBeInstanceOf(DOMException)
      expect(isAbortError(reason)).toBe(true)
    })

    it('custom abort reason string is not detected as AbortError', () => {
      const controller = new AbortController()
      controller.abort('custom reason string')
      // When you provide a reason, signal.reason is that value, not a DOMException
      const reason = controller.signal.reason
      expect(isAbortError(reason)).toBe(false) // string is not an Error
    })

    it('custom abort reason Error with AbortError name is detected', () => {
      const controller = new AbortController()
      const customAbortError = new AbortError('custom abort')
      controller.abort(customAbortError)
      const reason = controller.signal.reason
      expect(isAbortError(reason)).toBe(true)
    })
  })
})
