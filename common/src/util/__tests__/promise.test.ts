import { describe, expect, it, mock, spyOn } from 'bun:test'

import { withRetry } from '../promise'

describe('withRetry', () => {
  describe('basic functionality', () => {
    it('should return result on successful first attempt', async () => {
      const operation = mock(() => Promise.resolve('success'))

      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable error and succeed', async () => {
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts === 1) {
          const error = { type: 'APIConnectionError' }
          return Promise.reject(error)
        }
        return Promise.resolve('success after retry')
      })

      // Mock setTimeout to avoid delays
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      const result = await withRetry(operation)

      expect(result).toBe('success after retry')
      expect(attempts).toBe(2)

      setTimeoutSpy.mockRestore()
    })

    it('should throw immediately on non-retryable error', async () => {
      const error = new Error('non-retryable')
      const operation = mock(() => Promise.reject(error))

      await expect(withRetry(operation)).rejects.toThrow('non-retryable')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries exceeded', async () => {
      const error = { type: 'APIConnectionError' }
      const operation = mock(() => Promise.reject(error))

      // Mock setTimeout to avoid delays
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      await expect(
        withRetry(operation, { maxRetries: 3 }),
      ).rejects.toMatchObject({ type: 'APIConnectionError' })

      expect(operation).toHaveBeenCalledTimes(3)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('onRetry callback', () => {
    it('should call onRetry with error and attempt number', async () => {
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      const onRetry = mock(() => {})
      const error = { type: 'APIConnectionError' }
      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(error)
        }
        return Promise.resolve('success')
      })

      await withRetry(operation, {
        maxRetries: 3,
        onRetry,
      })

      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenNthCalledWith(1, error, 1)
      expect(onRetry).toHaveBeenNthCalledWith(2, error, 2)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('retryIf callback', () => {
    it('should use custom retryIf to determine retryability', async () => {
      const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
        ((callback: () => void) => {
          callback()
          return 0 as unknown as NodeJS.Timeout
        }) as typeof setTimeout,
      )

      let attempts = 0
      const operation = mock(() => {
        attempts++
        if (attempts === 1) {
          return Promise.reject({ code: 'RETRY_ME' })
        }
        return Promise.resolve('success')
      })

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryIf: (error) => error?.code === 'RETRY_ME',
      })

      expect(result).toBe('success')
      expect(attempts).toBe(2)

      setTimeoutSpy.mockRestore()
    })

    it('should not retry when retryIf returns false', async () => {
      const error = { code: 'DO_NOT_RETRY' }
      const operation = mock(() => Promise.reject(error))

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          retryIf: (err) => err?.code === 'RETRY_ME',
        }),
      ).rejects.toMatchObject({ code: 'DO_NOT_RETRY' })

      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})
