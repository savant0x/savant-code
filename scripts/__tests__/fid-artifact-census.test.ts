import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  findActiveArtifactFailures,
  findDeclaredTestPaths,
  scanFidArtifacts,
} from '../fid-artifact-census'

function withTempTree(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-fid-artifacts-'))
  try {
    run(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

describe('FID declared-artifact census', () => {
  it('finds repo-relative test paths outside fenced examples', () => {
    const content = [
      'New test: scripts/__tests__/fixture.test.ts',
      '',
      '```text',
      'packages/agent-runtime/src/ignored.test.ts',
      '```',
    ].join('\n')
    expect(findDeclaredTestPaths(content)).toEqual([
      'scripts/__tests__/fixture.test.ts',
    ])
  })

  it('reports missing artifacts and accepts an explicit absence marker', () => {
    withTempTree((root) => {
      fs.mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
      fs.mkdirSync(path.join(root, 'scripts/__tests__'), { recursive: true })
      fs.writeFileSync(path.join(root, 'scripts/__tests__/present.test.ts'), '')
      fs.writeFileSync(
        path.join(root, 'dev/fids/FID-1.md'),
        [
          'scripts/__tests__/present.test.ts',
          'scripts/__tests__/historical.test.ts',
          'artifact::absent scripts/__tests__/historical.test.ts — renamed',
        ].join('\n'),
      )

      expect(scanFidArtifacts(root, ['dev/fids/FID-1.md'])).toMatchObject({
        recordsScanned: 1,
        namedPaths: 2,
        distinctMissingPaths: [],
        recordsWithMissingPaths: [],
      })
    })
  })

  it('does not turn archived findings into active gate failures', () => {
    const archivedFailure = {
      record: 'dev/fids/archive/FID-1.md',
      paths: ['scripts/__tests__/historical.test.ts'],
      missing: ['scripts/__tests__/historical.test.ts'],
      markedAbsent: [],
    }
    const activeFailure = {
      record: 'dev/fids/FID-2.md',
      paths: ['scripts/__tests__/active.test.ts'],
      missing: ['scripts/__tests__/active.test.ts'],
      markedAbsent: [],
    }
    const census = {
      recordsScanned: 2,
      namedPaths: 2,
      distinctMissingPaths: [
        'scripts/__tests__/active.test.ts',
        'scripts/__tests__/historical.test.ts',
      ],
      recordsWithMissingPaths: [archivedFailure, activeFailure],
    }

    expect(findActiveArtifactFailures(census, ['dev/fids/FID-2.md'])).toEqual([
      activeFailure,
    ])
    expect(findActiveArtifactFailures(census, ['dev/fids/FID-3.md'])).toEqual(
      [],
    )
  })
})
