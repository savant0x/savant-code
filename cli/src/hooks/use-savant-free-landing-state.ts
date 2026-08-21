import { useRenderer } from '@opentui/react'
import {
  SAVANT_FREE_ENABLE_STREAK_IN_UI,
  SAVANT_FREE_LIMITED_SESSION_LIMIT,
  SAVANT_FREE_PREMIUM_SESSION_LIMIT,
} from '@savant-code/common/constants/savant-free-models'
import {
  getRateLimitsByModel,
  getReferralInfo,
} from '@savant-code/common/types/savant-free-session'
import { useEffect, useState } from 'react'

import { useGravityAd } from './use-gravity-ad'
import { useLogo } from './use-logo'
import { useNow } from './use-now'
import { useSavantFreeCtrlCExit } from './use-savant-free-ctrl-c-exit'
import { refreshSavantFreeLandingMetadata } from './use-savant-free-session'
import { useSavantFreeStreakQuery } from './use-savant-free-streak-query'
import { useTerminalDimensions } from './use-terminal-dimensions'
import { useTheme } from './use-theme'
import { getLimitedModeNotice } from '../components/savant-free-landing-screen/format'
import { computeLandingLayout } from '../components/savant-free-landing-screen/layout'
import { formatSessionUnits } from '../utils/format-session-units'
import {
  formatSavantFreePremiumResetCountdown,
  getSavantFreePremiumResetAt,
} from '../utils/savant-free-premium-reset'
import { getSavantFreeStreakBonusNote } from '../utils/savant-free-streak-line'
import { getLogoAccentColor, getLogoBlockColor } from '../utils/theme-system'

import type { SavantFreeSession } from '../types/savant-free-session'

/**
 * All derived state + hooks for the SavantFree landing screen, extracted from
 * SavantFreeLandingScreen so the component file stays under the line bar
 * (FID-2026-0819-005 quality ratchet: Loop 125). Hook order is identical to
 * the in-component wiring.
 */
export function useSavantFreeLandingState(params: {
  session: SavantFreeSession | null
}) {
  const { session } = params
  const theme = useTheme()
  useRenderer()
  const { terminalWidth, terminalHeight, contentMaxWidth } =
    useTerminalDimensions()
  // Progressive disclosure as the terminal gets shorter (picker must always
  // fit): tall >=40 full 6-line ASCII logo, medium >=20 one-line wordmark,
  // short <20 no logo, tiny <18 also drop the ad banner. Exception: a
  // collapsed referral-free picker shrinks to ~5 rows, so on mid-height
  // windows the wordmark is promoted back to the full logo (fills dead space
  // above the card); a referral card or expanded list keeps the compact
  // wordmark and gives those rows back to the scrollable menu. The picker
  // owns this and reports it via onExpandedChange.
  const [selectorExpanded, setSelectorExpanded] = useState(false)
  const COLLAPSED_LOGO_MIN_HEIGHT = 26
  const hasReferralMenu =
    session?.status === 'none' && Boolean(getReferralInfo(session))
  const fullLogoFits =
    terminalHeight >= 40 ||
    (!selectorExpanded &&
      !hasReferralMenu &&
      terminalHeight >= COLLAPSED_LOGO_MIN_HEIGHT)
  const logoMode: 'full' | 'text' | 'none' = fullLogoFits
    ? 'full'
    : terminalHeight >= 20
      ? 'text'
      : 'none'
  const compact = terminalHeight < 22
  const showAds = terminalHeight >= 18
  const logoLines = logoMode === 'full' ? 6 : logoMode === 'text' ? 1 : 0
  const blockColor = getLogoBlockColor(theme.name)
  const accentColor = getLogoAccentColor(theme.name)
  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    accentColor,
    blockColor,
    // No applySheenToChar — static logo, no animation
    // 'text' forces the one-line variant; 'none' is handled by not rendering.
    maxHeight: logoMode === 'full' ? undefined : 1,
  })
  // Ads always on here (monetization lives here); forceStart bypasses the
  // "wait for first user message" gate. Server tries Gravity first.
  const { ads, recordClick, recordImpression } = useGravityAd({
    enabled: true,
    forceStart: true,
    provider: 'gravity',
    // Legacy wire name for this surface — the ads API maps it to placements,
    // so it must not change with the component rename.
    surface: 'waiting_room',
  })
  useSavantFreeCtrlCExit()
  const [exitHover, setExitHover] = useState(false)
  const accessTier =
    session && 'accessTier' in session ? session.accessTier : 'full'
  // Hidden in compact terminals: the notice is nice-to-have context, and
  // below 22 rows every line competes with the picker itself.
  const limitedModeNotice =
    accessTier === 'limited' && !compact ? getLimitedModeNotice(session) : null
  // 'none' = user hasn't started a session yet. We're in the pre-chat landing
  // state: show the picker with a prompt. Picking a model triggers
  // startSavantFreeSession, which POSTs and transitions straight to 'active' (chat).
  const isLanding = session?.status === 'none'
  const streakQuery = useSavantFreeStreakQuery({
    enabled: SAVANT_FREE_ENABLE_STREAK_IN_UI && isLanding,
  })
  const streak = streakQuery.data?.streak ?? 0
  // Reserve the streak row whenever the feature could appear so the picker
  // doesn't jump when the query resolves or the user crosses from 0 → 1.
  // The component itself renders blank space when streak === 0.
  const reserveStreakSlot =
    SAVANT_FREE_ENABLE_STREAK_IN_UI && isLanding && !compact
  // Once a full week is earned, explain the recurring perk under the picker so
  // the streak reads as worth keeping. Accuracy lives in getSavantFreeStreakBonusNote
  // (daily session bonus, weekly GLM, GLM only for full access).
  const streakBonusNote = reserveStreakSlot
    ? getSavantFreeStreakBonusNote({
        streak,
        accessTier: accessTier === 'limited' ? 'limited' : 'full',
      })
    : null
  // On the landing screen the streak rides on the heading row, right-aligned.
  // Below ~50 cols the heading + dots get squashed together, so drop the streak
  // to its own line under the heading instead.
  const STREAK_INLINE_MIN_WIDTH = 50
  const streakOnHeadingRow =
    reserveStreakSlot && isLanding && contentMaxWidth >= STREAK_INLINE_MIN_WIDTH
  // On the landing picker we tick once a minute so the session reset countdown
  // stays fresh.
  const now = useNow(60000, isLanding)
  // Free-session quota counter for the title line. All free models share one
  // pool; the server replicates the same snapshot under each free model
  // id, so any entry has the right count. Renders amber when exhausted so
  // the limit reads as "you've hit it" rather than just another count.
  const rateLimitsByModel = getRateLimitsByModel(session)
  const sessionRateLimit = rateLimitsByModel
    ? Object.values(rateLimitsByModel)[0]
    : undefined
  const sharedSessionUsed = sessionRateLimit?.recentCount ?? 0
  // Hide the "0 of N used" line for a fresh user — noise on the landing
  // screen. Regular tiers carry the quota inline in the PREMIUM section header,
  // so the below-picker line survives only for the limited tier.
  const showSessionCounter = sharedSessionUsed > 0
  const showBelowPickerCounter = showSessionCounter && accessTier === 'limited'
  const isSessionExhausted =
    sharedSessionUsed >=
    (accessTier === 'limited'
      ? SAVANT_FREE_LIMITED_SESSION_LIMIT
      : SAVANT_FREE_PREMIUM_SESSION_LIMIT)
  const sessionUsedColor = isSessionExhausted ? theme.secondary : theme.muted
  const sessionLimit =
    accessTier === 'limited'
      ? SAVANT_FREE_LIMITED_SESSION_LIMIT
      : SAVANT_FREE_PREMIUM_SESSION_LIMIT
  const sessionLabel =
    accessTier === 'limited' ? 'sessions' : 'premium sessions'
  const formattedSharedSessionUsed = formatSessionUnits(sharedSessionUsed)
  const sessionResetAt = getSavantFreePremiumResetAt({
    rateLimitsByModel,
    nowMs: now,
  })
  const sessionResetAtMs = sessionResetAt.getTime()
  const sessionResetCountdown = formatSavantFreePremiumResetCountdown(
    sessionResetAt,
    now,
  )
  const counterText =
    `${formattedSharedSessionUsed} of ${sessionLimit} ${sessionLabel} used, ` +
    `resets in ${sessionResetCountdown}`
  const { selectorMaxHeight } = computeLandingLayout({
    terminalHeight,
    contentMaxWidth,
    logoMode,
    logoLines,
    showAds,
    showBelowPickerCounter,
    counterText,
    limitedModeNotice,
    streakBonusNote,
    reserveStreakSlot,
    streakOnHeadingRow,
  })
  useEffect(() => {
    if (!isLanding || !sessionRateLimit) return
    const delayMs = Math.max(0, sessionResetAtMs - Date.now() + 1000)
    const timer = setTimeout(() => {
      refreshSavantFreeLandingMetadata().catch(() => {})
    }, delayMs)
    return () => clearTimeout(timer)
  }, [isLanding, sessionRateLimit, sessionResetAtMs])

  return {
    theme,
    terminalWidth,
    contentMaxWidth,
    logoMode,
    logoComponent,
    ads,
    recordClick,
    recordImpression,
    exitHover,
    setExitHover,
    isLanding,
    streak,
    streakOnHeadingRow,
    reserveStreakSlot,
    selectorExpanded,
    setSelectorExpanded,
    selectorMaxHeight,
    showBelowPickerCounter,
    showAds,
    formattedSharedSessionUsed,
    sessionLimit,
    sessionLabel,
    sessionUsedColor,
    sessionResetCountdown,
    limitedModeNotice,
    streakBonusNote,
  }
}
