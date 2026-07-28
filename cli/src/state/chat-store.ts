import { castDraft } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { AGENT_MODES, IS_SAVANT_FREE } from '../utils/constants'
import { clamp } from '../utils/math'
import {
  loadModePreference,
  saveModePreference,
  loadPermissionModePreference,
} from '../utils/settings'

import type { ChatMessage, ContentBlock } from '../types/chat'
import type {
  TopBannerType,
  InputValue,
  AskUserQuestion,
  AnswerState,
  AskUserState,
  PendingImageStatus,
  PendingImageAttachment,
  PendingTextAttachment,
  PendingFileAttachment,
  PendingAttachment,
  PendingImage,
  PendingBashMessage,
  SuggestedFollowup,
  SuggestedFollowupsState,
  ClickedFollowupsMap,
} from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { InputMode } from '../utils/input-modes'
import type { AgentActivity } from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'

// Import types from the types/store module to avoid circular dependencies

// Re-export types from the types/store module to maintain backwards compatibility
export type {
  TopBannerType,
  InputValue,
  AskUserQuestion,
  AnswerState,
  AskUserState,
  PendingImageStatus,
  PendingImageAttachment,
  PendingTextAttachment,
  PendingFileAttachment,
  PendingAttachment,
  PendingImage,
  PendingBashMessage,
  SuggestedFollowup,
  SuggestedFollowupsState,
  ClickedFollowupsMap,
}

export type ToolHistoryEntry = {
  name: string
  timestamp: number
}

export type FilesChanged = {
  modified: number
  created: number
  added: number
  deleted: number
}

export type AgentStackEntry = {
  id: string
  displayName?: string
  isActive: boolean
}

export type ChatStoreState = {
  /** Unique ID for this chat session, regenerated on /new */
  chatSessionId: string
  messages: ChatMessage[]
  streamingAgents: Set<string>
  focusedAgentId: string | null
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputFocused: boolean
  isFocusSupported: boolean
  activeSubagents: Set<string>
  isChainInProgress: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  agentMode: AgentMode
  hasReceivedPlanResponse: boolean
  lastMessageMode: AgentMode | null
  sessionCreditsUsed: number
  runState: RunState | null
  /** The currently active top banner, or null if none */
  activeTopBanner: TopBannerType
  inputMode: InputMode
  isRetrying: boolean
  askUserState: AskUserState
  pendingAttachments: PendingAttachment[]
  pendingBashMessages: PendingBashMessage[]
  suggestedFollowups: SuggestedFollowupsState | null
  /** Persisted clicked indices per toolCallId */
  clickedFollowupsMap: ClickedFollowupsMap

  // Sidebar data
  contextTokensUsed: number
  contextTokensMax: number
  toolsUsed: string[]
  toolHistory: ToolHistoryEntry[]
  filesChanged: FilesChanged
  agentStack: AgentStackEntry[]
  sessionCost: number
  fsmPhase: string
  /** Dev override — bypasses all ECHO tool gating when true. */
  devMode: boolean
  /** Sandbox permission mode: safe = deny risky, prompt = ask when possible, unsafe = allow. */
  permissionMode: 'safe' | 'prompt' | 'unsafe'
  /**
   * Runtime activity indicator (FID-2026-0718-009). Distinct from fsmPhase.
   * What the agent is doing RIGHT NOW (tool/model/sub-agent/research).
   */
  activity: AgentActivity
  /**
   * FID-2026-0718-010 (Q17): anti-thrash window stamp. Tracks when
   * onStreamEnded last fired. Resets within 100ms are no-ops to dedupe
   * overlapping resets (finish/abort/slash fired in the same tick).
   */
  lastResetAt: number
  /**
   * FID-2026-0718-010 (D5/Q19): watermark updated by finish-logic.markChunkSeen
   * on every SDK chunk. StalledResetWatcher reads this to detect 30s+
   * silence and auto-reset to idle.
   */
  _lastChunkAtMs: number
}

const findLatestFollowupInBlocks = (
  blocks: ContentBlock[] | undefined,
): string | null => {
  if (!blocks) return null

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    if (block.type === 'tool' && block.toolName === 'suggest_followups') {
      return block.toolCallId
    }
    if (block.type === 'agent') {
      const nested = findLatestFollowupInBlocks(block.blocks)
      if (nested) return nested
    }
  }

  return null
}

export const getLatestFollowupToolCallId = (
  messages: ChatMessage[],
): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const latest = findLatestFollowupInBlocks(messages[i]?.blocks)
    if (latest) return latest
  }
  return null
}

type ChatStoreActions = {
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  setStreamingAgents: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void
  setFocusedAgentId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setInputFocused: (focused: boolean) => void
  setIsFocusSupported: (supported: boolean) => void
  setActiveSubagents: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void
  setIsChainInProgress: (active: boolean) => void
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  setAgentMode: (mode: AgentMode) => void
  toggleAgentMode: () => void
  setHasReceivedPlanResponse: (value: boolean) => void
  setLastMessageMode: (mode: AgentMode | null) => void
  addSessionCredits: (credits: number) => void
  setRunState: (runState: RunState | null) => void
  setActiveTopBanner: (banner: TopBannerType) => void
  closeTopBanner: () => void
  setInputMode: (mode: InputMode) => void
  setIsRetrying: (retrying: boolean) => void
  setAskUserState: (state: AskUserState) => void
  updateAskUserAnswer: (questionIndex: number, optionIndex: number) => void
  updateAskUserOtherText: (questionIndex: number, text: string) => void
  addPendingAttachment: (attachment: PendingAttachment) => void
  removePendingAttachment: (id: string) => void
  clearPendingAttachments: () => void
  // Convenience aliases for backwards compatibility
  addPendingImage: (image: Omit<PendingImageAttachment, 'kind'>) => void
  removePendingImage: (path: string) => void
  clearPendingImages: () => void
  addPendingTextAttachment: (attachment: Omit<PendingTextAttachment, 'kind'>) => void
  removePendingTextAttachment: (id: string) => void
  clearPendingTextAttachments: () => void
  addPendingFileAttachment: (attachment: Omit<PendingFileAttachment, 'kind'>) => void
  addPendingBashMessage: (message: PendingBashMessage) => void
  updatePendingBashMessage: (
    id: string,
    updates: Partial<PendingBashMessage>,
  ) => void
  removePendingBashMessage: (id: string) => void
  clearPendingBashMessages: () => void
  setSuggestedFollowups: (state: SuggestedFollowupsState | null) => void
  markFollowupClicked: (toolCallId: string, index: number) => void
  reset: () => void

  // Sidebar data actions
  updateContextTokens: (used: number) => void
  updateContextTokensMax: (max: number) => void
  addToolUsed: (toolName: string) => void
  addToolHistory: (toolName: string) => void
  incrementFilesChanged: (type: 'modified' | 'created' | 'added' | 'deleted') => void
  updateAgentStack: (stack: AgentStackEntry[]) => void
  updateSessionCost: (cost: number) => void
  resetSidebarData: () => void
  /** Set the current ECHO FSM phase (wired from transition_phase tool results). */
  setFsmPhase: (phase: string) => void
  /** Set the runtime activity indicator (FID-2026-0718-009). */
  setActivity: (activity: AgentActivity) => void
  /** Reset FSM phase to idle when a new user message is sent. */
  onNewUserMessage: () => void
  /**
   * FID-2026-0718-010 (F2): single canonical end-of-stream reset. Clears
   * fsmPhase, activity, streamingAgents, activeSubagents, isChainInProgress.
   * Idempotent; guarded by isRetrying + 100ms anti-thrash window (Q17).
   */
  onStreamEnded: (reason: string) => void
  /**
   * FID-2026-0718-010 (F3/D5): stamp the last chunk timestamp for the
   * stalled-reset watchdog. Called from finish-logic.markChunkSeen.
   */
  markChunkSeen: () => void
  /** Toggle dev override mode on/off. */
  setDevMode: (active: boolean) => void
  /** Set the sandbox permission mode. */
  setPermissionMode: (mode: 'safe' | 'prompt' | 'unsafe') => void
}

type ChatStore = ChatStoreState & ChatStoreActions

const generateSessionId = () => crypto.randomUUID()

const initialState: ChatStoreState = {
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
  isRetrying: false,
  askUserState: null,
  pendingAttachments: [],
  pendingBashMessages: [],
  suggestedFollowups: null,
  clickedFollowupsMap: new Map<string, Set<number>>(),

  // Sidebar data initial state
  contextTokensUsed: 0,
  contextTokensMax: 200_000,
  toolsUsed: [],
  toolHistory: [],
  filesChanged: { modified: 0, created: 0, added: 0, deleted: 0 },
  agentStack: [],
  sessionCost: 0,
  fsmPhase: 'idle',
  devMode: false,
  activity: { kind: 'idle', since: Date.now() },
  /** FID-2026-0718-010: anti-thrash window for onStreamEnded (D2/Q17). */
  lastResetAt: 0,
  /**
   * FID-2026-0718-010: watermark updated by markChunkSeen on every chunk
   * event. StalledResetWatcher reads this to detect 30s of silence (D2/D5).
   */
  _lastChunkAtMs: Date.now(),
}

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    ...initialState,

    setMessages: (value) =>
      set((state) => {
        state.messages =
          typeof value === 'function' ? value(state.messages) : value
      }),

    setStreamingAgents: (value) =>
      set((state) => {
        state.streamingAgents =
          typeof value === 'function' ? value(state.streamingAgents) : value
      }),

    setFocusedAgentId: (value) =>
      set((state) => {
        state.focusedAgentId =
          typeof value === 'function' ? value(state.focusedAgentId) : value
      }),

    setInputValue: (value) =>
      set((state) => {
        const { text, cursorPosition, lastEditDueToNav } =
          typeof value === 'function'
            ? value({
                text: state.inputValue,
                cursorPosition: state.cursorPosition,
                lastEditDueToNav: state.lastEditDueToNav,
              })
            : value
        state.inputValue = text
        state.cursorPosition = clamp(cursorPosition, 0, text.length)
        state.lastEditDueToNav = lastEditDueToNav
      }),

    setInputFocused: (focused) =>
      set((state) => {
        state.inputFocused = focused
      }),

    setIsFocusSupported: (supported) =>
      set((state) => {
        state.isFocusSupported = supported
      }),

    setActiveSubagents: (value) =>
      set((state) => {
        state.activeSubagents =
          typeof value === 'function' ? value(state.activeSubagents) : value
      }),

    setIsChainInProgress: (active) =>
      set((state) => {
        state.isChainInProgress = active
      }),

    setSlashSelectedIndex: (value) =>
      set((state) => {
        state.slashSelectedIndex =
          typeof value === 'function' ? value(state.slashSelectedIndex) : value
      }),

    setAgentSelectedIndex: (value) =>
      set((state) => {
        state.agentSelectedIndex =
          typeof value === 'function' ? value(state.agentSelectedIndex) : value
      }),

    setAgentMode: (mode) =>
      set((state) => {
        if (IS_SAVANT_FREE) return
        state.agentMode = mode
        saveModePreference(mode)
      }),

    toggleAgentMode: () =>
      set((state) => {
        if (IS_SAVANT_FREE) return
        const currentIndex = AGENT_MODES.indexOf(state.agentMode)
        const nextIndex = (currentIndex + 1) % AGENT_MODES.length
        state.agentMode = AGENT_MODES[nextIndex]
        saveModePreference(state.agentMode)
      }),

    setHasReceivedPlanResponse: (value) =>
      set((state) => {
        state.hasReceivedPlanResponse = value
      }),

    setLastMessageMode: (mode) =>
      set((state) => {
        state.lastMessageMode = mode
      }),

    addSessionCredits: (credits) =>
      set((state) => {
        state.sessionCreditsUsed += credits
      }),

    setRunState: (runState) =>
      set((state) => {
        state.runState = runState ? castDraft(runState) : null
      }),

    setActiveTopBanner: (banner) =>
      set((state) => {
        state.activeTopBanner = banner
      }),

    closeTopBanner: () =>
      set((state) => {
        state.activeTopBanner = null
      }),

    setInputMode: (mode) =>
      set((state) => {
        state.inputMode = mode
      }),

    setIsRetrying: (retrying) =>
      set((state) => {
        state.isRetrying = retrying
      }),

    setAskUserState: (askUserState) =>
      set((state) => {
        state.askUserState = askUserState
      }),

    addPendingAttachment: (attachment) =>
      set((state) => {
        // Don't add duplicates — use path for image/file, id for text
        const id = attachment.kind === 'text' ? attachment.id : attachment.path
        const isDuplicate = state.pendingAttachments.some((a) =>
          a.kind === 'text' ? a.id === id : a.path === id,
        )
        if (!isDuplicate) {
          state.pendingAttachments.push(attachment)
        }
      }),

    removePendingAttachment: (id) =>
      set((state) => {
        state.pendingAttachments = state.pendingAttachments.filter((a) =>
          a.kind === 'text' ? a.id !== id : a.path !== id,
        )
      }),

    clearPendingAttachments: () =>
      set((state) => {
        state.pendingAttachments = []
      }),

    // Backwards-compatible convenience methods that delegate to canonical functions
    addPendingImage: (image) => {
      useChatStore.getState().addPendingAttachment({ ...image, kind: 'image' })
    },

    removePendingImage: (path) => {
      // Clear any auto-remove timer to prevent memory leaks
      // Import dynamically to avoid circular dependency
      import('../utils/pending-attachments')
        .then(({ clearErrorImageTimer }) => {
          clearErrorImageTimer(path)
        })
        .catch(() => {
          // Silently ignore import errors - timer cleanup is best-effort
        })
      useChatStore.getState().removePendingAttachment(path)
    },

    clearPendingImages: () =>
      set((state) => {
        state.pendingAttachments = state.pendingAttachments.filter(
          (a) => a.kind !== 'image',
        )
      }),

    addPendingTextAttachment: (attachment) => {
      useChatStore.getState().addPendingAttachment({ ...attachment, kind: 'text' })
    },

    removePendingTextAttachment: (id) => {
      useChatStore.getState().removePendingAttachment(id)
    },

    clearPendingTextAttachments: () =>
      set((state) => {
        state.pendingAttachments = state.pendingAttachments.filter(
          (a) => a.kind !== 'text',
        )
      }),

    addPendingFileAttachment: (attachment) => {
      useChatStore.getState().addPendingAttachment({ ...attachment, kind: 'file' })
    },

    updateAskUserAnswer: (questionIndex, optionIndex) =>
      set((state) => {
        if (!state.askUserState) return

        const question = state.askUserState.questions[questionIndex]
        const currentAnswer = state.askUserState.selectedAnswers[questionIndex]

        if (question?.multiSelect) {
          // Multi-select: toggle option in array
          const selected = Array.isArray(currentAnswer) ? currentAnswer : []
          const newSelected = selected.includes(optionIndex)
            ? selected.filter((i) => i !== optionIndex) // Remove if already selected
            : [...selected, optionIndex] // Add if not selected

          state.askUserState.selectedAnswers[questionIndex] = newSelected
        } else {
          // Single-select: set option index
          state.askUserState.selectedAnswers[questionIndex] = optionIndex
        }

        // Clear other text when any option is selected (mutually exclusive)
        state.askUserState.otherTexts[questionIndex] = ''
      }),

    updateAskUserOtherText: (questionIndex, text) =>
      set((state) => {
        if (!state.askUserState) return

        state.askUserState.otherTexts[questionIndex] = text

        // Clear selected option(s) when text is entered (mutually exclusive)
        if (text) {
          const question = state.askUserState.questions[questionIndex]
          if (question?.multiSelect) {
            state.askUserState.selectedAnswers[questionIndex] = []
          } else {
            state.askUserState.selectedAnswers[questionIndex] = -1
          }
        }
      }),

    addPendingBashMessage: (message) =>
      set((state) => {
        state.pendingBashMessages.push(message)
      }),

    updatePendingBashMessage: (id, updates) =>
      set((state) => {
        const msg = state.pendingBashMessages.find((m) => m.id === id)
        if (msg) {
          Object.assign(msg, updates)
        }
      }),

    removePendingBashMessage: (id) =>
      set((state) => {
        state.pendingBashMessages = state.pendingBashMessages.filter(
          (m) => m.id !== id,
        )
      }),

    clearPendingBashMessages: () =>
      set((state) => {
        state.pendingBashMessages = []
      }),

    setSuggestedFollowups: (suggestedFollowups) =>
      set((state) => {
        state.suggestedFollowups = suggestedFollowups
      }),

    markFollowupClicked: (toolCallId: string, index: number) =>
      set((state) => {
        // Store in the persistent map
        if (!state.clickedFollowupsMap.has(toolCallId)) {
          state.clickedFollowupsMap.set(toolCallId, new Set<number>())
        }
        state.clickedFollowupsMap.get(toolCallId)!.add(index)

        // Also update the current suggestedFollowups if it matches
        if (state.suggestedFollowups?.toolCallId === toolCallId) {
          state.suggestedFollowups.clickedIndices.add(index)
        }
      }),

    // Sidebar data actions
    updateContextTokens: (used) =>
      set((state) => {
        state.contextTokensUsed = used
      }),

    updateContextTokensMax: (max) =>
      set((state) => {
        state.contextTokensMax = max
      }),

    addToolUsed: (toolName) =>
      set((state) => {
        if (!state.toolsUsed.includes(toolName)) {
          state.toolsUsed.push(toolName)
        }
      }),

    addToolHistory: (toolName) =>
      set((state) => {
        state.toolHistory.push({ name: toolName, timestamp: Date.now() })
        // Keep only last 5 entries
        if (state.toolHistory.length > 5) {
          state.toolHistory = state.toolHistory.slice(-5)
        }
      }),

    incrementFilesChanged: (type) =>
      set((state) => {
        if (type === 'modified') state.filesChanged.modified++
        else if (type === 'created') state.filesChanged.created++
        else if (type === 'added') state.filesChanged.added++
        else if (type === 'deleted') state.filesChanged.deleted++
      }),

    updateAgentStack: (stack) =>
      set((state) => {
        state.agentStack = stack
      }),

    updateSessionCost: (cost) =>
      set((state) => {
        state.sessionCost = cost
      }),

    resetSidebarData: () =>
      set((state) => {
        state.contextTokensUsed = 0
        // contextTokensMax is intentionally NOT reset here. It is derived
        // from the currently selected model and updated reactively by the
        // chat screen (FID-2026-0723-062). Resetting it to 200k would make
        // the sidebar lie after a sidebar reset mid-session.
        state.toolsUsed = []
        state.toolHistory = []
        state.filesChanged = { modified: 0, created: 0, added: 0, deleted: 0 }
        state.agentStack = []
        state.sessionCost = 0
        state.fsmPhase = initialState.fsmPhase
        state.activity = initialState.activity
      }),

    setFsmPhase: (phase) =>
      set((state) => {
        state.fsmPhase = phase
      }),

    setActivity: (activity) =>
      set((state) => {
        state.activity = activity
      }),

    onNewUserMessage: () =>
      set((state) => {
        // Reset FSM phase + activity when the user sends a new message.
        // Unlike onStreamEnded (which guards against isRetrying / anti-thrash),
        // this is the canonical pre-run-zeroing path so it's always safe to
        // fire — even when the run that just ended was mid-retry.
        state.fsmPhase = 'idle'
        state.activity = { kind: 'idle', since: Date.now() }
        state.lastResetAt = Date.now()
      }),

    /**
     * FID-2026-0718-010 (F2): single canonical end-of-stream reset. Called from
     * finally block, abort handler, slash-command bridges, and stalled detector.
     * Idempotent — multiple gates can fire within the 100ms anti-thrash window.
     */
    onStreamEnded: (reason: string) =>
      set((state) => {
        // Guard 1: skip reset during retry (Q15) — retry path will signal
        // its own reset when it terminates.
        if (state.isRetrying) return
        // Guard 2: anti-thrash window (Q17) — first caller within 100ms wins.
        if (Date.now() - state.lastResetAt < 100) return

        state.fsmPhase = 'idle'
        state.activity = { kind: 'idle', since: Date.now() }
        state.streamingAgents = new Set<string>()
        state.activeSubagents = new Set<string>()
        state.isChainInProgress = false
        state.lastResetAt = Date.now()
        // Bump the chunk-seen watermark so the stalled detector sees
        // "freshly reset" and won't immediately retrigger.
        state._lastChunkAtMs = Date.now()
        // The reason parameter is intentionally not stored. Logging handled
        // by finish-logic.resetUiToIdle. Tracing via dev/LEARNINGS.
        void reason
      }),

    /**
     * FID-2026-0718-010 (F3/D5): stamp the last chunk timestamp. Called via
     * markChunkSeen() from finish-logic on every SDK chunk handler.
     * O(1) write.
     */
    markChunkSeen: () =>
      set((state) => {
        state._lastChunkAtMs = Date.now()
      }),

    setDevMode: (active) =>
      set((state) => {
        state.devMode = active
      }),

    setPermissionMode: (mode) =>
      set((state) => {
        state.permissionMode = mode
      }),

    reset: () =>
      set((state) => {
        state.chatSessionId = generateSessionId()
        state.messages = initialState.messages.slice()
        state.streamingAgents = new Set(initialState.streamingAgents)
        state.focusedAgentId = initialState.focusedAgentId
        state.inputValue = initialState.inputValue
        state.cursorPosition = initialState.cursorPosition
        state.lastEditDueToNav = initialState.lastEditDueToNav
        // Terminal capabilities and focus outlive a chat. Resetting these can
        // re-enable animation while the app is still unfocused, and focus
        // support would stay false because the mounted detector only reports
        // support once per subscription.
        state.activeSubagents = new Set(initialState.activeSubagents)
        state.isChainInProgress = initialState.isChainInProgress
        state.slashSelectedIndex = initialState.slashSelectedIndex
        state.agentSelectedIndex = initialState.agentSelectedIndex
        state.agentMode = initialState.agentMode
        state.hasReceivedPlanResponse = initialState.hasReceivedPlanResponse
        state.lastMessageMode = initialState.lastMessageMode
        state.sessionCreditsUsed = initialState.sessionCreditsUsed
        state.runState = initialState.runState
          ? castDraft(initialState.runState)
          : null
        state.activeTopBanner = initialState.activeTopBanner
        state.inputMode = initialState.inputMode
        state.isRetrying = initialState.isRetrying
        state.askUserState = initialState.askUserState
        state.pendingAttachments = []
        state.pendingBashMessages = []
        state.suggestedFollowups = null
        state.clickedFollowupsMap = new Map<string, Set<number>>()

        // Reset sidebar data. contextTokensMax is derived from the active
        // model, so leave it alone — the chat screen effect keeps it correct.
        state.contextTokensUsed = 0
        state.toolsUsed = []
        state.toolHistory = []
        state.filesChanged = { modified: 0, created: 0, added: 0, deleted: 0 }
        state.agentStack = []
        state.sessionCost = 0
        state.fsmPhase = initialState.fsmPhase
        state.activity = initialState.activity
        state.devMode = initialState.devMode
        state.permissionMode = initialState.permissionMode
      }),
  })),
)
