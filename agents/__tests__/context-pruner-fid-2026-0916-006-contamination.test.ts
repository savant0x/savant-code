// FID-2026-0916-006 — compaction-summary contamination pins (RED-first).
//
// Every pin reproduces a defect observed in the operator's LIVE /compact
// artifact (pasted 2026-09-16): harness/system dumps transcribed as operator
// dialogue, punctuation-only decisions, greeting-spam goals, framing tags
// leaking into the summary sections.
//
// Shapes under test (all pure pruner functions — no spawn needed):
//  1. An ECHO_REFRESH-tagged user message (the protocol refresh, wrapped in
//     <system>) must never appear in Standing facts.            [RC1]
//  2. Framing tags (<user_message>, <system>, <compaction-notice>) must be
//     stripped from transcribed user-turn text.                 [RC2]
//  3. The infrastructure-dump detector must classify the protocol-refresh
//     dump as infrastructure regardless of prose density.       [RC3]
//  4. Decisions & rationale must never contain punctuation-only fragments;
//     a substantive last-turn wins over `(none)`.               [RC4a]
//  5. Goal must skip greeting-spam candidates and fall back to the newest
//     substantive user turn.                                    [RC4b]

import { describe, expect, test } from 'bun:test'

import {
  buildDecisions,
  buildGoalSection,
  buildStandingFacts,
  isProtocolInfrastructureDump,
} from '../context-pruner/structured-summary'
import { summarizeMessages } from '../context-pruner/summarize-messages'
import { shouldExcludeMessage } from '../context-pruner/summary-parsing'

import type { Message, UserMessage } from '../types/util-types'

/** User message with the given framed text (mirrors live framing). */
function userTurn(text: string, tags?: string[]): UserMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    sentAt: 0,
    ...(tags ? { tags } : {}),
  }
}

function assistantTurn(text: string): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    sentAt: 0,
  }
}

/** The protocol-refresh message exactly as grounding.ts injects it. */
function echoRefreshTurn(): UserMessage {
  return userTurn(
    '<system><!--echo-critical-->\n# ECHO Protocol (condensed refresh)\n\nGoverning law set: the ECHO Protocol. Read 0-EOF before touch. Present before act. Verify before proceed.\n</system>',
    ['ECHO_REFRESH'],
  )
}

describe('FID-2026-0916-006 RC1: ECHO_REFRESH excluded from summary inputs', () => {
  test('shouldExcludeMessage rejects ECHO_REFRESH-tagged messages', () => {
    const message = echoRefreshTurn()
    expect(shouldExcludeMessage(message)).toBe(true)
  })

  test('the protocol refresh never becomes a standing fact', () => {
    const messages: Message[] = [
      userTurn('<user_message>implement the catalog fix</user_message>'),
      echoRefreshTurn(),
    ]
    const facts = buildStandingFacts(messages)
    expect(facts).toContain('implement the catalog fix')
    expect(facts).not.toContain('condensed refresh')
    expect(facts).not.toContain('echo-critical')
  })
})

describe('FID-2026-0916-006 RC2: framing stripped from transcribed turns', () => {
  test('standing facts carry prose, not user_message/system tags', () => {
    const messages: Message[] = [
      userTurn(
        '<user_message>deepseek</user_message>\n<system>User interrupted the response.</system>\n<system>Free-model allowance is too low. It requires up to 923,420 weighted tokens.</system>',
      ),
    ]
    const facts = buildStandingFacts(messages)
    expect(facts).toContain('deepseek')
    expect(facts).not.toContain('<user_message>')
    expect(facts).not.toContain('</user_message>')
    expect(facts).not.toContain('<system>')
    expect(facts).not.toContain('Free-model allowance')
  })

  test('the [USER] historical entries are framing-free too', () => {
    const messages: Message[] = [
      userTurn(
        '<user_message>run the gauntlet</user_message>\n<system>Session ended before this response completed.</system>',
      ),
    ]
    const { entries } = summarizeMessages(messages, null)
    const userEntry = entries.find((e) => e.role === 'user')
    expect(userEntry).toBeDefined()
    expect(userEntry?.parts[0]).toContain('run the gauntlet')
    expect(userEntry?.parts[0]).not.toContain('<user_message>')
    expect(userEntry?.parts[0]).not.toContain('<system>')
  })
})

describe('FID-2026-0916-006 RC3: prose-heavy dumps classify as infrastructure', () => {
  test('the condensed ECHO refresh dump is infrastructure despite prose density', () => {
    const dump = [
      '<system><!--echo-critical-->',
      '# ECHO Protocol (condensed refresh — full protocol read at session start)',
      '',
      'Governing law set: the ECHO Protocol (Savant harness ECHO.md v0.2.0). No signatures, no author attribution — documents speak for themselves.',
      '',
      '## Laws 1-4 (immutable process)',
      '',
      '1. Read 0-EOF before touch — no exceptions, no skimming.',
      '2. Present before act — full impact analysis before implementation; user approval before any code is written.',
      '3. Verify before proceed — build/test commands from protocol.config.yaml; zero errors, zero warnings.',
      '4. Verify call-graph reachability — grep production entry points after wiring; zero grep results = not wired.',
      '',
      '## Session directives',
      '',
      'Flag ANY issue, even out of scope. Honest assessment: verification claims need tool output.',
      '</system>',
    ].join('\n')
    expect(isProtocolInfrastructureDump(dump)).toBe(true)
  })

  test('an operator turn with a stray inline system quote is NOT infrastructure', () => {
    // Multi-line prose with one inline tag mention: the density rule counts
    // the mention line, but 1/6 ≈ 17% is far below the 40% threshold — and
    // none of the FID-006 outright sentinels fire. Operator prose survives.
    const turn = [
      'The harness shows <system> tags around refreshes.',
      'I want us to audit how the summary builder handles them,',
      'because the last compact lost my actual request and kept the',
      'boilerplate instead. The pinned section was all infrastructure.',
      'Please fix that in the pruner, not the prompt.',
      'Also the standing facts lost the whole task queue state.',
    ].join('\n')
    expect(isProtocolInfrastructureDump(turn)).toBe(false)
  })
})

describe('FID-2026-0916-006 RC4a: decisions carry substance, not fragments', () => {
  test('punctuation-only assistant turns never become decisions', () => {
    const messages: Message[] = [
      assistantTurn('.'),
      assistantTurn('hosts'),
      assistantTurn('ok'),
      assistantTurn(
        'Chose the tail-normalized hash because both stamp paths flow through computeFidFingerprint.',
      ),
    ]
    const decisions = buildDecisions(messages)
    expect(decisions).not.toContain('- .')
    expect(decisions).not.toContain('- hosts')
    expect(decisions).not.toContain('- ok')
    expect(decisions).toContain('tail-normalized hash')
  })

  test('a window of only fragment turns yields (none in this window)', () => {
    const messages: Message[] = [assistantTurn('.'), assistantTurn('ok')]
    expect(buildDecisions(messages)).toContain('(none in this window)')
  })
})

describe('FID-2026-0916-006 RC4b: goal skips greeting spam', () => {
  test('a greeting-only latest turn is not pinned as the goal', () => {
    const goal = buildGoalSection('hey')
    expect(goal).not.toBe('## Goal\nhey')
    expect(goal).toContain('(none in this window)')
  })

  test('a substantive goal still pins verbatim', () => {
    const goal = buildGoalSection('implement FID-2026-0916-006 end to end')
    expect(goal).toContain('implement FID-2026-0916-006 end to end')
  })

  test('greeting runs coalesce into one counted entry (MQ3 ruling)', () => {
    const messages: Message[] = [
      userTurn('<user_message>hey</user_message>'),
      userTurn('<user_message>hello</user_message>'),
      userTurn('<user_message>hey</user_message>'),
      userTurn('<user_message>resume</user_message>'),
      userTurn('<user_message>hey</user_message>'),
    ]
    const { entries } = summarizeMessages(messages, null)
    const userEntries = entries.filter((e) => e.role === 'user')
    // Coalesced greeting run: one entry carrying a (×N) marker instead of
    // five separate near-empty entries.
    expect(userEntries.length).toBe(1)
    expect(userEntries[0]?.parts[0]).toMatch(/\(×\d+\)$/)
  })
})
