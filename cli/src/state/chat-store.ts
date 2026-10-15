import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { createChatActions } from './chat-store/chat-actions'
import { initialState } from './chat-store/initial-state'
import { createSidebarActions } from './chat-store/sidebar-actions'

import type { ChatStore } from './chat-store/types'

// Re-export types from the types module to maintain backwards compatibility
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
  ToolHistoryEntry,
  FilesChanged,
  AgentStackEntry,
  ChatStoreState,
  ChatStoreActions,
  ChatCoreActions,
  ChatAliasActions,
  ChatSidebarActions,
  ChatStore,
} from './chat-store/types'

export { getLatestFollowupToolCallId } from './chat-store/find-followup'

/**
 * The chat zustand store (FID-2026-0805-003). State, initial values, and the
 * action factories live in ./chat-store/*; this file is the thin assembly
 * point plus the store-instance-bound convenience aliases.
 */
export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    ...initialState,
    ...createChatActions(set),
    ...createSidebarActions(set),

    // Backwards-compatible convenience methods that delegate to canonical
    // functions. They need the store instance, so they live here (same as
    // before the deconstruction).
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
      useChatStore
        .getState()
        .addPendingAttachment({ ...attachment, kind: 'text' })
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
      useChatStore
        .getState()
        .addPendingAttachment({ ...attachment, kind: 'file' })
    },
  })),
)
