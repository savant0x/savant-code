import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { FEATURE_ARCHIVE } from '../lesson-feature-archive'
import {
  FEATURE_STORE,
  renderFeatureReport,
  reviewFeaturePipeline,
  sha256,
} from '../lesson-feature-pipeline'

import type { FeatureCandidate } from '../lesson-feature-schema'

const roots: string[] = []
const catalog =
  '# LEARNINGS\n\n## Lesson: Preserve evidence\n' +
  '- **Guard:** Read the original result\n- **Status:** active\n'

const candidate = (
  overrides: Partial<FeatureCandidate> = {},
): FeatureCandidate => ({
  id: 'LF-001',
  title: 'Preserve fetched evidence',
  priority: 'P1',
  state: 'ready',
  basis: 'observed-gap',
  lessons: ['Preserve evidence'],
  gap: 'A verified evidence gap',
  acceptance: ['Original records survive'],
  evidence: [
    {
      path: 'src/fixture.ts',
      sha256: sha256('export const result = 1\n'),
      reason: 'Measured source boundary',
    },
  ],
  ...overrides,
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-archive-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev', 'feature-pipeline'), { recursive: true })
  fs.mkdirSync(path.join(root, 'src'))
  fs.mkdirSync(path.join(root, 'dev', 'fids', 'archive'), { recursive: true })
  fs.writeFileSync(path.join(root, 'dev', 'LEARNINGS.md'), catalog)
  fs.writeFileSync(
    path.join(root, 'src', 'fixture.ts'),
    'export const result = 1\n',
  )
  fs.writeFileSync(
    path.join(root, 'dev', 'fids', 'archive', 'FID-2026-1012-007-test.md'),
    '**ID:** FID-2026-1012-007\n**Status:** closed\n' +
      '### Code Verification Evidence\nCommit 303c6838\n',
  )
  const saveActive = (features: FeatureCandidate[]) =>
    fs.writeFileSync(
      path.join(root, FEATURE_STORE),
      JSON.stringify({ version: 1, catalogHash: sha256(catalog), features }),
    )
  const saveArchive = (features: FeatureCandidate[]) =>
    fs.writeFileSync(
      path.join(root, FEATURE_ARCHIVE),
      JSON.stringify({ version: 1, features }),
    )
  saveActive([candidate()])
  return { root, saveActive, saveArchive }
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

const implemented = (overrides: Partial<FeatureCandidate> = {}) =>
  candidate({
    state: 'implemented',
    fid: 'FID-2026-1012-007',
    commit: '303c6838',
    ...overrides,
  })

describe('implemented candidate retirement (FID-2026-1016-009)', () => {
  test('implemented work may not remain in the active store', () => {
    const { root, saveActive } = fixture()
    saveActive([implemented()])
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'LF-001: Implemented work must be archived to dev/feature-pipeline/implemented.json',
    )
    saveActive([])
    expect(reviewFeaturePipeline(root, () => true).issues).toEqual([])
  })

  test('a retired record keeps the lesson link that suppresses a duplicate proposal', () => {
    const { root, saveActive, saveArchive } = fixture()
    saveActive([])
    saveArchive([implemented()])
    const review = reviewFeaturePipeline(root, () => true)
    expect(review.issues).toEqual([])
    expect(review.features).toEqual([])
    expect(
      review.lessons.find((lesson) => lesson.title === 'Preserve evidence')
        ?.linked,
    ).toEqual(['LF-001'])
    const report = renderFeatureReport(review)
    expect(report).toContain('_No open candidates._')
    expect(report).toContain('## Implemented (archived)')
    expect(report).toContain('LF-001 P1')
    expect(report).toContain('Preserve evidence — governed; LF-001.')
  })

  test('a record that is not implemented does not belong in the archive', () => {
    const { root, saveArchive } = fixture()
    saveArchive([candidate({ state: 'draft' })])
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'LF-001: Archived work must be recorded as implemented',
    )
  })

  test('an archived identity cannot duplicate an active candidate', () => {
    const { root, saveActive, saveArchive } = fixture()
    saveActive([candidate({ state: 'draft' })])
    saveArchive([implemented()])
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'LF-001: Archived identity duplicates an active candidate',
    )
  })

  test('an archived implementation must name a closed record and a real commit', () => {
    const { root, saveActive, saveArchive } = fixture()
    saveActive([])
    saveArchive([implemented()])
    expect(reviewFeaturePipeline(root, () => false).issues.join('')).toContain(
      'real recorded commit',
    )
    fs.writeFileSync(
      path.join(root, 'dev', 'fids', 'archive', 'FID-2026-1012-007-test.md'),
      '**ID:** FID-2026-1012-007\n**Status:** verified\n' +
        '### Code Verification Evidence\nCommit 303c6838\n',
    )
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'LF-001: Implementation needs a closed FID and a real recorded commit',
    )
  })

  test('a malformed archive fails admission instead of reading as empty', () => {
    const { root, saveActive } = fixture()
    saveActive([])
    fs.writeFileSync(path.join(root, FEATURE_ARCHIVE), '{broken')
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'Implemented archive is malformed',
    )
  })
})
