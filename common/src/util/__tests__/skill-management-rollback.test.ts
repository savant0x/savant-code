// skill-management test family — rollback (S2-E), references/, draft deletion.
// Sibling of the Loop 353 decomposition (fixture helpers replicated per
// module to preserve the monolith's isolation semantics).
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  createSkill,
  deleteDraftSkill,
  patchSkill,
  readCurrentSkill,
  removeReferenceFile,
  rollbackDraft,
  rollbackLiveSkill,
  skillQuarantineDir,
  trustSkill,
  validateReferencePath,
  writeReferenceFile,
} from '../skill-management'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-mgmt-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const BODY = `# Test Skill

## When to Use
Use this when...

## Procedure
1. Do the thing.

## Pitfalls
- Watch out.

## Verification
Run the suite.
`

describe('rollback (S2-E)', () => {
  test('agent rollback is quarantine-scoped only', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'rollme',
      description: 'Rollback test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    // Trust it — now there is no draft, so agent rollback must fail.
    trustSkill(root, 'rollme')
    const result = rollbackDraft({
      rootDir: root,
      name: 'rollme',
      seq: 1,
      sessionId: 's',
      reason: 'agent rollback attempt',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('draft')
  })

  test('agent rollback restores a snapshot into the draft', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'rollme2',
      description: 'Rollback test 2',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    patchSkill({
      rootDir: root,
      name: 'rollme2',
      oldString: '## Pitfalls',
      newString: '## Pitfalls (v2)',
      sessionId: 's',
      reason: 'patch',
    })
    // v2 snapshot = the ORIGINAL (pre-patch) content.
    const result = rollbackDraft({
      rootDir: root,
      name: 'rollme2',
      seq: 2,
      sessionId: 's',
      reason: 'restore',
    })
    expect(result.ok).toBe(true)
    const draft = readCurrentSkill(root, 'rollme2')
    expect(draft.draft?.content).toContain('## Pitfalls\n')
  })

  test('operator rollback restores a snapshot into the live copy', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'oproll',
      description: 'Operator rollback',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    trustSkill(root, 'oproll')
    const rb = rollbackLiveSkill(root, 'oproll', 1)
    expect(rb.ok).toBe(true)
    const live = readCurrentSkill(root, 'oproll').live
    expect(live?.content).toContain('# Test Skill')
  })
})

describe('references/ files (write_file/remove_file)', () => {
  test('writes and removes reference files in the draft', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'refskill',
      description: 'References test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const written = writeReferenceFile({
      rootDir: root,
      name: 'refskill',
      relPath: 'details/checklist.md',
      content: '# Checklist\n',
      sessionId: 's',
      reason: 'add checklist reference',
    })
    expect(written.ok).toBe(true)
    const refFile = path.join(
      skillQuarantineDir(root, 'refskill'),
      'references',
      'details',
      'checklist.md',
    )
    expect(fs.existsSync(refFile)).toBe(true)

    const removed = removeReferenceFile({
      rootDir: root,
      name: 'refskill',
      relPath: 'details/checklist.md',
      sessionId: 's',
      reason: 'drop stale reference',
    })
    expect(removed.ok).toBe(true)
    expect(fs.existsSync(refFile)).toBe(false)
  })

  test('rejects traversal paths', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'traversal',
      description: 'Traversal test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    expect(validateReferencePath('../evil.md')).not.toBeNull()
    expect(validateReferencePath('/abs.md')).not.toBeNull()
    expect(validateReferencePath('a/../../evil.md')).not.toBeNull()
    const result = writeReferenceFile({
      rootDir: root,
      name: 'traversal',
      relPath: '../evil.md',
      content: 'x',
      sessionId: 's',
      reason: 'attempt',
    })
    expect(result.ok).toBe(false)
  })
})

describe('deleteDraftSkill', () => {
  test('deletes only a quarantined draft', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'doomed',
      description: 'Delete test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    expect(
      deleteDraftSkill({
        rootDir: root,
        name: 'doomed',
        sessionId: 's',
        reason: 'rejected draft',
      }).ok,
    ).toBe(true)
    expect(fs.existsSync(path.join(skillQuarantineDir(root, 'doomed')))).toBe(
      false,
    )
  })

  test('rejects deleting a trusted (live) skill', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'keepme',
      description: 'Keep me',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    trustSkill(root, 'keepme')
    const result = deleteDraftSkill({
      rootDir: root,
      name: 'keepme',
      sessionId: 's',
      reason: 'attempt',
    })
    expect(result.ok).toBe(false)
  })
})
