/**
 * validateFidStepStatus — Anti-Deferral Gate (FID-2026-0817-005).
 *
 * Locks the Step Status section contract: only the operator may mark a
 * step deferred/skipped (via `operator-approved <YYYY-MM-DD>`); every other
 * unimplemented step is blocked by construction and must be presented
 * before the FID transitions to converged/closed.
 *
 * FID-2026-1001-003 step 7 extends the gate with the heading-choice
 * anti-evasion guard (whole-document numbered-step scan unless the document
 * asserts `implementation_started: false`).
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

describe('validateFidStepStatus — heading-choice anti-evasion (FID-2026-1001-003 step 7)', () => {
  const CONVERGED = (body: string): string =>
    `# FID: evader\n\n**Status:** converged\n\n${body}`

  it('REJECTS a converged FID whose unchecked numbered steps sit under a non-Step-Status heading without the assertion', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Work Items\n\n- [ ] **Step 1** — close the terminal bypass\n- [ ] **Step 2** — Law 15 reconciliation\n`,
      ),
    )
    expect(errors.length).toBe(2)
    expect(errors[0]).toContain('outside ## Step Status')
    expect(errors[0]).toContain('implementation_started: false')
  })

  it('REJECTS the plan-boxes-outside-section shape (Step Status present, steps parked in an Implementation Plan)', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Step Status\n\n- [x] RED — done\n- [x] GREEN — done\n\n## Implementation Plan\n\n- [ ] **Step 6** — scope Law 4's wiring detector\n- [ ] **Step 7** — stop validateFidStepStatus being defeatable\n`,
      ),
    )
    expect(errors.length).toBe(2)
    expect(errors.every((e) => e.includes('outside ## Step Status'))).toBe(true)
  })

  it('allows the same shape when the document asserts implementation_started: false', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `implementation_started: false\n\n## Implementation Plan\n\n- [ ] **Step 6** — scope Law 4's wiring detector\n- [ ] **Step 7** — stop validateFidStepStatus being defeatable\n`,
      ),
    )
    expect(errors).toEqual([])
  })

  it('a prose MENTION of implementation_started: false is NOT an assertion (anti-laundering)', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `The gate must verify an explicit \`implementation_started: false\` assertion.\n\n## Implementation Plan\n\n- [ ] **Step 1** — some unimplemented step\n`,
      ),
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('outside ## Step Status')
  })

  it('a declaration inside a FENCE is quotation, not an assertion', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        '```md\nimplementation_started: false\n```\n\n## Implementation Plan\n\n- [ ] **Step 1** — some unimplemented step\n',
      ),
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('outside ## Step Status')
  })

  it('a spec quoting the step grammar inside a fence is not a plan claim (FID-0817-005 shape)', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        '```\n- [ ] 2. Add scissor-hidden suspension — blocked::renderer API unverified\n```\n',
      ),
    )
    expect(errors).toEqual([])
  })

  it('allows operator-approved steps parked outside the section', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Work Items\n\n- [ ] 1. Wire typewriter — deferred::operator-approved 2026-10-02\n`,
      ),
    )
    expect(errors).toEqual([])
  })

  it('ignores prose (non-numbered) checkboxes like Risk-Level boxes outside the section', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Impact Assessment\n\n### Risk Level\n\n- [ ] Critical / [x] High: trust fails together\n- [ ] Medium / [ ] Low\n`,
      ),
    )
    expect(errors).toEqual([])
  })

  it('does not bind non-closure statuses (analyzed) for outside-section steps', () => {
    const errors = validateFidStepStatus(
      `# FID: draft\n\n**Status:** analyzed\n\n## Work Items\n\n- [ ] **Step 1** — close the terminal bypass\n`,
    )
    expect(errors).toEqual([])
  })

  it('ignores checked numbered steps outside the section', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Work Items\n\n- [x] **Step 1** — close the terminal bypass\n`,
      ),
    )
    expect(errors).toEqual([])
  })

  it('reports each unique outside-section step once (no duplicates)', () => {
    const errors = validateFidStepStatus(
      CONVERGED(
        `## Work Items\n\n- [ ] **Step 1** — close the terminal bypass\n- [ ] **Step 1** — close the terminal bypass\n`,
      ),
    )
    expect(errors.length).toBe(1)
  })
})
