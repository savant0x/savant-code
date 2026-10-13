import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { collectFeaturePipelineIssues } from '../lesson-feature-check'
import {
  FEATURE_STORE,
  FEATURE_REPORT,
  reviewFeaturePipeline,
  writeFeatureReport,
} from '../lesson-feature-pipeline'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-check-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev', 'feature-pipeline'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNINGS.md'),
    '## Lesson: Live\n- **Status:** active\n',
  )
  fs.writeFileSync(
    path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
    '## Lesson: Retired\n- **Status:** active\n',
  )
  const manifest = {
    version: 1,
    catalogHash: '0'.repeat(64),
    features: [
      {
        id: 'LF-001',
        title: 'Fixture feature',
        priority: 'P1',
        state: 'draft',
        basis: 'investigation',
        lessons: ['Retired'],
        gap: 'Measured fixture gap',
        acceptance: ['Preserve evidence'],
        evidence: [
          { path: 'dev/LEARNINGS.md', reason: 'Existing fixture source' },
        ],
      },
    ],
  }
  const save = () =>
    fs.writeFileSync(path.join(root, FEATURE_STORE), JSON.stringify(manifest))
  save()
  return { root, manifest, save }
}

describe('feature admission and report repository gate', () => {
  test('fresh reports pass; archive and manifest edits invalidate the generated report', () => {
    const { root, manifest, save } = fixture()
    writeFeatureReport(root, reviewFeaturePipeline(root))
    expect(collectFeaturePipelineIssues(root)).toEqual([])
    const before = reviewFeaturePipeline(root).sourceFingerprint
    fs.appendFileSync(
      path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
      '\nArchive evidence changed\n',
    )
    expect(reviewFeaturePipeline(root).sourceFingerprint).not.toBe(before)
    expect(
      collectFeaturePipelineIssues(root).map((issue) => issue.code),
    ).toContain('learning.features.report-drift')
    writeFeatureReport(root, reviewFeaturePipeline(root))
    manifest.features[0]!.gap = 'A revised gap'
    save()
    expect(
      collectFeaturePipelineIssues(root).map((issue) => issue.code),
    ).toContain('learning.features.report-drift')
  })
  test('red reports publish deterministically but remain failed admission without changing candidate state', () => {
    const { root, manifest, save } = fixture()
    manifest.features[0]!.lessons = ['Missing']
    save()
    const stored = fs.readFileSync(path.join(root, FEATURE_STORE), 'utf8')
    const review = reviewFeaturePipeline(root)
    writeFeatureReport(root, review)
    const first = fs.readFileSync(path.join(root, FEATURE_REPORT), 'utf8')
    writeFeatureReport(root, reviewFeaturePipeline(root))
    expect(fs.readFileSync(path.join(root, FEATURE_REPORT), 'utf8')).toBe(first)
    expect(first).toContain('Missing lesson: Missing')
    expect(collectFeaturePipelineIssues(root)).toEqual([
      {
        code: 'learning.features.admission',
        message: 'LF-001: Missing lesson: Missing',
      },
    ])
    expect(fs.readFileSync(path.join(root, FEATURE_STORE), 'utf8')).toBe(stored)
  })
  test('missing/malformed stores and missing reports fail the enforced check', () => {
    const { root } = fixture()
    expect(
      collectFeaturePipelineIssues(root).map((issue) => issue.code),
    ).toContain('learning.features.report-missing')
    fs.writeFileSync(path.join(root, FEATURE_STORE), '{broken')
    expect(
      collectFeaturePipelineIssues(root).map((issue) => issue.code),
    ).toContain('learning.features.admission')
    fs.unlinkSync(path.join(root, FEATURE_STORE))
    expect(collectFeaturePipelineIssues(root)[0]?.code).toBe(
      'learning.features.store-missing',
    )
  })
})
