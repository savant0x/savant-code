import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  EXPERIENCES_DIR_NAME,
  EXPOSURE_DIR_NAME,
  exposureReceiptFileName,
  exposureReceiptReadablePrefix,
} from '@savant-code/common/types/experience'

import { inspectBoundaryEvidence } from '../experiences-proof'

import type { FixBoundary } from '../experiences-recurrence'
import type { ExperienceExposureReceipt } from '@savant-code/common/types/experience'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function git(
  root: string,
  args: readonly string[],
  env?: Record<string, string>,
) {
  return Bun.spawnSync(['git', ...args], {
    cwd: root,
    env: env ? { ...process.env, ...env } : undefined,
  })
}

function headCommit(root: string): string {
  return Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
    .stdout.toString()
    .trim()
}

function commitAll(
  root: string,
  message: string,
  env?: Record<string, string>,
): string {
  for (const args of [
    ['add', '-A'],
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      message,
    ],
  ])
    expect(git(root, args, env).exitCode).toBe(0)
  return headCommit(root)
}

function commitEmpty(
  root: string,
  message: string,
  env: Record<string, string>,
): string {
  expect(
    git(
      root,
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '--allow-empty',
        '-qm',
        message,
      ],
      env,
    ).exitCode,
  ).toBe(0)
  return headCommit(root)
}

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
  expect(git(root, ['init', '-q']).exitCode).toBe(0)
  const commit = commitAll(root, 'fixture')
  const boundary: FixBoundary = {
    classKey: 'v1:fixture:timeout:unexpected',
    commit,
    fixedAt: new Date().toISOString(),
    captureVerified: true,
    implementationEvidence: 'implementation.md',
    captureEvidence: 'capture.md',
  }
  const receipt: ExperienceExposureReceipt = {
    kind: 'production-tool-exposure',
    classKey: boundary.classKey,
    sessionId: 'session',
    exercisedAt: new Date().toISOString(),
    implementationCommit: commit,
    boundaryCommit: boundary.commit,
    boundaryFixedAt: boundary.fixedAt,
    captureVerified: true,
  }
  return { root, boundary, receipt }
}

/** Store a receipt under the name the shared identity derives for it. */
function storeReceipt(
  root: string,
  receipt: ExperienceExposureReceipt,
): string {
  return storeBytes(root, exposureReceiptFileName(receipt), receipt)
}

/** Store arbitrary bytes under an explicit name (broken or renamed evidence). */
function storeBytes(root: string, name: string, value: unknown): string {
  const directory = path.join(root, EXPERIENCES_DIR_NAME, EXPOSURE_DIR_NAME)
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, name)
  fs.writeFileSync(
    file,
    typeof value === 'string' ? value : JSON.stringify(value),
  )
  return file
}

describe('production observation receipts', () => {
  test('binds a discovered production receipt to the implemented commit', () => {
    const { root, boundary, receipt } = fixture()
    const file = storeReceipt(root, receipt)
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toEqual([])
    expect(inspection.exposure).toEqual([
      {
        sessionId: receipt.sessionId,
        exercisedAt: receipt.exercisedAt,
        evidence: path.relative(root, file),
      },
    ])
  })
  test('a receipt issued under a different boundary cannot qualify', () => {
    const { root, boundary, receipt } = fixture()
    storeReceipt(root, { ...receipt, boundaryCommit: 'a'.repeat(40) })
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toEqual([])
    expect(inspection.exposure).toEqual([])
  })
  test('a changed boundary timestamp cannot reuse an earlier receipt', () => {
    const { root, boundary, receipt } = fixture()
    storeReceipt(root, {
      ...receipt,
      boundaryFixedAt: new Date(0).toISOString(),
    })
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toEqual([])
    expect(inspection.exposure).toEqual([])
  })
  test('an older unbound receipt cannot qualify and is never rewritten', () => {
    const { root, boundary, receipt } = fixture()
    const legacy = JSON.stringify(
      Object.fromEntries(
        Object.entries(receipt).filter(([key]) => !key.startsWith('boundary')),
      ),
    )
    const file = storeBytes(
      root,
      `${exposureReceiptReadablePrefix(boundary.classKey)}--legacy.json`,
      legacy,
    )
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `invalid production exposure receipt: ${path.relative(root, file)}`,
    )
    expect(fs.readFileSync(file, 'utf8')).toBe(legacy)
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
    const run = commitAll(root, 'later')
    expect(run).not.toBe(boundary.commit)
    receipt.exercisedAt = new Date().toISOString()
    storeReceipt(root, { ...receipt, implementationCommit: run })
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toEqual([])
    expect(inspection.exposure).toHaveLength(1)
  })
  test('an exposure cannot predate the run revision named by its receipt', () => {
    const { root, boundary, receipt } = fixture()
    const laterDate = new Date(
      Date.parse(receipt.exercisedAt) + 60_000,
    ).toISOString()
    const run = commitEmpty(root, 'later run revision', {
      GIT_AUTHOR_DATE: laterDate,
      GIT_COMMITTER_DATE: laterDate,
    })
    const file = storeReceipt(root, { ...receipt, implementationCommit: run })
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `exposure predates its recorded run revision: ${path.relative(root, file)}`,
    )
  })
  test('a receipt from a revision BEFORE the fix cannot prove anything', () => {
    const { root, boundary, receipt } = fixture()
    const before = boundary.commit
    fs.writeFileSync(
      path.join(root, 'fix.txt'),
      'the commit that landed the fix',
    )
    boundary.commit = commitAll(root, 'fix')
    boundary.fixedAt = new Date().toISOString()
    const file = storeReceipt(root, {
      ...receipt,
      boundaryCommit: boundary.commit,
      boundaryFixedAt: boundary.fixedAt,
      implementationCommit: before,
    })
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `exposure receipt disagrees with boundary: ${path.relative(root, file)}`,
    )
  })
  test('a synthetic receipt cannot substitute for production exposure', () => {
    const { root, boundary, receipt } = fixture()
    const file = storeBytes(
      root,
      `${exposureReceiptReadablePrefix(boundary.classKey)}--synthetic.json`,
      { ...receipt, kind: 'synthetic-test' },
    )
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `invalid production exposure receipt: ${path.relative(root, file)}`,
    )
  })
  test('an unknown run revision cannot establish exposure chronology', () => {
    const { root, boundary, receipt } = fixture()
    const file = storeReceipt(root, {
      ...receipt,
      implementationCommit: '0'.repeat(40),
    })
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `unresolvable exposure run revision: ${path.relative(root, file)}`,
    )
  })
  test('a renamed receipt cannot claim an exposure it did not earn', () => {
    const { root, boundary, receipt } = fixture()
    const file = storeBytes(
      root,
      `${exposureReceiptReadablePrefix(boundary.classKey)}--${'0'.repeat(16)}.json`,
      receipt,
    )
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toContain(
      `renamed or edited exposure receipt: ${path.relative(root, file)}`,
    )
    expect(inspection.exposure).toEqual([])
  })
  test('a receipt for a different class cannot qualify this repair', () => {
    const { root, boundary, receipt } = fixture()
    storeReceipt(root, { ...receipt, classKey: 'another' })
    const inspection = inspectBoundaryEvidence(root, boundary)
    expect(inspection.issues).toEqual([])
    expect(inspection.exposure).toEqual([])
  })
  test('a boundary cannot predate its implementation', () => {
    const { root, boundary } = fixture()
    boundary.fixedAt = '2000-01-01T00:00:00Z'
    expect(inspectBoundaryEvidence(root, boundary).issues).toContain(
      `boundary predates its implementation commit: ${boundary.commit}`,
    )
  })
})
