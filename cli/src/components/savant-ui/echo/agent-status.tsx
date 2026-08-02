import React from 'react'

import { activityMapping, phaseMapping } from './phase-info'
import { useTheme } from '../../../hooks/use-theme'
import { useChatStore } from '../../../state/chat-store'
import { glyph } from '../../../utils/glyphs'
import { SidebarSection } from '../primitives/sidebar-section'

/**
 * Agent Status — ECHO FSM phase + runtime activity display.
 *
 * Reads the current FSM phase and runtime activity from the chat store and
 * renders them inside a single bordered, self-contained box. The activity row
 * is hidden when both phase and activity are idle to avoid a duplicated
 * `IDLE`/`IDLE` pair.
 *
 * NOTE: This component shows the agent's runtime status, NOT the ECHO
 * Perfection Loop (the RED→GREEN→AUDIT fix/verify cycle bound to a FID).
 */
export const AgentStatus: React.FC = () => {
  const theme = useTheme()
  const fsmPhase = useChatStore((s) => s.fsmPhase) ?? 'idle'
  const activity = useChatStore((s) => s.activity)

  const phaseMap = phaseMapping(fsmPhase)
  const phaseStr = `${glyph(phaseMap.glyph)} ${phaseMap.label}`

  const activityMap = activityMapping(activity.kind)
  let activityDetail = ''
  if (activity.kind === 'tool') {
    activityDetail = activity.target
      ? `${activity.toolName}: ${activity.target}`
      : (activity.toolName ?? '')
  } else if (activity.kind === 'subagent') {
    activityDetail = activity.agentType ?? ''
  } else if (activity.kind === 'researching') {
    activityDetail = activity.query ?? ''
  } else if (activity.kind === 'thinking' && activity.model) {
    activityDetail = activity.model
  }

  const phaseIsIdle = fsmPhase === 'idle'
  const activityIsIdle = activity.kind === 'idle'
  // Show the phase row when the FSM phase is non-idle OR when both phase and
  // activity are idle. Suppress the idle phase row while real runtime activity
  // is happening so the user never sees a duplicated IDLE + <doing work> pair.
  const showPhase = !phaseIsIdle || activityIsIdle
  const showActivity = !activityIsIdle

  return (
    <SidebarSection title="Agent Status" defaultExpanded>
      {showPhase && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {phaseStr}
        </text>
      )}
      {showActivity && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {activityDetail
            ? `${glyph(activityMap.glyph)} ${activityDetail}`
            : `${glyph(activityMap.glyph)} ${activityMap.label}`}
        </text>
      )}
    </SidebarSection>
  )
}
