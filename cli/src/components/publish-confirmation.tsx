import { TextAttributes } from '@opentui/core'
import React, { useMemo, useState } from 'react'

import { Button } from './button'
import { computeDependencies, computeDependents } from './publish-graph'
import { AgentSection, DirectionLabel } from './publish-sections'
import { useTheme } from '../hooks/use-theme'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { PublishAgentDefinitions } from './publish-graph'
import type { LocalAgentInfo } from '../utils/local-agent-registry'

// Re-export the publish graph surface from the original path (consumers:
// use-publish-container-controller + the focused unit test).
export { getAllPublishAgentIds } from './publish-graph'
export type { PublishAgentDefinitions } from './publish-graph'

interface PublishConfirmationProps {
  selectedAgents: LocalAgentInfo[]
  allAgents: LocalAgentInfo[]
  agentDefinitions: PublishAgentDefinitions
  includeDependents: boolean
  onToggleDependents: () => void
}

const SECTION_MAX_HEIGHT = 4

export const PublishConfirmation: React.FC<PublishConfirmationProps> = ({
  selectedAgents,
  allAgents,
  agentDefinitions,
  includeDependents,
  onToggleDependents,
}) => {
  const theme = useTheme()
  const [toggleHovered, setToggleHovered] = useState(false)

  const selectedIds = useMemo(
    () => new Set(selectedAgents.map((a) => a.id)),
    [selectedAgents],
  )

  // Only include non-bundled agents in localAgentIds for dependency resolution
  // (allAgents is already filtered to exclude bundled agents)
  const localAgentIds = useMemo(
    () => new Set(allAgents.map((a) => a.id)),
    [allAgents],
  )

  // Compute dependencies (agents the selected agents spawn)
  const dependencyIds = useMemo(
    () => computeDependencies(selectedIds, agentDefinitions, localAgentIds),
    [selectedIds, agentDefinitions, localAgentIds],
  )

  // Compute dependents (agents that spawn the selected agents)
  const dependentIds = useMemo(
    () =>
      computeDependents(
        selectedIds,
        dependencyIds,
        agentDefinitions,
        localAgentIds,
      ),
    [selectedIds, dependencyIds, agentDefinitions, localAgentIds],
  )

  // Build lists with display info
  const selectedList = useMemo(
    () =>
      selectedAgents.map((a) => ({
        id: a.id,
        displayName: a.displayName,
      })),
    [selectedAgents],
  )

  const dependencyList = useMemo(
    () =>
      Array.from(dependencyIds).map((id) => {
        const agent = allAgents.find((a) => a.id === id)
        return {
          id,
          displayName: agent?.displayName ?? id,
        }
      }),
    [dependencyIds, allAgents],
  )

  const dependentList = useMemo(
    () =>
      Array.from(dependentIds).map((id) => {
        const agent = allAgents.find((a) => a.id === id)
        return {
          id,
          displayName: agent?.displayName ?? id,
        }
      }),
    [dependentIds, allAgents],
  )

  const hasDependents = dependentList.length > 0
  const hasDependencies = dependencyList.length > 0

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      {/* Parents section (agents that spawn the selected - optional) */}
      {hasDependents && (
        <>
          {includeDependents ? (
            // Show expanded list when included
            <>
              <AgentSection
                title="PARENTS"
                titleInBorder
                agents={dependentList}
                theme={theme}
                symbol="+"
                symbolColor={theme.info}
                textColor={theme.muted}
                maxHeight={SECTION_MAX_HEIGHT}
                rightContent={
                  <Button
                    onClick={onToggleDependents}
                    onMouseOver={() => setToggleHovered(true)}
                    onMouseOut={() => setToggleHovered(false)}
                    style={{
                      backgroundColor: 'transparent',
                      paddingLeft: 0,
                      paddingRight: 0,
                    }}
                  >
                    <text
                      style={{
                        fg: toggleHovered ? theme.error : theme.secondary,
                        attributes: toggleHovered
                          ? TextAttributes.UNDERLINE
                          : undefined,
                      }}
                    >
                      − remove
                    </text>
                  </Button>
                }
              />
              <DirectionLabel theme={theme} direction="down" />
            </>
          ) : (
            // Show clickable placeholder to add parents - centered pill button
            <>
              <box style={{ alignItems: 'center' }}>
                <Button
                  onClick={onToggleDependents}
                  onMouseOver={() => setToggleHovered(true)}
                  onMouseOut={() => setToggleHovered(false)}
                  style={{
                    backgroundColor: 'transparent',
                    paddingLeft: 0,
                    paddingRight: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                >
                  <box
                    border
                    borderStyle="single"
                    borderColor={toggleHovered ? theme.info : theme.border}
                    customBorderChars={BORDER_CHARS}
                    style={{ paddingLeft: 1, paddingRight: 1 }}
                  >
                    <text
                      style={{
                        fg: toggleHovered ? theme.info : theme.muted,
                        attributes: toggleHovered
                          ? TextAttributes.BOLD
                          : undefined,
                      }}
                    >
                      ⊕ Add {dependentList.length} parent
                      {dependentList.length !== 1 ? 's' : ''}
                    </text>
                  </box>
                </Button>
              </box>
              <DirectionLabel theme={theme} direction="down" />
            </>
          )}
        </>
      )}

      {/* Selected section */}
      <AgentSection
        title="SELECTED"
        titleInBorder
        agents={selectedList}
        theme={theme}
        symbol="✓"
        symbolColor={theme.success}
        textColor={theme.foreground}
        maxHeight={SECTION_MAX_HEIGHT}
      />

      {/* Spawns section (agents the selected spawn) - no title */}
      {hasDependencies && (
        <>
          <DirectionLabel theme={theme} direction="down" />
          <AgentSection
            agents={dependencyList}
            theme={theme}
            symbol="+"
            symbolColor={theme.info}
            textColor={theme.muted}
            maxHeight={SECTION_MAX_HEIGHT}
          />
        </>
      )}
    </box>
  )
}
