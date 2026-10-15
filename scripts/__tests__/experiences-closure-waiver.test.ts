import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  closedOwnerIssues,
  closureWaiverManifestSchema,
  type ClosureWaiverManifest,
} from '../experiences-probe'

const FID = 'FID-2026-1012-017'
const CLASS_KEY = 'v1:run_terminal_command:timeout:undetermined'
const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function closedOwnerRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-waiver-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
  fs.writeFileSync(
    path.join(root, `dev/fids/${FID}-fixture.md`),
    '**Status:** closed\n**Closure waiver:** Q25 — `dev/experiences/closure-waivers.json`\n',
  )
  return root
}

function waiver(classes: string[] = [CLASS_KEY]): ClosureWaiverManifest {
  return {
    version: 1,
    waivers: [
      {
        fid: FID,
        grantedAt: '2026-10-14',
        fixCutoff: '2026-10-13T23:00:00Z',
        reason: 'operator-approved observation waiver',
        classes,
      },
    ],
  }
}

describe('closure waivers preserve recurrence protection', () => {
  test('accepts an explicitly named unresolved class for a closed owner', () => {
    expect(
      closedOwnerIssues(
        closedOwnerRoot(),
        [FID],
        [{ key: CLASS_KEY, owner: FID, state: 'unresolved' }],
        waiver(),
      ),
    ).toEqual([])
  })

  test('still rejects a closed owner without complete waiver coverage', () => {
    expect(
      closedOwnerIssues(
        closedOwnerRoot(),
        [FID],
        [{ key: CLASS_KEY, owner: FID, state: 'incomplete-observation' }],
        waiver([]),
      ),
    ).toEqual([`closed owner has unproved class: ${CLASS_KEY}`])
  })

  test('rejects a named class with a post-fix capture row', () => {
    expect(
      closedOwnerIssues(
        closedOwnerRoot(),
        [FID],
        [
          {
            key: CLASS_KEY,
            owner: FID,
            state: 'unresolved',
            lastSeen: '2026-10-14T00:00:00Z',
          },
        ],
        waiver(),
      ),
    ).toContain(
      `closure waiver cannot excuse post-fix recurrence: ${CLASS_KEY}`,
    )
  })

  test('never waives a recurrent class', () => {
    expect(
      closedOwnerIssues(
        closedOwnerRoot(),
        [FID],
        [{ key: CLASS_KEY, owner: FID, state: 'recurred' }],
        waiver(),
      ),
    ).toContain(`closed owner has recurrent class: ${CLASS_KEY}`)
  })

  test('rejects stale, foreign, and duplicate waiver declarations', () => {
    const result = closedOwnerIssues(
      closedOwnerRoot(),
      [FID],
      [{ key: CLASS_KEY, owner: FID, state: 'unresolved' }],
      {
        version: 1,
        waivers: [
          {
            fid: FID,
            grantedAt: '2026-10-14',
            fixCutoff: '2026-10-13T23:00:00Z',
            reason: 'first',
            classes: [CLASS_KEY, CLASS_KEY, 'v1:missing:class'],
          },
          {
            fid: FID,
            grantedAt: '2026-10-14',
            fixCutoff: '2026-10-13T23:00:00Z',
            reason: 'duplicate',
            classes: [CLASS_KEY],
          },
        ],
      },
    )
    expect(result).toContain(`duplicate closure waiver: ${FID}`)
    expect(result).toContain(`duplicate closure waiver class: ${CLASS_KEY}`)
    expect(result).toContain(
      'closure waiver has no recorded class: v1:missing:class',
    )
  })

  test('schema rejects malformed manifests before the probe runs', () => {
    expect(() =>
      closureWaiverManifestSchema.parse({
        version: 1,
        waivers: [
          {
            fid: 'FID-2026-1012-017',
            grantedAt: '2026-10-14',
            fixCutoff: '2026-10-13T23:00:00Z',
            reason: '',
            classes: [],
          },
        ],
      }),
    ).toThrow()
  })

  test('schema rejects impossible calendar dates', () => {
    expect(() =>
      closureWaiverManifestSchema.parse({
        version: 1,
        waivers: [
          {
            fid: FID,
            grantedAt: '2026-02-30',
            fixCutoff: '2026-10-13T23:00:00Z',
            reason: 'operator-approved observation waiver',
            classes: [CLASS_KEY],
          },
        ],
      }),
    ).toThrow()
  })

  test('requires a Q25 citation in a waivered closed owner', () => {
    const root = closedOwnerRoot()
    fs.writeFileSync(
      path.join(root, `dev/fids/${FID}-fixture.md`),
      '**Status:** closed\n',
    )
    expect(
      closedOwnerIssues(
        root,
        [FID],
        [{ key: CLASS_KEY, owner: FID, state: 'unresolved' }],
        waiver(),
      ),
    ).toContain(
      `closed owner is missing its Q25 closure-waiver citation: ${FID}`,
    )
  })
})
