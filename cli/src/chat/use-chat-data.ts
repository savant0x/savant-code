/**
 * Data selectors for the chat screen (FID-2026-0805-003). Extracted from
 * chat.tsx verbatim: sidebar store slices, clipboard status, subscription
 * data, and the ad pool with its stable event handlers.
 */

import { getAdsEnabled } from '../commands/ads'
import { useClipboard } from '../hooks/use-clipboard'
import { useEvent } from '../hooks/use-event'
import { useGravityAd } from '../hooks/use-gravity-ad'
import { useSubscriptionQuery } from '../hooks/use-subscription-query'
import { useChatStore } from '../state/chat-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { IS_SAVANT_FREE } from '../utils/constants'

import type { AdResponse } from '../hooks/use-gravity-ad'
import type {
  AgentStackEntry,
  FilesChanged,
  ToolHistoryEntry,
} from '../state/chat-store'

export interface UseChatDataReturn {
  contextTokensUsed: number
  contextTokensMax: number
  fsmPhase: string
  toolsUsed: string[]
  toolHistory: ToolHistoryEntry[]
  filesChanged: FilesChanged
  agentStack: AgentStackEntry[]
  sessionCost: number
  updateContextTokensMax: (maxTokens: number) => void
  updateContextWindowSource: (
    source: 'catalog' | 'fallback-table' | 'default',
  ) => void
  /** FID-2026-0914-002 (MQ4): sidebar window provenance. */
  contextWindowSource: 'catalog' | 'fallback-table' | 'default'
  sidebarModel: string | null | undefined
  statusMessage: string | null
  subscriptionData: ReturnType<typeof useSubscriptionQuery>['data']
  hasSubscription: boolean
  ads: AdResponse[] | null
  responseAds: Record<string, AdResponse[]>
  showInlineAds: boolean
  handleAdClick: (ad: AdResponse) => void
  handleAdImpression: (ad: AdResponse) => void
  handleResponseAdsNeeded: (messageId: string, count: number) => void
}

export function useChatData(): UseChatDataReturn {
  // Sidebar data from chat-store
  const contextTokensUsed = useChatStore((s) => s.contextTokensUsed)
  const contextTokensMax = useChatStore((s) => s.contextTokensMax)
  // FID-2026-0914-002 (MQ4): sidebar window provenance.
  const contextWindowSource = useChatStore((s) => s.contextWindowSource)
  // FID-007 S1: reactive selector — the previous getState() read during
  // render was non-reactive (stale until some unrelated state forced a
  // re-render).
  const fsmPhase = useChatStore((s) => s.fsmPhase)
  const toolsUsed = useChatStore((s) => s.toolsUsed)
  const toolHistory = useChatStore((s) => s.toolHistory)
  const filesChanged = useChatStore((s) => s.filesChanged)
  const agentStack = useChatStore((s) => s.agentStack)
  const sessionCost = useChatStore((s) => s.sessionCost)
  const updateContextTokensMax = useChatStore((s) => s.updateContextTokensMax)
  const updateContextWindowSource = useChatStore(
    (s) => s.updateContextWindowSource,
  )
  const sidebarModel = useSavantFreeModelStore((s) => s.selectedModel)

  const { statusMessage } = useClipboard()

  // Fetch subscription data early - needed for session credits tracking and ad gating
  const { data: subscriptionData } = useSubscriptionQuery({
    refetchInterval: 60 * 1000,
  })
  const hasSubscription = subscriptionData?.hasSubscription ?? false

  const {
    ads,
    responseAds,
    requestResponseAds,
    recordClick,
    recordImpression,
  } = useGravityAd({
    enabled: IS_SAVANT_FREE || !hasSubscription,
    provider: 'gravity',
    inline: true,
    surface: 'cli_chat',
    // Lazily fill a four-ad pool, then repeat it for later transcript slots.
    inlinePlacementId: 'CLI-Chat-Inline',
    // Keep the rotating above-input slot separate for reporting continuity.
    slotPlacementId: 'Single-Ad-Unit-1',
  })
  const showInlineAds = IS_SAVANT_FREE || getAdsEnabled()

  // Stable identities so the message-block callbacks (set once) always call
  // the latest recorder from the hook.
  const handleAdClick = useEvent(recordClick)
  const handleAdImpression = useEvent(recordImpression)
  const handleResponseAdsNeeded = useEvent(requestResponseAds)

  return {
    contextTokensUsed,
    contextTokensMax,
    contextWindowSource,
    fsmPhase,
    toolsUsed,
    toolHistory,
    filesChanged,
    agentStack,
    sessionCost,
    updateContextTokensMax,
    updateContextWindowSource,
    sidebarModel,
    statusMessage,
    subscriptionData,
    hasSubscription,
    ads,
    responseAds,
    showInlineAds,
    handleAdClick,
    handleAdImpression,
    handleResponseAdsNeeded,
  }
}
