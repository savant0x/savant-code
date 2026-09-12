import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildDraftingPrompt,
  loadProposalRecord,
  readProposalStore,
  recordProposal,
} from '../skill-proposals'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-proposals-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const PROPOSAL = {
  proposalSha: 'sha256:' + 'a'.repeat(64),
  skillName: 'my-skill',
  action: 'create' as const,
  patternKey: 'k'.repeat(64),
  createdAt: '2026-09-12T10:00:00.000Z',
  sessionId: 'session-1',
  rationale: 'wiki pattern recurred 3x; no skill covers it',
}

describe('FID-2026-0912-004: proposal record', () => {
  test('recordProposal writes a monotonic JSON store under .savant/skill-proposals', () => {
    const root = fixtureRoot()
    const first = recordProposal(root, PROPOSAL)
    expect(first.ok).toBe(true)
    const second = recordProposal(root, {
      ...PROPOSAL,
      proposalSha: 'sha256:' + 'b'.repeat(64),
    })
    expect(second.ok).toBe(true)
    const store = readProposalStore(root)
    expect(store).toHaveLength(2)
    expect(store[0]?.proposalSha).toBe(PROPOSAL.proposalSha)
  })

  test('loadProposalRecord round-trips by sha; unknown sha is null', () => {
    const root = fixtureRoot()
    recordProposal(root, PROPOSAL)
    expect(loadProposalRecord(root, PROPOSAL.proposalSha)?.skillName).toBe(
      'my-skill',
    )
    expect(loadProposalRecord(root, 'sha256:' + 'c'.repeat(64))).toBeNull()
  })

  test('buildDraftingPrompt is isolated: wiki + traces + inventory, zero parent markers', () => {
    const prompt = buildDraftingPrompt({
      wikiIndex: '# Pattern Wiki\n…',
      patternPages: ['## Evidence\n- 2026-09-12 — recurrences 3 (total 3)'],
      dedupedTraces: ['run_terminal_command · Type is not assignable'],
      skillInventory: ['release-workflow v1.2'],
    })
    expect(prompt).toContain('# Pattern Wiki')
    expect(prompt).toContain('recurrences 3')
    expect(prompt).toContain('run_terminal_command · Type is not assignable')
    expect(prompt).toContain('release-workflow v1.2')
    // Atomic-proposal contract is baked into the prompt (case-insensitive —
    // the contract is the semantic, not the casing).
    expect(prompt.toLowerCase()).toContain('at most one')
    // Isolation contract: no parent-conversation markers.
    expect(prompt.toLowerCase()).not.toContain('user said')
    expect(prompt.toLowerCase()).not.toContain('conversation history')
  })
})
