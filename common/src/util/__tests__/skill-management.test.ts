import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  PATCH_MAX_CHANGE_RATIO,
  SKILL_INITIAL_VERSION,
  bumpVersion,
  createSkill,
  deleteDraftSkill,
  editSkill,
  levenshteinDistance,
  patchChangeRatio,
  patchSkill,
  readCurrentSkill,
  readLedgerEntries,
  removeReferenceFile,
  rollbackDraft,
  rollbackLiveSkill,
  skillCanonicalDir,
  skillQuarantineDir,
  skillVersionsDir,
  trustSkill,
  untrustSkill,
  validateReferencePath,
  writeReferenceFile,
  writeSnapshot,
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

describe('levenshtein + patch ratio (S2-B circuit breaker)', () => {
  test('levenshtein distance basics', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('same', 'same')).toBe(0)
    expect(levenshteinDistance('', 'abc')).toBe(3)
  })

  test('patch ratio caps at the 10% threshold', () => {
    const original = 'a'.repeat(100)
    // 5-char change on 100 chars = 5% (passes)
    expect(
      patchChangeRatio(original, 'b'.repeat(5) + 'a'.repeat(95)),
    ).toBeLessThanOrEqual(PATCH_MAX_CHANGE_RATIO)
    // 50-char change = 50% (fails)
    expect(
      patchChangeRatio(original, 'b'.repeat(50) + 'a'.repeat(50)),
    ).toBeGreaterThan(PATCH_MAX_CHANGE_RATIO)
  })
})

describe('bumpVersion', () => {
  test('bumps each semver kind', () => {
    expect(bumpVersion('0.1.0', 'patch')).toBe('0.1.1')
    expect(bumpVersion('0.1.9', 'minor')).toBe('0.2.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })
  test('rejects malformed versions', () => {
    expect(bumpVersion('abc', 'patch')).toBeNull()
    expect(bumpVersion('0.1', 'patch')).toBeNull()
  })
})

describe('createSkill (S2-B/S2-C)', () => {
  test('lands in quarantine, stamps version + ledger + snapshot', () => {
    const root = fixtureRoot()
    const result = createSkill({
      rootDir: root,
      name: 'release-runner',
      description: 'Runs the release checklist',
      body: BODY,
      sessionId: 'sess-1',
      reason: 'recurring release steps',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe(SKILL_INITIAL_VERSION)
    expect(result.pendingTrust).toBe(true)

    // Draft is in quarantine — NOT in the live dir.
    const draftFile = path.join(
      skillQuarantineDir(root, 'release-runner'),
      'SKILL.md',
    )
    expect(fs.existsSync(draftFile)).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillCanonicalDir(root, 'release-runner'), 'SKILL.md'),
      ),
    ).toBe(false)

    // Ledger entry with the full S2-C shape.
    const entries = readLedgerEntries(root, 'release-runner')
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.seq).toBe(1)
    expect(entry.action).toBe('create')
    expect(entry.version).toBe('0.1.0')
    expect(entry.prevSha).toBeNull()
    expect(entry.nextSha).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(entry.provenanceRef).toBe('session:sess-1')
    expect(entry.semanticPreservation).toBe(true)

    // Snapshot v1 exists for rollback.
    expect(
      fs.existsSync(
        path.join(skillVersionsDir(root, 'release-runner'), 'v1', 'SKILL.md'),
      ),
    ).toBe(true)
  })

  test('rejects invalid names and over-long descriptions', () => {
    const root = fixtureRoot()
    expect(
      createSkill({
        rootDir: root,
        name: '.quarantine',
        description: 'x',
        body: BODY,
        sessionId: 's',
        reason: 'r',
      }).ok,
    ).toBe(false)
    expect(
      createSkill({
        rootDir: root,
        name: 'ok-name',
        description: 'x'.repeat(61),
        body: BODY,
        sessionId: 's',
        reason: 'r',
      }).ok,
    ).toBe(false)
  })

  test('rejects duplicates', () => {
    const root = fixtureRoot()
    const first = createSkill({
      rootDir: root,
      name: 'dup-skill',
      description: 'first',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(first.ok).toBe(true)
    const second = createSkill({
      rootDir: root,
      name: 'dup-skill',
      description: 'second',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(second.ok).toBe(false)
  })
})

describe('patchSkill (S2-B: patch preferred, 10% cap, patch→patch)', () => {
  test('applies a small patch, bumps patch, snapshots prior state', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'patchy',
      description: 'Patch test skill',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'patchy',
      oldString: '## Pitfalls',
      newString: '## Pitfalls (updated)',
      sessionId: 'sess-2',
      reason: 'clarify pitfalls section',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe('0.1.1')

    const entries = readLedgerEntries(root, 'patchy')
    expect(entries).toHaveLength(2)
    expect(entries[1].action).toBe('patch')
    expect(entries[1].version).toBe('0.1.1')
    expect(entries[1].prevSha).toBe(entries[0].nextSha)

    // Prior state snapshot at v2.
    const priorSnapshot = fs.readFileSync(
      path.join(skillVersionsDir(root, 'patchy'), 'v2', 'SKILL.md'),
      'utf8',
    )
    expect(priorSnapshot).toContain('## Pitfalls')
    expect(priorSnapshot).not.toContain('(updated)')
  })

  test('rejects an over-cap patch', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'bigpatch',
      description: 'Big patch test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'bigpatch',
      oldString: BODY,
      newString: 'x'.repeat(200),
      sessionId: 's',
      reason: 'rewrite via patch',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('cap')
  })

  test('rejects a missing anchor', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'noanchor',
      description: 'Anchor test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = patchSkill({
      rootDir: root,
      name: 'noanchor',
      oldString: 'this does not exist anywhere',
      newString: 'replacement',
      sessionId: 's',
      reason: 'r',
    })
    expect(result.ok).toBe(false)
  })

  test('rejects patching a nonexistent skill', () => {
    const root = fixtureRoot()
    const result = patchSkill({
      rootDir: root,
      name: 'ghost',
      oldString: 'a',
      newString: 'b',
      sessionId: 's',
      reason: 'r',
    })
    expect(result.ok).toBe(false)
  })
})

describe('editSkill (edit→minor)', () => {
  test('full replace bumps minor', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'editable',
      description: 'Edit test',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = editSkill({
      rootDir: root,
      name: 'editable',
      description: 'Edit test v2',
      body: `# Completely new body\n\n## Procedure\n\nNew steps.\n`,
      sessionId: 'sess-3',
      reason: 'full rewrite',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version).toBe('0.2.0')
  })
})

describe('immutable skills (S2-A)', () => {
  test('mutations are rejected when the live skill is immutable', () => {
    const root = fixtureRoot()
    // Operator places a hand-written immutable skill directly.
    const liveDir = skillCanonicalDir(root, 'governance')
    fs.mkdirSync(liveDir, { recursive: true })
    fs.writeFileSync(
      path.join(liveDir, 'SKILL.md'),
      `---\nname: governance\nversion: 1.0.0\nimmutable: true\ndescription: Non-negotiable governance rules\n---\n\n# Governance\n\nMust never change.\n`,
      'utf8',
    )
    const patch = patchSkill({
      rootDir: root,
      name: 'governance',
      oldString: 'Governance',
      newString: 'Governance (edited)',
      sessionId: 's',
      reason: 'attempted mutation',
    })
    expect(patch.ok).toBe(false)
    if (!patch.ok) expect(patch.error).toContain('immutable')
  })

  test('operator rollback is also rejected for immutable skills', () => {
    const root = fixtureRoot()
    const liveDir = skillCanonicalDir(root, 'governance')
    fs.mkdirSync(liveDir, { recursive: true })
    fs.writeFileSync(
      path.join(liveDir, 'SKILL.md'),
      `---\nname: governance\nversion: 1.0.0\nimmutable: true\ndescription: Non-negotiable governance rules\n---\n\n# Governance\n`,
      'utf8',
    )
    writeSnapshot(root, 'governance', 1, 'snapshot content')
    const rb = rollbackLiveSkill(root, 'governance', 1)
    expect(rb.ok).toBe(false)
  })
})

describe('trust / untrust (S2-D operator boundary)', () => {
  test('trust migrates the draft to live and clears quarantine', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'trustme',
      description: 'To be trusted',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    const result = trustSkill(root, 'trustme')
    expect(result.ok).toBe(true)
    expect(
      fs.existsSync(path.join(skillCanonicalDir(root, 'trustme'), 'SKILL.md')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(skillQuarantineDir(root, 'trustme'), 'SKILL.md')),
    ).toBe(false)
  })

  test('untrust moves the live copy back to quarantine', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'untrustme',
      description: 'To be untrusted',
      body: BODY,
      sessionId: 's',
      reason: 'create',
    })
    trustSkill(root, 'untrustme')
    const result = untrustSkill(root, 'untrustme')
    expect(result.ok).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillQuarantineDir(root, 'untrustme'), 'SKILL.md'),
      ),
    ).toBe(true)
    expect(
      fs.existsSync(
        path.join(skillCanonicalDir(root, 'untrustme'), 'SKILL.md'),
      ),
    ).toBe(false)
  })

  test('trusting a nonexistent draft fails', () => {
    const root = fixtureRoot()
    expect(trustSkill(root, 'ghost').ok).toBe(false)
  })
})

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
