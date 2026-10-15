import {
  createPostHogClient,
  type AnalyticsClientWithIdentify,
  type PostHogClientOptions,
} from '@savant-code/common/analytics-core'
import {
  env as defaultEnv,
  IS_PROD as defaultIsProd,
} from '@savant-code/common/env'

import { getOrCreatePersistentAnonymousId } from '../anonymous-id'

// FID-2026-0819-005 Loop 148: analytics dependency contracts + resolver,
// extracted from analytics/state.ts. `resolveDeps` takes the injected deps
// as a parameter so it stays pure; state.ts threads its module variable in.

/** Dependencies that can be injected for testing */
export interface AnalyticsDeps {
  env: {
    NEXT_PUBLIC_POSTHOG_API_KEY?: string
    NEXT_PUBLIC_POSTHOG_HOST_URL?: string
  }
  isProd: boolean
  createClient: (
    apiKey: string,
    options: PostHogClientOptions,
  ) => AnalyticsClientWithIdentify
  generateAnonymousId?: () => string
}

export type ResolvedAnalyticsDeps = {
  env: AnalyticsDeps['env']
  isProd: boolean
  createClient: AnalyticsDeps['createClient']
  generateAnonymousId: NonNullable<AnalyticsDeps['generateAnonymousId']>
}

export function resolveDeps(
  injectedDeps: AnalyticsDeps | undefined,
): ResolvedAnalyticsDeps {
  return {
    env: injectedDeps?.env ?? defaultEnv,
    isProd: injectedDeps?.isProd ?? defaultIsProd,
    createClient: injectedDeps?.createClient ?? createPostHogClient,
    generateAnonymousId:
      injectedDeps?.generateAnonymousId ?? getOrCreatePersistentAnonymousId,
  }
}
