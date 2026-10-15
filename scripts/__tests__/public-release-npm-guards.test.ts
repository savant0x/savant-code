// FID-2026-0922-001 — the npm read-after-write race in POST_RELEASE_VERIFY.
//
// `packageIsPublished` (npm-guards.ts) reads the registry once; its sibling in
// the same stage (`verifyReleaseAssets`, assets.ts) retries for a bounded
// window. The v0.0.33 cut died on exactly that asymmetry: npm's publish output
// warned the package was "being processed and may take a few minutes to become
// available", the single read lost the race, and the stage failed on a
// self-correcting transient.
//
// The probe is injected (the same seam shape as `verifyReleaseAssets`'s
// `fetchImpl`) so both directions are pinned without touching the registry:
// a transient 404 must be absorbed, and an expired window must still fail
// closed with the --resume remediation. The legs drive `awaitPublishedPackage`
// — the retry boundary itself — because the step after it is the real
// `npm pack` artifact inspection, which is network-bound and unchanged here.

import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  awaitPublishedPackage,
  npmVerifyPollIntervalMs,
  npmVerifyTimeoutMs,
} from '../public-release/npm-guards'

import type { PackageTarget } from '../public-release/catalog'

/** No such directory: if the real probe were consulted, `spawnSync` fails
 *  with ENOENT instead of reaching the network. Keeps the suite hermetic. */
const ABSENT_ROOT = path.join(os.tmpdir(), 'savant-npm-guards-absent-root')

const TARGET: PackageTarget = {
  name: 'savant-code',
  directory: 'cli/release',
  stage: 'NPM_PUBLISH_CLI',
  defaultPublish: true,
}

const TIMEOUT_KEY = 'SAVANT_RELEASE_NPM_TIMEOUT_MS'
const POLL_KEY = 'SAVANT_RELEASE_NPM_POLL_MS'

async function withWindow(
  timeoutMs: string,
  pollMs: string,
  run: () => Promise<void>,
): Promise<void> {
  const previousTimeout = process.env[TIMEOUT_KEY]
  const previousPoll = process.env[POLL_KEY]
  try {
    process.env[TIMEOUT_KEY] = timeoutMs
    process.env[POLL_KEY] = pollMs
    await run()
  } finally {
    if (previousTimeout === undefined) delete process.env[TIMEOUT_KEY]
    else process.env[TIMEOUT_KEY] = previousTimeout
    if (previousPoll === undefined) delete process.env[POLL_KEY]
    else process.env[POLL_KEY] = previousPoll
  }
}

describe('npm post-release verification — registry read-after-write', () => {
  test('absorbs a transient 404 instead of failing the stage', async () => {
    let probes = 0
    const probe = (): boolean => {
      probes += 1
      return probes >= 3
    }
    await withWindow('2000', '5', async () => {
      await expect(
        awaitPublishedPackage(ABSENT_ROOT, TARGET, '0.0.0-red', probe),
      ).resolves.toBeUndefined()
    })
    expect(probes).toBe(3)
  })

  test('fails closed with the --resume remediation when the window expires', async () => {
    let probes = 0
    const probe = (): boolean => {
      probes += 1
      return false
    }
    await withWindow('60', '5', async () => {
      await expect(
        awaitPublishedPackage(ABSENT_ROOT, TARGET, '0.0.0-red', probe),
      ).rejects.toThrow(
        /Post-release verification failed for savant-code@0\.0\.0-red/,
      )
      await expect(
        awaitPublishedPackage(ABSENT_ROOT, TARGET, '0.0.0-red', probe),
      ).rejects.toThrow(/release:public:resume/)
    })
    expect(probes).toBeGreaterThan(1)
  })

  test('npm timing helpers honor env overrides and invalid values', () => {
    const previousTimeout = process.env[TIMEOUT_KEY]
    const previousPoll = process.env[POLL_KEY]
    try {
      delete process.env[TIMEOUT_KEY]
      delete process.env[POLL_KEY]
      expect(npmVerifyTimeoutMs()).toBe(10 * 60 * 1_000)
      expect(npmVerifyPollIntervalMs()).toBe(30 * 1_000)
      process.env[TIMEOUT_KEY] = '5000'
      process.env[POLL_KEY] = '250'
      expect(npmVerifyTimeoutMs()).toBe(5_000)
      expect(npmVerifyPollIntervalMs()).toBe(250)
      process.env[TIMEOUT_KEY] = 'not-a-number'
      process.env[POLL_KEY] = '-7'
      expect(npmVerifyTimeoutMs()).toBe(10 * 60 * 1_000)
      expect(npmVerifyPollIntervalMs()).toBe(30 * 1_000)
    } finally {
      if (previousTimeout === undefined) delete process.env[TIMEOUT_KEY]
      else process.env[TIMEOUT_KEY] = previousTimeout
      if (previousPoll === undefined) delete process.env[POLL_KEY]
      else process.env[POLL_KEY] = previousPoll
    }
  })
})
