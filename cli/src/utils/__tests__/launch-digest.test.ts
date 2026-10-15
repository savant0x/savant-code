/**
 * FID-2026-1008-004 (A) — pins the launch-digest decision (post when there are
 * lines, every call, never throw). Readers and the sink are injected, so the
 * React effect that calls `runLaunchDigest` is not needed here.
 */
import { describe, expect, test } from 'bun:test'

import { CATALOG, CTX } from './free-options-test-fixtures'
import { buildFreeOptionsReport } from '../free-options'
import { runLaunchDigest } from '../launch-digest'

describe('FID-2026-1008-004: runLaunchDigest', () => {
  test('posts the digest and returns true when there are lines', () => {
    const posted: string[] = []
    const ok = runLaunchDigest({
      readReport: () => buildFreeOptionsReport(CATALOG, CTX),
      readDiscovery: () => null,
      post: (text) => posted.push(text),
    })
    expect(ok).toBe(true)
    expect(posted).toHaveLength(1)
    expect(posted[0]).toContain('Free AI lanes available')
  })

  test('posts nothing when there is nothing to say', () => {
    const posted: string[] = []
    const ok = runLaunchDigest({
      readReport: () => null,
      readDiscovery: () => null,
      post: (text) => posted.push(text),
    })
    expect(ok).toBe(false)
    expect(posted).toHaveLength(0)
  })

  test('posts again on every call, so a same-day relaunch still shows it', () => {
    const posted: string[] = []
    const deps = {
      readReport: () => buildFreeOptionsReport(CATALOG, CTX),
      readDiscovery: () => null,
      post: (text: string) => posted.push(text),
    }
    runLaunchDigest(deps)
    runLaunchDigest(deps)
    expect(posted).toHaveLength(2)
  })

  test('a discovery delta alone is enough to post', () => {
    const posted: string[] = []
    const ok = runLaunchDigest({
      readReport: () => null,
      readDiscovery: () => ({ newCount: 1, changedCount: 0 }),
      post: (text) => posted.push(text),
    })
    expect(ok).toBe(true)
    expect(posted[0]).toContain('1 new')
  })

  test('a failing reader is fail-silent: no throw, no post', () => {
    const posted: string[] = []
    const ok = runLaunchDigest({
      readReport: () => {
        throw new Error('corrupt cache')
      },
      readDiscovery: () => null,
      post: (text) => posted.push(text),
    })
    expect(ok).toBe(false)
    expect(posted).toHaveLength(0)
  })
})
