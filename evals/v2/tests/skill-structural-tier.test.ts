/**
 * FID-2026-1005-005 — Tier 1, the structural tier (declared gate).
 *
 * Pins the structural baseline the trigger tier assumes: the existing
 * checker reports no errors on the project-scoped skills, every trusted
 * skill carries a trigger case file (the coverage rule — a trusted skill
 * without cases is a CI error), the rank-1 floor is bootstrapped, and the
 * rejected-changes ledger exists in the tracked tree. Quarantined drafts
 * are advisory here by design (loader-invisible).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  checkSkillsRoot,
  getDefaultSkillsRoots,
} from '../../../scripts/skills-check'
import { runTriggerEvals } from '../src/skill-evals/run'

const ROOT = path.resolve(import.meta.dir, '..', '..', '..')
const PROJECT_ROOTS = getDefaultSkillsRoots(ROOT).filter((root) =>
  root.startsWith(ROOT),
)

describe('Tier 1 — structural (FID-2026-1005-005)', () => {
  it('the structural checker reports no errors on project skills', () => {
    for (const root of PROJECT_ROOTS) {
      const findings = checkSkillsRoot(root).flatMap((result) =>
        result.findings.filter((finding) => finding.severity === 'error'),
      )
      expect(findings).toEqual([])
    }
  })

  it('every trusted project skill carries a trigger case file', () => {
    const casesDir = path.join(ROOT, 'evals', 'v2', 'skill-cases')
    for (const root of PROJECT_ROOTS) {
      if (!existsSync(root)) continue
      for (const entry of readdirSync(root)) {
        if (entry.startsWith('.')) continue
        const dir = path.join(root, entry)
        if (!existsSync(path.join(dir, 'SKILL.md'))) continue
        expect(existsSync(path.join(casesDir, `${entry}.json`))).toBe(true)
      }
    }
  })

  it('the rank-1 floor is bootstrapped and well-formed', () => {
    const floorFile = path.join(
      ROOT,
      'evals',
      'v2',
      'skill-cases',
      'floor.json',
    )
    expect(existsSync(floorFile)).toBe(true)
    const floor = JSON.parse(readFileSync(floorFile, 'utf8')) as {
      rank1Floor: number
      measuredAt: string
    }
    expect(floor.rank1Floor).toBeGreaterThan(0)
    expect(floor.rank1Floor).toBeLessThanOrEqual(1)
    expect(floor.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('the rejected-changes ledger exists in the tracked tree', () => {
    expect(existsSync(path.join(ROOT, 'evals', 'skill-impact.md'))).toBe(true)
  })

  it('the trigger eval runs clean on the live catalog (no error issues)', () => {
    const result = runTriggerEvals(ROOT)
    const errors = result.issues.filter((issue) => issue.severity === 'error')
    expect(errors).toEqual([])
  })
})
