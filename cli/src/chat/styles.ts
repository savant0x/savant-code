import type { ChatTheme } from '../types/theme-system'

// FID-007 S2: sidebar tool list — hoisted (stable identity so RightSidebar's
// React.memo can skip) and cross-checked against
// common/src/tools/constants.ts. The previous inline list named tools that do
// NOT exist in the executor allowlist (read_file, search_files, bash).
export const SIDEBAR_TOOLS_AVAILABLE = [
  'read_files',
  'code_search',
  'apply_patch',
  'run_terminal_command',
]

// FID-007 D7: hoisted static style objects so the render loop stops
// allocating fresh style identities every render/tick.
export const CHAT_ROOT_STYLE = {
  flexDirection: 'row', // Horizontal split: chat + sidebar
  gap: 0,
  flexGrow: 1,
  // FID-2026-0816-007 step 2: the chat root is the positioning context for
  // absolutely-positioned overlays (picker dialog chrome).
  position: 'relative',
} as const

/** Shared base surface for the chat and sidebar; nested wrappers intentionally inherit it. */
export const createChatSurfaceStyle = (backgroundColor: string) => ({
  flexGrow: 1,
  backgroundColor,
})

/** Shared sidebar geometry and base surface contract. */
export const createSidebarSurfaceStyle = (backgroundColor: string) => ({
  flexDirection: 'column' as const,
  width: 40,
  height: '100%' as const,
  flexGrow: 1,
  flexShrink: 0,
  shouldFill: true,
  backgroundColor,
})

/**
 * Single sanctioned scrollbar factory app-wide (FID-2026-0823-002): every
 * vertical scrollbox must spread this into verticalScrollbarOptions so no
 * surface ever falls back to OpenTUI's vendored gray defaults (#9a9ea3
 * thumb / #252527 track). OpenTUI SliderRenderable semantics verified against
 * the vendored source: foregroundColor renders the THUMB, backgroundColor the
 * track.
 */
export const createChatScrollbarOptions = (theme: ChatTheme) => ({
  trackOptions: {
    width: 1,
    backgroundColor: theme.scrollbarTrack,
    foregroundColor: theme.scrollbarThumb,
  },
})

export const HEADER_BOX_STYLE = { flexDirection: 'column' } as const

export const SCROLLBOX_STYLE = {
  flexGrow: 1,
  rootOptions: {
    flexGrow: 1,
    padding: 0,
    gap: 0,
    flexDirection: 'row',
    shouldFill: true,
    backgroundColor: 'transparent',
  },
  wrapperOptions: {
    flexGrow: 1,
    border: false,
    shouldFill: true,
    backgroundColor: 'transparent',
    flexDirection: 'column',
  },
  contentOptions: {
    flexDirection: 'column',
    gap: 0,
    shouldFill: true,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingLeft: 1,
    paddingRight: 2,
  },
} as const

export const BOTTOM_BOX_STYLE = {
  flexShrink: 0,
  backgroundColor: 'transparent',
} as const
