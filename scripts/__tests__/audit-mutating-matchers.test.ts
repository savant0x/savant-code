import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  auditMutatingMatcherSource,
  collectMutatingMatcherIssues,
} from '../audit-mutating-matchers'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('inline asymmetric matcher audit', () => {
  test.each([
    "expect(value).toMatchObject({ a: expect.stringContaining('x') })",
    'expect(value).toMatchObject({ a: expect.not.objectContaining({ b: 1 }) })',
    "import { expect as check } from 'bun:test'; check(value).toMatchObject({ a: check.any(String) })",
    'await expect(promise).resolves.toMatchObject({ a: expect.anything() })',
  ])('rejects executable matcher pattern: %s', (source) => {
    expect(auditMutatingMatcherSource('fixture.test.ts', source)).toHaveLength(
      1,
    )
  })

  test('literal assertions, quoted examples and equality compositions are clean', () => {
    const source = `
      // expect(value).toMatchObject({ a: expect.any(String) })
      const example = "expect(value).toMatchObject({ a: expect.any(String) })";
      expect(value).toMatchObject({ a: 'x', nested: { b: 1 } });
      expect(value).toEqual(expect.objectContaining({ a: expect.any(String) }));
    `
    expect(auditMutatingMatcherSource('fixture.test.ts', source)).toEqual([])
  })

  test('equality composition preserves evidence and still rejects mismatches', () => {
    const received = { a: 'x', nested: { b: 1 }, other: true }
    const before = JSON.stringify(received)
    expect(received).toEqual(
      expect.objectContaining({ a: expect.stringContaining('x') }),
    )
    expect(JSON.stringify(received)).toBe(before)
    expect(() =>
      expect(received).toEqual(expect.objectContaining({ a: 'wrong' })),
    ).toThrow()
    expect(JSON.stringify(received)).toBe(before)
  })

  test('new source is enforced, ignored copies are excluded and a bad census fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'matcher-audit-'))
    roots.push(root)
    expect(collectMutatingMatcherIssues(root)[0]?.code).toBe(
      'audit.mutating-matcher.census',
    )
    expect(Bun.spawnSync(['git', 'init', '-q'], { cwd: root }).exitCode).toBe(0)
    fs.mkdirSync(path.join(root, 'sdk'))
    fs.writeFileSync(path.join(root, '.gitignore'), 'sdk/ignored.test.ts\n')
    const source = 'expect(value).toMatchObject({ a: expect.any(String) })'
    fs.writeFileSync(path.join(root, 'sdk/ignored.test.ts'), source)
    fs.writeFileSync(path.join(root, 'sdk/new.test.ts'), source)
    const issues = collectMutatingMatcherIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('sdk/new.test.ts:1')
  })
})
