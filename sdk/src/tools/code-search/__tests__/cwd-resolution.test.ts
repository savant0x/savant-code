import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

import { codeSearch } from '../executor'

type SearchOutput = Awaited<ReturnType<typeof codeSearch>>

/** Pull the human message out of the tool's json envelope, without casting. */
const messageOf = (out: SearchOutput): string => {
  const first = out[0]
  if (!first || !('value' in first)) return ''
  const value: unknown = first.value
  if (typeof value !== 'object' || value === null) return ''
  if (!('message' in value)) return ''
  const message: unknown = value.message
  return typeof message === 'string' ? message : ''
}

const tmpRoots: string[] = []

const makeFixtureRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'code-search-cwd-'))
  tmpRoots.push(root)
  writeFileSync(join(root, 'hit.ts'), 'export const needle = 1\n')
  writeFileSync(join(root, 'other.ts'), 'export const nothing = 2\n')
  return root
}

afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true })
})

describe('FID-2026-1004-006 (A)+(C-1): search-directory validation', () => {
  test('a FILE cwd is rejected by name, never prescribing the re-fetch', async () => {
    const root = makeFixtureRoot()
    const out = await codeSearch({
      projectPath: root,
      pattern: 'needle',
      cwd: 'hit.ts',
    })
    const message = messageOf(out)
    expect(message).toContain('not a directory')
    expect(message).toContain('hit.ts')
    // The remedy that cannot apply to a bad cwd must not be suggested: a
    // re-fetch changes nothing while the binary is present and working.
    expect(message).not.toContain('fetch-ripgrep')
    expect(message).not.toContain('uv_spawn')
  })

  test('a NON-EXISTENT cwd is rejected the same truthful way', async () => {
    const root = makeFixtureRoot()
    const out = await codeSearch({
      projectPath: root,
      pattern: 'needle',
      cwd: 'nope/not/here',
    })
    const message = messageOf(out)
    expect(message).toContain('not a directory')
    expect(message).not.toContain('fetch-ripgrep')
  })

  test('a real DIRECTORY cwd still spawns and returns matches', async () => {
    const root = makeFixtureRoot()
    const out = await codeSearch({
      projectPath: root,
      pattern: 'needle',
    })
    const message = messageOf(out)
    expect(message).not.toContain('not a directory')
    expect(message).toContain('Exit code: 0')
  })
})
