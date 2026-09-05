import { describe, expect, it } from 'bun:test'

import {
  ABORT_ERROR_MESSAGE,
  isAbortError,
  promptAborted,
  promptSuccess,
  unwrapPromptResult,
  type PromptResult,
} from '../error'

describe('PromptResult integration patterns', () => {
  describe('early return pattern', () => {
    async function mockLlmCall(
      shouldAbort: boolean,
    ): Promise<PromptResult<string>> {
      if (shouldAbort) {
        return promptAborted('User cancelled')
      }
      return promptSuccess('LLM response')
    }

    async function callerWithEarlyReturn(
      shouldAbort: boolean,
    ): Promise<string | null> {
      const result = await mockLlmCall(shouldAbort)
      if (result.aborted) {
        return null
      }
      return result.value.toUpperCase()
    }

    it('returns transformed value on success', async () => {
      const result = await callerWithEarlyReturn(false)
      expect(result).toBe('LLM RESPONSE')
    })

    it('returns null on abort', async () => {
      const result = await callerWithEarlyReturn(true)
      expect(result).toBeNull()
    })
  })

  describe('unwrap with try/catch pattern', () => {
    async function mockLlmCall(
      shouldAbort: boolean,
    ): Promise<PromptResult<string>> {
      if (shouldAbort) {
        return promptAborted('Signal triggered')
      }
      return promptSuccess('Success response')
    }

    async function callerWithUnwrap(shouldAbort: boolean): Promise<string> {
      return unwrapPromptResult(await mockLlmCall(shouldAbort))
    }

    async function outerCaller(
      shouldAbort: boolean,
    ): Promise<{ result: string; wasAborted: boolean }> {
      try {
        const result = await callerWithUnwrap(shouldAbort)
        return { result, wasAborted: false }
      } catch (error) {
        if (isAbortError(error)) {
          return { result: '', wasAborted: true }
        }
        throw error // Rethrow non-abort errors
      }
    }

    it('returns result on success', async () => {
      const { result, wasAborted } = await outerCaller(false)
      expect(result).toBe('Success response')
      expect(wasAborted).toBe(false)
    })

    it('catches and identifies abort', async () => {
      const { result, wasAborted } = await outerCaller(true)
      expect(result).toBe('')
      expect(wasAborted).toBe(true)
    })
  })

  describe('nested function abort propagation', () => {
    async function deepestCall(signal: {
      aborted: boolean
    }): Promise<PromptResult<number>> {
      if (signal.aborted) {
        return promptAborted('Aborted at deepest level')
      }
      return promptSuccess(42)
    }

    async function middleCall(signal: {
      aborted: boolean
    }): Promise<PromptResult<string>> {
      const result = await deepestCall(signal)
      if (result.aborted) {
        return result // Propagate abort
      }
      return promptSuccess(`Value: ${result.value}`)
    }

    async function topCall(signal: {
      aborted: boolean
    }): Promise<PromptResult<string[]>> {
      const result = await middleCall(signal)
      if (result.aborted) {
        return result // Propagate abort
      }
      return promptSuccess([result.value, 'additional'])
    }

    it('propagates success through all levels', async () => {
      const signal = { aborted: false }
      const result = await topCall(signal)
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toEqual(['Value: 42', 'additional'])
      }
    })

    it('propagates abort from deepest level', async () => {
      const signal = { aborted: true }
      const result = await topCall(signal)
      expect(result.aborted).toBe(true)
      if (result.aborted) {
        expect(result.reason).toBe('Aborted at deepest level')
      }
    })
  })

  describe('mixed pattern with fallback', () => {
    async function primaryProvider(signal: {
      aborted: boolean
    }): Promise<PromptResult<string>> {
      if (signal.aborted) {
        return promptAborted()
      }
      // Simulate primary provider failure
      throw new Error('Primary provider unavailable')
    }

    async function fallbackProvider(signal: {
      aborted: boolean
    }): Promise<PromptResult<string>> {
      if (signal.aborted) {
        return promptAborted()
      }
      return promptSuccess('Fallback result')
    }

    async function callWithFallback(signal: {
      aborted: boolean
    }): Promise<PromptResult<string>> {
      try {
        const result = await primaryProvider(signal)
        // If aborted, don't try fallback
        if (result.aborted) {
          return result
        }
        return result
      } catch (error) {
        // Don't fall back on abort errors
        if (isAbortError(error)) {
          throw error
        }
        // Try fallback for other errors
        return fallbackProvider(signal)
      }
    }

    it('uses fallback on non-abort error', async () => {
      const signal = { aborted: false }
      const result = await callWithFallback(signal)
      expect(result.aborted).toBe(false)
      if (!result.aborted) {
        expect(result.value).toBe('Fallback result')
      }
    })

    it('does not use fallback on abort', async () => {
      const signal = { aborted: true }
      const result = await callWithFallback(signal)
      expect(result.aborted).toBe(true)
    })
  })

  describe('abort during async iteration', () => {
    async function* generateValues(signal: {
      aborted: boolean
    }): AsyncGenerator<PromptResult<number>> {
      for (let i = 0; i < 5; i++) {
        if (signal.aborted) {
          yield promptAborted(`Aborted at iteration ${i}`)
          return
        }
        yield promptSuccess(i)
      }
    }

    async function collectValues(signal: {
      aborted: boolean
    }): Promise<{ values: number[]; abortedAt?: string }> {
      const values: number[] = []
      for await (const result of generateValues(signal)) {
        if (result.aborted) {
          return { values, abortedAt: result.reason }
        }
        values.push(result.value)
      }
      return { values }
    }

    it('collects all values when not aborted', async () => {
      const signal = { aborted: false }
      const { values, abortedAt } = await collectValues(signal)
      expect(values).toEqual([0, 1, 2, 3, 4])
      expect(abortedAt).toBeUndefined()
    })

    it('stops iteration on abort', async () => {
      const signal = { aborted: false }
      // Simulate abort after first value
      const generator = generateValues(signal)
      const results: number[] = []

      for await (const result of generator) {
        if (result.aborted) break
        results.push(result.value)
        if (results.length === 2) {
          signal.aborted = true
        }
      }

      expect(results).toEqual([0, 1])
    })
  })

  describe('rethrow pattern in catch blocks', () => {
    async function innerOperation(): Promise<PromptResult<string>> {
      return promptAborted('Inner abort')
    }

    async function middleOperation(): Promise<string> {
      const result = await innerOperation()
      return unwrapPromptResult(result)
    }

    async function outerOperationBad(): Promise<string> {
      try {
        return await middleOperation()
      } catch (error) {
        // BAD: swallows abort error
        return 'default value'
      }
    }

    async function outerOperationGood(): Promise<string> {
      try {
        return await middleOperation()
      } catch (error) {
        // GOOD: rethrows abort error
        if (isAbortError(error)) {
          throw error
        }
        return 'default value'
      }
    }

    it('bad pattern swallows abort', async () => {
      const result = await outerOperationBad()
      // This shows the anti-pattern - abort was swallowed
      expect(result).toBe('default value')
    })

    it('good pattern propagates abort', async () => {
      await expect(outerOperationGood()).rejects.toThrow(ABORT_ERROR_MESSAGE)
    })

    it('good pattern rethrows AbortError that can be detected', async () => {
      try {
        await outerOperationGood()
        expect(true).toBe(false) // Should not reach
      } catch (error) {
        expect(isAbortError(error)).toBe(true)
      }
    })
  })
})
