// FID-2026-0820-010 Loop 3 — app shell: splash until the gateway transport is
// ready, then the chat thread. Gateway config comes exclusively through
// lib/gateway-config.ts (one truth — the previously-duplicated inline IPC
// schema is gone); the bearer token stays in memory only and is never
// rendered, logged, or persisted (Law 12).
// FID-2026-0822-012 P1 — the center canvas gains a Deck/Chat toggle;
// ChatThread mounts as the chat projection of DeckView.

import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { AutoDriveDashboard } from './components/chat/AutoDriveDashboard'
import { ChatThread } from './components/chat/ChatThread'
import { CompactionStatusBar } from './components/chat/CompactionStatusBar'
import { ConnectionPill } from './components/chat/ConnectionPill'
import { FidQueuePanel } from './components/chat/FidQueuePanel'
import { PhaseStepper } from './components/chat/PhaseStepper'
import { RosterRail } from './components/chat/RosterRail'
import { ScopeSwitcher } from './components/chat/ScopeSwitcher'
import { SessionStatusPanel } from './components/chat/SessionStatusPanel'
import { DeckView } from './floor/deck-view'
import { useGateway } from './hooks/use-gateway'
import { formatModelLabel } from './lib/model-label'
import { useUpdater, type UpdaterPhase } from './lib/updater'
import { SplashScreen } from './SplashScreen'
import {
  DEFAULT_WORKSPACE_SCOPE,
  nextWorkspaceScope,
} from './state/workspace-scope'

import type { WorkspaceScope } from './state/workspace-scope'
import type { JSX } from 'react'

const LifecycleEventSchema = z.object({
  state: z.string(),
  detail: z.string().nullable(),
})

type LifecycleEventPayload = z.infer<typeof LifecycleEventSchema>

const BOOT_STATE: LifecycleEventPayload = { state: 'booting', detail: null }

function useLifecycleEvents(): LifecycleEventPayload {
  const [lifecycle, setLifecycle] = useState<LifecycleEventPayload>(BOOT_STATE)

  useEffect(() => {
    const subscription = listen<unknown>('gateway-lifecycle', (event) => {
      const parsed = LifecycleEventSchema.safeParse(event.payload)
      if (parsed.success) setLifecycle(parsed.data)
    })
    return () => {
      void subscription.then((unsubscribe) => unsubscribe())
    }
  }, [])

  return lifecycle
}

function UpdateBanner({
  phase,
  accept,
  dismiss,
}: {
  phase: UpdaterPhase
  accept(): void
  dismiss(): void
}): JSX.Element | null {
  if (phase.state === 'available') {
    return (
      <div className="update-banner" role="status">
        <span>
          Update to v{phase.offer.version} is available — the app closes while
          it installs.
        </span>
        <button type="button" onClick={accept}>
          Install
        </button>
        <button type="button" onClick={dismiss}>
          Later
        </button>
      </div>
    )
  }
  if (phase.state === 'error') {
    return (
      <div className="update-banner update-error" role="alert">
        <span>Update check failed: {phase.message}</span>
        <button type="button" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    )
  }
  return null
}

export function App(): JSX.Element {
  const lifecycle = useLifecycleEvents()
  const gateway = useGateway()
  const updater = useUpdater()

  // Sticky session: once the transport has been ready, transient drops
  // (reconnecting/offline) keep the thread mounted with a disabled composer
  // and the connection pill visible (FID Loop-1 Q5 persistent indicator);
  // the splash owns only pre-first-ready boot.
  const [everReady, setEverReady] = useState(false)
  const [workspaceScope, setWorkspaceScope] = useState<WorkspaceScope>(
    DEFAULT_WORKSPACE_SCOPE,
  )
  useEffect(() => {
    if (gateway.status === 'ready') setEverReady(true)
  }, [gateway.status])

  useEffect(() => {
    if (gateway.projectId === null || workspaceScope.type !== 'project') return
    if (workspaceScope.id === gateway.projectId) return
    setWorkspaceScope({
      type: 'project',
      id: gateway.projectId,
      label: gateway.projectId,
    })
  }, [gateway.projectId, workspaceScope])

  useEffect(() => {
    if (
      gateway.status !== 'ready' ||
      (workspaceScope.type === 'project' && gateway.projectId === null)
    )
      return
    void gateway.loadScope(workspaceScope.type, workspaceScope.id)
  }, [gateway.loadScope, gateway.projectId, gateway.status, workspaceScope])

  // The supervisor's terminal state outranks a quiet socket error: surface it
  // on the splash even when no boot exception was recorded.
  const supervisorDead =
    lifecycle.state === 'dead' || lifecycle.state === 'shutting-down'
  const splashError =
    gateway.bootError ??
    (supervisorDead && lifecycle.detail !== null ? lifecycle.detail : null)
  const showChat = everReady && gateway.bootError === null && !supervisorDead

  return (
    <main className="shell shell-app">
      <UpdateBanner
        phase={updater.phase}
        accept={updater.accept}
        dismiss={updater.dismiss}
      />
      {showChat ? (
        <>
          <div className="chat-topbar">
            <PhaseStepper
              phase={gateway.fsmPhase}
              activity={gateway.currentActivity}
            />
            {/* P17: active model badge — captured from the runtime thinking
                activity, mirroring the CLI's AgentStatus model read. P19:
                rendered through the shared display formatter (provider
                trimmed, tier suffixes stripped). */}
            {gateway.model !== null ? (
              <span className="model-badge">
                {formatModelLabel(gateway.model)}
              </span>
            ) : null}
            <CompactionStatusBar status={gateway.compactionStatus} />
            <ScopeSwitcher
              scope={workspaceScope}
              onToggle={() =>
                setWorkspaceScope(
                  nextWorkspaceScope(
                    workspaceScope,
                    gateway.projectId ?? undefined,
                  ),
                )
              }
            />
            <ConnectionPill status={gateway.status} />
          </div>
          <DeckView
            disabled={gateway.status !== 'ready'}
            chat={
              <div className="chat-workspace">
                <div className="workspace-left-rail">
                  <RosterRail roster={gateway.roster} />
                  {/* P21: the empty Threads rail is replaced with the live
                      session status card (model, context, run state, phase)
                      — genuinely useful at a glance. */}
                  <SessionStatusPanel
                    model={gateway.model}
                    phase={gateway.fsmPhase}
                    running={gateway.running}
                    activity={gateway.currentActivity}
                    compaction={gateway.compactionStatus}
                  />
                </div>
                <ChatThread
                  blocks={gateway.blocks}
                  running={gateway.running}
                  disabled={gateway.status !== 'ready'}
                  currentActivity={gateway.currentActivity}
                  serverCommands={gateway.serverCommands}
                  onSend={(text) => {
                    void gateway.send(text)
                  }}
                  onSendFollowup={(prompt) => {
                    void gateway.send(prompt)
                  }}
                  onRespondApproval={(approvalId, skipped) => {
                    void gateway.respondApproval(approvalId, skipped)
                  }}
                  onInterrupt={() => {
                    void gateway.interrupt()
                  }}
                />
                <div className="workspace-right-rail">
                  <AutoDriveDashboard
                    queue={gateway.fidQueue}
                    running={gateway.running}
                    haltState={gateway.haltState}
                    onHalt={() => {
                      void gateway.haltRun()
                    }}
                  />
                  <FidQueuePanel
                    queue={gateway.fidQueue}
                    scope={workspaceScope}
                  />
                </div>
              </div>
            }
          />
        </>
      ) : (
        <SplashScreen
          state={lifecycle.state}
          detail={lifecycle.detail}
          bootError={splashError}
        />
      )}
    </main>
  )
}
