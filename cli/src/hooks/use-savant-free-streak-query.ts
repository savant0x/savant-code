import { useQuery } from '@tanstack/react-query'

import { isDirectProviderMode } from '../utils/env'
import { getAuthToken } from '../utils/auth'
import { logger as defaultLogger } from '../utils/logger'
import { getApiClient, setApiClientAuthToken } from '../utils/savant-code-api'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantFreeStreakResponse } from '@savant-code/common/types/savant-free-streak'

export const streakQueryKeys = {
  all: ['streakQueryKeys'] as const,
  current: () => [...streakQueryKeys.all, 'current'] as const,
}

export async function fetchSavantFreeStreak(params: {
  authToken: string
  logger?: Logger
}): Promise<SavantFreeStreakResponse> {
  const { authToken, logger = defaultLogger } = params
  if (isDirectProviderMode()) {
    return {
      streak: 0,
      todayUsed: false,
      lastUsageDate: null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
  setApiClientAuthToken(authToken)
  const response = await getApiClient().get<SavantFreeStreakResponse>(
    '/api/v1/savant-free/streak',
    { retry: false },
  )

  if (!response.ok) {
    logger.error(
      { status: response.status, error: response.error },
      'Failed to fetch savant-free streak',
    )
    throw new Error(`Failed to fetch savant-free streak (HTTP ${response.status})`)
  }

  if (!response.data) {
    throw new Error('Failed to fetch savant-free streak: empty response')
  }

  return response.data
}

export function useSavantFreeStreakQuery(
  params: {
    enabled?: boolean
    logger?: Logger
  } = {},
) {
  const { enabled = true, logger = defaultLogger } = params
  const authToken = getAuthToken()

  return useQuery({
    queryKey: streakQueryKeys.current(),
    queryFn: () => fetchSavantFreeStreak({ authToken: authToken!, logger }),
    enabled: enabled && !!authToken && !isDirectProviderMode(),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
