import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

export const helperModules = [
  {
    name: 'shared release helper',
    path: fileURLToPath(
      new URL('../../../release-core/http.js', import.meta.url),
    ),
  },
]

export function createResponse(
  statusCode: number,
  headers: Record<string, string>,
  body = '',
) {
  const response = Readable.from(body.length > 0 ? [body] : [])
  return Object.assign(response, {
    statusCode,
    headers,
  })
}

export function createConnectRequest({
  statusCode = 200,
  tunnelSocket,
  recorder,
}: {
  statusCode?: number
  tunnelSocket: object
  recorder: { timeoutCalls: number }
}) {
  const emitter = new EventEmitter()

  return {
    on(event: string, listener: (...args: any[]) => void) {
      emitter.on(event, listener)
      return this
    },
    setTimeout() {
      recorder.timeoutCalls += 1
      return this
    },
    destroy() {},
    end() {
      queueMicrotask(() => {
        emitter.emit('connect', { statusCode }, tunnelSocket)
      })
    },
  }
}
