import { useQuery } from '@tanstack/react-query'

import { getAuthToken } from '../utils/auth'
import { getApiClient, setApiClientAuthToken } from '../utils/savant-code-api'
import { logger as defaultLogger } from '../utils/logger'

import type { SavantFree$1 } from '@savant-code/common/types/savant-free-streak'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export const savant-free$1 = {
  all: ['savant-free$1'] as const,
  current: () => [...savant-free$1.all, 'current'] as const,
}

export async function fetchFreebuffStreak(params: {
  authToken: string
  logger?: Logger
}): Promise<SavantFree$1> {
  const { authToken, logger = defaultLogger } = params
  setApiClientAuthToken(authToken)
  const response = await getApiClient().get<SavantFree$1>(
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

export function useFreebuffStreakQuery(
  params: {
    enabled?: boolean
    logger?: Logger
  } = {},
) {
  const { enabled = true, logger = defaultLogger } = params
  const authToken = getAuthToken()

  return useQuery({
    queryKey: savant-free$1.current(),
    queryFn: () => fetchFreebuffStreak({ authToken: authToken!, logger }),
    enabled: enabled && !!authToken,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
