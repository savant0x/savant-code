// Public release contract — gate environment hygiene and captured-output
// decoding. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { readCapturedOutput, sanitizedGateEnv } from './public-release'

describe('public release contract — gate env', () => {
  test('decodes captured gate output leniently so invalid bytes never mask a real exit code', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-decode-'),
    )
    try {
      const capturePath = path.join(directory, 'captured.log')
      writeFileSync(capturePath, Buffer.from([0x41, 0xff, 0x42, 0x0a]))
      expect(() => readCapturedOutput(capturePath)).not.toThrow()
      expect(readCapturedOutput(capturePath)).toBe('A\uFFFD' + 'B\n')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('removes known secret variables from the gate environment', () => {
    const previousToken = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'ghs_should-not-leak'
    try {
      const gateEnv = sanitizedGateEnv()
      expect(gateEnv).toBeDefined()
      expect(gateEnv?.GITHUB_TOKEN).toBeUndefined()
      expect(Object.keys(gateEnv ?? {}).length).toBeGreaterThan(0)
      // The helper must never mutate process.env itself.
      expect(process.env.GITHUB_TOKEN).toBe('ghs_should-not-leak')
    } finally {
      if (previousToken === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = previousToken
    }
  })
})
