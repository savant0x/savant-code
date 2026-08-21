import { TextAttributes } from '@opentui/core'
import { useRenderer } from '@opentui/react'
import React from 'react'

import { ChoiceAdBanner, AD_CARD_HEIGHT } from './ad-banner'
import { Button } from './button'
import { SavantFreeModelSelector } from './savant-free-model-selector'
import { useSavantFreeLandingState } from '../hooks/use-savant-free-landing-state'
import { exitSavantFreeCleanly } from '../utils/savant-free-exit'
import { LANDING_HEADING } from './savant-free-landing-screen/format'
import {
  BannedPanel,
  CountryBlockedPanel,
  RateLimitedPanel,
} from './savant-free-landing-screen/status-panels'
import { StreakInlineLine } from './savant-free-landing-screen/streak-line'
import { TakeoverPrompt } from './savant-free-landing-screen/takeover-prompt'

import type { SavantFreeSession } from '../types/savant-free-session'

interface SavantFreeLandingScreenProps {
  session: SavantFreeSession | null
  error: string | null
}

export const SavantFreeLandingScreen: React.FC<
  SavantFreeLandingScreenProps
> = ({ session, error }) => {
  useRenderer()
  const {
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
  } = useSavantFreeLandingState({ session })

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: theme.background,
      }}
    >
      {/* Top-right exit affordance for mouse users; width '100%' is required
            for justifyContent to push the X right. */}
      <box
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 1,
          paddingLeft: 2,
          paddingRight: 2,
          flexShrink: 0,
        }}
      >
        {/* Empty spacer: justifyContent space-between needs a left sibling to
            keep the ✕ pushed to the right. */}
        <box />
        <Button
          onClick={exitSavantFreeCleanly}
          onMouseOver={() => setExitHover(true)}
          onMouseOut={() => setExitHover(false)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
        >
          <text
            style={{ fg: exitHover ? theme.foreground : theme.muted }}
            attributes={TextAttributes.BOLD}
          >
            ✕
          </text>
        </Button>
      </box>

      <box
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          alignItems: 'center',
          // Full logo: anchor the clump low (flex-end), matching how chat pins
          // its header/messages to the input bar. Text wordmark: center the
          // clump so a short (collapsed) picker reads as a balanced card instead
          // of leaving a void above the ad. No logo (tiny terminals): hug the
          // top, since the content nearly fills the height anyway and centering
          // would just shave rows off the top.
          justifyContent:
            logoMode === 'full'
              ? 'flex-end'
              : logoMode === 'text'
                ? 'center'
                : 'flex-start',
          paddingLeft: 2,
          paddingRight: 2,
          // A row of breathing room under the top bar for the text logo; the
          // full logo brings its own spacing and the tiniest (no-logo) screens
          // can't spare the row.
          paddingTop: logoMode === 'text' ? 1 : 0,
          paddingBottom: 1,
          gap: logoMode === 'full' ? 1 : 0,
        }}
      >
        {logoMode !== 'none' && (
          <box style={{ marginBottom: 1, flexShrink: 0 }}>{logoComponent}</box>
        )}

        <box
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            maxWidth: contentMaxWidth,
          }}
        >
          {error && (!session || session.status === 'none') && (
            <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
              ⚠ {error}
            </text>
          )}

          {!session && !error && (
            <text style={{ fg: theme.muted }}>Connecting...</text>
          )}

          {isLanding && (
            <box
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0,
              }}
            >
              <box
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  alignSelf: 'stretch',
                  marginBottom: 1,
                }}
              >
                <text style={{ wrapMode: 'word' }}>
                  <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
                    {LANDING_HEADING}
                  </span>
                </text>
                {streakOnHeadingRow && (
                  <StreakInlineLine streak={streak} marginTop={0} />
                )}
              </box>
              {reserveStreakSlot && !streakOnHeadingRow && (
                <StreakInlineLine streak={streak} marginTop={0} />
              )}
              <SavantFreeModelSelector
                maxHeight={selectorMaxHeight}
                onExpandedChange={setSelectorExpanded}
              />
              {showBelowPickerCounter && (
                <text
                  style={{
                    fg: theme.muted,
                    marginTop: 1,
                    wrapMode: 'word',
                  }}
                >
                  <span fg={sessionUsedColor}>
                    {formattedSharedSessionUsed} of {sessionLimit}{' '}
                    {sessionLabel} used
                  </span>
                  <span fg={theme.muted}>
                    {', '}
                    resets in {sessionResetCountdown}
                  </span>
                </text>
              )}
              {limitedModeNotice && (
                <text
                  style={{ fg: theme.muted, wrapMode: 'word', marginTop: 1 }}
                >
                  {limitedModeNotice}
                </text>
              )}
              {streakBonusNote && (
                <text
                  style={{ fg: theme.primary, wrapMode: 'word', marginTop: 1 }}
                >
                  {streakBonusNote}
                </text>
              )}
            </box>
          )}

          {session?.status === 'takeover_prompt' && <TakeoverPrompt />}

          {session?.status === 'country_blocked' && (
            <CountryBlockedPanel session={session} />
          )}

          {session?.status === 'banned' && <BannedPanel />}

          {session?.status === 'rate_limited' && (
            <RateLimitedPanel session={session} />
          )}
        </box>
      </box>

      {/* Reserve the ad slot before the async fetch resolves so content does
            not jump when the banner fills; dropped on very short terminals. */}
      {showAds && (
        <box
          style={{
            width: '100%',
            flexShrink: 0,
            height: AD_CARD_HEIGHT,
          }}
        >
          {ads ? (
            <ChoiceAdBanner
              ads={ads}
              onClick={recordClick}
              onImpression={recordImpression}
            />
          ) : (
            <text style={{ fg: theme.muted }}>{'─'.repeat(terminalWidth)}</text>
          )}
        </box>
      )}
    </box>
  )
}
