// FID-2026-0906-002 — desktop verify-claim tests.
//
// Pins the flag-independent POST_RELEASE_VERIFY desktop claim: manifest
// asserted when the desktop stages ran, provable absence recorded when
// they were skipped, and both contradictory/unverifiable states fail
// closed. Exercises verifyDesktopUpdaterClaim over injected fetch — no
// network, no real release.

import { describe, expect, test } from 'bun:test'

import { verifyDesktopUpdaterClaim } from './public-release/stages-verify'

import type { ReleaseReceipt } from './public-release/catalog'

/** Captures a rejection as an Error (or null on resolve) — async-safe. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(
    () => null,
    (error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
  )
}

describe('desktop verify claim (FID-2026-0906-002)', () => {
  const validManifest = JSON.stringify({
    version: '0.0.29',
    platforms: {
      'windows-x86_64': {
        signature: 'sig',
        url: 'https://github.com/savant0x/savant-code/releases/download/v0.0.29/x.exe',
      },
    },
  })

  function fetchOf(status: number, body = ''): typeof fetch {
    return (async () =>
      new Response(body, { status })) as unknown as typeof fetch
  }

  function receiptOf(): ReleaseReceipt {
    return {
      schemaVersion: 'release-receipt/v2',
      version: '0.0.29',
      mode: 'automation',
      completedStages: [],
      restored: false,
      receiptPath: 'unused-in-claim-tests',
      repositoryKey: 'testkey1',
      gateAttempts: [],
      evidenceFinalized: false,
    }
  }

  function envFlag(value: '1' | undefined): () => void {
    const previous = process.env.SAVANT_CODE_RELEASE_DESKTOP
    if (value === undefined) delete process.env.SAVANT_CODE_RELEASE_DESKTOP
    else process.env.SAVANT_CODE_RELEASE_DESKTOP = value
    return () => {
      if (previous === undefined) delete process.env.SAVANT_CODE_RELEASE_DESKTOP
      else process.env.SAVANT_CODE_RELEASE_DESKTOP = previous
    }
  }

  test('enabled + manifest resolvable: asserts and clears a stale skip flag', async () => {
    const restore = envFlag('1')
    try {
      const receipt = receiptOf()
      receipt.desktopStagesSkipped = true
      receipt.completedStages = ['DESKTOP_BUNDLES', 'DESKTOP_RELEASE']
      await verifyDesktopUpdaterClaim(
        receipt,
        '0.0.29',
        fetchOf(200, validManifest),
      )
      expect(receipt.desktopStagesSkipped).toBeUndefined()
    } finally {
      restore()
    }
  })

  test('enabled + manifest missing: fails closed with the existing assert', async () => {
    const restore = envFlag('1')
    try {
      const error = await rejectionOf(
        verifyDesktopUpdaterClaim(receiptOf(), '0.0.29', fetchOf(404)),
      )
      expect(error?.message).toMatch(/not resolvable/)
    } finally {
      restore()
    }
  })

  test('disabled + 404: proven absence — records the skip on a pre-002 receipt', async () => {
    const restore = envFlag(undefined)
    try {
      const receipt = receiptOf()
      expect(receipt.desktopStagesSkipped).toBeUndefined()
      await verifyDesktopUpdaterClaim(
        receipt,
        '0.0.29',
        fetchOf(404, 'Not Found'),
      )
      expect(receipt.desktopStagesSkipped).toBe(true)
    } finally {
      restore()
    }
  })

  test('disabled + manifest present: desktop claim mismatch — fail closed', async () => {
    const restore = envFlag(undefined)
    try {
      const error = await rejectionOf(
        verifyDesktopUpdaterClaim(
          receiptOf(),
          '0.0.29',
          fetchOf(200, validManifest),
        ),
      )
      expect(error?.message).toMatch(/claim mismatch/)
    } finally {
      restore()
    }
  })

  test('disabled + non-404 failure: cannot verify absence — fail closed', async () => {
    const restore = envFlag(undefined)
    try {
      const error = await rejectionOf(
        verifyDesktopUpdaterClaim(receiptOf(), '0.0.29', fetchOf(500)),
      )
      expect(error?.message).toMatch(/status 500/)
    } finally {
      restore()
    }
  })
})
