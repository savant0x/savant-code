import React from 'react'

import { LearnOverlay } from './savant-ui'
import { useChatStore } from '../state/chat-store'
import { DriveStatusPanel } from './savant-ui/echo/drive-status-panel'
import { LoopStatusPanel } from './savant-ui/echo/loop-status-panel'
import { PerfectionLoop } from './savant-ui/echo/perfection-loop'
import {
  reduceTrustMatrixEvents,
  summarizeTrustRows,
  TrustMatrix,
} from './savant-ui/echo/trust-matrix'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

export function SidebarSupporting({
  fsmPhase,
  fidsDir,
}: {
  fsmPhase: string
  fidsDir?: string
}) {
  const teacher = useChatStore((s) => s.teacherState)
  const events = useChatStore((s) => s.provenanceEvents)
  const trust = React.useMemo(
    () => summarizeTrustRows(reduceTrustMatrixEvents(events).rows),
    [events],
  )
  return (
    <>
      {teacher?.challenge && (
        <SidebarSection title="Teacher">
          <LearnOverlay
            challenge={teacher.challenge}
            events={teacher.events}
            receipt={teacher.receipt}
            persisted={teacher.persisted}
            competencyState={teacher.competencyState}
            phase={teacher.phase}
            completionState={teacher.completionState}
          />
        </SidebarSection>
      )}
      {fsmPhase !== 'idle' && <PerfectionLoop fidsDir={fidsDir} />}
      {trust.hasPending && (
        <SidebarSection title="Trust Matrix">
          <TrustMatrix events={events} />
        </SidebarSection>
      )}
      <LoopStatusPanel />
      <DriveStatusPanel />
    </>
  )
}
