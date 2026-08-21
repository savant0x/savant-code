import { isSavantFreeModelAvailable } from '@savant-code/common/constants/savant-free-models'
import { useCallback } from 'react'

import { startSavantFreeSession } from '../../hooks/use-savant-free-session'

import type { SavantFreeModel } from '@savant-code/common/constants/savant-free-models'
import type { SavantFreeRateLimitsByModel } from '@savant-code/common/types/savant-free-session'
import type React from 'react'

interface UseSelectorActionsOptions {
  now: number
  rateLimitsByModel: SavantFreeRateLimitsByModel | undefined
  pending: string | null
  setPending: React.Dispatch<React.SetStateAction<string | null>>
  committedModelId: string | null
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>
  otherModels: readonly SavantFreeModel[]
  recommendedModel: SavantFreeModel
  setFocusedId: React.Dispatch<React.SetStateAction<string>>
}

export function useSelectorActions(opts: UseSelectorActionsOptions): {
  isJoinable: (modelId: string) => boolean
  pick: (modelId: string) => void
  toggleExpanded: () => void
} {
  const {
    now,
    rateLimitsByModel,
    pending,
    setPending,
    committedModelId,
    setExpanded,
    otherModels,
    recommendedModel,
    setFocusedId,
  } = opts

  const isJoinable = useCallback(
    (modelId: string) => {
      if (!isSavantFreeModelAvailable(modelId, new Date(now))) return false
      const rateLimit = rateLimitsByModel?.[modelId]
      return !rateLimit || rateLimit.recentCount < rateLimit.limit
    },
    [now, rateLimitsByModel],
  )

  const pick = useCallback(
    (modelId: string) => {
      if (pending) return
      if (modelId === committedModelId) return
      if (!isJoinable(modelId)) return
      setPending(modelId)
      startSavantFreeSession(modelId).finally(() => setPending(null))
    },
    [pending, committedModelId, isJoinable],
  )

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      // After revealing the list, drop focus onto the first newly-shown row so
      // the next arrow press walks into it; after collapsing, return to the
      // hero so Enter starts.
      setFocusedId(
        next
          ? (otherModels[0]?.id ?? recommendedModel.id)
          : recommendedModel.id,
      )
      return next
    })
  }, [otherModels, recommendedModel])

  return { isJoinable, pick, toggleExpanded }
}
