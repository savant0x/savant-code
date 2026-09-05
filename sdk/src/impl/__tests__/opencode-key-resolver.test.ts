// Shared OpenCode credential chain (FID-2026-0905-003 key merge):
// OPENCODE_API_KEY first, legacy OPENCODE_GO_API_KEY fallback.

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import { resolveOpencodeApiKey } from '../opencode-key-resolver'

describe('resolveOpencodeApiKey', () => {
  let originalShared: string | undefined
  let originalLegacy: string | undefined

  beforeEach(() => {
    originalShared = process.env.OPENCODE_API_KEY
    originalLegacy = process.env.OPENCODE_GO_API_KEY
    delete process.env.OPENCODE_API_KEY
    delete process.env.OPENCODE_GO_API_KEY
  })

  afterEach(() => {
    if (originalShared === undefined) delete process.env.OPENCODE_API_KEY
    else process.env.OPENCODE_API_KEY = originalShared
    if (originalLegacy === undefined) delete process.env.OPENCODE_GO_API_KEY
    else process.env.OPENCODE_GO_API_KEY = originalLegacy
  })

  test('returns undefined when neither var is set', async () => {
    await expect(resolveOpencodeApiKey()).resolves.toBeUndefined()
  })

  test('prefers the shared OPENCODE_API_KEY', async () => {
    process.env.OPENCODE_API_KEY = 'shared-key'
    process.env.OPENCODE_GO_API_KEY = 'legacy-key'
    await expect(resolveOpencodeApiKey()).resolves.toBe('shared-key')
  })

  test('falls back to legacy OPENCODE_GO_API_KEY', async () => {
    process.env.OPENCODE_GO_API_KEY = 'legacy-key'
    await expect(resolveOpencodeApiKey()).resolves.toBe('legacy-key')
  })

  test('ignores blank values', async () => {
    process.env.OPENCODE_API_KEY = '   '
    process.env.OPENCODE_GO_API_KEY = 'legacy-key'
    await expect(resolveOpencodeApiKey()).resolves.toBe('legacy-key')
  })
})
