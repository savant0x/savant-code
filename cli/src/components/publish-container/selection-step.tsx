import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { AgentChecklist } from '../agent-checklist'
import { Button } from '../button'
import { MultilineInput } from '../multiline-input'
import { SelectedChips } from '../selected-chips'
import { Separator } from '../separator'

import type { LocalAgentInfo } from '../../utils/local-agent-registry'
import type { MultilineInputHandle } from '../multiline-input'

/** Search + checklist step: pick which agents to publish, then Next. */
export const SelectionStep: React.FC<{
  width: number
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  inputFocused: boolean
  agents: LocalAgentInfo[]
  filteredAgents: LocalAgentInfo[]
  selectedIds: Set<string>
  selectedAgents: LocalAgentInfo[]
  agentDefinitions: Map<string, { spawnableAgents?: string[] }>
  focusedIndex: number
  canProceed: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleAgent: (agentId: string) => void
  onFocusChange: (index: number) => void
  onKeyIntercept: (key: {
    name?: string
    sequence?: string
    shift?: boolean
    ctrl?: boolean
    meta?: boolean
    option?: boolean
  }) => boolean
  onNext: () => void
}> = ({
  width,
  inputRef,
  inputFocused,
  agents,
  filteredAgents,
  selectedIds,
  selectedAgents,
  agentDefinitions,
  focusedIndex,
  canProceed,
  searchQuery,
  onSearchChange,
  onToggleAgent,
  onFocusChange,
  onKeyIntercept,
  onNext,
}) => {
  const theme = useTheme()
  const [nextButtonHovered, setNextButtonHovered] = useState(false)
  return (
    <>
      {/* Search input */}
      <Separator width={width} widthOffset={4} />
      <box style={{ paddingTop: 0, paddingBottom: 0 }}>
        <MultilineInput
          value={searchQuery}
          onChange={({ text }) => onSearchChange(text)}
          onSubmit={onNext}
          onPaste={() => {}}
          onKeyIntercept={onKeyIntercept}
          placeholder="Type to search agents..."
          focused={inputFocused}
          maxHeight={1}
          minHeight={1}
          ref={inputRef}
          cursorPosition={searchQuery.length}
        />
      </box>
      <Separator width={width} widthOffset={4} />

      {/* Selected chips */}
      {selectedAgents.length > 0 && (
        <>
          <SelectedChips
            selectedAgents={selectedAgents.map((a) => ({
              id: a.id,
              displayName: a.displayName,
            }))}
            onRemove={onToggleAgent}
          />
          <Separator width={width} widthOffset={4} />
        </>
      )}

      {/* Agent checklist */}
      <AgentChecklist
        allAgents={agents}
        filteredAgents={filteredAgents}
        selectedIds={selectedIds}
        searchQuery={searchQuery}
        focusedIndex={focusedIndex}
        onToggleAgent={onToggleAgent}
        onFocusChange={onFocusChange}
        agentDefinitions={agentDefinitions}
      />

      {/* Footer with Next button */}
      <Separator width={width} widthOffset={4} />
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <text style={{ fg: theme.muted }}>
          ↑↓ navigate • Enter toggle • Tab next
        </text>
        <Button
          onClick={onNext}
          onMouseOver={() => setNextButtonHovered(true)}
          onMouseOut={() => setNextButtonHovered(false)}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: canProceed ? theme.foreground : theme.border,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text
            style={{ wrapMode: 'none' }}
            attributes={
              canProceed
                ? undefined
                : TextAttributes.DIM | TextAttributes.ITALIC
            }
          >
            <span
              fg={
                canProceed
                  ? nextButtonHovered
                    ? theme.primary
                    : theme.foreground
                  : theme.muted
              }
            >
              NEXT
            </span>
          </text>
        </Button>
      </box>
    </>
  )
}
