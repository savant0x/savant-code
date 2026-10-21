import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildDraftingPrompt,
  loadProposalRecord,
  prepareCandidateHandoff,
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

describe('proposal counted unit (FID-2026-1021-001)', () => {
  test('the drafting prompt names the class the count belongs to', () => {
    const root = fixtureRoot()
    const result = prepareCandidateHandoff(root, {
      skillName: 'exit-code-guard',
      lessonTitle: 'Read the exit code before retrying',
      canonicalRule: 'check-exit-code',
      toolName: 'run_command',
      errorFirstLine: 'head: command not found',
      cause: 'command-exit',
      invariant: 'The exit code carries the outcome.',
      guard: 'Never retry on a non-zero exit without reading stderr.',
      count: 48,
      distinctSessions: 6,
    })
    expect(result.ok).toBe(true)
    const handoff = result.handoff!
    // The count spans the classes the rule covers, so it is stated with its
    // span and its top class — never as the trigger message's own tally.
    expect(handoff.prompt).toContain(
      '48× across the classes this rule covers (top class: command-exit)',
    )
    expect(handoff.prompt).toContain(
      '48× across the classes this rule covers (top class: command-exit); ' +
        'e.g. head: command not found',
    )
    expect(handoff.record.rationale).toContain(
      'recurrence 48× across the classes this rule covers (top class: command-exit)',
    )
  })
})
