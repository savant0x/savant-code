import { describe, expect, test } from 'bun:test'

import {
  collectForeignRoots,
  type ForeignRootInput,
} from '../audit-vendored-tree.js'

/**
 * The three signals, in the order the rule applies them. `tracked` is the set of
 * top-level roots git has at least one file in; a root absent from it has no
 * tracked files at all, which is signal 1.
 */
const root = (
  name: string,
  overrides: Partial<ForeignRootInput> = {},
): ForeignRootInput => ({
  root: name,
  untracked: 1,
  nestedGit: false,
  ...overrides,
})

describe('collectForeignRoots — the three foreign-tree signals', () => {
  test('a root with no tracked files is foreign (pure accidental clone)', () => {
    const findings = collectForeignRoots([root('clone-main')], new Set())
    expect(findings).toEqual([{ root: 'clone-main', reason: 'untracked' }])
  })

  test('a root with ONE tracked file and a nested .git is foreign (the blind spot)', () => {
    // The original rule tested "no tracked files", so a single `git add`'d file
    // made a 4,150-file payload invisible. This is the regression guard.
    const findings = collectForeignRoots(
      [root('partial', { untracked: 4150, nestedGit: true })],
      new Set(['partial']),
    )
    expect(findings).toEqual([{ root: 'partial', reason: 'nested-git' }])
  })

  test('a root with ONE tracked file and bulk untracked files is foreign (plain copy)', () => {
    // resources/cline-main is a directory copy with no .git, so the bulk signal
    // is the only one that catches the original incident.
    const findings = collectForeignRoots(
      [root('copy-main', { untracked: 4150 })],
      new Set(['copy-main']),
    )
    expect(findings).toEqual([{ root: 'copy-main', reason: 'bulk-untracked' }])
  })
})

describe('collectForeignRoots — what must NOT be flagged', () => {
  test('work in progress inside a tracked root is never foreign', () => {
    // The false-positive guard, mirroring the live M4 mutation: 100 untracked
    // files under the already-tracked `scripts/` root is ordinary uncommitted
    // work, not a vendored tree. `nestedGit` is false because the real
    // `scripts/` has no nested clone inside it.
    const findings = collectForeignRoots(
      [root('scripts', { untracked: 100 })],
      new Set(['scripts']),
    )
    expect(findings).toEqual([])
  })

  test('a nested .git inside a tracked root IS foreign', () => {
    // The counterpart to the guard above, and the reason the guard needs
    // `nestedGit: false`: a clone dropped INSIDE a project root is exactly the
    // shape that `git add --all` would stage, so it must not be excused by the
    // root being tracked. Signal 2 outranks the tracked-root exemption.
    //
    // `untracked: 0` is the regression that review caught: the candidate set
    // used to be derived from the untracked listing alone, so a root with no
    // untracked files never entered consideration and this case printed PASS.
    const findings = collectForeignRoots(
      [root('scripts', { untracked: 0, nestedGit: true })],
      new Set(['scripts']),
    )
    expect(findings).toEqual([{ root: 'scripts', reason: 'nested-git' }])
  })

  test('a small untracked run in a tracked root is not foreign', () => {
    const findings = collectForeignRoots(
      [root('cli', { untracked: 12 })],
      new Set(['cli']),
    )
    expect(findings).toEqual([])
  })

  test('the bulk threshold is not crossed by the legitimate maximum', () => {
    // Measured live: the largest untracked run in a real root is 12 files.
    // The threshold is 250, so ordinary work has ~20x headroom.
    const findings = collectForeignRoots(
      [root('dev', { untracked: 249 })],
      new Set(['dev']),
    )
    expect(findings).toEqual([])
  })
})

describe('collectForeignRoots — threshold boundary', () => {
  test('one file below the threshold is clean', () => {
    const findings = collectForeignRoots(
      [root('edge', { untracked: 249 })],
      new Set(['edge']),
      250,
    )
    expect(findings).toEqual([])
  })

  test('exactly at the threshold fires', () => {
    const findings = collectForeignRoots(
      [root('edge', { untracked: 250 })],
      new Set(['edge']),
      250,
    )
    expect(findings).toEqual([{ root: 'edge', reason: 'bulk-untracked' }])
  })
})

describe('collectForeignRoots — ordering and determinism', () => {
  test('findings are sorted by root name regardless of input order', () => {
    const findings = collectForeignRoots(
      [root('zeta'), root('alpha'), root('mid')],
      new Set(),
    )
    expect(findings.map((f) => f.root)).toEqual(['alpha', 'mid', 'zeta'])
  })

  test('each root is reported at most once, with its first matching signal', () => {
    // A clone with bulk files must report the more specific clone reason, and
    // must not be double-counted as a bulk payload.
    const findings = collectForeignRoots(
      [root('both', { untracked: 9000, nestedGit: true })],
      new Set(['both']),
    )
    expect(findings).toEqual([{ root: 'both', reason: 'nested-git' }])
  })
})
