// FID-2026-1007-016 — sweep control manifest loader pins.
//
// The verdict rule needs a control pair per route; the manifest is the
// operator-owned source of those pairs. A missing entry is a first-class
// uncontrolled state, but a missing FILE (typo'd path) must refuse loudly —
// never silently run uncontrolled.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { parseArgs } from '../identity-gauntlet'
import { controlKey, loadSweepControls } from '../lib/identity-controls'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function manifestFile(content: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-controls-'))
  tempRoots.push(root)
  const file = path.join(root, 'controls.json')
  writeFileSync(file, content, 'utf8')
  return file
}

const VALID = JSON.stringify({
  version: 'sweep-controls/1',
  entries: {
    'hcnsec/glm': {
      sameModel: {
        provider: 'tokenbom',
        requestedModel: 'glm-5.3-flash',
        baseUrl: 'https://tokenbom.example/v1',
      },
      differentModel: {
        provider: 'openai',
        requestedModel: 'gpt-5',
        baseUrl: 'https://openai.example/v1',
      },
      capturedAt: '2026-10-08T00:00:00.000Z',
    },
  },
})

describe('sweep control manifest (FID-2026-1007-016)', () => {
  test('an undefined path means uncontrolled (today\'s behavior)', () => {
    expect(loadSweepControls(undefined)).toBeNull()
  })

  test('a valid manifest loads with entries keyed by provider/family', () => {
    const manifest = loadSweepControls(manifestFile(VALID))
    expect(manifest?.entries['hcnsec/glm']?.sameModel?.provider).toBe(
      'tokenbom',
    )
    expect(controlKey('hcnsec', 'glm')).toBe('hcnsec/glm')
  })

  test('a missing file refuses loudly (never silently uncontrolled)', () => {
    expect(() => loadSweepControls('/nope/missing.json')).toThrow(
      /not found/,
    )
  })

  test('non-JSON refuses', () => {
    expect(() => loadSweepControls(manifestFile('not json'))).toThrow(
      /not JSON/,
    )
  })

  test('version drift refuses', () => {
    expect(() =>
      loadSweepControls(
        manifestFile(JSON.stringify({ version: 'sweep-controls/2', entries: {} })),
      ),
    ).toThrow(/version unsupported/)
  })

  test('a malformed entry refuses, naming the entry', () => {
    expect(() =>
      loadSweepControls(
        manifestFile(
          JSON.stringify({
            version: 'sweep-controls/1',
            entries: { 'hcnsec/glm': { sameModel: { provider: 'x' } } },
          }),
        ),
      ),
    ).toThrow(/hcnsec\/glm/)
  })

  test('a non-ISO capturedAt refuses', () => {
    expect(() =>
      loadSweepControls(
        manifestFile(
          JSON.stringify({
            version: 'sweep-controls/1',
            entries: { 'hcnsec/glm': { capturedAt: 'whenever' } },
          }),
        ),
      ),
    ).toThrow(/malformed/)
  })
})

describe('sweep control flags (FID-2026-1007-016)', () => {
  test('--controls-manifest and --max-control-probes parse', () => {
    const args = parseArgs([
      '--provider',
      'hcnsec',
      '--all',
      '--controls-manifest',
      'controls.json',
      '--max-control-probes',
      '40',
    ])
    expect(args.controlsManifest).toBe('controls.json')
    expect(args.maxControlProbes).toBe(40)
  })

  test('a non-integer budget refuses', () => {
    expect(() =>
      parseArgs([
        '--provider',
        'hcnsec',
        '--all',
        '--max-control-probes',
        'many',
      ]),
    ).toThrow(/max-control-probes/)
  })

  test('flags default to uncontrolled and unbounded', () => {
    const args = parseArgs(['--provider', 'hcnsec', '--all'])
    expect(args.controlsManifest).toBeUndefined()
    expect(args.maxControlProbes).toBeUndefined()
  })
})
