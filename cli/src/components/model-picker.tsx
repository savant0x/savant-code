


import { useKeyboard } from '@opentui/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'


import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { Badge } from './savant-ui/data-display/badge'

import type { OpenRouterModel } from '../utils/openrouter-models'
import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core'

const MAX_VISIBLE = 12

interface ModelPickerProps {
  models: OpenRouterModel[]
  query: string
  selectedIndex: number
  onQueryChange: (query: string) => void
  onSelectIndex: (index: number) => void
  onSelect: (model: OpenRouterModel) => void
  onClose: () => void
}

type ModelProvider = NonNullable<OpenRouterModel['provider']>

interface ModelItem {
  type: 'model'
  model: OpenRouterModel
  provider: ModelProvider
}

interface HeaderItem {
  type: 'header'
  provider: ModelProvider
}

type ListItem = ModelItem | HeaderItem

function getProvider(model: OpenRouterModel): ModelProvider {
  return model.provider ?? 'openrouter'
}

function getProviderOrder(provider: ModelProvider): number {
  switch (provider) {
    case 'openrouter':
      return 0
    case 'tokenrouter':
      return 1
    case 'nvidia':
      return 2
    case 'opencode-go':
      return 3
    default:
      return 4
  }
}

function buildGroupedItems(models: OpenRouterModel[]): ListItem[] {
  const byProvider = new Map<ModelProvider, OpenRouterModel[]>()
  for (const model of models) {
    const provider = getProvider(model)
    const group = byProvider.get(provider) ?? []
    group.push(model)
    byProvider.set(provider, group)
  }

  const providers = Array.from(byProvider.keys()).sort((a, b) => {
    const orderDiff = getProviderOrder(a) - getProviderOrder(b)
    if (orderDiff !== 0) return orderDiff
    return a.localeCompare(b)
  })

  const items: ListItem[] = []
  for (const provider of providers) {
    const group = byProvider.get(provider)
    if (!group || group.length === 0) continue
    group.sort((a, b) => a.id.localeCompare(b.id))
    items.push({ type: 'header', provider })
    for (const model of group) {
      items.push({ type: 'model', model, provider })
    }
  }

  return items
}

/**
 * Interactive, searchable model picker for the /model command.
 *
 * - Filters the FULL live catalog by substring (id or name) — no truncation.
 * - Groups models by provider with section headers.
 * - Shows a provider badge for every model.
 * - Arrow / Tab navigation with a viewport that keeps the focus in view.
 * - Enter (or click) selects; Escape closes.
 *
 * Kept generic and provider-agnostic; the parent wires persistence via
 * onSelect. Mirrors the keyboard/focus pattern of SavantFreeModelSelector and
 * ask-user so behavior is consistent across overlays.
 */
export const ModelPicker: React.FC<ModelPickerProps> = ({
  models,
  query,
  selectedIndex,
  onQueryChange,
  onSelectIndex,
  onSelect,
  onClose,
}) => {
  const theme = useTheme()
  const { terminalWidth } = useTerminalDimensions()

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    )
  }, [models, query])

  const items = useMemo(
    () => buildGroupedItems(filteredModels),
    [filteredModels],
  )

  // Keep the selected index valid as the filter narrows the list.
  useEffect(() => {
    if (selectedIndex > items.length - 1) {
      onSelectIndex(Math.max(0, items.length - 1))
    }
  }, [items.length, selectedIndex, onSelectIndex])

  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const needsScroll = items.length > MAX_VISIBLE
  const viewportHeight = needsScroll
    ? MAX_VISIBLE
    : Math.max(items.length, 1)
  const start = needsScroll
    ? Math.min(
        Math.max(selectedIndex - Math.floor((MAX_VISIBLE - 1) / 2), 0),
        Math.max(items.length - MAX_VISIBLE, 0),
      )
    : 0
  const visible = items.slice(start, start + viewportHeight)

  useEffect(() => {
    const sb = scrollRef.current
    if (!sb) return
    sb.scrollTop = start
  }, [start])

  const findNextModelIndex = useCallback(
    (from: number, direction: 1 | -1): number => {
      if (items.length === 0) return 0
      let index = from
      for (let i = 0; i < items.length; i++) {
        index =
          direction === 1
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length
        if (items[index]?.type === 'model') {
          return index
        }
      }
      return 0
    },
    [items],
  )

  const commit = useCallback(
    (index: number) => {
      const item = items[index]
      if (item?.type === 'model') onSelect(item.model)
    },
    [items, onSelect],
  )

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const name = key.name ?? ''
        const prevent = () => {
          key.preventDefault?.()
          key.stopPropagation?.()
        }
        if (name === 'escape' || (key.ctrl && name === 'c')) {
          prevent()
          onClose()
          return
        }
        if (name === 'up' || (name === 'tab' && key.shift)) {
          prevent()
          onSelectIndex(findNextModelIndex(selectedIndex, -1))
          return
        }
        if (name === 'down' || (name === 'tab' && !key.shift)) {
          prevent()
          onSelectIndex(findNextModelIndex(selectedIndex, 1))
          return
        }
        if (name === 'backspace') {
          prevent()
          onQueryChange(query.slice(0, -1))
          return
        }
        if (
          name === 'return' ||
          name === 'enter' ||
          name === 'space'
        ) {
          prevent()
          commit(selectedIndex)
          return
        }
        // Printable characters build the filter query. OpenTUI routes keys
        // globally; while the picker is open the text input is blurred
        // (chat.tsx sets inputFocused false), so these land here.
        const ch =
          key.sequence ??
          (key as typeof key & { input?: string }).input ??
          ''
        if (
          ch &&
          ch.length === 1 &&
          !key.ctrl &&
          !key.meta &&
          !(key as typeof key & { alt?: boolean }).alt
        ) {
          prevent()
          onQueryChange(query + ch)
        }
      },
      [
        selectedIndex,
        commit,
        findNextModelIndex,
        onClose,
        onQueryChange,
        onSelectIndex,
        query,
      ],
    ),
  )

  const menuWidth = Math.max(20, Math.min(terminalWidth - 4, 120))

  return (
    <box
      style={{
        flexDirection: 'column',
        width: menuWidth,
        backgroundColor: theme.surface,
        borderStyle: 'single',
        borderColor: theme.border,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <text style={{ fg: theme.muted, wrapMode: 'none' }}>
        {query
          ? `Filter: "${query}"  ·  ${filteredModels.length} match${filteredModels.length === 1 ? '' : 'es'}`
          : `Select a model (↑/↓, Enter, Esc)  ·  ${filteredModels.length} models`}
      </text>
      <scrollbox
        ref={scrollRef}
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{
          visible: needsScroll,
          trackOptions: { width: 1 },
        }}
        style={{
          height: viewportHeight + 1,
          flexShrink: 0,
          rootOptions: {
            flexDirection: 'row',
            backgroundColor: 'transparent',
          },
          wrapperOptions: { border: false, backgroundColor: 'transparent' },
          contentOptions: {
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0,
            backgroundColor: 'transparent',
          },
        }}
      >
        {filteredModels.length === 0 && (
          <box
            style={{
              paddingLeft: 1,
              paddingTop: 1,
              backgroundColor: theme.surface,
            }}
          >
            <text style={{ fg: theme.muted, wrapMode: 'none' }}>
              {query ? `No models match "${query}"` : 'No models available'}
            </text>
          </box>
        )}
        {visible.map((item, idx) => {
          const absoluteIndex = start + idx
          const isSelected = absoluteIndex === selectedIndex

          if (item.type === 'header') {
            return (
              <box
                key={`header-${item.provider}`}
                style={{
                  width: '100%',
                  paddingLeft: 1,
                  paddingTop: 1,
                  paddingBottom: 0,
                  backgroundColor: theme.surface,
                }}
              >
                <text
                  style={{
                    fg: theme.primary,
                    wrapMode: 'none',
                  }}
                >
                  {item.provider.toUpperCase()}
                </text>
              </box>
            )
          }

          const { model, provider } = item
          return (
            <Button
              key={model.id}
              onClick={() => commit(absoluteIndex)}
              style={{
                width: '100%',
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: isSelected
                  ? theme.surfaceHover
                  : theme.surface,
                flexDirection: 'row',
                gap: 1,
                alignItems: 'center',
              }}
            >
              {/* Marker + model ID */}
              <box style={{ flexDirection: 'row', flexShrink: 0, gap: 0 }}>
                <text
                  fg={theme.primary}
                  wrapMode="none"
                  selectable={false}
                >
                  {isSelected ? '› ' : '  '}
                </text>
                <text
                  fg={theme.foreground}
                  attributes={isSelected ? 1 : 0}
                  wrapMode="none"
                  selectable={false}
                >
                  {model.id}
                </text>
              </box>
              {/* Provider badge */}
              <box style={{ flexShrink: 0 }}>
                <Badge variant="info" brackets={false}>
                  {provider}
                </Badge>
              </box>
              {/* Model name */}
              <box style={{ flexGrow: 1, minWidth: 0 }}>
                <text
                  fg={theme.muted}
                  wrapMode="char"
                  selectable={false}
                >
                  {model.name}
                </text>
              </box>
            </Button>
          )
        })}
      </scrollbox>
    </box>
  )
}
