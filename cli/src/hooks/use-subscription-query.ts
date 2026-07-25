import { useActivityQuery } from './use-activity-query'
import { getAuthToken } from '../utils/auth'
import { IS_SAVANT_FREE } from '../utils/constants'
import { isDirectProviderMode } from '../utils/env'
import { logger as defaultLogger } from '../utils/logger'
import { getApiClient } from '../utils/savant-code-api'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SubscriptionResponse } from '@savant-code/common/types/subscription'

export type { SubscriptionResponse }

export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  current: () => [...subscriptionQueryKeys.all, 'current'] as const,
}

export async function fetchSubscriptionData(
  logger: Logger = defaultLogger,
): Promise<SubscriptionResponse> {
  if (isDirectProviderMode()) {
    return {
      hasSubscription: true,
      displayName: 'Direct Provider',
      subscription: {
        id: 'direct-provider',
        status: 'active',
        billingPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        tier: 1,
      },
      rateLimit: {
        limited: false,
        canStartNewBlock: true,
        weeklyUsed: 0,
        weeklyLimit: Number.MAX_SAFE_INTEGER,
        weeklyResetsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        weeklyPercentUsed: 0,
      },
      limits: {
        creditsPerBlock: Number.MAX_SAFE_INTEGER,
        blockDurationHours: 24,
        weeklyCreditsLimit: Number.MAX_SAFE_INTEGER,
      },
      fallbackToALaCarte: false,
    }
  }

  const client = getApiClient()
  const response = await client.get<SubscriptionResponse>(
    '/api/user/subscription',
    { includeCookie: true },
  )

  if (!response.ok) {
    logger.debug(
      { status: response.status },
      'Failed to fetch subscription data',
    )
    throw new Error(`Failed to fetch subscription: ${response.status}`)
  }

  return response.data!
}

export interface UseSubscriptionQueryDeps {
  logger?: Logger
  enabled?: boolean
  refetchInterval?: number | false
  refetchOnActivity?: boolean
  pauseWhenIdle?: boolean
  idleThreshold?: number
}

export function useSubscriptionQuery(deps: UseSubscriptionQueryDeps = {}) {
  const {
    logger = defaultLogger,
    enabled = true,
    refetchInterval = 60 * 1000,
    refetchOnActivity = true,
    pauseWhenIdle = true,
    idleThreshold = 30_000,
  } = deps

  const authToken = getAuthToken()

  return useActivityQuery({
    queryKey: subscriptionQueryKeys.current(),
    queryFn: () => fetchSubscriptionData(logger),
    enabled: enabled && !!authToken && !IS_SAVANT_FREE && !isDirectProviderMode(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
    refetchInterval,
    refetchOnActivity,
    pauseWhenIdle,
    idleThreshold,
  })
}
