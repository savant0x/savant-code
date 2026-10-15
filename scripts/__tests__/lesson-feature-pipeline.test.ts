import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  FEATURE_STORE,
  featureRoutingNotes,
  renderFeatureReport,
  reviewFeaturePipeline,
  sha256,
} from '../lesson-feature-pipeline'
import { runSessionEndReview } from '../session-end-review'

import type { FeatureManifest } from '../lesson-feature-schema'

const directories: string[] = []
const catalog =
  '# LEARNINGS\n\n## Lesson: Preserve evidence\n' +
  '- **Guard:** Read the original result\n- **Status:** active\n' +
  '<!-- Legacy entries below this line are preserved historical prose. -->\n' +
  '## Lesson: Old guidance\n- **Status:** active\n'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-feature-'))
  directories.push(root)
  fs.mkdirSync(path.join(root, 'dev', 'feature-pipeline'), { recursive: true })
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'dev', 'LEARNINGS.md'), catalog)
  fs.writeFileSync(
    path.join(root, 'src', 'fixture.ts'),
    'export const result = 1\n',
  )
  const manifest: FeatureManifest = {
    version: 1,
    catalogHash: sha256(catalog),
    features: [
      {
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
      },
    ],
  }
  const save = () =>
    fs.writeFileSync(path.join(root, FEATURE_STORE), JSON.stringify(manifest))
  save()
  return { root, manifest, save }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('lesson feature admission', () => {
  test('retired references are admitted as retired evidence; superseded references name replacements', () => {
    const { root, manifest, save } = fixture()
    const title = 'Retired evidence'
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
      `## Lesson: ${title}\n- **Status:** active\n`,
    )
    manifest.features[0]!.lessons = [title]
    manifest.catalogHash = reviewFeaturePipeline(root).catalogHash
    save()
    const review = reviewFeaturePipeline(root)
    expect(review.issues).toEqual([])
    expect(
      review.lessons.find((lesson) => lesson.title === title)?.retired,
    ).toBe(true)
    expect(renderFeatureReport(review)).toContain('Retired evidence — retired')
    fs.writeFileSync(
      path.join(root, 'dev', 'LEARNINGS-RETIRED.md'),
      `## Lesson: ${title}\n- **Status:** superseded\n- **Superseded by:** Preserve evidence\n`,
    )
    manifest.catalogHash = reviewFeaturePipeline(root).catalogHash
    save()
    expect(reviewFeaturePipeline(root).issues).toEqual([
      'LF-001: Superseded lesson: Retired evidence; replacement: Preserve evidence',
    ])
  })

  test('inventory retains historical entries without inventing candidates', () => {
    const { root } = fixture()
    const before = fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'))
    const review = reviewFeaturePipeline(root)
    expect(review.issues).toEqual([])
    expect(review.lessons).toEqual([
      { title: 'Preserve evidence', governed: true, linked: ['LF-001'] },
      { title: 'Old guidance', governed: false, linked: [] },
    ])
    expect(renderFeatureReport(review)).toContain('no new candidate')
    expect(reviewFeaturePipeline(root)).toEqual(review)
    expect(fs.readFileSync(path.join(root, 'dev', 'LEARNINGS.md'))).toEqual(
      before,
    )
  })

  test('changed catalog and source evidence suppress readiness without changing records', () => {
    const { root } = fixture()
    const stored = fs.readFileSync(path.join(root, FEATURE_STORE))
    fs.appendFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      '\nUpdated guidance\n',
    )
    fs.appendFileSync(
      path.join(root, 'src', 'fixture.ts'),
      'export const extra = 2\n',
    )
    expect(reviewFeaturePipeline(root).issues).toEqual([
      'LF-001: Lesson review is stale',
      'LF-001: Evidence changed: src/fixture.ts',
    ])
    expect(featureRoutingNotes(root)[0]).toStartWith('FEATURE-REVIEW:')
    expect(fs.readFileSync(path.join(root, FEATURE_STORE))).toEqual(stored)
  })

  test('unknown lessons, duplicate identity and speculative readiness are rejected', () => {
    const { root, manifest, save } = fixture()
    manifest.features[0]!.lessons = ['Unknown lesson']
    manifest.features[0]!.basis = 'investigation'
    manifest.features.push({ ...manifest.features[0]! })
    save()
    const issues = reviewFeaturePipeline(root).issues.join('\n')
    expect(issues).toContain('Missing lesson: Unknown lesson')
    expect(issues).toContain('Readiness needs an observed gap')
    expect(issues).toContain('Duplicate feature identity')
  })

  test('missing snapshots and outside evidence never gain admission', () => {
    const { root, manifest, save } = fixture()
    manifest.features[0]!.evidence[0]!.sha256 = undefined
    manifest.features[0]!.evidence.push({
      path: '../outside.ts',
      reason: 'escape',
    })
    save()
    expect(reviewFeaturePipeline(root).issues).toEqual([
      'LF-001: Missing evidence snapshot: src/fixture.ts',
      'LF-001: Missing or unsafe evidence: ../outside.ts',
    ])
  })

  test('routed ownership exists and implementation cannot be faked by a status flag', () => {
    const { root, manifest, save } = fixture()
    const feature = manifest.features[0]!
    feature.state = 'routed'
    save()
    expect(reviewFeaturePipeline(root).issues).toContain(
      'LF-001: Routed work requires an owning FID',
    )
    feature.fid = 'FID-2026-1012-099'
    fs.mkdirSync(path.join(root, 'dev', 'fids'), { recursive: true })
    const fidFile = path.join(root, 'dev', 'fids', `${feature.fid}-test.md`)
    fs.writeFileSync(fidFile, `**ID:** ${feature.fid}\n**Status:** verified\n`)
    save()
    expect(reviewFeaturePipeline(root).issues).toEqual([])
    fs.writeFileSync(fidFile, `**ID:** ${feature.fid}0\n**Status:** verified\n`)
    expect(reviewFeaturePipeline(root).issues).toContain(
      'LF-001: FID owner cannot be verified',
    )
    feature.state = 'implemented'
    feature.commit = '12345678'
    fs.writeFileSync(
      fidFile,
      `**ID:** ${feature.fid}\n**Status:** closed\n` +
        '### Code Verification Evidence\nCommit 12345678\n',
    )
    const archive = path.join(root, 'dev', 'fids', 'archive')
    save()
    expect(reviewFeaturePipeline(root, () => true).issues).toContain(
      'LF-001: FID owner cannot be verified',
    )
    fs.mkdirSync(archive)
    fs.renameSync(fidFile, path.join(archive, path.basename(fidFile)))
    save()
    expect(reviewFeaturePipeline(root, () => false).issues.join('')).toContain(
      'real recorded commit',
    )
    const checked: string[] = []
    expect(
      reviewFeaturePipeline(root, (_root, commit) => {
        checked.push(commit)
        return true
      }).issues,
    ).toEqual([])
    expect(checked).toEqual(['12345678'])
    // The original defect's evidence changes when the fix lands; it must not
    // invalidate a separately recorded implementation proof.
    fs.appendFileSync(path.join(root, 'src', 'fixture.ts'), '// fixed\n')
    expect(reviewFeaturePipeline(root, () => true).issues).toEqual([])
  })

  test('existing evidence reached through a junction outside the repo is rejected', () => {
    const { root, manifest, save } = fixture()
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-outside-'))
    directories.push(outside)
    fs.writeFileSync(path.join(outside, 'evidence.ts'), 'outside evidence')
    fs.symlinkSync(outside, path.join(root, 'linked'), 'junction')
    manifest.features[0]!.evidence = [
      {
        path: 'linked/evidence.ts',
        sha256: sha256('outside evidence'),
        reason: 'An actual outside file exists',
      },
    ]
    save()
    expect(reviewFeaturePipeline(root).issues).toEqual([
      'LF-001: Missing or unsafe evidence: linked/evidence.ts',
    ])
    fs.unlinkSync(path.join(root, 'linked'))
  })

  test('missing stores are silent and malformed stores fail admission', () => {
    const { root } = fixture()
    fs.rmSync(path.join(root, FEATURE_STORE))
    expect(featureRoutingNotes(root)).toEqual([])
    fs.writeFileSync(path.join(root, FEATURE_STORE), '{}')
    expect(reviewFeaturePipeline(root).issues).toHaveLength(1)
    expect(featureRoutingNotes(root)[0]).toStartWith('FEATURE-REVIEW:')
  })

  test('the real session-end hook presents ready features and survives invalid input', () => {
    const { root } = fixture()
    const review = runSessionEndReview(root)
    expect(review.routing).toContain(
      'FEATURE-READY: LF-001 P1 — Preserve fetched evidence. Converge a FID before implementation.',
    )
    fs.writeFileSync(path.join(root, FEATURE_STORE), '{broken')
    const invalid = runSessionEndReview(root)
    expect(
      invalid.routing.some((note) => note.startsWith('FEATURE-REVIEW:')),
    ).toBe(true)
    expect(fs.existsSync(path.join(root, 'dev', 'agenda.md'))).toBe(true)
  })

  test('generated report stays within Markdown line limits', () => {
    const { root, manifest, save } = fixture()
    manifest.features[0]!.gap = 'long evidence statement '.repeat(40)
    save()
    for (const line of renderFeatureReport(reviewFeaturePipeline(root)).split(
      '\n',
    )) {
      expect(line.length).toBeLessThanOrEqual(120)
    }
  })
})
