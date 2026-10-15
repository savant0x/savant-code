import { TextAttributes } from '@opentui/core'
import { memo, useCallback, useMemo } from 'react'

import { useMessageBlockStore } from '../../state/message-block-store'
import { splitByAgentSize } from '../../utils/block-processor'
import { getCliEnv } from '../../utils/env'
import { MAX_AGENT_DEPTH } from '../../utils/layout-helpers'
import { logger } from '../../utils/logger'
import { ErrorBoundary } from '../error-boundary'
import { GridLayout } from '../grid-layout'
import { MessageWithAgents } from '../message-with-agents'

import type { ChatMessage } from '../../types/chat'

interface AgentChildrenGridProps {
  agentChildren: ChatMessage[]
  depth: number
  availableWidth: number
}

export const AgentChildrenGrid = memo(
  ({ agentChildren, depth, availableWidth }: AgentChildrenGridProps) => {
    const theme = useMessageBlockStore((state) => state.context.theme)

    const getItemKey = useCallback((agent: ChatMessage) => agent.id, [])

    const renderAgentChild = useCallback(
      (agent: ChatMessage, _idx: number, columnWidth: number) => (
        <MessageWithAgents
          message={agent}
          depth={depth + 1}
          isLastMessage={false}
          availableWidth={columnWidth}
        />
      ),
      [depth],
    )

    const subGroups = useMemo(
      () => splitByAgentSize(agentChildren, (m) => m.agent?.agentType ?? ''),
      [agentChildren],
    )

    if (agentChildren.length === 0) return null

    if (depth >= MAX_AGENT_DEPTH) {
      if (getCliEnv().NODE_ENV === 'development') {
        logger.warn(
          { depth, maxAgentDepth: MAX_AGENT_DEPTH },
          '[AgentChildrenGrid] Depth limit reached, truncating agent tree',
        )
      }
      return (
        <text fg={theme?.muted} attributes={TextAttributes.ITALIC}>
          {`${agentChildren.length} nested agent${
            agentChildren.length > 1 ? 's' : ''
          } not shown (depth limit)`}
        </text>
      )
    }

    const errorFallback = (
      <text fg={theme?.error}>Error rendering agent children</text>
    )

    return (
      <ErrorBoundary fallback={errorFallback} componentName="AgentChildrenGrid">
        <box
          selectable={false}
          style={{ flexDirection: 'column', gap: 0, width: '100%' }}
        >
          {subGroups.map((group) => (
            <GridLayout
              key={getItemKey(group[0])}
              items={group}
              availableWidth={availableWidth}
              getItemKey={getItemKey}
              renderItem={renderAgentChild}
            />
          ))}
        </box>
      </ErrorBoundary>
    )
  },
)
