/**
 * Branch summarization — FID-2026-1006-002 WP6 (T149 idea 6).
 *
 * Pins the two halves of the format contract: the skeleton is FIXED (five
 * sections in order, three Progress sub-lists, empty sections marked rather
 * than dropped) and the content is VERBATIM (a path, symbol or error string a
 * consumer has to act on is never rewritten on the way through).
 */

import { describe, expect, it } from 'bun:test'

import {
  BRANCH_SUMMARY_NONE_RECORDED,
  BRANCH_SUMMARY_SECTIONS,
  formatBranchSummary,
  resolveCustomInstructions,
} from '../context-compactor/branch-summarization'
import {
  BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS,
  BRANCH_SUMMARY_FIDELITY_INSTRUCTIONS,
  buildBranchSummaryPrompt,
} from '../context-compactor/branch-summary-prompt'

import type { BranchSummaryInput } from '../context-compactor/branch-summarization'

const POPULATED: BranchSummaryInput = {
  goal: 'Make durable writes assertable and race-free',
  constraints: ['No new dependencies', 'Windows + POSIX paths both work'],
  done: ['commit-journal.ts is the single write seam'],
  inProgress: ['mutation-line.ts seal recovery'],
  blocked: ['T147 keyed probe — operator-side'],
  keyDecisions: ['One ordered pending list for text and reasoning'],
  nextSteps: ['Run the WP9 project-trust suite'],
}

describe('formatBranchSummary — fixed skeleton', () => {
  it('renders every section, in order, once', () => {
    const text = formatBranchSummary(POPULATED)

    const positions = BRANCH_SUMMARY_SECTIONS.map((section) =>
      text.indexOf(`## ${section}`),
    )
    expect(positions.every((index) => index >= 0)).toBe(true)
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
    for (const section of BRANCH_SUMMARY_SECTIONS) {
      expect(text.split(`## ${section}`)).toHaveLength(2)
    }
  })

  it('renders the three Progress sub-lists in order', () => {
    const text = formatBranchSummary(POPULATED)

    const done = text.indexOf('### Done')
    const inProgress = text.indexOf('### In Progress')
    const blocked = text.indexOf('### Blocked')
    expect(done).toBeGreaterThan(-1)
    expect(inProgress).toBeGreaterThan(done)
    expect(blocked).toBeGreaterThan(inProgress)
  })

  it('places every populated item in its own section', () => {
    const text = formatBranchSummary(POPULATED)

    for (const item of [
      ...(POPULATED.constraints ?? []),
      ...(POPULATED.done ?? []),
      ...(POPULATED.inProgress ?? []),
      ...(POPULATED.blocked ?? []),
      ...(POPULATED.keyDecisions ?? []),
      ...(POPULATED.nextSteps ?? []),
    ]) {
      expect(text).toContain(`- ${item}`)
    }
  })

  it('an empty input still renders all five headings, marked not dropped', () => {
    const text = formatBranchSummary({})

    for (const section of BRANCH_SUMMARY_SECTIONS) {
      expect(text).toContain(`## ${section}`)
    }
    // Goal, Constraints, Done, In Progress, Blocked, Key Decisions, Next Steps
    expect(text.split(BRANCH_SUMMARY_NONE_RECORDED)).toHaveLength(8)
    expect(text).not.toContain('- _None recorded._')
  })

  it('drops whitespace-only items but keeps the section marked', () => {
    const text = formatBranchSummary({
      constraints: ['   ', '\t', ''],
      nextSteps: ['   ', 'real step'],
    })

    expect(text).toContain('## Constraints & Preferences\n_None recorded._')
    expect(text).toContain('- real step')
    expect(text).not.toContain('-    ')
  })

  it('emits items verbatim — paths, backticked errors and trailing spaces', () => {
    const windowsPath =
      'C:\\Users\\me\\dev\\savant-code\\packages\\database\\src\\mutation-line.ts'
    const slashPath = 'packages/database/src/__tests__/durable-races.test.ts'
    const errorText =
      'error: `FOREIGN KEY constraint failed` at durable-races.test.ts:41'
    const text = formatBranchSummary({
      done: [windowsPath, slashPath],
      blocked: [errorText],
    })

    expect(text).toContain(`- ${windowsPath}`)
    expect(text).toContain(`- ${slashPath}`)
    expect(text).toContain(`- ${errorText}`)
    expect(text).not.toContain('mutation-line.ts'.toUpperCase())
  })

  it('keeps an item’s own surrounding whitespace (only blankness is tested)', () => {
    const text = formatBranchSummary({ keyDecisions: ['  spaced  '] })

    expect(text).toContain('-   spaced  ')
  })

  it('does not mutate the arrays it is handed', () => {
    const constraints = ['a', '   ', 'b']
    formatBranchSummary({ constraints })

    expect(constraints).toEqual(['a', '   ', 'b'])
  })
})

describe('resolveCustomInstructions — the append/replace seam', () => {
  it('absent or blank instructions are a no-op', () => {
    expect(resolveCustomInstructions({})).toEqual({ mode: 'append' })
    expect(resolveCustomInstructions({ customInstructions: '   ' })).toEqual({
      mode: 'append',
    })
    expect(
      resolveCustomInstructions({
        customInstructions: '',
        replaceInstructions: true,
      }),
    ).toEqual({ mode: 'append' })
  })

  it('instructions append by default and replace only when asked', () => {
    expect(
      resolveCustomInstructions({ customInstructions: 'be terse' }),
    ).toEqual({ mode: 'append', instructions: 'be terse' })
    expect(
      resolveCustomInstructions({
        customInstructions: 'be terse',
        replaceInstructions: true,
      }),
    ).toEqual({ mode: 'replace', instructions: 'be terse' })
  })
})

describe('buildBranchSummaryPrompt', () => {
  it('carries the fixed structure, the default guidance and the fidelity rule', () => {
    const prompt = buildBranchSummaryPrompt(POPULATED)

    for (const section of BRANCH_SUMMARY_SECTIONS) {
      expect(prompt).toContain(section)
    }
    expect(prompt).toContain(BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS)
    expect(prompt).toContain(BRANCH_SUMMARY_FIDELITY_INSTRUCTIONS)
  })

  it('appends custom instructions without dropping the default guidance', () => {
    const prompt = buildBranchSummaryPrompt({
      customInstructions: 'Always list the exact test command you ran.',
    })

    expect(prompt).toContain('Always list the exact test command you ran.')
    expect(prompt).toContain(BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS)
  })

  it('replaceInstructions replaces the default guidance and keeps the fidelity rule', () => {
    const prompt = buildBranchSummaryPrompt({
      customInstructions: 'Only the paths matter. Nothing else.',
      replaceInstructions: true,
    })

    expect(prompt).toContain('Only the paths matter. Nothing else.')
    expect(prompt).not.toContain(BRANCH_SUMMARY_DEFAULT_INSTRUCTIONS)
    // The format contract and the fidelity requirement are not guidance, so a
    // replacement instruction cannot drop them.
    expect(prompt).toContain(BRANCH_SUMMARY_FIDELITY_INSTRUCTIONS)
    expect(prompt).toContain('## Next Steps')
  })

  it('mentions every Progress sub-list so the model cannot invent its own', () => {
    const prompt = buildBranchSummaryPrompt(POPULATED)

    expect(prompt).toContain('Done, In Progress, Blocked')
  })
})
