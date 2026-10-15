// Public release contract — GitHub release asset verification and the live
// CHANGELOG section check. Sibling of the FID-2026-0819-005 Loop 317
// decomposition.

import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  RELEASE_BINARY_TARBALLS,
  assetPollIntervalMs,
  assetRetryTimeoutMs,
  extractChangelogSection,
  verifyReleaseAssets,
} from './public-release'

describe('public release contract — assets', () => {
  test('expects exactly the five workflow-matrix binary tarballs', () => {
    // NOT every PLATFORM_TARGETS key: the launcher map has 7 entries including
    // two baseline variants the workflow does not build. Asserting the full
    // map would fail forever (FID-2026-0809-002 Fix B / Loop 2 finding).
    expect([...RELEASE_BINARY_TARBALLS]).toEqual([
      'savant-code-linux-x64.tar.gz',
      'savant-code-linux-arm64.tar.gz',
      'savant-code-darwin-x64.tar.gz',
      'savant-code-darwin-arm64.tar.gz',
      'savant-code-win32-x64.tar.gz',
    ])
    expect(RELEASE_BINARY_TARBALLS).toHaveLength(5)
  })

  test('verifyReleaseAssets passes when all five tarballs are present', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '2000'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '10'
      const names = [...RELEASE_BINARY_TARBALLS]
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v0.0.21',
            assets: names.map((name) => ({ name })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).resolves.toBeUndefined()
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('verifyReleaseAssets fails closed when the release has zero assets', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '80'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '5'
      const fetchImpl = async () =>
        new Response(JSON.stringify({ tag_name: 'v0.0.21', assets: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).rejects.toThrow('missing binary assets')
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('verifyReleaseAssets fails closed when only part of the matrix uploaded', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '80'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '5'
      const names = RELEASE_BINARY_TARBALLS.slice(0, 4)
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v0.0.21',
            assets: names.map((name) => ({ name })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).rejects.toThrow('missing binary assets')
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('asset timing helpers honor env overrides and invalid values', () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      expect(assetRetryTimeoutMs()).toBe(45 * 60 * 1_000)
      expect(assetPollIntervalMs()).toBe(30 * 1_000)
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '5000'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '250'
      expect(assetRetryTimeoutMs()).toBe(5_000)
      expect(assetPollIntervalMs()).toBe(250)
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = 'not-a-number'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '-7'
      expect(assetRetryTimeoutMs()).toBe(45 * 60 * 1_000)
      expect(assetPollIntervalMs()).toBe(30 * 1_000)
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('extracts only the real current release section', () => {
    const changelog = readFileSync(
      path.resolve(import.meta.dir, '../CHANGELOG.md'),
      'utf8',
    )
    const section = extractChangelogSection(changelog, '0.0.21')

    expect(section.startsWith('## v0.0.21 — 2026-08-06')).toBe(true)
    expect(section).toContain('### Reversible public release pipeline')
    expect(section).not.toContain('## v0.0.20 —')
  })
})
