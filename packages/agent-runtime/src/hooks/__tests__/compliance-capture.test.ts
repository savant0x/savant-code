import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { complianceEventSchema } from '@savant-code/common/types/telemetry'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  appendComplianceRecord,
  buildComplianceEvent,
  isComplianceCaptureEnabled,
  resetComplianceCaptureCache,
  runComplianceCapture,
} from '../compliance-capture'

import type { ComplianceObservation } from '../compliance-capture'

function fixtureRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'compliance-capture-'))
}

const tempRoots: string[] = []
afterEach(() => {
  resetComplianceCaptureCache()
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function rootWithConfig(enabledYaml: string | null): string {
  const root = fixtureRoot()
  tempRoots.push(root)
  if (enabledYaml !== null) {
    fs.writeFileSync(
      path.join(root, 'protocol.config.yaml'),
      enabledYaml,
      'utf8',
    )
  }
  return root
}

const OBSERVATION: ComplianceObservation = {
  lawId: 7,
  violationClass: 'flagged',
  gateLayer: 'pre-write',
  agentId: 'forge',
}

function readLines(root: string): string[] {
  const content = fs.readFileSync(
    path.join(root, 'dev', 'telemetry', 'compliance.jsonl'),
    'utf8',
  )
  return content.split('\n').filter((line) => line !== '')
}

/**
 * FID-2026-1007-012 FID 2: every law-flag produces exactly one storable line;
 * disabled sinks write nothing; the sink never throws and never persists
 * message content (there is no message field to persist).
 */
describe('compliance capture (FID-2026-1007-012 FID 2)', () => {
  test('every observation appends exactly one parseable line', () => {
    const root = rootWithConfig(null)
    for (const violationClass of ['rejected', 'flagged'] as const) {
      const result = runComplianceCapture(root, {
        ...OBSERVATION,
        violationClass,
      })
      expect(result.appended).toBe(true)
    }
    const lines = readLines(root)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      const parsed = complianceEventSchema.parse(JSON.parse(line))
      expect(parsed.lawId).toBe(7)
      expect(parsed).not.toHaveProperty('message')
    }
  })

  test('a disabled sink writes nothing and creates no files', () => {
    const root = rootWithConfig('complianceTelemetry:\n  enabled: false\n')
    expect(isComplianceCaptureEnabled(root)).toBe(false)
    const result = runComplianceCapture(root, OBSERVATION)
    expect(result.appended).toBe(false)
    expect(fs.existsSync(path.join(root, 'dev', 'telemetry'))).toBe(false)
  })

  test('capture is default-on with no config file', () => {
    const root = rootWithConfig(null)
    expect(isComplianceCaptureEnabled(root)).toBe(true)
    expect(runComplianceCapture(root, OBSERVATION).appended).toBe(true)
  })

  test('rapid appends leave valid JSONL (atomic single-write lines)', () => {
    const root = rootWithConfig(null)
    for (let i = 0; i < 50; i++) {
      runComplianceCapture(root, { ...OBSERVATION, lawId: (i % 15) + 1 })
    }
    const lines = readLines(root)
    expect(lines).toHaveLength(50)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  test('a config flip is picked up (mtime cache invalidation)', () => {
    const root = rootWithConfig('complianceTelemetry:\n  enabled: true\n')
    expect(runComplianceCapture(root, OBSERVATION).appended).toBe(true)
    const configPath = path.join(root, 'protocol.config.yaml')
    fs.writeFileSync(
      configPath,
      'complianceTelemetry:\n  enabled: false\n',
      'utf8',
    )
    const later = new Date(Date.now() + 2000)
    fs.utimesSync(configPath, later, later)
    expect(isComplianceCaptureEnabled(root)).toBe(false)
    expect(runComplianceCapture(root, OBSERVATION).appended).toBe(false)
    expect(readLines(root)).toHaveLength(1)
  })

  test('a malformed config falls back to default-on', () => {
    const root = rootWithConfig('{{{{not yaml\n')
    expect(isComplianceCaptureEnabled(root)).toBe(true)
  })

  test('strike counts round-trip only when present', () => {
    expect(
      buildComplianceEvent({ ...OBSERVATION, strikeCount: 3 }),
    ).toMatchObject({ strikeCount: 3 })
    expect(buildComplianceEvent(OBSERVATION)).not.toHaveProperty(
      'strikeCount',
    )
  })

  test('an undefined root reports disabled without touching disk', () => {
    expect(runComplianceCapture(undefined, OBSERVATION)).toEqual({
      appended: false,
    })
  })

  test('append failures report instead of throwing', () => {
    const root = fixtureRoot()
    tempRoots.push(root)
    const fileAsDir = path.join(root, 'blocker')
    fs.writeFileSync(fileAsDir, 'x', 'utf8')
    const result = appendComplianceRecord(
      path.join(fileAsDir, 'nested'),
      buildComplianceEvent(OBSERVATION),
    )
    expect(result.appended).toBe(false)
    expect(result.error).toBeDefined()
  })
})
