/**
 * Inline verifier fidelity tests — FID-2026-0813-007/008.
 * Sibling of the Loop 333 decomposition (shared fixture harness in
 * attest-test-harness).
 */
import { describe, expect, test } from 'bun:test'

import { setupAttestTest, writeFixtureSession } from './attest-test-harness'
import {
  INLINE_VERIFIER_SOURCE,
  runInlineVerifier,
} from '../attest/inline-verifier'

setupAttestTest()

describe('Inline verifier fidelity (FID-2026-0813-007/008)', () => {
  test('valid bundle verifies OK — inline JCS reproduces server JCS byte-for-byte', async () => {
    const { manifest, receipts } = await writeFixtureSession('sess_verify')
    const bundle = {
      schema: 'savant.trust-receipt.v1',
      sessions: [
        {
          manifest: {
            sessionId: manifest.sessionId,
            createdAt: manifest.createdAt,
            roles: manifest.roles,
          },
          receipts: receipts.map((r) => ({
            receipt: r,
            classification: 'live',
          })),
        },
      ],
    }
    const result = await runInlineVerifier(bundle as never)
    expect(result.ok).toBe(true)
    expect(result.receipts).toHaveLength(1)
    expect(result.receipts[0].valid).toBe(true)
    expect(result.receipts[0].failures).toEqual([])
  })

  test('tampered bundle fails — inline verifier catches the substituted verdict text', async () => {
    const { manifest, receipts } = await writeFixtureSession('sess_verify_bad')
    const tampered = structuredClone(receipts[0])
    tampered.verdicts = tampered.verdicts.map((v) =>
      v.phase === 'adversarial'
        ? { ...v, verdictText: 'PASS — (tampered)' }
        : v,
    )
    const bundle = {
      schema: 'savant.trust-receipt.v1',
      sessions: [
        {
          manifest: {
            sessionId: manifest.sessionId,
            createdAt: manifest.createdAt,
            roles: manifest.roles,
          },
          receipts: [{ receipt: tampered, classification: 'live' }],
        },
      ],
    }
    const result = await runInlineVerifier(bundle as never)
    expect(result.ok).toBe(false)
    const bad = result.receipts.find((r) => !r.valid)
    expect(bad?.failures.some((f) => f.includes('over-hash mismatch'))).toBe(
      true,
    )
  })

  test('inline verifier source parses as valid JavaScript', () => {
    expect(() => new Function(INLINE_VERIFIER_SOURCE)).not.toThrow()
  })
})
