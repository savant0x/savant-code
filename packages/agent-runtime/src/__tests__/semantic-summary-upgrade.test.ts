/**
 * FID-2026-0914-002 — semantic-summary upgrade pins (RED-first).
 *
 * The context-pruner is a model-less embedded transcriber (V1/V2 audit
 * evidence); the LLM writer lives at the spawn boundary where
 * `promptAiSdk: PromptAiSdkFn` exists (V3). These pins fix the writer
 * contract: kimi-pattern prompt with no secret leakage, output validation
 * (band + tool-call leak + redaction), and the failure contract — writer
 * failure degrades to the deterministic excerpt verbatim, aborts propagate.
 */
import { describe, expect, test } from 'bun:test'

import {
  applySemanticSummaryUpgrade,
  buildSemanticSummaryPrompt,
  validateSemanticSummary,
} from '../tools/handlers/tool/semantic-summary-upgrade'

import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PromptResult } from '@savant-code/common/util/error'

const fakeLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const noopSendAction = () => {}
const noopTrackEvent = () => async () => {}

function fakePromptAiSdk(value: string): PromptAiSdkFn {
  const fn = (async () =>
    ({
      aborted: false,
      value,
    }) as PromptResult<string>) as unknown as PromptAiSdkFn
  return fn
}

const DETERMINISTIC_EXCERPT = [
  '<compaction-summary>',
  '## Goal',
  'Add the Infron provider',
  '## Preserved state',
  '{"todos":[{"task":"wire registry","completed":false}]}',
  '</compaction-summary>',
].join('\n')

describe('buildSemanticSummaryPrompt', () => {
  test('never embeds credentials in the prompt (Law 12)', () => {
    const { system, user } = buildSemanticSummaryPrompt({
      deterministicSummary: DETERMINISTIC_EXCERPT,
    })
    expect(system).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(user).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(user).not.toContain('sk-or-v1-')
  })

  test('carries the kimi-pattern handoff disciplines (settled/open, evidence, unknowns, language)', () => {
    const { system } = buildSemanticSummaryPrompt({
      deterministicSummary: DETERMINISTIC_EXCERPT,
    })
    const lowered = system.toLowerCase()
    expect(lowered).toContain('continuing')
    expect(lowered).toContain('settled')
    expect(lowered).toContain('open')
    expect(lowered).toContain('evidence')
    expect(lowered).toContain('unknown')
    expect(lowered).toContain('redact')
    expect(lowered).toContain('same language')
  })

  test('includes the deterministic summary as input material and the session-model instruction', () => {
    const { system, user } = buildSemanticSummaryPrompt({
      deterministicSummary: DETERMINISTIC_EXCERPT,
    })
    expect(user).toContain('Add the Infron provider')
    expect(system).toContain('session')
  })
})

describe('validateSemanticSummary', () => {
  test('rejects output below the 800-token band', () => {
    const result = validateSemanticSummary({ text: 'too short' })
    expect(result.ok).toBe(false)
  })

  test('rejects output above the 6000-token band', () => {
    const result = validateSemanticSummary({
      text: `word `.repeat(6000 * 4),
    })
    expect(result.ok).toBe(false)
  })

  test('rejects leaked tool-call syntax', () => {
    const result = validateSemanticSummary({
      text:
        `A coherent handoff paragraph. `.repeat(300) +
        '\n<tool_call>read_files</tool_call>',
    })
    expect(result.ok).toBe(false)
  })

  test('redacts secret-looking strings with [REDACTED]', () => {
    const good = 'Handoff: '.repeat(400) // comfortably inside the band
    const result = validateSemanticSummary({
      text: `${good} key=sk-abc123def456ghi789`,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('[REDACTED]')
      expect(result.text).not.toContain('sk-abc123def456ghi789')
    }
  })

  test('accepts a coherent in-band summary unchanged', () => {
    const good = 'Handoff: '.repeat(400)
    const result = validateSemanticSummary({ text: good })
    expect(result.ok).toBe(true)
  })
})

describe('applySemanticSummaryUpgrade', () => {
  function baseParams(
    overrides?: Partial<Parameters<typeof applySemanticSummaryUpgrade>[0]>,
  ) {
    return {
      promptAiSdk: fakePromptAiSdk('Handoff summary: '.repeat(300)),
      model: 'z-ai/glm-5.3-flash' as const,
      apiKey: 'test-key',
      runId: 'run-1',
      clientSessionId: 'cs-1',
      fingerprintId: 'fp-1',
      userInputId: 'ui-1',
      userId: undefined,
      deterministicExcerpt: DETERMINISTIC_EXCERPT,
      signal: new AbortController().signal,
      logger: fakeLogger,
      sendAction: noopSendAction,
      trackEvent: noopTrackEvent,
      ...overrides,
    }
  }

  test('replaces the deterministic excerpt with the validated model summary', async () => {
    const result = await applySemanticSummaryUpgrade(baseParams())
    expect(result.status).toBe('applied')
    expect(result.provenance).toBe('semantic-llm')
    expect(result.excerpt).toContain('Handoff summary')
    expect(result.excerpt).not.toBe(DETERMINISTIC_EXCERPT)
  })

  test('writer failure preserves the deterministic excerpt verbatim (degraded mode)', async () => {
    const failing = (async () => {
      throw new Error('provider 500')
    }) as unknown as PromptAiSdkFn
    const result = await applySemanticSummaryUpgrade(
      baseParams({ promptAiSdk: failing }),
    )
    expect(result.status).toBe('deterministic-fallback')
    expect(result.provenance).toBe('deterministic-fallback')
    expect(result.excerpt).toBe(DETERMINISTIC_EXCERPT)
  })

  test('off-band model output degrades to the deterministic excerpt', async () => {
    const result = await applySemanticSummaryUpgrade(
      baseParams({ promptAiSdk: fakePromptAiSdk('short') }),
    )
    expect(result.status).toBe('deterministic-fallback')
    expect(result.excerpt).toBe(DETERMINISTIC_EXCERPT)
  })

  test('user abort propagates (never swallowed)', async () => {
    const aborting = (async () =>
      ({
        aborted: true,
        reason: 'user cancel',
      }) as PromptResult<string>) as unknown as PromptAiSdkFn
    await expect(
      applySemanticSummaryUpgrade(baseParams({ promptAiSdk: aborting })),
    ).rejects.toThrow()
  })

  test('sends the summary request with the session model (MQ1: main model only)', async () => {
    let capturedModel: string | undefined
    let capturedMessages: Message[] | undefined
    const capturing = (async (params: {
      model: string
      messages: Message[]
    }) => {
      capturedModel = params.model
      capturedMessages = params.messages
      return {
        aborted: false,
        value: 'Handoff summary: '.repeat(300),
      } as PromptResult<string>
    }) as unknown as PromptAiSdkFn
    await applySemanticSummaryUpgrade(baseParams({ promptAiSdk: capturing }))
    expect(capturedModel).toBe('z-ai/glm-5.3-flash')
    expect(capturedMessages?.length).toBeGreaterThan(0)
  })
})
