// FID-2026-0820-010 Loop 3 — React binding for the gateway client and the
// transcript store. The client is a page-level singleton so StrictMode's dev
// double-mount cannot open two sockets; every mount still subscribes its own
// listeners and unsubscribes on unmount.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'

import { GatewayClient, browserTransportFactory } from '../lib/gateway-client'
import { getGatewayConfig } from '../lib/gateway-config'
import {
  ingestEvents,
  hydratePersistedTranscript,
  pushLocalError,
  pushLocalNotice,
  setWorkspaceThreads,
  updateWorkspaceThread,
  pushLocalUserMessage,
  transcriptStore,
} from '../state/transcript-store'

import type { GatewayStatus, RunCompleteInfo } from '../lib/gateway-client'
import type { GatewayConfig } from '../lib/gateway-config'
import type { WorkspaceScopeType } from '../lib/gateway-protocol'
import type {
  ChatBlock,
  CompactionStatus,
  FidQueueEntry,
  RosterEntry,
  WorkspaceThread,
  AutoDriveHaltState,
} from '../state/transcript-store'

let sharedClient: GatewayClient | null = null
let connectStarted = false

function getClient(): GatewayClient {
  if (sharedClient === null) {
    sharedClient = new GatewayClient({ factory: browserTransportFactory })
  }
  return sharedClient
}

/** Shared-client accessor for non-hook consumers (FID-2026-0824-011 deck driver). */
export function getSharedGatewayClient(): GatewayClient {
  return getClient()
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type UseGatewayResult = {
  bootError: string | null
  status: GatewayStatus
  blocks: ChatBlock[]
  running: boolean
  /** Current Perfection Loop phase (G2-derived from transition_phase results). */
  fsmPhase: string | null
  fidQueue: FidQueueEntry[]
  compactionStatus: CompactionStatus | null
  haltState: AutoDriveHaltState
  haltRun(): Promise<void>
  roster: RosterEntry[]
  workspaceThreads: WorkspaceThread[]
  projectId: string | null
  loadScope(scopeType: WorkspaceScopeType, scopeId: string): Promise<void>
  updateThreadState(
    sessionId: string,
    state: { unread?: boolean; pinned?: boolean },
  ): Promise<void>
  send(text: string): Promise<void>
  respondApproval(approvalId: string, skipped: boolean): Promise<void>
  interrupt(): Promise<void>
}

export function useGateway(): UseGatewayResult {
  const [bootError, setBootError] = useState<string | null>(null)
  const [status, setStatus] = useState<GatewayStatus>('offline')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [haltState, setHaltState] = useState<AutoDriveHaltState>('idle')
  const scopeRequestRef = useRef(0)
  const blocks = useStore(transcriptStore, (state) => state.blocks)
  const running = useStore(transcriptStore, (state) => state.running)
  const fsmPhase = useStore(transcriptStore, (state) => state.fsmPhase)
  const fidQueue = useStore(transcriptStore, (state) => state.fidQueue)
  const roster = useStore(transcriptStore, (state) => state.roster)
  const workspaceThreads = useStore(
    transcriptStore,
    (state) => state.workspaceThreads,
  )
  const compactionStatus = useStore(
    transcriptStore,
    (state) => state.compactionStatus,
  )

  useEffect(() => {
    const client = getClient()
    const offStatus = client.onStatus((nextStatus) => {
      setStatus(nextStatus)
      if (nextStatus === 'ready') setProjectId(client.getProjectId())
    })
    const offEvents = client.onEvents(ingestEvents)
    const offRunComplete = client.onRunComplete((info: RunCompleteInfo) => {
      setHaltState('idle')
      if (!info.ok && info.error !== undefined) {
        pushLocalError(`run failed: ${info.error}`)
      }
    })
    if (!connectStarted) {
      connectStarted = true
      getGatewayConfig()
        .then((config: GatewayConfig) => {
          client.connect(config)
        })
        .catch((error: unknown) => {
          setBootError(describeError(error))
        })
    }
    return () => {
      offStatus()
      offEvents()
      offRunComplete()
    }
  }, [])

  const loadScope = useCallback(
    async (scopeType: WorkspaceScopeType, scopeId: string): Promise<void> => {
      const requestId = scopeRequestRef.current + 1
      scopeRequestRef.current = requestId
      try {
        const result = await getClient().getScopedThreads(scopeType, scopeId)
        if (scopeRequestRef.current !== requestId) return
        setWorkspaceThreads(result.threads)
        const messages = result.threads.flatMap((thread) => thread.messages)
        hydratePersistedTranscript(messages)
      } catch (error) {
        if (scopeRequestRef.current !== requestId) return
        pushLocalError(
          `failed to load ${scopeType} threads: ${describeError(error)}`,
        )
      }
    },
    [],
  )

  const updateThreadState = useCallback(
    async (
      sessionId: string,
      state: { unread?: boolean; pinned?: boolean },
    ): Promise<void> => {
      try {
        const result = await getClient().updateScopedThreadState(
          sessionId,
          state,
        )
        if (result.updated) updateWorkspaceThread(sessionId, state)
      } catch (error) {
        pushLocalError(`failed to update thread: ${describeError(error)}`)
      }
    },
    [],
  )

  const send = useCallback(async (text: string): Promise<void> => {
    // Optimistic local echo: the gateway never broadcasts the operator's
    // own message back, so without this the thread only shows responses.
    pushLocalUserMessage(text)
    setHaltState('idle')
    try {
      await getClient().sendUserMessage(text)
    } catch (error) {
      pushLocalError(describeError(error))
    }
  }, [])

  // v1 note: interactive answer collection is Step 5; this path resolves an
  // approval as skipped (the fail-closed deny shape the gateway records).
  const respondApproval = useCallback(
    async (approvalId: string, skipped: boolean): Promise<void> => {
      try {
        await getClient().respondApproval(approvalId, [], skipped)
      } catch (error) {
        pushLocalError(describeError(error))
      }
    },
    [],
  )

  const interrupt = useCallback(async (): Promise<void> => {
    try {
      await getClient().interrupt()
    } catch (error) {
      pushLocalError(describeError(error))
    }
  }, [])

  const haltRun = useCallback(async (): Promise<void> => {
    setHaltState('requested')
    pushLocalNotice('Emergency halt requested')
    try {
      await getClient().interrupt()
      setHaltState('confirmed')
      pushLocalNotice('Emergency halt accepted by gateway')
    } catch (error) {
      setHaltState('failed')
      pushLocalError(`emergency halt failed: ${describeError(error)}`)
    }
  }, [])

  return {
    bootError,
    status,
    blocks,
    running,
    fsmPhase,
    fidQueue,
    compactionStatus,
    haltState,
    roster,
    workspaceThreads,
    projectId,
    loadScope,
    updateThreadState,
    send,
    respondApproval,
    interrupt,
    haltRun,
  }
}
