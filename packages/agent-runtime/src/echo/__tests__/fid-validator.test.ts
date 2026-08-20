/**
 * validateFidStepStatus — Anti-Deferral Gate (FID-2026-0817-005).
 *
 * Locks the Step Status section contract: only the operator may mark a
 * step deferred/skipped (via `operator-approved <YYYY-MM-DD>`); every other
 * unimplemented step is blocked by construction and must be presented
 * before the FID transitions to converged/closed.
 */
import { describe, expect, it } from 'bun:test'

import { validateFidStepStatus } from '../fid-validator'

function fidWithSteps(steps: string[], status = 'analyzed'): string {
  return `# FID: test

**Status:** ${status}

## Step Status
${steps.map((step) => `- ${step}`).join('\n')}
`
}

const IMPLEMENTED = '[x] 1. Migrate spinner to useTimeline — implemented'
const BLOCKED =
  '[ ] 2. Add scissor-hidden suspension — blocked::renderer API unverified'
const DEFERRED_APPROVED =
  '[ ] 3. Wire typewriter — deferred::operator-approved 2026-08-16'
const SKIPPED_APPROVED =
  '[ ] 4. Remove legacy spinner — skipped::operator-approved 2026-08-16'
const DEFERRED_NO_DATE = '[ ] 5. Wire typewriter — deferred::operator-approved'
const DEFERRED_NO_MARKER = '[ ] 6. Wire typewriter — deferred::'
const ORPHAN_MARKER =
  '[x] 7. Already done — implemented::operator-approved 2026-08-16'

describe('validateFidStepStatus', () => {
  it('returns [] when the FID has no Step Status section (legacy no-op)', () => {
    expect(
      validateFidStepStatus('# FID: test\n\n**Status:** analyzed\n'),
    ).toEqual([])
  })

  it('allows close when every step is implemented', () => {
    const errors = validateFidStepStatus(fidWithSteps([IMPLEMENTED], 'closed'))
    expect(errors).toEqual([])
  })

  it('BLOCKS close with unresolved non-approved steps and lists them', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([IMPLEMENTED, BLOCKED], 'closed'),
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('scissor-hidden suspension')
    expect(errors[0]).toContain('operator')
  })

  it('allows close with an operator-approved deferral', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([IMPLEMENTED, DEFERRED_APPROVED], 'closed'),
    )
    expect(errors).toEqual([])
  })

  it('allows close with an operator-approved skip', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([IMPLEMENTED, SKIPPED_APPROVED], 'closed'),
    )
    expect(errors).toEqual([])
  })

  it('BLOCKS a deferred step whose approval date is missing', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([DEFERRED_NO_DATE], 'closed'),
    )
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]).toContain('operator-approved')
  })

  it('BLOCKS a deferred step with no marker at all', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([DEFERRED_NO_MARKER], 'closed'),
    )
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]).toContain('operator-approved')
  })

  it('reports a converged status the same as closed', () => {
    const errors = validateFidStepStatus(fidWithSteps([BLOCKED], 'converged'))
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('converged')
  })

  it('does NOT gate an analyzed FID with a blocked step (no transition)', () => {
    const errors = validateFidStepStatus(fidWithSteps([BLOCKED], 'analyzed'))
    expect(errors).toEqual([])
  })

  it('reports an orphan operator-approved marker on an implemented step as advisory', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([ORPHAN_MARKER], 'closed'),
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatch(/^advisory:/)
  })

  it('reports both a missing approval marker and the unresolved transition for one step', () => {
    const errors = validateFidStepStatus(
      fidWithSteps([DEFERRED_NO_MARKER], 'closed'),
    )
    expect(errors.length).toBe(2)
  })
})
