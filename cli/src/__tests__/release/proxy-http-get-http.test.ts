import { createRequire } from 'node:module'

import { describe, expect, test } from 'bun:test'

import { createResponse, helperModules } from './proxy-http-get-fixtures'

import type { Readable } from 'node:stream'

const require = createRequire(import.meta.url)

for (const helperModule of helperModules) {
  describe(helperModule.name, () => {
    test('uses plain HTTP for local release servers', async () => {
      const httpGetCalls: Array<Record<string, unknown>> = []
      const { createReleaseHttpClient } = require(helperModule.path)
      const client = createReleaseHttpClient({
        env: {},
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
        httpModule: {
          get(
            options: Record<string, unknown>,
            callback: (response: Readable) => void,
          ) {
            httpGetCalls.push(options)
            queueMicrotask(() => callback(createResponse(200, {}, 'ok')))
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
        httpsModule: {
          get() {
            throw new Error('HTTPS transport should not be used')
          },
        },
      })

      const response = await client.httpGet('http://localhost/releases/file')
      response.resume()

      expect(httpGetCalls).toEqual([
        {
          hostname: 'localhost',
          port: 80,
          path: '/releases/file',
          headers: { 'User-Agent': 'release-test-agent' },
        },
      ])
    })

    test('sends HTTP release requests through an HTTP proxy', async () => {
      const httpGetCalls: Array<Record<string, unknown>> = []
      const { createReleaseHttpClient } = require(helperModule.path)
      const client = createReleaseHttpClient({
        env: { HTTP_PROXY: 'http://proxy.internal:7890' },
        userAgent: 'release-test-agent',
        requestTimeout: 2500,
        httpModule: {
          get(
            options: Record<string, unknown>,
            callback: (response: Readable) => void,
          ) {
            httpGetCalls.push(options)
            queueMicrotask(() => callback(createResponse(200, {}, 'ok')))
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

      const response = await client.httpGet(
        'http://releases.internal:3000/files/asset',
      )
      response.resume()

      expect(httpGetCalls).toEqual([
        {
          hostname: 'proxy.internal',
          port: '7890',
          path: 'http://releases.internal:3000/files/asset',
          headers: {
            Host: 'releases.internal:3000',
            'User-Agent': 'release-test-agent',
          },
        },
      ])
    })
  })
}
