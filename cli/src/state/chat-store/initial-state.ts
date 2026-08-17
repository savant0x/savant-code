import { getAdsEnabled } from '../../commands/ads'
import {
  loadModePreference,
  loadPermissionModePreference,
} from '../../utils/settings'

import type { ChatStoreState } from './types'
import type { InputMode } from '../../utils/input-modes'

export const generateSessionId = () => crypto.randomUUID()

export const initialState: ChatStoreState = {
  chatSessionId: generateSessionId(),
  messages: [],
  streamingAgents: new Set<string>(),
  focusedAgentId: null,
  inputValue: '',
  cursorPosition: 0,
  lastEditDueToNav: false,
  inputFocused: true, // Cursor visible by default
  isFocusSupported: false, // Don't blink until terminal support is detected
  activeSubagents: new Set<string>(),
  isChainInProgress: false,
  slashSelectedIndex: 0,
  agentSelectedIndex: 0,
  agentMode: loadModePreference(),
  permissionMode: loadPermissionModePreference(),
  hasReceivedPlanResponse: false,
  lastMessageMode: null,
  sessionCreditsUsed: 0,
  runState: null,
  activeTopBanner: null,
  inputMode: 'default' as InputMode,
  adsEnabled: getAdsEnabled(),
  isRetrying: false,
  askUserState: null,
  pendingAttachments: [],
  pendingBashMessages: [],
  suggestedFollowups: null,
  clickedFollowupsMap: new Map<string, Set<number>>(),

  // Sidebar data initial state
  contextTokensUsed: 0,
  contextTokensMax: 200_000,
  // Manual sidebar fold — starts expanded; toggled by Ctrl+B / edge handle.
  sidebarCollapsed: false,
  compactionStatus: null,
  /** FID-2026-0814-006: session compaction counter + bounded lifecycle events. */
  compactionCount: 0,
  compactionEvents: [],
  toolsUsed: [],
  toolHistory: [],
  filesChanged: { modified: 0, created: 0, added: 0, deleted: 0 },
  agentStack: [],
  sessionCost: 0,
  fsmPhase: 'idle',
  devMode: false,
  activity: { kind: 'idle', since: Date.now() },
  provenanceEvents: [],
  teacherState: null,
  /** FID-2026-0718-010: anti-thrash window for onStreamEnded (D2/Q17). */
  lastResetAt: 0,
  /**
   * FID-2026-0718-010: watermark updated by markChunkSeen on every chunk
   * event. StalledResetWatcher reads this to detect 30s of silence (D2/D5).
   */
  _lastChunkAtMs: Date.now(),
}
