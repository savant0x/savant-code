// ECHO compliance tracker — docs classification (FID-2026-0814-004 H-03):
// doc-only writes never trigger the code nags. Sibling of the Loop-344
// decomposition (parent: echo-compliance.test.ts).
import { describe, expect, it } from 'bun:test'

import { EchoComplianceTracker } from '../echo-compliance'

describe('EchoComplianceTracker — docs classification (FID-2026-0814-004 H-03)', () => {
  it('doc-only writes do not trigger Law 3 or Verifier criteria nags', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/scratchpad/report.md',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    // No Law 3 code nag, no verifier_criteria nag for a pure doc write.
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
    expect(violations.some((v) => v.law === 'fid')).toBe(false)
    const law3 = violations.filter((v) => v.law === 'law3')
    // The docs-appropriate info reminder may fire, but never the code nag.
    for (const v of law3) {
      expect(v.message).toContain('markdownlint')
      expect(v.severity).toBe('info')
    }
  })

  it('code writes still trigger Law 3 + Verifier criteria exactly as before', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'law3')).toBe(true)
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(true)
  })

  it('running markdownlint clears a doc-only turn without a code nag', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/scratchpad/report.md',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun run lint:md')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.filter((v) => v.law === 'law3')).toHaveLength(0)
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
  })
})
