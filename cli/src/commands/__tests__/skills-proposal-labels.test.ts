import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { createSkill } from '@savant-code/common/util/skill-management'
import {
  proposalsForSession,
  recordProposal,
} from '@savant-code/common/util/skill-proposals'
import { appendRejectedProposal } from '@savant-code/common/util/skill-wiki'
import { afterEach, describe, expect, test } from 'bun:test'

import { discoverSkills, formatTable } from '../skills-discovery'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proposal-labels-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const BODY = `# Test Skill\n\n## When to Use\nx\n\n## Procedure\n1. y\n\n## Pitfalls\n- z\n\n## Verification\nrun\n`

function writeProof(root: string, name: string, eligible: boolean): void {
  const dir = path.join(root, '.savant', 'skill-proofs')
  fs.mkdirSync(dir, { recursive: true })
  // A truly eligible receipt needs the full conjunction: 3+ active trials
  // (all passing), a 3/3 baseline, activation, and pass^k above threshold.
  // The ineligible shape leaves the trial arms empty.
  const trial = (index: number, passed: boolean) => ({
    index,
    passed,
    trace_sha256: String(index).repeat(64),
  })
  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify({
      schema_version: '1.0',
      skill_name: name,
      task_id: 't',
      generated_at: '2026-09-12T00:00:00.000Z',
      k: 1,
      trials: eligible
        ? {
            baseline: [0, 1, 2].map((i) => trial(i, false)),
            active: [3, 4, 5].map((i) => trial(i, true)),
          }
        : { baseline: [], active: [] },
      metrics: {
        baseline_pass_rate: 0,
        active_pass_rate: eligible ? 1 : 0,
        skill_lift: eligible ? 1 : 0,
        pass_at_k: eligible ? 1 : 0,
        pass_pow_k: eligible ? 1 : 0,
      },
      activation_verified: eligible,
      gate: {
        immutable_threshold: 0.95,
        min_trials: 3,
        reliability_met: eligible,
        eligible_for_immutable: eligible,
      },
      ztap: { mode: 'off', bound: false },
    }),
    'utf8',
  )
}

describe('FID-2026-0912-004: quarantine labels in /skills list --quarantined', () => {
  test('a draft with an eligible receipt renders [✓ PROVEN]', () => {
    const root = fixtureRoot()
    const created = createSkill({
      rootDir: root,
      name: 'proven-draft',
      description: 'd',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(created.ok).toBe(true)
    writeProof(root, 'proven-draft', true)
    const rows = discoverSkills(root).filter((r) => r.quarantined)
    const table = formatTable(rows)
    expect(table).toContain('proven-draft')
    expect(table).toContain('[✓ PROVEN]')
  })

  test('a draft with no receipt renders [⚠ UNPROVEN — TRUSTING BLIND]', () => {
    const root = fixtureRoot()
    const created = createSkill({
      rootDir: root,
      name: 'blind-draft',
      description: 'd',
      body: BODY,
      sessionId: 's',
      reason: 'r',
    })
    expect(created.ok).toBe(true)
    const rows = discoverSkills(root).filter((r) => r.quarantined)
    const table = formatTable(rows)
    expect(table).toContain('blind-draft')
    expect(table).toContain('[⚠ UNPROVEN — TRUSTING BLIND]')
  })

  test('rejected proposals land in the owning wiki page evidence section', () => {
    const root = fixtureRoot()
    appendRejectedProposal(root, {
      patternKey: 'a'.repeat(64),
      toolName: 'run_terminal_command',
      skillName: 'rejected-proposal',
      proposalSha: 'sha256:' + 'f'.repeat(64),
      reason: 'gate rejection: per-task regression',
      rejectedAt: '2026-09-12T00:00:00.000Z',
    })
    const page = fs.readFileSync(
      path.join(
        root,
        'dev',
        'wiki',
        'patterns',
        `run-terminal-command-${'a'.repeat(12)}.md`,
      ),
      'utf8',
    )
    expect(page).toContain('## Rejected Proposals')
    expect(page).toContain('rejected-proposal')
    expect(page).toContain('per-task regression')
    // Idempotent: the same rejection does not duplicate.
    appendRejectedProposal(root, {
      patternKey: 'a'.repeat(64),
      toolName: 'run_terminal_command',
      skillName: 'rejected-proposal',
      proposalSha: 'sha256:' + 'f'.repeat(64),
      reason: 'gate rejection: per-task regression',
      rejectedAt: '2026-09-13T00:00:00.000Z',
    })
    const after = fs.readFileSync(
      path.join(
        root,
        'dev',
        'wiki',
        'patterns',
        `run-terminal-command-${'a'.repeat(12)}.md`,
      ),
      'utf8',
    )
    expect(after.match(/rejected-proposal/g) ?? []).toHaveLength(1)
  })

  test('proposal store is the one-proposal-per-session enforcement point', () => {
    const root = fixtureRoot()
    const p = {
      proposalSha: 'sha256:' + 'd'.repeat(64),
      skillName: 's',
      action: 'create' as const,
      patternKey: 'e'.repeat(64),
      createdAt: '2026-09-12T00:00:00.000Z',
      sessionId: 'session-9',
      rationale: 'r',
    }
    recordProposal(root, p)
    expect(proposalsForSession(root, 'session-9')).toHaveLength(1)
  })
})
