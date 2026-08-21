// Layout constants for responsive breakpoints
export const LAYOUT = {
  // Content width constraints
  MAX_CONTENT_WIDTH: 80,
  PREFERRED_CONTENT_WIDTH: 60,
  CONTENT_PADDING: 4,

  // Essential element heights (always shown)
  INPUT_HEIGHT: 1,
  BOTTOM_BAR_HEIGHT: 2,
  MIN_LIST_HEIGHT: 2, // Minimum rows to show in file picker
  MAX_LIST_HEIGHT: 12,

  // Compact mode threshold - below this, remove padding/margins
  COMPACT_MODE_THRESHOLD: 12,

  // Decorative element heights
  LOGO_HEIGHT: 8,
  HELP_TEXT_HEIGHT: 2,

  // Spacing constants (used in normal mode)
  MAIN_CONTENT_PADDING: 2,
  LOGO_MARGIN_TOP: 1,
  LOGO_MARGIN_BOTTOM: 1,
  HELP_TEXT_MARGIN_BOTTOM: 1,
  RECENTS_MARGIN_TOP: 1,
  RECENTS_PADDING_LEFT: 1,
} as const

export interface ProjectPickerLayout {
  contentMaxWidth: number
  contentWidth: number
  isCompactMode: boolean
  mainPadding: number
  canShowFilePicker: boolean
  maxListHeight: number
  canShowLogo: boolean
  canShowHelpText: boolean
  canShowRecents: boolean
  maxRecentsToShow: number
  shouldCenterContent: boolean
}

/**
 * Pure responsive layout computation for the project picker. Given terminal
 * dimensions and the recent-projects count, it allocates vertical space to
 * the file picker, recents list, logo, and help text by priority.
 */
export function computeProjectPickerLayout(
  terminalWidth: number,
  terminalHeight: number,
  recentProjectsCount: number,
): ProjectPickerLayout {
  const contentMaxWidth = Math.min(
    terminalWidth - LAYOUT.CONTENT_PADDING,
    LAYOUT.MAX_CONTENT_WIDTH,
  )
  const contentWidth = Math.min(LAYOUT.PREFERRED_CONTENT_WIDTH, contentMaxWidth)

  // Compact mode: remove padding/margins when space is tight
  const isCompactMode = terminalHeight < LAYOUT.COMPACT_MODE_THRESHOLD
  const mainPadding = isCompactMode ? 0 : LAYOUT.MAIN_CONTENT_PADDING

  // Calculate essential height first (these always show)
  // Essential = input (1) + file picker border (2) + bottom bar (2) + minimal padding
  const essentialHeight =
    LAYOUT.INPUT_HEIGHT + 2 + LAYOUT.BOTTOM_BAR_HEIGHT + (isCompactMode ? 0 : 2)

  // Calculate remaining height for file picker and optional elements
  const remainingHeight = terminalHeight - essentialHeight

  // File picker gets priority - calculate how much space it needs
  const filePickerHeight = Math.max(
    LAYOUT.MIN_LIST_HEIGHT,
    Math.min(remainingHeight, LAYOUT.MAX_LIST_HEIGHT),
  )

  // After file picker, calculate space for optional elements
  const spaceAfterFilePicker = remainingHeight - filePickerHeight

  // Determine which optional elements can fit (priority: recents first, then logo, then help text)
  const logoHeightNeeded =
    LAYOUT.LOGO_HEIGHT +
    (isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_TOP + LAYOUT.LOGO_MARGIN_BOTTOM)
  const helpTextHeightNeeded =
    LAYOUT.HELP_TEXT_HEIGHT +
    (isCompactMode ? 0 : LAYOUT.HELP_TEXT_MARGIN_BOTTOM)

  // Allocate space for optional elements based on available space
  let availableForOptional = spaceAfterFilePicker

  // Try to fit recents first (most useful)
  let recentsToShow = 0
  if (recentProjectsCount > 0 && availableForOptional >= 2) {
    // Calculate how many recents fit
    const baseRecentsHeight =
      1 + (isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP) // header + margin
    const remainingForRecents = availableForOptional - baseRecentsHeight
    recentsToShow = Math.min(
      recentProjectsCount,
      Math.max(0, remainingForRecents),
      3,
    )
    if (recentsToShow > 0) {
      availableForOptional -=
        recentsToShow + 1 + (isCompactMode ? 0 : LAYOUT.RECENTS_MARGIN_TOP)
    }
  }

  // Try to fit logo (decorative but nice)
  const canShowLogo = !isCompactMode && availableForOptional >= logoHeightNeeded
  if (canShowLogo) {
    availableForOptional -= logoHeightNeeded
  }

  // Try to fit help text (least important)
  const canShowHelpText =
    !isCompactMode && availableForOptional >= helpTextHeightNeeded

  // File picker is always shown if there's any space
  const canShowFilePicker = remainingHeight >= LAYOUT.MIN_LIST_HEIGHT

  // Center content only in non-compact mode when there's extra space
  const shouldCenterContent = !isCompactMode && spaceAfterFilePicker > 10

  return {
    contentMaxWidth,
    contentWidth,
    isCompactMode,
    mainPadding,
    canShowFilePicker,
    maxListHeight: filePickerHeight,
    canShowLogo,
    canShowHelpText,
    canShowRecents: recentsToShow > 0,
    maxRecentsToShow: recentsToShow,
    shouldCenterContent,
  }
}
