import { describe, expect, it } from 'bun:test'

import { validateFidPhaseEvidence } from '../fid-validator'

const base =
  '# FID\n\n**Status:** analyzed\n\n## Perfection Loop\n\n' +
  '### RED\n\n- found `cli/src/a.ts:12` — grep evidence\n\n' +
  '### GREEN\n\n- fixed it\n\n' +
  '### Missed Questions\n\n1. q1\n   Decision: yes\n2. q2\n   Decision: no\n\n' +
  '### Code Verification Evidence\n\n- typecheck PASS, exit 0\n\n' +
  '### AUDIT\n\nVerifier verdict: PASS\n\n## Resolution\n'

describe('validateFidPhaseEvidence', () => {
  it('passes RED when file:line evidence is present', () => {
    expect(validateFidPhaseEvidence(base, 'red')).toEqual([])
  })

  it('fails RED without file:line evidence', () => {
    const content = base.replace('`cli/src/a.ts:12`', 'looks broken')
    const errors = validateFidPhaseEvidence(content, 'red')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('passes GREEN when every Missed Question has a Decision', () => {
    expect(validateFidPhaseEvidence(base, 'green')).toEqual([])
  })

  it('fails GREEN when a Missed Question is unanswered', () => {
    const content = base.replace('   Decision: no', '   (unresolved)')
    const errors = validateFidPhaseEvidence(content, 'green')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('passes AUDIT with gate output + Verifier verdict', () => {
    expect(validateFidPhaseEvidence(base, 'audit')).toEqual([])
  })

  it('fails AUDIT without a Verifier verdict', () => {
    const errors = validateFidPhaseEvidence(
      base.replace('Verifier verdict: PASS', ''),
      'audit',
    )
    expect(errors.some((e) => e.includes('Verifier'))).toBe(true)
  })

  it('passes ADVERSARIAL when a verdict block is present', () => {
    const content = base + 'Adversary verdict: PASS\n'
    expect(validateFidPhaseEvidence(content, 'adversarial')).toEqual([])
  })

  it('fails COMPLETE unless status is closed', () => {
    expect(validateFidPhaseEvidence(base, 'complete').length).toBeGreaterThan(0)
    const closed = base.replace('**Status:** analyzed', '**Status:** closed')
    expect(validateFidPhaseEvidence(closed, 'complete')).toEqual([])
  })
})
