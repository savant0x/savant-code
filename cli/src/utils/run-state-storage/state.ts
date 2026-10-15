import * as fs from 'fs'

import { getCurrentChatDir } from '../../project-files'

import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

export const RUN_STATE_FILENAME = 'run-state.json'

export type SavedChatState = {
  runState: RunState
  messages: ChatMessage[]
  chatId?: string
}

export type LiveChatState = {
  runState: RunState
  messages: ChatMessage[]
}

type LiveChatStateProvider = {
  ownerId: string
  chatDir: string
  provide: () => LiveChatState | null
}

/**
 * FID-2026-0809-015: consolidated module-level mutable state. All mutation
 * sites live in this module; sibling modules (save/load/paths) read and write
 * through the exported accessors so a split cannot scatter state.
 */
const runtimeState: {
  liveChatStateProvider: LiveChatStateProvider | null
  chatDirOverride: string | undefined
  pendingCheckpoints: Map<string, LiveChatState>
  checkpointDrain: Promise<void> | null
} = {
  liveChatStateProvider: null,
  chatDirOverride: undefined,
  pendingCheckpoints: new Map(),
  checkpointDrain: null,
}

export function getLiveChatStateProvider(): LiveChatStateProvider | null {
  return runtimeState.liveChatStateProvider
}

/**
 * Register a provider for the in-flight chat state. While a run is active,
 * exit paths call flushLiveChatState() to persist the latest checkpoint so a
 * quit/crash doesn't lose the turn. ownerId ties the provider to a specific
 * run so a stale run can't clear a newer run's provider. The chat directory
 * is captured at registration time so a later chat switch can't redirect the
 * flush into a different chat's directory.
 */
export function setLiveChatStateProvider(
  ownerId: string,
  provide: () => LiveChatState | null,
): void {
  runtimeState.liveChatStateProvider = {
    ownerId,
    chatDir: resolveCurrentChatDir(),
    provide,
  }
}

export function clearLiveChatStateProvider(ownerId: string): void {
  if (runtimeState.liveChatStateProvider?.ownerId === ownerId) {
    runtimeState.liveChatStateProvider = null
  }
}

// Test-only escape hatch: persistence normally resolves the chat directory
// through project-files (under the user's real config dir). Tests point it at
// a temp directory instead of mocking module internals — mock.module leaks
// across bun test files and os.homedir() ignores $HOME on macOS, so both of
// those seams are unreliable (see docs/testing.md: DI over module mocking).
export function setChatDirOverrideForTesting(dir: string | undefined): void {
  runtimeState.chatDirOverride = dir
}

/**
 * Resolve the directory of the currently active chat. Persistence callers
 * must capture this at the moment the state is captured (run start, snapshot
 * time) and pass it through to the save — resolving it again at write time
 * races with chat switches (/new, resuming from /history) and would write one
 * chat's transcript into another chat's directory.
 */
export function resolveCurrentChatDir(): string {
  if (runtimeState.chatDirOverride) {
    fs.mkdirSync(runtimeState.chatDirOverride, { recursive: true })
    return runtimeState.chatDirOverride
  }
  return getCurrentChatDir()
}

export function getChatDirOverride(): string | null {
  return runtimeState.chatDirOverride ?? null
}

export function getPendingCheckpoints(): Map<string, LiveChatState> {
  return runtimeState.pendingCheckpoints
}

export function getCheckpointDrain(): Promise<void> | null {
  return runtimeState.checkpointDrain
}

export function setCheckpointDrain(drain: Promise<void> | null): void {
  runtimeState.checkpointDrain = drain
}
