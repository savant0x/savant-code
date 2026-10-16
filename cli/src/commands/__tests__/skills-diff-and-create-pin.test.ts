import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  createSkill,
  editSkill,
  skillCanonicalDir,
  skillQuarantineDir,
  trustSkill,
} from '@savant-code/common/util/skill-management'
import { readBaselineSha } from '@savant-code/common/util/skill-management/baseline-sha'
import { afterEach, expect, test } from 'bun:test'

import { computeUnifiedSkillDiff } from '../skills-diff'
import { showMessage } from '../skills-discovery'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function draft() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'skill-pin-'))
  roots.push(rootDir)
  const params = {
    rootDir,
    name: 'review-rule',
    description: 'Review code changes',
    body: '# Review\nCheck all changed code.',
    sessionId: 'test',
    reason: 'regression',
  }
  expect(createSkill(params).ok).toBe(true)
  return params
}

test('one inserted line has one addition and no cascading replacements', () => {
  const live = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
  const changed = live.replace('line 1\n', 'line 1\ninserted\n')
  const diff = computeUnifiedSkillDiff(live, changed)
  expect(diff).toContain('[-0/+1 lines]')
  expect(diff).toContain('+ inserted')
  expect(diff).toContain('@@ -1,4 +1,5 @@')
  expect(diff).not.toContain('- line')
  expect(computeUnifiedSkillDiff(live, live)).toBe('(identical)')
})

test('diff reports replacements, handles repeated lines and bounds output', () => {
  expect(computeUnifiedSkillDiff('a\nb\na', 'a\nc\na')).toContain(
    '[-1/+1 lines]',
  )
  expect(computeUnifiedSkillDiff('a\na', 'a')).toContain('[-1/+0 lines]')
  const diff = computeUnifiedSkillDiff(
    Array.from({ length: 100 }, (_, i) => String(i)).join('\n'),
    'replacement',
    { maxOutputLines: 10 },
  )
  expect(diff.split('\n')).toHaveLength(10)
  expect(diff).toContain('truncated')
})

test('create pins absence and refuses a concurrently created live skill', () => {
  const params = draft()
  const content = readFileSync(
    path.join(skillQuarantineDir(params.rootDir, params.name), 'SKILL.md'),
    'utf8',
  )
  expect(readBaselineSha(content)).toBe('none')
  const live = skillCanonicalDir(params.rootDir, params.name)
  mkdirSync(live, { recursive: true })
  writeFileSync(path.join(live, 'SKILL.md'), content + '\nOperator edit\n')
  const result = trustSkill(params.rootDir, params.name)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toContain('Drift detected')
  expect(readFileSync(path.join(live, 'SKILL.md'), 'utf8')).toContain(
    'Operator edit',
  )
  expect(showMessage(params.rootDir, params.name)).toContain(
    'Pending quarantined draft',
  )
  expect(showMessage(params.rootDir, params.name)).toContain(
    '/skills show review-rule --review',
  )
})

test('editing a new draft preserves absence pin and ordinary trust succeeds', () => {
  const params = draft()
  expect(
    editSkill({ ...params, body: '# Review\nCheck all boundaries.' }).ok,
  ).toBe(true)
  const content = readFileSync(
    path.join(skillQuarantineDir(params.rootDir, params.name), 'SKILL.md'),
    'utf8',
  )
  expect(readBaselineSha(content)).toBe('none')
  expect(trustSkill(params.rootDir, params.name).ok).toBe(true)
})
