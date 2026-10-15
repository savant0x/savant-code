/**
 * Project-trust gating (FID-2026-1006-002 WP9, T149 idea 9).
 *
 * Store half: canonical keys, ancestor chains, and the real JSON store file
 * — exercised through real temp files, never a mock: the file is the
 * boundary. The resolution chain's branches are pinned in
 * `project-trust-resolution.test.ts`.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  canonicalTrustKey,
  clearProjectTrust,
  defaultProjectTrustStorePath,
  readProjectTrustStore,
  setProjectTrust,
  trustAncestry,
  writeProjectTrustStore,
} from '../project-trust'

let tempDir: string
let storePath: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-trust-'))
  storePath = path.join(tempDir, 'trust.json')
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

/** A recorded decision written by this test, through the real store file. */
function record(directory: string, decision: 'trusted' | 'denied'): void {
  setProjectTrust(directory, decision, storePath)
}

describe('canonicalTrustKey', () => {
  it('normalizes a trailing separator so two spellings share one key', () => {
    expect(canonicalTrustKey(tempDir)).toBe(
      canonicalTrustKey(`${tempDir}${path.sep}`),
    )
  })

  it('normalizes `.` and `..` segments', () => {
    const nested = path.join(tempDir, 'a')
    fs.mkdirSync(nested, { recursive: true })
    expect(canonicalTrustKey(path.join(nested, '..', 'a'))).toBe(
      canonicalTrustKey(nested),
    )
  })

  it('resolves a directory that does not exist yet without throwing', () => {
    const missing = path.join(tempDir, 'not-created')
    expect(canonicalTrustKey(missing)).toBe(canonicalTrustKey(missing))
    expect(canonicalTrustKey(missing).length).toBeGreaterThan(0)
  })
})

describe('trustAncestry', () => {
  it('lists the directory first and reaches the root last', () => {
    const child = path.join(tempDir, 'packages', 'api')
    fs.mkdirSync(child, { recursive: true })
    const ancestry = trustAncestry(child)

    expect(ancestry[0]).toBe(canonicalTrustKey(child))
    expect(ancestry).toContain(canonicalTrustKey(tempDir))
    expect(ancestry.at(-1)).toBe(canonicalTrustKey(path.parse(child).root))
    // Nearest first: the parent index is strictly after the child's.
    expect(ancestry.indexOf(canonicalTrustKey(tempDir))).toBeGreaterThan(0)
  })

  it('never repeats a key', () => {
    const ancestry = trustAncestry(tempDir)
    expect(new Set(ancestry).size).toBe(ancestry.length)
  })
})

describe('the trust store file', () => {
  it('round-trips a recorded decision and clears it again', () => {
    record(tempDir, 'trusted')
    expect(
      readProjectTrustStore(storePath).projects[canonicalTrustKey(tempDir)],
    ).toBe('trusted')

    clearProjectTrust(tempDir, storePath)
    expect(
      readProjectTrustStore(storePath).projects[canonicalTrustKey(tempDir)],
    ).toBeUndefined()
  })

  it('reads a missing store as "nothing recorded"', () => {
    expect(readProjectTrustStore(storePath)).toEqual({
      version: 1,
      projects: {},
    })
  })

  it('reads a corrupt store as "nothing recorded" instead of throwing', () => {
    // An unreadable trust file must not take the session down; falling through
    // to `ask` is already the safe direction.
    fs.writeFileSync(storePath, '{ this is not json')
    expect(readProjectTrustStore(storePath).projects).toEqual({})
  })

  it('drops unknown decisions and non-object payloads (fail-safe parse)', () => {
    writeProjectTrustStore(
      {
        version: 1,
        projects: { [canonicalTrustKey(tempDir)]: 'trusted' },
      },
      storePath,
    )
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
      projects: Record<string, unknown>
    }
    raw.projects['/somewhere'] = 'maybe'
    fs.writeFileSync(storePath, JSON.stringify(raw))

    const store = readProjectTrustStore(storePath)
    expect(store.projects['/somewhere']).toBeUndefined()
    expect(store.projects[canonicalTrustKey(tempDir)]).toBe('trusted')
  })

  it('defaults the store path under the Savant home directory', () => {
    expect(defaultProjectTrustStorePath()).toContain('.savant-free')
  })
})
