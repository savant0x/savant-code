import { isSavantFreePremiumModelId } from '@savant-code/common/constants/savant-free-models'

import { TOGGLE_ID } from './layout'

import type { Section } from './layout'
import type { SavantFreeReferralFocusTarget } from '../savant-free-referral-banner'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type {
  SavantFreeAccessTier,
  SavantFreeModel,
} from '@savant-code/common/constants/savant-free-models'
import type { getReferralInfo } from '@savant-code/common/types/savant-free-session'
import type React from 'react'

/** Everything the render path needs, computed from session state + the
 *  terminal's width budget. The picker component stays a thin presentational
 *  shell; all state, effects, and callbacks live in the hook. */
export interface ModelSelectorState {
  accessTier: SavantFreeAccessTier
  deploymentAvailabilityLabel: string
  pending: string | null
  hoveredId: string | null
  setHoveredId: React.Dispatch<React.SetStateAction<string | null>>
  availableModels: readonly SavantFreeModel[]
  recommendedModel: SavantFreeModel
  canCollapse: boolean
  expanded: boolean
  focusedId: string
  setFocusedId: React.Dispatch<React.SetStateAction<string>>
  extraTargets: readonly SavantFreeReferralFocusTarget[]
  setExtraTargets: React.Dispatch<
    React.SetStateAction<SavantFreeReferralFocusTarget[]>
  >
  sections: readonly Section[]
  navIds: readonly string[]
  committedModelId: string | null
  referral: ReturnType<typeof getReferralInfo>
  premiumUsed: number
  premiumExhausted: boolean
  premiumResetCountdown: string | null
  wrapDetails: boolean
  buttonOuterWidth: number
  nameColumnWidth: number
  recommendedOneLineLen: number
  contentHeight: number
  needsScroll: boolean
  scrollViewportHeight: number
  scrollRef: React.MutableRefObject<ScrollBoxRenderable | null>
  contentRef: React.MutableRefObject<BoxRenderable | null>
  syncContentHeight: () => void
  isJoinable: (modelId: string) => boolean
  pick: (modelId: string) => void
  toggleExpanded: () => void
}

/**
 * Group the non-recommended models into render sections: limited tier shows a
 * single section; full tier splits PREMIUM vs UNLIMITED (empty sections are
 * dropped). Pure — the hook memoizes over this.
 */
export function buildSelectorSections(
  expanded: boolean,
  accessTier: SavantFreeAccessTier,
  otherModels: readonly SavantFreeModel[],
): readonly Section[] {
  if (!expanded) return [] as readonly Section[]
  if (accessTier === 'limited') {
    return [
      { key: 'limited', label: '', models: otherModels },
    ] satisfies readonly Section[]
  }
  return (
    [
      {
        key: 'premium',
        label: 'PREMIUM',
        models: otherModels.filter((m) => isSavantFreePremiumModelId(m.id)),
      },
      {
        key: 'unlimited',
        label: 'UNLIMITED',
        models: otherModels.filter((m) => !isSavantFreePremiumModelId(m.id)),
      },
    ] satisfies readonly Section[]
  ).filter((section) => section.models.length > 0)
}

/** Model rows in render order: recommended hero first, then the grouped rest. */
export function buildRenderedModelIds(
  recommendedModel: SavantFreeModel,
  sections: readonly Section[],
): string[] {
  return [
    recommendedModel.id,
    ...sections.flatMap((section) => section.models.map((m) => m.id)),
  ]
}

/**
 * Keyboard-navigable ids: the model rows, then the toggle, then any focus
 * targets the referral banner registered (so arrowing down past "see all
 * models" reaches its buttons; nextSavantFreeModelId wraps back to the top).
 */
export function buildSelectorNavIds(
  renderedModelIds: readonly string[],
  canCollapse: boolean,
  extraTargetIds: readonly string[],
): string[] {
  return [
    ...renderedModelIds,
    ...(canCollapse ? [TOGGLE_ID] : []),
    ...extraTargetIds,
  ]
}
