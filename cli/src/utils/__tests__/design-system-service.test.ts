import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { setProjectRoot } from '../../project-files'
import {
  resolveDesignSystemInScope,
  saveCustomDesignSystem,
} from '../design-system-service'
import { validateSettings } from '../settings/validation'

import type { DesignAuthoringInputV1 } from '@savant-code/design-systems'

const roots: string[] = []
const previousConfigDir = process.env.SAVANT_CODE_CONFIG_DIR

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
  if (previousConfigDir === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
  else process.env.SAVANT_CODE_CONFIG_DIR = previousConfigDir
})

function input(
  provenance?: DesignAuthoringInputV1['provenance'],
): DesignAuthoringInputV1 {
  return {
    schemaVersion: '1',
    id: 'service-test-system',
    displayName: 'Service Test System',
    description: 'A service test design system.',
    scope: 'project',
    targets: ['terminal', 'react'],
    colors: { primary: '#123456' },
    typography: { body: { fontFamily: 'Inter, sans-serif' } },
    spacing: { sm: '8px' },
    radius: { sm: '4px' },
    components: {},
    accessibility: {},
    activate: false,
    ...(provenance ? { provenance } : {}),
  }
}

function projectFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-service-'))
  roots.push(root)
  setProjectRoot(root)
  process.env.SAVANT_CODE_CONFIG_DIR = path.join(root, 'config')
  return root
}

describe('design-system settings', () => {
  test('accepts stable design-system ids and rejects paths', () => {
    const settings = validateSettings({
      designSystemProject: 'my-design',
      designSystemUser: '../escape',
    })
    expect(settings.designSystemProject).toBe('my-design')
    expect(settings.designSystemUser).toBeUndefined()
  })

  test('preserves provenance across save and reload', () => {
    projectFixture()
    const provenance = {
      sourceRepository: 'example/designs',
      sourceRevision: 'abc123',
      sourcePath: 'reference/custom.design.md',
      license: 'MIT',
      notice: 'Example notice',
    }
    const saved = saveCustomDesignSystem(input(provenance))
    const reloaded = resolveDesignSystemInScope('project', saved.id)
    expect(reloaded?.provenance).toEqual(provenance)
    expect(reloaded?.sourceContentHash).toBe(saved.sourceContentHash)
  })

  test('records revision history while preserving edit provenance', () => {
    const root = projectFixture()
    const provenance = {
      sourceRepository: 'example/designs',
      sourceRevision: 'abc123',
      sourcePath: 'reference/custom.design.md',
      license: 'MIT',
    }
    const first = saveCustomDesignSystem(input(provenance))
    saveCustomDesignSystem({
      ...input(provenance),
      description: 'Edited description.',
    })
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(root, '.savant', 'design-systems', 'manifest.json'),
        'utf8',
      ),
    ) as { revisions?: Array<{ previousSourceContentHash?: string }> }
    expect(manifest.revisions).toHaveLength(2)
    expect(manifest.revisions?.[1]?.previousSourceContentHash).toBe(
      first.sourceContentHash,
    )
    expect(resolveDesignSystemInScope('project', first.id)?.provenance).toEqual(
      provenance,
    )
  })

  test('retains a valid-shaped interrupted journal version for repair', () => {
    const root = projectFixture()
    const saved = saveCustomDesignSystem(input())
    const designRoot = path.join(root, '.savant', 'design-systems')
    const versionPath = path.basename(saved.contentPath)
    fs.writeFileSync(
      path.join(designRoot, 'manifest.commit.json'),
      JSON.stringify({
        id: saved.id,
        versionPath,
        sourceContentHash: saved.sourceContentHash,
        manifestHash: '0'.repeat(64),
        createdVersion: true,
      }),
    )

    expect(resolveDesignSystemInScope('project', saved.id)?.id).toBe(saved.id)
    expect(fs.existsSync(saved.contentPath)).toBe(true)
    expect(fs.existsSync(path.join(designRoot, 'manifest.commit.json'))).toBe(
      false,
    )
  })

  test('quarantines a malformed journal without deleting the saved version', () => {
    const root = projectFixture()
    const saved = saveCustomDesignSystem(input())
    const designRoot = path.join(root, '.savant', 'design-systems')
    fs.writeFileSync(
      path.join(designRoot, 'manifest.commit.json'),
      JSON.stringify({ id: 'different-system', versionPath: 'bad' }),
    )

    expect(() => resolveDesignSystemInScope('project', saved.id)).toThrow(
      'journal is corrupt',
    )
    expect(fs.existsSync(saved.contentPath)).toBe(true)
    expect(
      fs.readdirSync(designRoot).some((name) => name.includes('.corrupt.')),
    ).toBe(true)
  })
})
