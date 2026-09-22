/**
 * FID-2026-0919-021 pins — the WIDENED verification-contract sweep.
 *
 * FID-2026-0918-006 shipped a deliberately narrow promise detector:
 * `/\bnew\s+(?:runtime\s+)?test\b/i`, scoped to the `### Verification`
 * section only. Auditing FID-2026-0918-007 against its own contract showed
 * BOTH limits let a real gap through:
 *
 *   - wording: the record says "New/updated `<path>`", which the narrow
 *     pattern never matches, so the sweep reported 0 errors / 0 warnings;
 *   - section: the two uncovered suites are named in the Steps and
 *     `### Implementation Evidence` sections, not in `### Verification`.
 *
 * The widened rule keeps the contract's NARROW intent (only lines that
 * promise an artifact) while closing both holes: a promise is any line that
 * names a REPO-RELATIVE `*.test.ts(x)` path AND carries a novelty marker
 * (`new`, `added`) on that same line — in either order, in any section.
 * A bare filename carries no repo-relative commitment and is ignored.
 */
import { describe, expect, it } from 'bun:test'

import { collectContractViolations } from '@savant-code/agent-runtime/echo/fid-verification-contract-sweep'
import { computeFidFingerprint } from '@savant-code/agent-runtime/echo/fid-verification-gates'

const COVERED = 'scripts/__tests__/contract-sweep-fixture.test.ts'
const UNCOVERED = 'sdk/src/__tests__/ripgrep-path-fallback.test.ts'

/** FID-shaped fixture with free-form sections between the required headings. */
function fid(opts: {
  status: string
  gates: string[]
  sections?: { heading: string; body: string }[]
  withReceipt?: boolean
}): string {
  const withReceipt = opts.withReceipt ?? true
  const base = [
    '# FID: widened sweep fixture',
    '',
    `**Status:** ${opts.status}`,
    '',
    ...(opts.sections ?? []).flatMap((section) => [
      `## ${section.heading}`,
      '',
      section.body,
      '',
    ]),
    '## Verification Gates',
    '',
    ...opts.gates.map((gate) => `- gate: ${gate}`),
  ].join('\n')

  if (!withReceipt) return base + '\n'

  // Mirror the stamp layout: fingerprint over the receipt-less document.
  const fingerprint = computeFidFingerprint(base + '\n')
  return [
    base,
    '',
    '### Verification Receipt',
    '',
    `- fingerprint: sha256:${fingerprint}`,
    '- verified: 2026-09-19T00:00:00.000Z',
    ...opts.gates.map((gate) =>
      gate === 'quality' ? '- quality: exit 0' : `- ${gate}: exit 0`,
    ),
  ].join('\n')
}

describe('widened promise wording', () => {
  it('flags "New/updated `<path>`" — the FID-2026-0918-007 wording', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Proposed Solution',
          body: `### Verification\n\n- New/updated \`${UNCOVERED}\` suites green (pasted output).`,
        },
      ],
    })
    const { errors, warnings } = collectContractViolations(doc, [])
    expect(warnings).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(UNCOVERED)
    expect(errors[0]).toContain('not covered by a declared')
  })

  it('flags "New runtime test: `<path>`" (the original narrow shape, preserved)', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Proposed Solution',
          body: `### Verification\n\n- New runtime test: \`${UNCOVERED}\` proves it.`,
        },
      ],
    })
    expect(collectContractViolations(doc, []).errors).toHaveLength(1)
  })
})

describe('widened section scope — the actual FID-2026-0918-007 gap', () => {
  it('flags an uncovered suite named in Implementation Evidence', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Perfection Loop',
          body: `### Implementation Evidence (REQUIRED for closed)\n\n- [x] **File:line ranges:** \`${UNCOVERED}\` (new), \`sdk/scripts/ensure-ripgrep-vendor.ts\` (new; part 3)`,
        },
      ],
    })
    const { errors } = collectContractViolations(doc, [])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(UNCOVERED)
  })

  it('flags a suite named under a Resolution "Tests Added" bullet', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Resolution',
          body: `- **Tests Added:** \`${UNCOVERED}\` (new);\n  \`ripgrep.test.ts\` exhaustion suite made deterministic`,
        },
      ],
    })
    const { errors } = collectContractViolations(doc, [])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(UNCOVERED)
  })
})

describe('no false positives from the widening', () => {
  it('ignores a bare filename on a novelty line (no repo-relative commitment)', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Resolution',
          body: '- **Tests Added:** `ripgrep.test.ts` exhaustion suite, new pins inside',
        },
      ],
    })
    expect(collectContractViolations(doc, [])).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('ignores gate declarations and receipt result lines', () => {
    const doc = fid({
      status: 'fixed',
      gates: [`test ${COVERED}`, 'quality'],
      sections: [
        {
          heading: 'Proposed Solution',
          body: '### Verification\n\n- Existing suites re-run green; `sdk/src/native/ripgrep.ts` touched only.',
        },
      ],
    })
    expect(collectContractViolations(doc, [COVERED])).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('a covered promise stays clean in every section', () => {
    const doc = fid({
      status: 'verified',
      gates: [`test ${COVERED}`, 'quality'],
      sections: [
        {
          heading: 'Feedback',
          body: `- New/updated \`${COVERED}\` suites green.`,
        },
        {
          heading: 'Resolution',
          body: `- **Tests Added:** \`${COVERED}\``,
        },
      ],
    })
    expect(collectContractViolations(doc, [COVERED])).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('ignores a pathless "new test suites" mention in narrative prose', () => {
    // Loop 2 audit finding: whole-document scanning made the pathless
    // branch fire on a descriptive Summary sentence — narration, not a
    // commitment to produce a file.
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Summary',
          body: 'The sweep reported 0 errors over a document whose two new test suites were covered by no declared gate.',
        },
      ],
    })
    expect(collectContractViolations(doc, [])).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('still reports a pathless promise inside ### Verification (original guard)', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Proposed Solution',
          body: '### Verification\n\n- New runtime test: proves the sweep end to end.',
        },
      ],
    })
    const { errors } = collectContractViolations(doc, [])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('names no path')
  })

  it('fenced examples remain documentation, never violations', () => {
    const doc = fid({
      status: 'fixed',
      gates: ['quality'],
      sections: [
        {
          heading: 'Proposed Solution',
          body: `### Verification\n\n\`\`\`markdown\n- New/updated \`${UNCOVERED}\` suites green.\n\`\`\``,
        },
      ],
    })
    expect(collectContractViolations(doc, [])).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('the grandfathered (receipt-less) tier still warns instead of failing', () => {
    const doc = fid({
      status: 'analyzed',
      gates: ['quality'],
      withReceipt: false,
      sections: [
        {
          heading: 'Resolution',
          body: `- **Tests Added:** \`${UNCOVERED}\``,
        },
      ],
    })
    const { errors, warnings } = collectContractViolations(doc, [])
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(UNCOVERED)
  })
})

// The live `--check` enforcement-tier pin lives in
// fid-check-enforcement-tier.test.ts (FID-2026-0913-002 ceiling split — this
// file reached 304 lines; both halves are declared gates in FID-2026-0919-021).
