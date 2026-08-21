import { useKeyboard } from '@opentui/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { buildGroupedItems, type ListItem } from './model-picker-grouping'
import { ModelPickerHeaderRow, ModelPickerModelRow } from './model-picker-rows'
import { getPickerViewport, normalizeSelectableIndex } from './picker-viewport'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'

import type { OpenRouterModel } from '../utils/openrouter-models'
import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core'

interface ModelPickerProps {
  models: OpenRouterModel[]
  query: string
  selectedIndex: number
  onQueryChange: (query: string) => void
  onSelectIndex: (index: number) => void
  onSelect: (model: OpenRouterModel) => void
  onClose: () => void
  terminalHeight: number
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
  terminalHeight,
}) => {
  const theme = useTheme()
  const { terminalWidth } = useTerminalDimensions()

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    )
  }, [models, query])

  const items = useMemo(
    () => buildGroupedItems(filteredModels),
    [filteredModels],
  )

  const effectiveSelectedIndex = useMemo(
    () =>
      normalizeSelectableIndex(
        selectedIndex,
        items.length,
        (index) => items[index]?.type === 'model',
      ),
    [items, selectedIndex],
  )

  // Keep selection on a real model as the filter changes; headers are display
  // rows and must never become the active/committable item.
  useEffect(() => {
    if (effectiveSelectedIndex !== selectedIndex) {
      onSelectIndex(effectiveSelectedIndex)
    }
  }, [effectiveSelectedIndex, onSelectIndex, selectedIndex])

  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const viewport = useMemo(
    () =>
      getPickerViewport(terminalHeight, items.length, effectiveSelectedIndex),
    [terminalHeight, items.length, effectiveSelectedIndex],
  )
  useEffect(() => {
    const sb = scrollRef.current
    if (!sb) return
    sb.scrollTop = viewport.start
  }, [viewport.start])

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
          onSelectIndex(findNextModelIndex(effectiveSelectedIndex, -1))
          return
        }
        if (name === 'down' || (name === 'tab' && !key.shift)) {
          prevent()
          onSelectIndex(findNextModelIndex(effectiveSelectedIndex, 1))
          return
        }
        if (name === 'backspace') {
          prevent()
          onQueryChange(query.slice(0, -1))
          return
        }
        if (name === 'return' || name === 'enter' || name === 'space') {
          prevent()
          commit(effectiveSelectedIndex)
          return
        }
        // Printable characters build the filter query. OpenTUI routes keys
        // globally; while the picker is open the text input is blurred
        // (chat.tsx sets inputFocused false), so these land here.
        const ch =
          key.sequence ?? (key as typeof key & { input?: string }).input ?? ''
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
        effectiveSelectedIndex,
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
          ? `Filter: "${query}"  ·  ${filteredModels.length} match${filteredModels.length === 1 ? '' : 'es'}${viewport.needsScroll ? ` · showing ${viewport.start + 1}-${viewport.end}` : ''}`
          : `Select a model (↑/↓, Enter, Esc)  ·  ${filteredModels.length} models${viewport.needsScroll ? ` · showing ${viewport.start + 1}-${viewport.end}` : ''}`}
      </text>
      <scrollbox
        ref={scrollRef}
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{
          visible: viewport.needsScroll,
          trackOptions: { width: 1 },
        }}
        style={{
          height: viewport.visibleRows + 1,
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
        {items.map((item: ListItem, absoluteIndex: number) => {
          const isSelected = absoluteIndex === effectiveSelectedIndex
          if (item.type === 'header') {
            return (
              <ModelPickerHeaderRow
                key={`header-${item.provider}`}
                provider={item.provider}
                theme={theme}
              />
            )
          }
          return (
            <ModelPickerModelRow
              key={item.model.id}
              item={item}
              isSelected={isSelected}
              onCommit={commit}
              index={absoluteIndex}
              theme={theme}
            />
          )
        })}
      </scrollbox>
    </box>
  )
}
