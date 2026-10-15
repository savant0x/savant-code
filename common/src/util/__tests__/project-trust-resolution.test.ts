/**
 * Project-trust gating (FID-2026-1006-002 WP9, T149 idea 9).
 *
 * Resolution half: every branch of the resolution chain is pinned here,
 * because the chain is a security decision — a bug that makes branch 2 answer
 * when it should not is an auto-trust, and one that makes branch 5 not fail
 * closed is a cloned repository loading its `.agents/skills/` unchanged. The
 * store is exercised through real temp files, never a mock.
 *
 * The chain is async (a decider may run a process — the hook-backed one does),
 * so every resolution is awaited; that is also what makes "the FIRST decider
 * owns it" observable rather than incidental.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  canonicalTrustKey,
  isProjectTrusted,
  resolveProjectTrust,
  setProjectTrust,
} from '../project-trust'

import type {
  ProjectTrustDecider,
  ProjectTrustDecision,
} from '../project-trust'

let tempDir: string
let storePath: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-trust-res-'))
  storePath = path.join(tempDir, 'trust.json')
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

/** A recorded decision written by this test, through the real store file. */
function record(directory: string, decision: 'trusted' | 'denied'): void {
  setProjectTrust(directory, decision, storePath)
}

describe('resolution order', () => {
  it('an explicit override wins over a recorded decision, and deny beats approve', async () => {
    record(tempDir, 'denied')
    expect(
      (await resolveProjectTrust(tempDir, { approve: true, storePath }))
        .decision,
    ).toBe('trusted')
    expect(
      (
        await resolveProjectTrust(tempDir, {
          approve: true,
          deny: true,
          storePath,
        })
      ).decision,
    ).toBe('denied')
    expect(
      (await resolveProjectTrust(tempDir, { deny: true, storePath })).source,
    ).toBe('override')
  })

  it('a recorded decision wins over the default and names its source', async () => {
    record(tempDir, 'trusted')
    const resolved = await resolveProjectTrust(tempDir, {
      defaultProjectTrust: 'denied',
      storePath,
    })
    expect(resolved.decision).toBe('trusted')
    expect(resolved.source).toBe('store')
    expect(resolved.inheritedFrom).toBeUndefined()
  })

  it('inherits the closest recorded parent and names the ancestor it came from', async () => {
    const child = path.join(tempDir, 'packages', 'api')
    const sibling = path.join(tempDir, 'packages', 'web')
    const parent = path.join(tempDir, 'packages')
    fs.mkdirSync(child, { recursive: true })
    fs.mkdirSync(sibling, { recursive: true })
    record(parent, 'trusted')

    const resolved = await resolveProjectTrust(child, { storePath })
    expect(resolved.decision).toBe('trusted')
    expect(resolved.inheritedFrom).toBe(canonicalTrustKey(parent))
    // A sibling inherits the same decision...
    expect(await isProjectTrusted(sibling, { storePath })).toBe(true)
    // ...and a decision recorded for the child overrides the parent.
    record(child, 'denied')
    expect((await resolveProjectTrust(child, { storePath })).decision).toBe(
      'denied',
    )
    expect(await isProjectTrusted(sibling, { storePath })).toBe(true)
  })

  it('an `ask` entry is not a decision and does not stop the chain', async () => {
    // `ask` cannot be recorded through setProjectTrust (its type excludes it),
    // but a hand-edited store can carry it — it must not read as a decision.
    fs.writeFileSync(
      storePath,
      JSON.stringify({
        version: 1,
        projects: { [canonicalTrustKey(tempDir)]: 'ask' },
      }),
    )
    const resolved = await resolveProjectTrust(tempDir, {
      defaultProjectTrust: 'trusted',
      storePath,
    })
    expect(resolved.source).toBe('default')
    expect(resolved.decision).toBe('trusted')
  })

  it('consults deciders in order and the FIRST decision owns it', async () => {
    const calls: string[] = []
    const deciders: ProjectTrustDecider[] = [
      ({ key }) => {
        calls.push(`first:${key}`)
        return undefined
      },
      async (): Promise<ProjectTrustDecision> => {
        calls.push('second')
        return 'trusted'
      },
      () => {
        calls.push('third')
        return 'denied'
      },
    ]

    const resolved = await resolveProjectTrust(tempDir, { storePath }, deciders)

    expect(resolved.decision).toBe('trusted')
    expect(resolved.source).toBe('decider')
    // The decider that answered ends the chain: the third is never consulted.
    expect(calls).toEqual([`first:${canonicalTrustKey(tempDir)}`, 'second'])
  })

  it('a decider deferring with `ask` is not a decision either', async () => {
    const resolved = await resolveProjectTrust(
      tempDir,
      { storePath, defaultProjectTrust: 'denied' },
      [
        (): ProjectTrustDecision | undefined => 'ask',
        (): ProjectTrustDecision | undefined => 'trusted',
      ],
    )
    expect(resolved.decision).toBe('trusted')
  })

  it('a recorded decision is never overridden by a decider', async () => {
    record(tempDir, 'denied')
    const resolved = await resolveProjectTrust(tempDir, { storePath }, [
      (): ProjectTrustDecision | undefined => 'trusted',
    ])
    expect(resolved.decision).toBe('denied')
    expect(resolved.source).toBe('store')
  })
})

describe('fail-closed behaviour', () => {
  it('an unresolved `ask` stays `ask` for the caller and never loads resources', async () => {
    const resolved = await resolveProjectTrust(tempDir, { storePath })
    expect(resolved.decision).toBe('ask')
    expect(resolved.effective).toBe('denied')
    expect(resolved.source).toBe('default')
    expect(await isProjectTrusted(tempDir, { storePath })).toBe(false)
  })

  it('a non-interactive session resolves an `ask` to a named refusal', async () => {
    const resolved = await resolveProjectTrust(tempDir, {
      storePath,
      nonInteractive: true,
    })
    expect(resolved.decision).toBe('ask')
    expect(resolved.effective).toBe('denied')
    expect(resolved.source).toBe('non-interactive')
  })

  it('a non-interactive session still honours an explicit override', async () => {
    expect(
      (
        await resolveProjectTrust(tempDir, {
          storePath,
          nonInteractive: true,
          approve: true,
        })
      ).effective,
    ).toBe('trusted')
  })

  it('the default decision is configurable and reported as the default', async () => {
    const resolved = await resolveProjectTrust(tempDir, {
      storePath,
      defaultProjectTrust: 'trusted',
    })
    expect(resolved.decision).toBe('trusted')
    expect(resolved.effective).toBe('trusted')
    expect(resolved.source).toBe('default')
  })
})
