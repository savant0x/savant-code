import {
  FALLBACK_SAVANT_FREE_MODEL_ID,
  SAVANT_FREE_PREMIUM_SESSION_LIMIT,
  getSavantFreeDeploymentAvailabilityLabel,
  getSavantFreeModelsForAccessTier,
  getRecommendedSavantFreeModelId,
  isSavantFreeGlmV52ModelId,
  isSavantFreeModelAvailable,
} from '@savant-code/common/constants/savant-free-models'
import {
  getRateLimitsByModel,
  getReferralInfo,
} from '@savant-code/common/types/savant-free-session'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { computeSelectorLayout, estimateSelectorHeight } from './layout'
import {
  buildRenderedModelIds,
  buildSelectorNavIds,
  buildSelectorSections,
} from './model-selector-core'
import { useModelSelectorKeyboard } from './use-keyboard-nav'
import { useSelectorActions } from './use-selector-actions'
import {
  useKeepSelectorFocusValid,
  useSelectorScrollSync,
} from './use-selector-effects'
import { useNow } from '../../hooks/use-now'
import { useTerminalDimensions } from '../../hooks/use-terminal-dimensions'
import { useSavantFreeModelStore } from '../../state/savant-free-model-store'
import { useSavantFreeSessionStore } from '../../state/savant-free-session-store'
import {
  formatSavantFreePremiumResetCountdown,
  getSavantFreePremiumResetAt,
} from '../../utils/savant-free-premium-reset'

import type { ModelSelectorState } from './model-selector-core'
import type { SavantFreeReferralFocusTarget } from '../savant-free-referral-banner'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type { SavantFreeAccessTier } from '@savant-code/common/constants/savant-free-models'

// Re-export the state contract from the original path (public API kept).
export type { ModelSelectorState } from './model-selector-core'

export function useModelSelectorState(opts: {
  maxHeight: number
  onExpandedChange?: (expanded: boolean) => void
}): ModelSelectorState {
  const { maxHeight, onExpandedChange } = opts
  // contentMaxWidth (capped at 80 cols by the landing screen) is the real budget.
  const { contentMaxWidth } = useTerminalDimensions()
  const selectedModel = useSavantFreeModelStore((s) => s.selectedModel)
  const setSelectedModel = useSavantFreeModelStore((s) => s.setSelectedModel)
  const session = useSavantFreeSessionStore((s) => s.session)
  const accessTier: SavantFreeAccessTier =
    (session && 'accessTier' in session ? session.accessTier : undefined) ??
    'full'
  const now = useNow(60_000)
  const deploymentAvailabilityLabel = useMemo(
    () => getSavantFreeDeploymentAvailabilityLabel(new Date(now)),
    [now],
  )
  const [pending, setPending] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const availableModels = useMemo(
    // GLM 5.2 is a referral reward (SavantFreeReferralBanner), not a grid model.
    () =>
      getSavantFreeModelsForAccessTier(accessTier).filter(
        (m) => !isSavantFreeGlmV52ModelId(m.id),
      ),
    [accessTier],
  )
  const recommendedModel = useMemo(() => {
    const id = getRecommendedSavantFreeModelId(accessTier)
    return availableModels.find((m) => m.id === id) ?? availableModels[0]!
  }, [accessTier, availableModels])
  const otherModels = useMemo(
    () => availableModels.filter((m) => m.id !== recommendedModel.id),
    [availableModels, recommendedModel],
  )
  // Only worth collapsing when the toggle actually hides something (a single
  // "other" model just shows both — a "see 1 more" toggle is noise).
  const canCollapse = otherModels.length >= 2

  // Collapsed by default only on the landing screen when the saved selection
  // IS the recommended model; other preferences start expanded.
  const isLanding = session?.status === 'none' || !session
  const [expanded, setExpanded] = useState(
    () => !canCollapse || !isLanding || selectedModel !== recommendedModel.id,
  )
  // Mirror expansion up to the landing screen (collapsed → full ASCII logo).
  useLayoutEffect(() => {
    onExpandedChange?.(expanded)
  }, [expanded, onExpandedChange])

  // Keyboard cursor — separate from the selected model (preview without commit).
  const [focusedId, setFocusedId] = useState<string>(() => selectedModel)

  // Referral banner GLM/copy actions join the nav order (kept local).
  const [extraTargets, setExtraTargets] = useState<
    SavantFreeReferralFocusTarget[]
  >([])
  const extraTargetIds = useMemo(
    () => extraTargets.map((t) => t.id),
    [extraTargets],
  )
  const contentRef = useRef<BoxRenderable | null>(null)
  const [measuredContentHeight, setMeasuredContentHeight] = useState<
    number | null
  >(null)
  const syncContentHeight = useCallback(() => {
    const nextHeight = contentRef.current?.height
    if (!nextHeight) return
    setMeasuredContentHeight((current) =>
      current === nextHeight ? current : nextHeight,
    )
  }, [])
  const sections = useMemo(
    () => buildSelectorSections(expanded, accessTier, otherModels),
    [expanded, accessTier, otherModels],
  )

  // Model rows in render order: recommended hero first, then the grouped rest.
  const renderedModelIds = useMemo(
    () => buildRenderedModelIds(recommendedModel, sections),
    [recommendedModel, sections],
  )
  // Keyboard-navigable ids: model rows, then the toggle, then referral focus
  // targets (arrowing down past "see all models" reaches its buttons).
  const navIds = useMemo(
    () => buildSelectorNavIds(renderedModelIds, canCollapse, extraTargetIds),
    [canCollapse, renderedModelIds, extraTargetIds],
  )

  // Keep focus valid as the list expands/collapses or the selection changes
  // server-side; only out-of-range focus snaps back to the selection.
  useKeepSelectorFocusValid({ navIds, selectedModel, setFocusedId })

  useEffect(() => {
    // Landing-screen safety net: if the in-memory selection becomes unavailable
    // (e.g. deployment hours close while the picker is open), swap to the
    // always-available fallback so Enter doesn't POST a rejected model.
    // In-memory only — the saved preference is preserved for the next launch.
    if (
      (session?.status === 'none' || !session) &&
      (!renderedModelIds.includes(selectedModel) ||
        !isSavantFreeModelAvailable(selectedModel, new Date(now)))
    ) {
      setSelectedModel(renderedModelIds[0] ?? FALLBACK_SAVANT_FREE_MODEL_ID)
    }
  }, [renderedModelIds, now, selectedModel, session, setSelectedModel])

  // Never a queued model: re-picking is always meaningful.
  const committedModelId: string | null = null
  const rateLimitsByModel = getRateLimitsByModel(session)
  const referral = getReferralInfo(session)

  // Premium quota surfaced on the PREMIUM header: all premium models share
  // one pool; the pool resets on a Pacific-day boundary, so the countdown
  // shows even at zero used.
  const sharedRateLimit = rateLimitsByModel
    ? Object.values(rateLimitsByModel)[0]
    : undefined
  const premiumUsed = sharedRateLimit?.recentCount ?? 0
  const premiumExhausted = premiumUsed >= SAVANT_FREE_PREMIUM_SESSION_LIMIT
  const premiumResetCountdown = formatSavantFreePremiumResetCountdown(
    getSavantFreePremiumResetAt({ rateLimitsByModel, nowMs: now }),
    now,
  )

  const {
    wrapDetails,
    buttonOuterWidth,
    nameColumnWidth,
    recommendedOneLineLen,
  } = useMemo(
    () =>
      computeSelectorLayout({
        availableModels,
        contentMaxWidth,
        deploymentAvailabilityLabel,
        recommendedModel,
      }),
    [
      availableModels,
      contentMaxWidth,
      deploymentAvailabilityLabel,
      recommendedModel,
    ],
  )

  const estimatedModelHeight = useMemo(
    () =>
      estimateSelectorHeight({
        recommendedModel,
        sections,
        canCollapse,
        wrapDetails,
      }),
    [sections, wrapDetails, recommendedModel, canCollapse],
  )

  // With a referral, start at the full allowance until the wrapper reports
  // its intrinsic height (conservative, cannot clip wrapped copy).
  const contentHeight =
    measuredContentHeight ?? (referral ? maxHeight : estimatedModelHeight)

  const needsScroll = contentHeight > maxHeight
  const scrollViewportHeight = Math.max(1, Math.min(contentHeight, maxHeight))
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  // Keep the focused element inside the viewport while arrowing through a
  // taller list; reset stale offsets when a resize makes everything fit.
  useSelectorScrollSync({
    scrollRef,
    focusedId,
    contentHeight,
    needsScroll,
    extraTargetIds,
  })

  const { isJoinable, pick, toggleExpanded } = useSelectorActions({
    now,
    rateLimitsByModel,
    pending,
    setPending,
    committedModelId,
    setExpanded,
    otherModels,
    recommendedModel,
    setFocusedId,
  })

  // Tab/arrows move the highlight only; Enter/Space commits or fires toggle.
  useModelSelectorKeyboard({
    pending,
    focusedId,
    committedModelId,
    navIds,
    extraTargets,
    isJoinable,
    onPick: pick,
    onFocus: setFocusedId,
    onToggle: toggleExpanded,
  })

  return {
    accessTier,
    deploymentAvailabilityLabel,
    pending,
    hoveredId,
    setHoveredId,
    availableModels,
    recommendedModel,
    canCollapse,
    expanded,
    focusedId,
    setFocusedId,
    extraTargets,
    setExtraTargets,
    sections,
    navIds,
    committedModelId,
    referral,
    premiumUsed,
    premiumExhausted,
    premiumResetCountdown,
    wrapDetails,
    buttonOuterWidth,
    nameColumnWidth,
    recommendedOneLineLen,
    contentHeight,
    needsScroll,
    scrollViewportHeight,
    scrollRef,
    contentRef,
    syncContentHeight,
    isJoinable,
    pick,
    toggleExpanded,
  }
}
