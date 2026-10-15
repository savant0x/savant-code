// Re-export shim (FID-2026-0805-003 methodology; FID-2026-0809-015 Batch A).
// Implementation moved to `run-state-storage/{state,paths,save,load,toggle-ids}.ts`;
// this path keeps exporting the same public surface so no consumer changes.
export {
  clearLiveChatStateProvider,
  getLiveChatStateProvider,
  resolveCurrentChatDir,
  setChatDirOverrideForTesting,
  setLiveChatStateProvider,
} from './run-state-storage/state'

export type { LiveChatState, SavedChatState } from './run-state-storage/state'

export { getChatMessagesPath, getRunStatePath } from './run-state-storage/paths'

export {
  flushLiveChatState,
  saveChatState,
  scheduleCheckpointSave,
  settleCheckpointSave,
} from './run-state-storage/save'

export {
  clearChatState,
  loadMostRecentChatState,
  readRestoredContextTokenCount,
} from './run-state-storage/load'

export { getAllToggleIdsFromMessages } from './run-state-storage/toggle-ids'
