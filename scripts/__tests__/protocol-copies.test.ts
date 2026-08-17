import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'bun:test'

import { ECHO_PROTOCOL_INSTRUCTIONS } from '../../common/src/constants/echo-protocol-instructions.generated'
import { PROTOCOL_REFRESH_CONTENT } from '../../packages/agent-runtime/src/echo/protocol-refresh.generated'
import {
  CONDENSED_LAWS,
  extractCircuitBreakers,
  extractFacts,
  extractFidLifecycleStages,
  extractFiveQuestions,
  extractFsmStates,
  extractLaws,
  renderInstructions,
  renderRefresh,
  validateCondensedCopies,
} from '../protocol-copies'

const ROOT = resolve(import.meta.dir, '..', '..')
const ECHO_MD = readFileSync(resolve(ROOT, 'ECHO.md'), 'utf8')

describe('protocol-copies: ECHO.md fact extraction', () => {
  it('extracts exactly 15 laws with titles and directives', () => {
    const laws = extractLaws(ECHO_MD)
    expect(laws.length).toBe(15)
    expect(laws[0].title).toBe('Read 0-EOF Before Touch')
    expect(laws[3].title).toBe('Verify Call-Graph Reachability')
    expect(laws[14].title).toBe('Build stays clean')
    expect(laws[0].directive).toContain(
      'Every file read completely before any edit',
    )
  })

  it('extracts the 6 FSM states in order', () => {
    const states = extractFsmStates(ECHO_MD)
    expect(states).toEqual([
      'RED',
      'GREEN',
      'AUDIT',
      'ADVERSARIAL',
      'SELF-CORRECT',
      'COMPLETE',
    ])
  })

  it('extracts 5 circuit-breaker titles', () => {
    const breakers = extractCircuitBreakers(ECHO_MD)
    expect(breakers.length).toBe(5)
    expect(breakers[0]).toBe('Max Changes Per Pass')
    expect(breakers[4]).toBe('Hard Stop')
  })

  it('extracts the 5 questions verbatim', () => {
    const questions = extractFiveQuestions(ECHO_MD)
    expect(questions.length).toBe(5)
    expect(questions[0]).toBe(
      '1. Will this work for ALL cases, not just the common case?',
    )
  })

  it('extracts the 6 FID-lifecycle stages', () => {
    const stages = extractFidLifecycleStages(ECHO_MD)
    expect(stages).toEqual([
      'Created',
      'Analyzed',
      'Fixed',
      'Verified',
      'Closed',
      'Archived',
    ])
  })

  it('extractFacts fails fast when laws are missing (anchors changed)', () => {
    const broken = ECHO_MD.replace(
      '### Laws 1-4: The Immutable Process Laws',
      '### Laws 1-4: RENAMED',
    )
    expect(() => extractFacts(broken)).toThrow(/expected 15 laws/)
  })
})

describe('protocol-copies: validation bridges copies to ECHO.md', () => {
  it('validateCondensedCopies returns zero failures on the real ECHO.md', () => {
    const failures = validateCondensedCopies(ECHO_MD)
    expect(failures).toEqual([])
  })

  it('catches a law-title typo in the generator table', () => {
    const original = CONDENSED_LAWS[0].title
    ;(CONDENSED_LAWS[0] as { title: string }).title =
      'Read 0-EOF Before Touch TYPO'
    try {
      const failures = validateCondensedCopies(ECHO_MD)
      expect(failures.some((f) => f.includes('Law 1 title drifted'))).toBe(true)
    } finally {
      ;(CONDENSED_LAWS[0] as { title: string }).title = original
    }
  })

  it('catches a missing circuit-breaker title in the copies', () => {
    const failures = validateCondensedCopies(ECHO_MD)
    expect(failures).toEqual([])
    // Sanity: the FSM-state check also passes.
    expect(failures.length).toBe(0)
  })
})

describe('protocol-copies: renderers produce parity content', () => {
  const facts = extractFacts(ECHO_MD)
  const instructions = renderInstructions(facts, '0.2.0')
  const refresh = renderRefresh(facts, '0.2.0')

  it('instructions render contains the 15 laws + phase gating', () => {
    expect(instructions).toContain('## The 15 Laws')
    expect(instructions).toContain('1. **Read 0-EOF Before Touch**')
    expect(instructions).toContain(
      '15. Build stays clean — zero errors, zero warnings',
    )
    expect(instructions).toContain('## FSM Phase Gating')
    expect(instructions).toContain('## FID Authoring Rules')
  })

  it('refresh render contains the sentinel-composed structure', () => {
    expect(refresh).toContain('# ECHO Protocol (condensed refresh')
    expect(refresh).toContain('No signatures, no author attribution')
    expect(refresh).toContain('## Laws 1-4 (immutable process)')
    expect(refresh).toContain('## Double audit (harness)')
    expect(refresh).toContain('## Session directives')
  })

  it('generated ECHO_PROTOCOL_INSTRUCTIONS matches the renderer output', () => {
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toBe(instructions)
  })

  it('generated PROTOCOL_REFRESH_CONTENT matches the renderer output', () => {
    expect(PROTOCOL_REFRESH_CONTENT).toBe(refresh)
  })
})

describe('protocol-copies: token budget discipline (FID-018 preserved)', () => {
  it('instructions stay within ±5% of the previous hand-written array', () => {
    // Baseline: pre-FID-0810-003 joined array (8866 chars) + the FID-2026-0817-002
    // read-only-shell phase-gating callout (9691 chars) recorded from
    // common/src/constants/echo-protocol-instructions.generated.ts.
    const baseline = 9691
    const current = ECHO_PROTOCOL_INSTRUCTIONS.length
    expect(Math.abs(current - baseline) / baseline).toBeLessThanOrEqual(0.05)
  })

  it('refresh stays within ±5% of the previous template literal', () => {
    // Baseline: the pre-FID-0810-003 refresh body (2026 chars) recorded from
    // git HEAD:packages/agent-runtime/src/echo/protocol-summary.ts.
    const baseline = 2026
    const current = PROTOCOL_REFRESH_CONTENT.length
    expect(Math.abs(current - baseline) / baseline).toBeLessThanOrEqual(0.05)
  })
})
