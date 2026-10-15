import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline as nodePipeline } from 'node:stream/promises'

import { describe, expect, test } from 'bun:test'

import { createResponse, helperModules } from './proxy-http-get-fixtures'

import type { Readable, Writable } from 'node:stream'

const require = createRequire(import.meta.url)

for (const helperModule of helperModules) {
  describe(helperModule.name, () => {
    test('resumes an interrupted file download from the saved byte', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'release-resume-'))
      const destinationPath = join(tempDir, 'asset.part')
      const httpsGetCalls: Array<Record<string, any>> = []

      try {
        const { createReleaseHttpClient } = require(helperModule.path)
        let callCount = 0
        let pipelineCallCount = 0
        const client = createReleaseHttpClient({
          env: {},
          userAgent: 'release-test-agent',
          requestTimeout: 2500,
          async pipelineFn(source: Readable, destination: Writable) {
            pipelineCallCount += 1
            if (pipelineCallCount === 1) {
              for await (const chunk of source) {
                destination.write(chunk)
              }
              await new Promise<void>((resolve, reject) => {
                destination.end(resolve)
                destination.once('error', reject)
              })
              throw Object.assign(new Error('read ECONNRESET'), {
                code: 'ECONNRESET',
              })
            }
            return nodePipeline(source, destination)
          },
          httpsModule: {
            get(
              options: Record<string, any>,
              callback: (response: Readable) => void,
            ) {
              httpsGetCalls.push(options)
              callCount += 1
              queueMicrotask(() => {
                if (callCount === 1) {
                  callback(
                    createResponse(200, { 'content-length': '10' }, 'hello'),
                  )
                  return
                }
                callback(
                  createResponse(
                    206,
                    { 'content-range': 'bytes 5-9/10' },
                    'world',
                  ),
                )
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
          client.downloadFile('https://example.com/asset', destinationPath),
        ).rejects.toMatchObject({
          code: 'ECONNRESET',
          downloadedBytes: 5,
          totalBytes: 10,
        })
        expect(readFileSync(destinationPath, 'utf8')).toBe('hello')

        const result = await client.downloadFile(
          'https://example.com/asset',
          destinationPath,
        )

        expect(httpsGetCalls[1]?.headers?.Range).toBe('bytes=5-')
        expect(result).toMatchObject({
          downloadedBytes: 10,
          resumedFrom: 5,
          totalBytes: 10,
        })
        expect(readFileSync(destinationPath, 'utf8')).toBe('helloworld')
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    test('restarts safely when a server ignores the Range header', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'release-restart-'))
      const destinationPath = join(tempDir, 'asset.part')
      writeFileSync(destinationPath, 'stale')

      try {
        const { createReleaseHttpClient } = require(helperModule.path)
        let requestHeaders: Record<string, string> = {}
        const client = createReleaseHttpClient({
          env: {},
          userAgent: 'release-test-agent',
          requestTimeout: 2500,
          httpsModule: {
            get(
              options: Record<string, any>,
              callback: (response: Readable) => void,
            ) {
              requestHeaders = options.headers
              queueMicrotask(() => {
                callback(
                  createResponse(200, { 'content-length': '5' }, 'fresh'),
                )
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

        const result = await client.downloadFile(
          'https://example.com/asset',
          destinationPath,
        )

        expect(requestHeaders.Range).toBe('bytes=5-')
        expect(result).toMatchObject({
          downloadedBytes: 5,
          resumedFrom: 0,
          totalBytes: 5,
        })
        expect(readFileSync(destinationPath, 'utf8')).toBe('fresh')
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    test('discards a stale partial file rejected by the server', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'release-stale-'))
      const destinationPath = join(tempDir, 'asset.part')
      writeFileSync(destinationPath, 'too-long')

      try {
        const { createReleaseHttpClient } = require(helperModule.path)
        const client = createReleaseHttpClient({
          env: {},
          userAgent: 'release-test-agent',
          requestTimeout: 2500,
          httpsModule: {
            get(
              _options: Record<string, any>,
              callback: (response: Readable) => void,
            ) {
              queueMicrotask(() => {
                callback(createResponse(416, { 'content-range': 'bytes */5' }))
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
          client.downloadFile('https://example.com/asset', destinationPath),
        ).rejects.toMatchObject({ statusCode: 416, retryable: true })
        expect(existsSync(destinationPath)).toBe(false)
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    test('rejects a response body that overruns its Content-Range', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'release-overrun-'))
      const destinationPath = join(tempDir, 'asset.part')
      writeFileSync(destinationPath, 'hello')

      try {
        const { createReleaseHttpClient } = require(helperModule.path)
        const client = createReleaseHttpClient({
          env: {},
          userAgent: 'release-test-agent',
          requestTimeout: 2500,
          httpsModule: {
            get(
              _options: Record<string, any>,
              callback: (response: Readable) => void,
            ) {
              queueMicrotask(() => {
                callback(
                  createResponse(
                    206,
                    { 'content-range': 'bytes 5-8/10' },
                    'world',
                  ),
                )
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
          client.downloadFile('https://example.com/asset', destinationPath),
        ).rejects.toMatchObject({
          code: 'EINCOMPLETE',
          downloadedBytes: 0,
          totalBytes: 10,
        })
        expect(existsSync(destinationPath)).toBe(false)
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })
}
