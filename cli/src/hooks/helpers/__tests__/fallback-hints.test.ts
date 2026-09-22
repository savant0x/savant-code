/**
 * FID-2026-0915-001 (W5) — the 429 fallback-hint seam (RED-first).
 *
 * On a rate-limit failure the agent offers up to 2 OTHER boundary-ok hosts
 * serving the same model family — read from the harvest state, fail-silent,
 * once per model per session. Missing data ⇒ empty string ⇒ zero behavior
 * change (the error banner renders exactly as before).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildModelIndex,
  fallbackHint,
} from '@savant-code/common/providers/discovery-state'
import { describe, expect, test } from 'bun:test'

import { quotaHint, rateLimitHint } from '../send-message/fallback-hints'

function withState(
  hosts: Record<
    string,
    { url: string; lastBoundary: string | null; models?: string[] }
  >,
): string {
  const dir = join(tmpdir(), `fallback-hints-${Date.now()}-${Math.random()}`)
  mkdirSync(join(dir, 'dev', 'provider-candidates'), { recursive: true })
  writeFileSync(
    join(dir, 'dev', 'provider-candidates', 'candidates.json'),
    JSON.stringify({ _meta: { version: 2 }, hosts }),
    'utf8',
  )
  return dir
}

const cleanup: string[] = []
process.on('exit', () => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true })
})

describe('rateLimitHint (W5 seam)', () => {
  test('returns a hint naming up to 2 other boundary-ok hosts of the family', () => {
    const root = withState({
      'failing.host': {
        url: 'https://failing.host',
        lastBoundary: 'boundary-ok',
        models: ['qwen3-coder:free'],
      },
      'fast.host': {
        url: 'https://fast.host',
        lastBoundary: 'boundary-ok',
        models: ['qwen3-coder:free'],
      },
      'slow.host': {
        url: 'https://slow.host',
        lastBoundary: 'boundary-ok',
        models: ['qwen3-coder:free'],
      },
      'third.host': {
        url: 'https://third.host',
        lastBoundary: 'boundary-ok',
        models: ['qwen3-coder:free'],
      },
    })
    cleanup.push(root)
    const hint = rateLimitHint({
      // Production derives the failing host from the error's request URL.
      error: {
        statusCode: 429,
        url: 'https://failing.host/v1/chat/completions',
      },
      modelId: 'qwen/qwen3-coder:free',
      projectRoot: root,
    })
    expect(hint).toContain('fast.host')
    expect(hint).toContain('slow.host')
    expect(hint).not.toContain('third.host')
    expect(hint).not.toContain('failing.host')
  })

  test('suppresses already-suggested models for the session (once per model)', () => {
    const root = withState({
      'a.host': {
        url: 'https://a.host',
        lastBoundary: 'boundary-ok',
        models: ['deepseek-v4'],
      },
      'b.host': {
        url: 'https://b.host',
        lastBoundary: 'boundary-ok',
        models: ['deepseek-v4'],
      },
    })
    cleanup.push(root)
    const first = rateLimitHint({
      error: { statusCode: 429 },
      modelId: 'deepseek-ai/deepseek-v4-pro',
      projectRoot: root,
    })
    expect(first).toContain('a.host')
    const second = rateLimitHint({
      error: { statusCode: 429 },
      modelId: 'deepseek-ai/deepseek-v4-pro',
      projectRoot: root,
    })
    expect(second).toBe('')
  })

  test('empty string on missing state file (zero behavior change)', () => {
    const empty = join(
      tmpdir(),
      `fallback-hints-empty-${Date.now()}-${Math.random()}`,
    )
    cleanup.push(empty)
    expect(
      rateLimitHint({
        error: { statusCode: 429 },
        modelId: 'qwen3-coder:free',
        projectRoot: empty,
      }),
    ).toBe('')
  })

  test('empty string on non-429 errors', () => {
    expect(
      rateLimitHint({
        error: { statusCode: 500 },
        modelId: 'qwen3-coder:free',
        projectRoot: '.',
      }),
    ).toBe('')
    expect(
      rateLimitHint({
        error: new Error('boom'),
        modelId: 'qwen3-coder:free',
        projectRoot: '.',
      }),
    ).toBe('')
  })

  test('never suggests open relays or unverified boundaries', () => {
    const root = withState({
      'ok.host': {
        url: 'https://ok.host',
        lastBoundary: 'boundary-ok',
        models: ['llama-3.3-70b'],
      },
      'relay.host': {
        url: 'https://relay.host',
        lastBoundary: 'open-relay-reject',
        models: ['llama-3.3-70b'],
      },
    })
    cleanup.push(root)
    const hint = rateLimitHint({
      error: { statusCode: 429 },
      modelId: 'meta/llama-3.3-70b-instruct',
      projectRoot: root,
    })
    expect(hint).toContain('ok.host')
    expect(hint).not.toContain('relay.host')
  })
})

describe('quotaHint (FID-2026-0919-026)', () => {
  const refusal = {
    statusCode: 400,
    code: 'insufficient_user_quota',
    message:
      'credit insufficient balance: balance=0 required=3672 (request id: 20260919193303938194165c955d568iMhaOQev)',
  }

  test('a gateway quota refusal quotes the declared note and points at /health', () => {
    const hint = quotaHint({
      error: refusal,
      modelId: 'bai/deepseek-v4.1-flash',
    })
    expect(hint).toContain('B.AI')
    expect(hint).toContain('prepaid')
    expect(hint).toContain('/health')
  })

  test('an explicit provider id wins over the model prefix', () => {
    const hint = quotaHint({
      error: refusal,
      modelId: 'bai/hy3',
      providerId: 'bai',
    })
    expect(hint).toContain('B.AI')
  })

  test('stays silent when nothing honest applies', () => {
    // Not a quota refusal.
    expect(
      quotaHint({
        error: { code: 'invalid_request', message: 'bad param' },
        modelId: 'bai/hy3',
      }),
    ).toBe('')
    // Quota refusal, but no provider to attribute it to.
    expect(quotaHint({ error: refusal })).toBe('')
    expect(quotaHint({ error: refusal, modelId: 'some-bare-model' })).toBe('')
    // Quota refusal on a provider that declares no quota note.
    expect(quotaHint({ error: refusal, modelId: 'openrouter/hy3' })).toBe('')
  })

  test('message-only shapes are recognised, including the operator-reported text', () => {
    const hint = quotaHint({
      error: {
        message:
          'credit insufficient balance: balance=0 required=3672 (request id: 20260919193303938194165c955d568iMhaOQev)',
      },
      modelId: 'bai/qwen3.8-flash',
    })
    expect(hint).toContain('B.AI')
  })
})

describe('fallbackHint (common, W5 selection — reused here)', () => {
  test('selection contract stays pinned at the consumption site', () => {
    const index = buildModelIndex([
      {
        host: 'x.host',
        boundary: 'boundary-ok',
        latencyMs: 10,
        models: ['glm-4.7-flash'],
      },
    ])
    expect(fallbackHint('GLM-4.7-Flash', index)).toContain('x.host')
  })
})
