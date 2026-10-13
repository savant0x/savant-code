import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { closedOwnerIssues } from '../experiences-probe'
import { inspectBoundaryEvidence } from '../experiences-proof'

import type { FixBoundary } from '../experiences-recurrence'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'experience-proof-'))
  roots.push(root)
  fs.writeFileSync(
    path.join(root, 'implementation.md'),
    'implemented and audited',
  )
  fs.writeFileSync(
    path.join(root, 'capture.md'),
    'capture exercised and audited',
  )
  for (const args of [
    ['init', '-q'],
    ['add', 'implementation.md', 'capture.md'],
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
  ])
    expect(Bun.spawnSync(['git', ...args], { cwd: root }).exitCode).toBe(0)
  const commit = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
    .stdout.toString()
    .trim()
  const boundary: FixBoundary = {
    classKey: 'v1:fixture:timeout:unexpected',
    commit,
    fixedAt: new Date().toISOString(),
    captureVerified: true,
    implementationEvidence: 'implementation.md',
    captureEvidence: 'capture.md',
    exposure: [
      {
        sessionId: 'session',
        exercisedAt: new Date().toISOString(),
        evidence: 'exposure.json',
      },
    ],
  }
  const receipt = {
    kind: 'production-tool-exposure',
    classKey: boundary.classKey,
    sessionId: 'session',
    exercisedAt: boundary.exposure[0]!.exercisedAt,
    implementationCommit: commit,
    captureVerified: true,
  }
  fs.writeFileSync(path.join(root, 'exposure.json'), JSON.stringify(receipt))
  return { root, boundary, receipt }
}

describe('production observation receipts', () => {
  test('closing an owner cannot bypass missing repair boundaries', () => {
    const { root, boundary } = fixture()
    fs.mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dev/fids/FID-2026-1012-024-fixture.md'),
      '**Status:** closed\n',
    )
    expect(
      closedOwnerIssues(
        root,
        ['FID-2026-1012-024'],
        [
          {
            key: boundary.classKey,
            owner: 'FID-2026-1012-024',
            state: 'unresolved',
          },
        ],
      ),
    ).toEqual([`closed owner has unproved class: ${boundary.classKey}`])
  })
  test('binds a readable production receipt to the implemented local commit', () => {
    const { root, boundary } = fixture()
    expect(inspectBoundaryEvidence(root, boundary)).toEqual([])
  })
  test('a receipt from a LATER revision still proves the fixed path ran', () => {
    // The session ran HEAD, which is normally ahead of the boundary commit that
    // landed the fix; requiring equality would force the receipt to claim a
    // revision it never ran.
    const { root, boundary, receipt } = fixture()
    fs.writeFileSync(
      path.join(root, 'later.txt'),
      'a later commit, after the fix landed',
    )
    for (const args of [
      ['add', 'later.txt'],
      ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'later'],
    ])
      expect(Bun.spawnSync(['git', ...args], { cwd: root }).exitCode).toBe(0)
    const run = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
      .stdout.toString()
      .trim()
    expect(run).not.toBe(boundary.commit)
    fs.writeFileSync(
      path.join(root, 'exposure.json'),
      JSON.stringify({ ...receipt, implementationCommit: run }),
    )
    expect(inspectBoundaryEvidence(root, boundary)).toEqual([])
  })
  test('a receipt from a revision BEFORE the fix cannot prove anything', () => {
    const { root, boundary, receipt } = fixture()
    // The fixture's commit is the run; a later commit becomes the fix.
    const before = boundary.commit
    fs.writeFileSync(path.join(root, 'fix.txt'), 'the commit that landed the fix')
    for (const args of [
      ['add', 'fix.txt'],
      ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fix'],
    ])
      expect(Bun.spawnSync(['git', ...args], { cwd: root }).exitCode).toBe(0)
    boundary.commit = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
      .stdout.toString()
      .trim()
    boundary.fixedAt = new Date().toISOString()
    fs.writeFileSync(
      path.join(root, 'exposure.json'),
      JSON.stringify({ ...receipt, implementationCommit: before }),
    )
    expect(inspectBoundaryEvidence(root, boundary)).toContain(
      'exposure receipt disagrees with boundary: exposure.json',
    )
  })
  test('a synthetic receipt cannot substitute for production exposure', () => {
    const { root, boundary, receipt } = fixture()
    fs.writeFileSync(
      path.join(root, 'exposure.json'),
      JSON.stringify({ ...receipt, kind: 'synthetic-test' }),
    )
    expect(inspectBoundaryEvidence(root, boundary)).toContain(
      'invalid production exposure receipt: exposure.json',
    )
  })
  test('renaming the session in the manifest cannot multiply one real exposure', () => {
    const { root, boundary } = fixture()
    boundary.exposure.push({
      ...boundary.exposure[0]!,
      sessionId: 'invented-session',
    })
    expect(inspectBoundaryEvidence(root, boundary)).toContain(
      'missing, repeated or outside-workspace exposure: exposure.json',
    )
  })
  test('a receipt for a different class cannot qualify this repair', () => {
    const { root, boundary, receipt } = fixture()
    fs.writeFileSync(
      path.join(root, 'exposure.json'),
      JSON.stringify({ ...receipt, classKey: 'another' }),
    )
    expect(inspectBoundaryEvidence(root, boundary)).toContain(
      'exposure receipt disagrees with boundary: exposure.json',
    )
  })
  test('a boundary cannot predate its implementation', () => {
    const { root, boundary } = fixture()
    boundary.fixedAt = '2000-01-01T00:00:00Z'
    expect(inspectBoundaryEvidence(root, boundary)).toContain(
      `boundary predates its implementation commit: ${boundary.commit}`,
    )
  })
})
