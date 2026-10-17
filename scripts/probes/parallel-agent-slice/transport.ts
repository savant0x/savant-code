export interface RequestRecord {
  index: number
  startedAt: number
  finishedAt?: number
  status?: number
  cancelFailed?: boolean
}

/** Counts actual HTTP sends, including provider correction/retry dispatches. */
export function installRequestGuard(options: {
  maxRequests: number
  concurrency: number
  signal: AbortSignal
  onDispatch?: (record: RequestRecord) => void
}): { records: RequestRecord[]; restore: () => void } {
  if (
    !Number.isSafeInteger(options.maxRequests) ||
    options.maxRequests < 1 ||
    !Number.isSafeInteger(options.concurrency) ||
    options.concurrency < 1
  )
    throw new Error('Invalid experiment request limits')
  const original = globalThis.fetch
  const records: RequestRecord[] = []
  let active = 0
  const waiters: Array<() => void> = []
  const acquire = async (signal: AbortSignal): Promise<() => void> => {
    signal.throwIfAborted()
    while (active >= options.concurrency) {
      await new Promise<void>((resolve, reject) => {
        const wake = () => {
          signal.removeEventListener('abort', abort)
          resolve()
        }
        const abort = () => {
          const index = waiters.indexOf(wake)
          if (index >= 0) waiters.splice(index, 1)
          reject(new Error('Request cancelled while queued'))
        }
        waiters.push(wake)
        signal.addEventListener('abort', abort, { once: true })
      })
      signal.throwIfAborted()
    }
    active += 1
    let released = false
    return () => {
      if (released) return
      released = true
      active -= 1
      waiters.shift()?.()
    }
  }
  const guarded = async (
    ...args: Parameters<typeof fetch>
  ): Promise<Response> => {
    const [input, init] = args
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    )
    if (
      url.origin !== 'https://api.apixoai.online' ||
      url.pathname !== '/v1/chat/completions'
    )
      throw new Error('Experiment blocked unrelated network destination')
    const signal = AbortSignal.any([
      options.signal,
      ...(init?.signal ? [init.signal] : []),
      ...(input instanceof Request ? [input.signal] : []),
    ])
    const release = await acquire(signal)
    if (records.length >= options.maxRequests) {
      release()
      throw new Error('Experiment inference request ceiling reached')
    }
    const record: RequestRecord = {
      index: records.length + 1,
      startedAt: Date.now(),
    }
    records.push(record)
    let detachAbort = () => {}
    const finish = () => {
      record.finishedAt ??= Date.now()
      detachAbort()
      release()
    }
    try {
      options.onDispatch?.(record)
      const response = await original(input, {
        ...init,
        signal,
        redirect: 'error',
      })
      record.status = response.status
      if (!response.body) {
        finish()
        return response
      }
      const reader = response.body.getReader()
      const abortReader = () => {
        void reader.cancel().then(finish, () => {
          record.cancelFailed = true
          finish()
        })
      }
      signal.addEventListener('abort', abortReader, { once: true })
      detachAbort = () => signal.removeEventListener('abort', abortReader)
      if (signal.aborted) abortReader()
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await reader.read()
            if (next.done) {
              finish()
              controller.close()
            } else controller.enqueue(next.value)
          } catch (error) {
            finish()
            controller.error(error)
          }
        },
        async cancel(reason) {
          try {
            await reader.cancel(reason)
          } finally {
            finish()
          }
        },
      })
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    } catch (error) {
      finish()
      throw error
    }
  }
  globalThis.fetch = Object.assign(guarded, { preconnect: original.preconnect })
  return {
    records,
    restore: () => {
      globalThis.fetch = original
    },
  }
}
