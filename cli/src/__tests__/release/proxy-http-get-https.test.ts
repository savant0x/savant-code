import { createRequire } from 'node:module'

import { describe, expect, test } from 'bun:test'

import {
  createConnectRequest,
  createResponse,
  helperModules,
} from './proxy-http-get-fixtures'

import type { Readable } from 'node:stream'

const require = createRequire(import.meta.url)

for (const helperModule of helperModules) {
  describe(helperModule.name, () => {
    test('uses a tunnel agent instead of createConnection for proxied HTTPS requests', async () => {
      const connectCalls: Array<Record<string, unknown>> = []
      const httpsGetCalls: Array<Record<string, unknown>> = []
      const tlsConnectCalls: Array<Record<string, unknown>> = []

      const tunnelSocket = { kind: 'tunnel-socket' }
      const tlsSocket = { kind: 'tls-socket' }

      const { createReleaseHttpClient } = require(helperModule.path)

      const client = createReleaseHttpClient({
        env: {
          HTTPS_PROXY: 'http://proxy.internal:7890',
        },
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
        httpModule: {
          request(options: Record<string, unknown>) {
            connectCalls.push(options)
            return createConnectRequest({
              tunnelSocket,
              recorder: { timeoutCalls: 0 },
            })
          },
        },
        httpsModule: {
          Agent: class FakeAgent {
            options: Record<string, unknown>

            constructor(options: Record<string, unknown>) {
              this.options = options
            }
          },
          get(
            options: Record<string, any>,
            callback: (response: Readable) => void,
          ) {
            httpsGetCalls.push(options)
            options.agent.createConnection(options)
            queueMicrotask(() => {
              callback(createResponse(200, {}, '{"version":"0.0.33"}'))
            })
            return {
              on() {
                return this
              },
              setTimeout() {
                return this
              },
              destroy() {},
            }
          },
        },
        tlsModule: {
          connect(options: Record<string, unknown>) {
            tlsConnectCalls.push(options)
            return tlsSocket
          },
        },
      })

      const response = await client.httpGet(
        'https://registry.npmjs.org/savant-free/latest',
      )
      response.resume()

      expect(connectCalls).toHaveLength(1)
      expect(connectCalls[0]).toMatchObject({
        hostname: 'proxy.internal',
        port: '7890',
        method: 'CONNECT',
        path: 'registry.npmjs.org:443',
        headers: {
          Host: 'registry.npmjs.org:443',
        },
      })

      expect(httpsGetCalls).toHaveLength(1)
      expect(httpsGetCalls[0]?.createConnection).toBeUndefined()
      expect(httpsGetCalls[0]?.agent).toBeDefined()
      expect(httpsGetCalls[0]).toMatchObject({
        hostname: 'registry.npmjs.org',
        path: '/savant-free/latest',
        headers: {
          'User-Agent': 'release-test-agent',
        },
      })

      expect(tlsConnectCalls).toEqual([
        {
          socket: tunnelSocket,
          servername: 'registry.npmjs.org',
        },
      ])
    })

    test('reuses the same proxy strategy across redirects', async () => {
      const httpsGetCalls: Array<Record<string, unknown>> = []

      const { createReleaseHttpClient } = require(helperModule.path)

      let callCount = 0
      const client = createReleaseHttpClient({
        env: {
          HTTPS_PROXY: 'http://proxy.internal:7890',
        },
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
        httpModule: {
          request() {
            return createConnectRequest({
              tunnelSocket: { kind: 'tunnel-socket' },
              recorder: { timeoutCalls: 0 },
            })
          },
        },
        httpsModule: {
          Agent: class FakeAgent {},
          get(
            options: Record<string, any>,
            callback: (response: Readable) => void,
          ) {
            httpsGetCalls.push(options)
            callCount += 1

            queueMicrotask(() => {
              if (callCount === 1) {
                callback(
                  createResponse(307, {
                    location: '/redirected',
                  }),
                )
                return
              }

              callback(createResponse(200, {}, 'ok'))
            })

            return {
              on() {
                return this
              },
              setTimeout() {
                return this
              },
              destroy() {},
            }
          },
        },
        tlsModule: {
          connect() {
            return { kind: 'tls-socket' }
          },
        },
      })

      const response = await client.httpGet(
        'https://registry.npmjs.org/savant-free/latest',
      )
      response.resume()

      expect(httpsGetCalls).toHaveLength(2)
      expect(httpsGetCalls[0]).toMatchObject({
        hostname: 'registry.npmjs.org',
        path: '/savant-free/latest',
      })
      expect(httpsGetCalls[1]).toMatchObject({
        hostname: 'registry.npmjs.org',
        path: '/redirected',
      })
      expect(
        httpsGetCalls.every((call) => call.createConnection === undefined),
      ).toBe(true)
      expect(httpsGetCalls.every((call) => call.agent != null)).toBe(true)
    })

    test('limits redirect chains', async () => {
      const { createReleaseHttpClient } = require(helperModule.path)
      let callCount = 0

      const client = createReleaseHttpClient({
        env: {},
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
        httpsModule: {
          get(_options: unknown, callback: (response: Readable) => void) {
            callCount += 1
            queueMicrotask(() => {
              callback(createResponse(302, { location: '/again' }))
            })
            return {
              on() {
                return this
              },
              setTimeout() {
                return this
              },
              destroy() {},
            }
          },
        },
      })

      await expect(
        client.httpGet('https://example.com/start', { maxRedirects: 2 }),
      ).rejects.toThrow('Too many redirects')
      expect(callCount).toBe(3)
    })
  })
}
