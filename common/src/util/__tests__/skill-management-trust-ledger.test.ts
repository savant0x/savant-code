// FID-2026-0912-001 RED pins: trust/untrust ledger appends + baselineSha
// drift gate at the operator trust boundary.
//
// Contract under test (FID-2026-0912-001):
// 1. trustSkill appends a FULL SkillLedgerEntry (action 'trust') — the
//    rollbackLiveSkill pattern — and untrustSkill appends action 'untrust'.
//    Previously neither appended anything (trust.ts:77-121).
// 2. patch/edit drafts carry metadata.baselineSha = hash of the LIVE bytes
//    at draft time; trust refuses (fail-closed) when the live file has
//    drifted since. Unpinned (legacy/created) drafts trust with a warning.
// 3. SKILL_MANAGE_ACTIONS extends with 'trust' and 'untrust'.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  SKILL_MANAGE_ACTIONS,
  createSkill,
  editSkill,
  patchSkill,
  readLedgerEntries,
  skillCanonicalDir,
  skillQuarantineDir,
  trustSkill,
  untrustSkill,
} from '../skill-management'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-trust-ledger-'))
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

## Verification
Run the suite.
`

function writeLiveSkill(
  root: string,
  name: string,
  description: string,
  body: string,
): void {
  const liveDir = skillCanonicalDir(root, name)
  fs.mkdirSync(liveDir, { recursive: true })
  fs.writeFileSync(
    path.join(liveDir, 'SKILL.md'),
    `---\nname: ${name}\nversion: 1.0.0\ndescription: ${description}\n---\n\n${body}`,
    'utf8',
  )
}

describe('FID-2026-0912-001: action union extension', () => {
  test("SKILL_MANAGE_ACTIONS includes 'trust' and 'untrust'", () => {
    expect(SKILL_MANAGE_ACTIONS).toContain('trust')
    expect(SKILL_MANAGE_ACTIONS).toContain('untrust')
  })
})

describe('FID-2026-0912-001: trust appends a ledger entry', () => {
  test('trusting a created draft appends action trust with the full shape', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'ledgered',
      description: 'To be trusted with a ledger trail',
      body: BODY,
      sessionId: 's1',
      reason: 'create for ledger pin',
    })
    const result = trustSkill(root, 'ledgered')
    expect(result.ok).toBe(true)

    const entries = readLedgerEntries(root, 'ledgered')
    const trustEntry = entries.find((entry) => entry.action === 'trust')
    expect(trustEntry).toBeDefined()
    if (!trustEntry) return
    // Full SkillLedgerEntry shape (the rollbackLiveSkill pattern).
    expect(typeof trustEntry.seq).toBe('number')
    expect(typeof trustEntry.version).toBe('string')
    expect(typeof trustEntry.ts).toBe('string')
    expect(typeof trustEntry.sessionId).toBe('string')
    expect(typeof trustEntry.reason).toBe('string')
    expect(trustEntry.prevSha).toBeNull() // no prior live bytes
    expect(typeof trustEntry.nextSha).toBe('string')
    expect(typeof trustEntry.provenanceRef).toBe('string')
    expect(trustEntry.semanticPreservation).toBe(true)
  })

  test('trusting a patch draft records prevSha of the prior live bytes', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'patched', 'Has a live baseline', BODY)
    const patch = patchSkill({
      rootDir: root,
      name: 'patched',
      oldString: 'Do the thing.',
      newString: 'Do the thing carefully.',
      sessionId: 's2',
      reason: 'small patch',
    })
    expect(patch.ok).toBe(true)
    const result = trustSkill(root, 'patched')
    expect(result.ok).toBe(true)

    const entries = readLedgerEntries(root, 'patched')
    const trustEntry = entries.find((entry) => entry.action === 'trust')
    expect(trustEntry).toBeDefined()
    if (!trustEntry) return
    expect(trustEntry.prevSha).not.toBeNull()
    expect(trustEntry.prevSha).not.toBe(trustEntry.nextSha)
  })

  test('untrust appends action untrust', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'untrasted', 'Will be untrusted', BODY)
    const down = untrustSkill(root, 'untrasted')
    expect(down.ok).toBe(true)

    const entries = readLedgerEntries(root, 'untrasted')
    expect(entries.some((entry) => entry.action === 'untrust')).toBe(true)
  })

  test('result carries action trust/untrust (not the edit fallback)', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'actions', 'Action pin', BODY)
    const down = untrustSkill(root, 'actions')
    expect(down.ok).toBe(true)
    if (down.ok) expect(down.action).toBe('untrust')
    const up = trustSkill(root, 'actions')
    expect(up.ok).toBe(true)
    if (up.ok) expect(up.action).toBe('trust')
  })
})

describe('FID-2026-0912-001: baselineSha capture', () => {
  test('patch drafts record metadata.baselineSha of the live bytes', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'pinned', 'Pinned baseline', BODY)
    const liveBefore = fs.readFileSync(
      path.join(skillCanonicalDir(root, 'pinned'), 'SKILL.md'),
      'utf8',
    )
    const patch = patchSkill({
      rootDir: root,
      name: 'pinned',
      oldString: 'Do the thing.',
      newString: 'Do the thing slowly.',
      sessionId: 's3',
      reason: 'baseline pin',
    })
    expect(patch.ok).toBe(true)

    const draft = fs.readFileSync(
      path.join(skillQuarantineDir(root, 'pinned'), 'SKILL.md'),
      'utf8',
    )
    expect(draft).toContain('baselineSha:')
    // The recorded baseline is the house hash format (`sha256:<hex>`,
    // hashChange) of the live bytes at draft time — NOT the raw content.
    // (YAML quoting style is gray-matter's choice — the pin targets the
    // value.)
    const recorded = draft.match(
      /baselineSha:\s*['"]?(sha256:[0-9a-f]{64})['"]?/,
    )?.[1]
    expect(recorded).toBeDefined()
    expect(recorded).not.toBe(liveBefore)
  })

  test('edit drafts record metadata.baselineSha of the live bytes', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'editpinned', 'Edit baseline', BODY)
    const edit = editSkill({
      rootDir: root,
      name: 'editpinned',
      description: 'Edit baseline (updated)',
      body: BODY + '\nExtra section.\n',
      sessionId: 's4',
      reason: 'edit with pin',
    })
    expect(edit.ok).toBe(true)
    const draft = fs.readFileSync(
      path.join(skillQuarantineDir(root, 'editpinned'), 'SKILL.md'),
      'utf8',
    )
    expect(draft).toContain('baselineSha:')
  })
})

describe('FID-2026-0912-001: drift gate at trust', () => {
  test('trusting an UNDRIFTED patch draft succeeds', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'steady', 'Steady baseline', BODY)
    const patch = patchSkill({
      rootDir: root,
      name: 'steady',
      oldString: 'Do the thing.',
      newString: 'Do the thing well.',
      sessionId: 's5',
      reason: 'undrifted pin',
    })
    expect(patch.ok).toBe(true)
    const result = trustSkill(root, 'steady')
    expect(result.ok).toBe(true)
  })

  test('trusting a DRIFTED patch draft fails closed with drift error', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'drifted', 'Will drift', BODY)
    const patch = patchSkill({
      rootDir: root,
      name: 'drifted',
      oldString: 'Do the thing.',
      newString: 'Do the thing differently.',
      sessionId: 's6',
      reason: 'drift pin',
    })
    expect(patch.ok).toBe(true)

    // Operator edits the LIVE skill after the draft was authored.
    const liveFile = path.join(skillCanonicalDir(root, 'drifted'), 'SKILL.md')
    fs.writeFileSync(
      liveFile,
      fs
        .readFileSync(liveFile, 'utf8')
        .replace('Run the suite.', 'Run the FULL suite.'),
      'utf8',
    )

    const result = trustSkill(root, 'drifted')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Drift detected')
      expect(result.error).toContain('re-draft')
    }
    // The draft is NOT destroyed by a refused trust.
    expect(
      fs.existsSync(path.join(skillQuarantineDir(root, 'drifted'), 'SKILL.md')),
    ).toBe(true)
    // The live file was NOT overwritten.
    expect(fs.readFileSync(liveFile, 'utf8')).toContain('Run the FULL suite.')
  })

  test('created drafts (no live baseline) trust without drift refusal', () => {
    const root = fixtureRoot()
    createSkill({
      rootDir: root,
      name: 'fresh',
      description: 'No live baseline exists',
      body: BODY,
      sessionId: 's7',
      reason: 'create pin',
    })
    const result = trustSkill(root, 'fresh')
    expect(result.ok).toBe(true)
  })

  test('legacy drafts without a baseline pin trust with a warning', () => {
    const root = fixtureRoot()
    writeLiveSkill(root, 'legacy', 'Legacy draft target', BODY)
    // Hand-author a quarantine draft WITHOUT metadata.baselineSha —
    // the pre-FID shape.
    const draftDir = skillQuarantineDir(root, 'legacy')
    fs.mkdirSync(draftDir, { recursive: true })
    fs.writeFileSync(
      path.join(draftDir, 'SKILL.md'),
      `---\nname: legacy\nversion: 1.1.0\ndescription: Legacy draft target\n---\n\n${BODY}`,
      'utf8',
    )
    const result = trustSkill(root, 'legacy')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message).toBeDefined()
      expect(result.message).toContain('baseline')
    }
  })
})
