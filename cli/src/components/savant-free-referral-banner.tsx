import { TextAttributes } from '@opentui/core'
import {
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_GLM_V52_REFERRAL_CAP,
} from '@savant-code/common/constants/savant-free-models'
import { REFERRAL_CLI_DAILY_SESSION_BONUS_CAP } from '@savant-code/common/constants/savant-free-referral-tiers'
import { pluralize } from '@savant-code/common/util/string'
import React, { useCallback, useEffect, useState } from 'react'

import { Button } from './button'
import { useCopyToClipboard } from './copy-button'
import {
  COPY_FOCUS_ID,
  GLM_FOCUS_ID,
  CopyInviteLinkButton,
  firstLabelThatFits,
  referralLink,
  shouldStackSavantFreeReferralActions,
} from './referral-copy-button'
import { ReferralQuietLine } from './referral-quiet-line'
import { useNow } from '../hooks/use-now'
import { startSavantFreeSession } from '../hooks/use-savant-free-session'
import { useTheme } from '../hooks/use-theme'
import { LOGIN_WEBSITE_URL } from '../login/constants'
import { safeOpen } from '../utils/open-url'
import { formatSavantFreePremiumResetCountdown } from '../utils/savant-free-premium-reset'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { SavantFreeReferralFocusTarget } from './referral-copy-button'
import type { SavantFreeAccessTier } from '@savant-code/common/constants/savant-free-models'
import type { SavantFreeReferralInfo } from '@savant-code/common/types/savant-free-session'

// Re-export the focus-target contract from the original path (consumers:
// use-model-selector-state + use-keyboard-nav import it as a type).
export type { SavantFreeReferralFocusTarget } from './referral-copy-button'

/**
 * Landing-screen "invite friends" reward ad, tiered by access: LIMITED and
 * FULL-locked render the quiet line + share button; FULL-unlocked renders the
 * GLM 5.2 accent card. Renders nothing without a server `referral` block.
 */
interface SavantFreeReferralBannerProps {
  width: number
  referral: SavantFreeReferralInfo
  accessTier: SavantFreeAccessTier
  focusedId: string
  onFocusTargetsChange: (targets: SavantFreeReferralFocusTarget[]) => void
}

export const SavantFreeReferralBanner: React.FC<
  SavantFreeReferralBannerProps
> = ({ width, referral, accessTier, focusedId, onFocusTargetsChange }) => {
  const theme = useTheme()
  const now = useNow(60_000)
  const [joining, setJoining] = useState(false)
  const [glmHovered, setGlmHovered] = useState(false)
  const copyFocused = focusedId === COPY_FOCUS_ID
  const glmFocused = focusedId === GLM_FOCUS_ID

  const useGlm = useCallback(() => {
    setJoining((wasJoining) => {
      if (wasJoining) return wasJoining
      startSavantFreeSession(SAVANT_FREE_GLM_V52_MODEL_ID).finally(() =>
        setJoining(false),
      )
      return true
    })
  }, [])

  const link = referralLink(referral.code, referral.referrerName)
  const { isCopied, copy } = useCopyToClipboard(link)

  // Register this banner's buttons as keyboard focus targets so the model
  // selector's arrow navigation flows from "see all models" into them (and
  // wraps back up). The limited variant and the full-tier locked state show
  // just the copy button; the full-tier unlocked card leads with "Use GLM 5.2"
  // then the invite button.
  const isLocked =
    accessTier === 'limited' || (referral.weeklySessionsRemaining ?? 0) <= 0
  useEffect(() => {
    onFocusTargetsChange(
      isLocked
        ? [{ id: COPY_FOCUS_ID, activate: copy }]
        : [
            { id: GLM_FOCUS_ID, activate: useGlm },
            { id: COPY_FOCUS_ID, activate: copy },
          ],
    )
    return () => onFocusTargetsChange([])
  }, [isLocked, copy, useGlm, onFocusTargetsChange])

  const { qualifiedCount, githubLinked } = referral

  // LIMITED tier: referrals earn a daily free-session bonus, not GLM. Keep it
  // quiet — one line advertising the perk + the share button below it, with the
  // earned bonus (capped) shown as progress. `qualifiedCount` is the capped
  // bonus sessions/day already earned.
  if (accessTier === 'limited') {
    const atCap = qualifiedCount >= REFERRAL_CLI_DAILY_SESSION_BONUS_CAP
    return (
      <ReferralQuietLine
        isCopied={isCopied}
        focused={copyFocused}
        onCopy={copy}
        width={width}
      >
        {qualifiedCount > 0 ? (
          <>
            <span fg={theme.foreground}>
              +{pluralize(qualifiedCount, 'session')}/day
            </span>
            <span fg={theme.muted}>
              {' '}
              from referrals
              {atCap
                ? ''
                : ` — refer more (${qualifiedCount}/${REFERRAL_CLI_DAILY_SESSION_BONUS_CAP}):`}
            </span>
          </>
        ) : (
          <span fg={theme.muted}>
            Refer friends to unlock more free sessions per day:
          </span>
        )}
      </ReferralQuietLine>
    )
  }

  // FULL tier: GLM 5.2 reward. The GLM-only fields are always present on a
  // full-tier block from the server; default defensively for the wire type.
  const weeklySessionsRemaining = referral.weeklySessionsRemaining ?? 0
  const resetsIn = formatSavantFreePremiumResetCountdown(
    referral.resetAt ? new Date(referral.resetAt) : new Date(now),
    now,
    {
      withDays: true,
    },
  )

  // NOT USABLE: keep it quiet — one line that advertises the reward, with the
  // share link as a clearly-clickable button below it. Message adapts to *why*
  // it's locked — no referrals yet vs. this week's sessions already spent.
  if (weeklySessionsRemaining <= 0) {
    return (
      <ReferralQuietLine
        isCopied={isCopied}
        focused={copyFocused}
        onCopy={copy}
        width={width}
      >
        {qualifiedCount > 0 ? (
          <>
            <span fg={theme.foreground}>GLM 5.2</span>
            <span fg={theme.muted}>
              {' '}
              — weekly sessions used, resets in {resetsIn}. Refer more (
              {qualifiedCount}/{SAVANT_FREE_GLM_V52_REFERRAL_CAP}):
            </span>
          </>
        ) : (
          <>
            <span fg={theme.muted}>Refer friends to access </span>
            <span fg={theme.foreground}>GLM 5.2</span>
            <span fg={theme.muted}>, the most powerful open-source model:</span>
          </>
        )}
      </ReferralQuietLine>
    )
  }

  // USABLE: flashy accent card. Round the (possibly fractional) remaining up to
  // whole sessions for a clean count — an early-ended session leaves a fraction
  // that the user can still spend, so never show 0 here.
  const sessionsLeft = Math.max(1, Math.ceil(weeklySessionsRemaining))
  const stackActions = shouldStackSavantFreeReferralActions(width)
  const actionRowWidth = width - 4 // card border + horizontal padding
  const glmLabel = firstLabelThatFits(actionRowWidth, [
    '▶ Use GLM 5.2 ↵',
    '▶ GLM 5.2',
    '▶ GLM',
  ])
  const inviteLabels =
    qualifiedCount >= SAVANT_FREE_GLM_V52_REFERRAL_CAP
      ? [
          `✔ Max sessions earned (${qualifiedCount}/${SAVANT_FREE_GLM_V52_REFERRAL_CAP})`,
          '✔ Max earned',
          '✔ Invite',
        ]
      : [
          `⎘ Invite for +1/wk (${qualifiedCount}/${SAVANT_FREE_GLM_V52_REFERRAL_CAP})`,
          '⎘ Invite +1/wk',
          '⎘ Invite',
        ]
  const githubLabel =
    actionRowWidth >=
    'Signed up with Google? Connect GitHub to qualify ↗'.length
      ? 'Signed up with Google? Connect GitHub to qualify ↗'
      : 'Connect GitHub to qualify ↗'

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        paddingLeft: 1,
        paddingRight: 1,
        borderStyle: 'rounded',
        borderColor: theme.muted,
        marginTop: 1,
        width,
        // Never let a height-starved landing column squash the card — that
        // would draw the bordered action buttons on top of the status line.
        flexShrink: 0,
      }}
      border={['top', 'bottom', 'left', 'right']}
      title=" ✦ GLM 5.2 unlocked "
      titleAlignment="left"
    >
      <text style={{ wrapMode: 'word' }}>
        <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
          {pluralize(sessionsLeft, 'session')}
        </span>
        <span fg={theme.foreground}> available this week</span>
        <span fg={theme.muted}> · resets in {resetsIn}</span>
      </text>

      <box
        style={{
          flexDirection: stackActions ? 'column' : 'row',
          alignItems: stackActions ? 'flex-start' : 'center',
          gap: stackActions ? 0 : 2,
        }}
      >
        <Button
          id={GLM_FOCUS_ID}
          onClick={useGlm}
          onMouseOver={() => setGlmHovered(true)}
          onMouseOut={() => setGlmHovered(false)}
          border
          borderStyle="rounded"
          // Standard button treatment: muted border at rest, green when
          // keyboard-focused, brighter on hover — same scheme as the
          // "Copy invite link" button below it.
          borderColor={
            glmFocused
              ? theme.primary
              : glmHovered
                ? theme.foreground
                : theme.border
          }
          customBorderChars={BORDER_CHARS}
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: 'transparent',
          }}
        >
          <text style={{ wrapMode: 'none' }}>
            <span
              fg={
                joining
                  ? theme.muted
                  : glmFocused || glmHovered
                    ? theme.foreground
                    : theme.muted
              }
              attributes={TextAttributes.BOLD}
            >
              {joining ? 'Starting…' : glmLabel}
            </span>
          </text>
        </Button>
        <CopyInviteLinkButton
          isCopied={isCopied}
          focused={copyFocused}
          onCopy={copy}
          availableWidth={actionRowWidth}
          labels={inviteLabels}
        />
      </box>

      {!githubLinked && (
        <Button
          onClick={() => void safeOpen(`${LOGIN_WEBSITE_URL}/web/settings`)}
        >
          <text style={{ wrapMode: 'word' }}>
            <span fg={theme.secondary}>{githubLabel}</span>
          </text>
        </Button>
      )}
    </box>
  )
}
