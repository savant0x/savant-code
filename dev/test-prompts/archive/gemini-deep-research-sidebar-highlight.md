# Deep Research: OpenTUI Sidebar Row Highlight Bug

## [ROLE / PERSONA]

Act as an expert TUI/OpenTUI frontend engineer and debugging specialist with deep knowledge of OpenTUI's React wrapper, renderable lifecycle, and pointer/selection event handling.

## [OBJECTIVE / TASK]

Conduct a root-cause analysis of a persistent row-highlight bug in the Savant-Code CLI's right sidebar and propose a minimal, correct fix. The sidebar is built with OpenTUI (`@opentui/react`) and React.

## [CONTEXT & BOUNDARIES]

- The bug: clicking any empty/open space in the right sidebar causes entire rows/sections to become highlighted.
- The highlight was previously fixed, then re-appeared after the sidebar was refactored from ASCII box drawing to native OpenTUI flexbox components.
- The fix must work with **OpenTUI v0.2.2** (`@opentui/core` + `@opentui/react`) and React 19.
- Do not assume the fix is simply `selectable={false}` or `focusable={false}`; those have already been applied exhaustively without resolving the issue.
- **All relevant source code is inlined below. Do not attempt to read local files on this PC; treat the inline snippets as the canonical source.**
- Prefer official OpenTUI source, the `opencode-ai/opencode` repository, and other OpenTUI-based projects as reference implementations.

### Attempted fixes that did NOT work

1. Adding `focusable={false}` to every sidebar `<box>`.
2. Adding `selectable={false}` to every sidebar `<box>` and every `<text>` element.
3. Restricting `onMouseDown` handlers to content-width boxes with `alignSelf="flex-start"`.

## [REQUIRED COVERAGE]

### 1. OpenTUI internals

Read the official source and explain how `focusable`, `selectable`, `onMouseDown`, and `processMouseEvent` interact. Cite the relevant lines in:

- https://raw.githubusercontent.com/anomalyco/opentui/main/packages/core/src/Renderable.ts
- https://raw.githubusercontent.com/anomalyco/opentui/main/packages/core/src/renderables/Box.ts
- https://raw.githubusercontent.com/anomalyco/opentui/main/packages/core/src/lib/selection.ts
- https://raw.githubusercontent.com/anomalyco/opentui/main/packages/core/src/renderables/Text.ts

Explain why the current exhaustive `focusable={false}` / `selectable={false}` approach may still leave a highlight path.

### 2. Comparable implementations

Examine `https://github.com/opencode-ai/opencode` and any other OpenTUI-based sidebars/lists you find. Show how they avoid row highlighting on empty-space clicks and contrast it with the code inlined below.

### 3. Failure modes and edge cases

Consider terminal-emulator text selection, OpenTUI selection/focus, event propagation, and Yoga layout bounding boxes. Identify which of these is actually causing the visible highlight.

### 4. Alternative fixes and tradeoffs

List at least 2 viable fixes (e.g., renderer-level mouse sink, wrapper component, prop change, layout change). Include the risk of each.

## [SOURCE CODE — RIGHT SIDEBAR AND PRIMITIVES]

The following is the actual React/TSX source that renders the right sidebar and its primitives. Analyze this directly.

### RightSidebar component

```tsx
import { TextAttributes } from '@opentui/core'
import React from 'react'
import { AgentStack } from './savant-ui'
import { useFids } from '../hooks/use-fids'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { loadSavantCodeModelPreference } from '../utils/settings'
import { getVersion } from '../utils/version'
import { Timeline } from './savant-ui/data-display/timeline'
import { AgentStatus } from './savant-ui/echo/agent-status'
import { FidList } from './savant-ui/echo/fid-list'
import { PerfectionLoop } from './savant-ui/echo/perfection-loop'
import { KeyValueRow } from './savant-ui/primitives/key-value-row'
import { SidebarSection } from './savant-ui/primitives/sidebar-section'

interface ToolCall { name: string; timestamp: number }
interface AgentInfo { id: string; displayName?: string; isActive: boolean }
interface FilesChanged { modified: number; added: number; deleted: number }

interface RightSidebarProps {
  tokensUsed: number
  tokensMax: number
  cost: number
  model: string
  mode: string
  agent: string
  toolsUsed: string[]
  toolsAvailable: string[]
  filesChanged: FilesChanged
  agentStack: AgentInfo[]
  toolHistory: ToolCall[]
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

export const RightSidebar = React.memo(function RightSidebar({
  tokensUsed,
  tokensMax,
  cost,
  model,
  mode,
  agent,
  toolsUsed,
  toolsAvailable,
  filesChanged,
  agentStack,
  toolHistory,
}: RightSidebarProps) {
  const theme = useTheme()
  const devMode = useChatStore((s) => s.devMode)
  const { fids: activeFids } = useFids()
  const displayModel = IS_SAVANT_FREE
    ? useSavantFreeModelStore.getState().selectedModel
    : loadSavantCodeModelPreference() ?? model
  const fids = activeFids

  return (
    <box
      flexDirection="column"
      width={40}
      flexShrink={0}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={1}
      paddingRight={1}
      gap={1}
      focusable={false}
      selectable={false}
    >
      <box
        flexDirection="column"
        alignItems="center"
        gap={1}
        paddingBottom={1}
        focusable={false}
        selectable={false}
      >
        <text attributes={TextAttributes.BOLD} fg={theme.primary} selectable={false}>
          SAVANT
        </text>
        <text fg={theme.muted} selectable={false}>One Mind. A Thousand Faces.</text>
      </box>

      {devMode && (
        <text attributes={TextAttributes.BOLD} fg={theme.error} selectable={false}>
          [DEV MODE]
        </text>
      )}

      <SidebarSection title="Active Agents">
        <AgentStack
          agents={
            agentStack.length > 0
              ? agentStack.map((a) => ({ name: a.displayName ?? a.id, active: a.isActive }))
              : [{ name: agent, active: true }]
          }
        />
      </SidebarSection>

      <AgentStatus />

      <SidebarSection title="Session">
        <KeyValueRow label="Agent" value={agent === 'main-agent' ? 'Savant' : agent} />
        <KeyValueRow label="Cost" value={formatCost(cost)} />
        <KeyValueRow label="Mode" value={mode} />
        <KeyValueRow label="Model" value={displayModel} />
        <KeyValueRow
          label="Tokens"
          value={`${formatTokens(tokensUsed)}/${formatTokens(tokensMax)}`}
        />
      </SidebarSection>

      <PerfectionLoop />

      <SidebarSection title="Tools">
        {toolsUsed
          .sort((a, b) => a.localeCompare(b))
          .map((tool, i) => (
            <text key={`used-${i}`} fg={theme.foreground} wrapMode="none" selectable={false}>
              {`● ${tool}`}
            </text>
          ))}
        {toolsAvailable
          .filter((t) => !toolsUsed.includes(t))
          .sort((a, b) => a.localeCompare(b))
          .slice(0, Math.max(0, 5 - toolsUsed.length))
          .map((tool, i) => (
            <text key={`avail-${i}`} fg={theme.muted} wrapMode="none" selectable={false}>
              {`○ ${tool}`}
            </text>
          ))}
      </SidebarSection>

      <SidebarSection title="Files Changed">
        <KeyValueRow label="Added" value={filesChanged.added.toString()} />
        <KeyValueRow label="Deleted" value={filesChanged.deleted.toString()} />
        <KeyValueRow label="Modified" value={filesChanged.modified.toString()} />
      </SidebarSection>

      <SidebarSection title="Active FIDs">
        {fids.length > 0 ? (
          <FidList fids={fids.slice(0, 3)} sortBy="severity" />
        ) : (
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            (none — loop converged)
          </text>
        )}
      </SidebarSection>

      <SidebarSection title="History">
        {toolHistory.length > 0 ? (
          <Timeline
            events={toolHistory.slice(-5).map((call) => {
              const date = new Date(call.timestamp)
              const hours = date.getHours().toString().padStart(2, '0')
              const minutes = date.getMinutes().toString().padStart(2, '0')
              return { time: `${hours}:${minutes}`, label: call.name }
            })}
            maxItems={5}
          />
        ) : (
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            (empty)
          </text>
        )}
      </SidebarSection>

      <box
        marginTop="auto"
        width="100%"
        justifyContent="flex-end"
        paddingRight={1}
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`v${getVersion()}`}
        </text>
      </box>
    </box>
  )
})
```

### SidebarSection primitive

```tsx
import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface SidebarSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

export function SidebarSection({
  title,
  defaultExpanded = true,
  children,
}: SidebarSectionProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const handleToggle = () => setExpanded((prev) => !prev)

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      <box
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={handleToggle}
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text attributes={TextAttributes.BOLD} fg={theme.primary} selectable={false}>
          {title}
        </text>
      </box>
      {expanded && (
        <box flexDirection="column" paddingLeft={2} focusable={false} selectable={false}>
          {children}
        </box>
      )}
    </box>
  )
}
```

### FidCard primitive

```tsx
import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface FidCardProps {
  id: string
  status: string
  severity: string
  summary: string
  onClick?: () => void
  expanded?: boolean
}

export function FidCard({
  id,
  summary,
  onClick,
  expanded: initialExpanded = true,
}: FidCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(initialExpanded)
  const shortId = id.replace(/^FID-\d{4}-\d{4}-/, '')

  const handleToggle = () => {
    setExpanded((prev) => !prev)
    onClick?.()
  }

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      <box
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={handleToggle}
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text
          fg={theme.foreground}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
          selectable={false}
        >
          {`FID-${shortId}`}
        </text>
      </box>
      {expanded && (
        <box flexDirection="column" paddingLeft={2} focusable={false} selectable={false}>
          {summary.split(/\n\s*\n/).map((paragraph, index) => (
            <text key={index} fg={theme.muted} wrapMode="word" selectable={false}>
              {paragraph.trim()}
            </text>
          ))}
        </box>
      )}
    </box>
  )
}
```

### FidList primitive

```tsx
import React from 'react'
import { FidCard } from './fid-card'
import { useTheme } from '../../../hooks/use-theme'

export interface FidData {
  id: string
  status: string
  severity: string
  summary: string
}

export interface FidListProps {
  fids: FidData[]
  filter?: string
  sortBy?: 'id' | 'severity' | 'status'
  onSelect?: (fid: FidData) => void
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function FidList({ fids, filter, sortBy = 'severity', onSelect }: FidListProps) {
  const theme = useTheme()
  let filtered = fids
  if (filter) {
    filtered = fids.filter((f) => f.status === filter || f.severity === filter)
  }
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') {
      return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    }
    if (sortBy === 'status') return a.status.localeCompare(b.status)
    return a.id.localeCompare(b.id)
  })

  if (sorted.length === 0) {
    return <text fg={theme.muted}>No FIDs found</text>
  }

  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      {sorted.map((fid) => (
        <FidCard
          key={fid.id}
          id={fid.id}
          status={fid.status}
          severity={fid.severity}
          summary={fid.summary}
          onClick={() => onSelect?.(fid)}
        />
      ))}
    </box>
  )
}
```

### AgentStack primitive

```tsx
import React from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface AgentStackAgent {
  name: string
  active?: boolean
}

export interface AgentStackProps {
  agents: AgentStackAgent[]
}

function formatAgentName(name: string): string {
  if (name === 'savant' || name === 'main-agent') return 'Savant'
  return name
    .split('-')
    .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
}

export function AgentStack({ agents }: AgentStackProps) {
  const theme = useTheme()
  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      {agents.map((agent, i) => {
        const isActive = agent.active ?? false
        return (
          <box key={i} flexDirection="row" gap={1} alignItems="center" focusable={false} selectable={false}>
            <text fg={isActive ? theme.primary : theme.muted} selectable={false}>
              {isActive ? '●' : '○'}
            </text>
            <text
              fg={isActive ? theme.foreground : theme.muted}
              wrapMode="none"
              selectable={false}
            >
              {formatAgentName(agent.name)}
            </text>
          </box>
        )
      })}
    </box>
  )
}
```

### KeyValueRow primitive

```tsx
import React from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface KeyValueRowProps {
  label: string
  value: React.ReactNode
  valueColor?: string
}

export function KeyValueRow({ label, value, valueColor }: KeyValueRowProps) {
  const theme = useTheme()
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      gap={1}
      focusable={false}
      selectable={false}
    >
      <text fg={theme.muted} wrapMode="none" selectable={false}>
        {label}
      </text>
      <text
        fg={valueColor ?? theme.foreground}
        wrapMode="none"
        selectable={false}
      >
        {value}
      </text>
    </box>
  )
}
```

### Timeline primitive

```tsx
import React from 'react'
import { useTheme } from '../../../hooks/use-theme'

export interface TimelineEvent {
  time: string
  label: string
  color?: string
}

export interface TimelineProps {
  events: TimelineEvent[]
  maxItems?: number
}

export function Timeline({ events, maxItems }: TimelineProps) {
  const theme = useTheme()
  const display = maxItems ? events.slice(-maxItems) : events

  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      {display.map((event, i) => (
        <box key={i} flexDirection="row" gap={1} focusable={false} selectable={false}>
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            {event.time}
          </text>
          <text
            fg={event.color ?? theme.foreground}
            wrapMode="word"
            selectable={false}
          >
            {event.label}
          </text>
        </box>
      ))}
    </box>
  )
}
```

### Main chat layout snippet (right sidebar mount)

```tsx
const SIDEBAR_MIN_TERMINAL_WIDTH = 100
const showSidebar = terminalWidth >= SIDEBAR_MIN_TERMINAL_WIDTH

return (
  <box
    onMouseMove={handleMouseActivity}
    focusable={false}
    selectable={false}
  >
    {/* ...main chat column... */}

    {showSidebar && (
      <RightSidebar
        tokensUsed={contextTokensUsed}
        tokensMax={contextTokensMax}
        cost={sessionCost}
        model={sidebarModel || 'unknown'}
        mode={agentMode}
        agent={agentId ?? 'Savant'}
        toolsUsed={toolsUsed}
        toolsAvailable={['read_file', 'search_files', 'apply_patch', 'bash']}
        filesChanged={filesChanged}
        agentStack={agentStack.length > 0 ? agentStack : [{ id: agentId ?? 'Savant', isActive: true }]}
        toolHistory={toolHistory}
      />
    )}
  </box>
)
```

## [OUTPUT FORMAT & STYLE]

Return a concise, structured report in Markdown with the following sections:

1. **Root Cause** — one paragraph plus exact source line references.
2. **Why `selectable={false}` / `focusable={false}` did not work** — bullet list with source quotes.
3. **Recommended Fix** — exact code changes in the inlined source, with code snippets.
4. **Alternatives Considered** — a short comparison table.
5. **Verification Plan** — step-by-step commands or interactions to confirm the fix in the Savant-Code CLI.
6. **References** — links to every source used.

Flag any low-confidence findings inline. Cite all web sources with URLs.
