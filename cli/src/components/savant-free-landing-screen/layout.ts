import { AD_CARD_HEIGHT } from '../ad-banner'
import { LANDING_HEADING } from './format'

/** Inputs to the picker height budget. Every term mirrors the real layout
 *  exactly (no padded estimate, no blanket safety row) so the scrollbox fills
 *  the available space with no dead band below it. */
export interface LandingLayoutInput {
  terminalHeight: number
  contentMaxWidth: number
  logoMode: 'full' | 'text' | 'none'
  logoLines: number
  showAds: boolean
  showBelowPickerCounter: boolean
  counterText: string
  limitedModeNotice: string | null
  streakBonusNote: string | null
  reserveStreakSlot: boolean
  streakOnHeadingRow: boolean
}

export interface LandingLayout {
  selectorMaxHeight: number
}

// Rows the picker may occupy = terminal height minus the fixed chrome around
// it:
//   - top bar: paddingTop 1 + the ✕ row = 2
//   - ad banner: AD_CARD_HEIGHT, only when shown
//   - main box: its paddingTop (text-logo tier only) + paddingBottom 1
//   - logo block: lines + marginBottom 1 (always, when shown) + gap (full)
//   - the prompt/counter (landing)
// Line wrapping is derived from the actual strings vs contentMaxWidth, so a
// wrapped counter is accounted for precisely instead of guessed at.
export function computeLandingLayout(input: LandingLayoutInput): LandingLayout {
  const {
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
  } = input
  const textMarginBottom = 1
  const wrappedRows = (text: string) =>
    Math.max(1, Math.ceil(text.length / contentMaxWidth))
  const logoBlockRows =
    logoMode === 'none'
      ? 0
      : logoLines + 1 /* marginBottom */ + (logoMode === 'full' ? 1 : 0)
  const mainPaddingRows = (logoMode === 'text' ? 1 : 0) + 1
  const adRows = showAds ? AD_CARD_HEIGHT : 0
  // Status lines render below the picker, each with marginTop 1: the session
  // counter (landing only), then the limited-mode notice, then the streak.
  // They still eat into the picker's height budget regardless of being above
  // or below it. Placement varies: on a wide landing screen the streak shares
  // the heading row (0 extra rows, already counted in landingTextRows); on a
  // narrow landing screen it drops to its own line under the heading (1 row,
  // no top margin).
  const streakRows = !reserveStreakSlot ? 0 : streakOnHeadingRow ? 0 : 1
  const noticeRows = limitedModeNotice
    ? 1 /* marginTop */ + wrappedRows(limitedModeNotice)
    : 0
  // Streak perk note (landing, streak >= 7): one marginTop row + wrap.
  const streakBonusRows = streakBonusNote
    ? 1 /* marginTop */ + wrappedRows(streakBonusNote)
    : 0
  // The referral/GLM card now lives inside the model selector's scrollbox, so
  // only genuinely fixed status lines below the selector reduce its viewport.
  const belowPickerRows = streakRows + noticeRows + streakBonusRows
  const counterRows = showBelowPickerCounter
    ? 1 /* marginTop */ + wrappedRows(counterText)
    : 0
  const reservedChrome = 2 + adRows + mainPaddingRows + logoBlockRows
  const landingTextRows =
    wrappedRows(LANDING_HEADING) +
    textMarginBottom +
    counterRows +
    belowPickerRows
  return {
    selectorMaxHeight: Math.max(
      3,
      terminalHeight - reservedChrome - landingTextRows,
    ),
  }
}
