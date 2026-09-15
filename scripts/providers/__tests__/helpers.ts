/**
 * FID-2026-0915-002 — shared pipeline test fixtures (moved verbatim from
 * harvest-core.test.ts and intelligence-layer.test.ts during the splits;
 * consumed by the core/diff-state/ring-buffer pins). Not a test file —
 * bun test only picks up *.test.ts.
 */
import type { CandidateState } from '../../../common/src/providers/discovery-state'

/** Frozen card slice — mirrors the real feed record shape. */
export function card(overrides: Record<string, unknown>): {
  card: Record<string, unknown>
} {
  return {
    card: {
      id: 1,
      host: 'api.example-free.ai',
      url: 'https://api.example-free.ai',
      name: 'api.example-free.ai',
      kind: 'product',
      platform: 'openai-compatible',
      category: 'first-party-free',
      categoryConfirmed: true,
      isPrimary: true,
      status: 'verified',
      discoveredFrom: 'for-the-zero/Free-LLM-Collection',
      firstSeenAt: '2026-08-01T00:00:00.000Z',
      lastProbedAt: '2026-09-14T00:00:57.771Z',
      lastAnalyzedAt: null,
      freeQuota: null,
      freeQuota_en: 'Free tier: 1M tokens/day, no card',
      freeModels: [],
      freeModels_en: ['llama-3.3-70b', 'qwen-3-32b'],
      probe: {
        reachable: true,
        latencyMs: 320,
        modelsCount: 12,
        modelsPublic: false,
        signupOpen: null,
        quotaHint: null,
      },
      analysis: null,
      upstream: null,
      ...overrides,
    },
  }
}

export const DAY = 24 * 60 * 60 * 1000
export const T0 = 1_757_800_000_000 // 2026-09-14-ish epoch ms (fixture clock)

/** Synthetic CandidateState fixture — mirrors a healthy tracked host. */
export function state(overrides: Partial<CandidateState> = {}): CandidateState {
  return {
    category: 'first-party-free',
    fingerprint: 'habcdef01',
    downStreak: 0,
    lastSeenUtc: new Date(T0).toISOString(),
    firstSeenUtc: new Date(T0).toISOString(),
    url: 'https://api.example-free.ai',
    lastBoundary: 'boundary-ok',
    models: ['llama-3.3-70b', 'qwen-3-32b'],
    history: [],
    lastProbe: {
      reachable: true,
      modelsCount: 2,
      boundary: 'boundary-ok',
      latencyMs: 320,
    },
    ...overrides,
  }
}
