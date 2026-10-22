import { useKeyboard } from '@opentui/react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'

import { buildGroupedItems, type ListItem } from './model-picker-grouping'
import { ModelPickerHeaderRow, ModelPickerModelRow } from './model-picker-rows'
import { getPickerViewport, normalizeSelectableIndex } from './picker-viewport'
import { createChatScrollbarOptions } from '../chat/styles'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { useModelPickerStore } from '../state/model-picker-store'
import { logger } from '../utils/logger'

import type { OpenRouterModel } from '../utils/openrouter-models'
import type { KeyEvent } from '@opentui/core'

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
 * - Groups models by provider with section headers (alphabetical by
 *   provider id); free-token entries hoist into a FREE MODELS section.
 * - Shows a provider badge for every model.
 * - Arrow / Tab navigation with a viewport that keeps the focus in view.
 * - Enter (or click) selects; Escape closes.
 *
 * Kept generic and provider-agnostic; the parent wires persistence via
 * onSelect. Mirrors the keyboard/focus pattern of SavantFreeModelSelector and
 * ask-user so behavior is consistent across overlays.
 */
export const ModelPicker = memo(function ModelPicker({
  models,
  query,
  selectedIndex,
  onQueryChange,
  onSelectIndex,
  onSelect,
  onClose,
  terminalHeight,
}: ModelPickerProps) {
  const theme = useTheme()
  const { terminalWidth } = useTerminalDimensions()
  const unavailableProviders = useModelPickerStore(
    (s) => s.unavailableProviders,
  )

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    )
  }, [models, query])

  const items = useMemo(
    () => buildGroupedItems(filteredModels, unavailableProviders),
    [filteredModels, unavailableProviders],
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

  // FID-2026-1022-002: the picker's interaction verdict used to exist only in
  // the operator's memory. These breadcrumbs make it replayable from
  // `debug/cli.jsonl`: one record per open, per handled key, per filter change
  // and per close, carrying lengths and counts — never what was typed.
  const closeReasonRef = useRef<'escape' | 'select' | null>(null)

  useEffect(() => {
    logger.debug(
      { event: 'model-picker.open', catalog: models.length },
      'model picker open',
    )
    return () => {
      logger.debug(
        {
          event: 'model-picker.close',
          reason: closeReasonRef.current ?? 'unmount',
        },
        'model picker close',
      )
    }
  }, [])

  useEffect(() => {
    logger.debug(
      {
        event: 'model-picker.filter',
        queryLength: query.length,
        filtered: filteredModels.length,
        catalog: models.length,
      },
      'model picker filter',
    )
  }, [filteredModels.length, models.length, query.length])

  /** One record per HANDLED key; unhandled keys stay silent. */
  const traceKey = useCallback(
    (keyName: string, action: string) => {
      logger.debug(
        {
          event: 'model-picker.key',
          key: keyName,
          action,
          queryLength: query.length,
          filtered: filteredModels.length,
          selected: effectiveSelectedIndex,
        },
        'model picker key',
      )
    },
    [effectiveSelectedIndex, filteredModels.length, query.length],
  )

  // Keep selection on a real model as the filter changes; headers are display
  // rows and must never become the active/committable item.
  useEffect(() => {
    if (effectiveSelectedIndex !== selectedIndex) {
      onSelectIndex(effectiveSelectedIndex)
    }
  }, [effectiveSelectedIndex, onSelectIndex, selectedIndex])

  const viewport = useMemo(
    () =>
      getPickerViewport(terminalHeight, items.length, effectiveSelectedIndex),
    [terminalHeight, items.length, effectiveSelectedIndex],
  )

  /**
   * Only the visible window is mounted (FID-2026-1018-008).
   *
   * The dev catalog holds 4,075 models and the picker used to mount a row
   * renderable for every one of them — roughly ten native renderables and
   * several `TextBuffer`s per row. On the first commit after `/model` the
   * native allocator returned null for a `TextBuffer`, React threw during
   * `completeWork`, and the error boundary's own fallback `<text>` failed the
   * same way, so React unmounted the root: a blank screen on a healthy
   * process that was still painting frames and logging nothing.
   *
   * `getPickerViewport` already bounds the window to 12 rows; slicing to it is
   * what keeps the mount bounded. The list is no longer natively scrollable,
   * which is why the scrollbar is hidden and the header reports the window
   * (`showing 13-24`) — keyboard selection is the documented interaction.
   */
  const visibleItems = useMemo(
    () => items.slice(viewport.start, viewport.end),
    [items, viewport.start, viewport.end],
  )

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
          closeReasonRef.current = 'escape'
          traceKey(name === 'escape' ? 'escape' : 'ctrl+c', 'close')
          onClose()
          return
        }
        if (name === 'up' || (name === 'tab' && key.shift)) {
          prevent()
          traceKey(name === 'up' ? 'up' : 'shift+tab', 'up')
          onSelectIndex(findNextModelIndex(effectiveSelectedIndex, -1))
          return
        }
        if (name === 'down' || (name === 'tab' && !key.shift)) {
          prevent()
          traceKey(name === 'down' ? 'down' : 'tab', 'down')
          onSelectIndex(findNextModelIndex(effectiveSelectedIndex, 1))
          return
        }
        if (name === 'backspace') {
          prevent()
          traceKey('backspace', 'filter')
          onQueryChange(query.slice(0, -1))
          return
        }
        if (name === 'return' || name === 'enter' || name === 'space') {
          prevent()
          closeReasonRef.current = 'select'
          traceKey(name, 'select')
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
          traceKey(ch, 'filter')
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
        traceKey,
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
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        // The windowed list has no native scroll range, so the bar stays
        // hidden (the header reports the window). The themed factory is still
        // wired in: the app's scrollbar contract applies to every vertical
        // scrollbox consumer, and a default bar must never appear here.
        verticalScrollbarOptions={{
          visible: false,
          ...createChatScrollbarOptions(theme),
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
        {visibleItems.map((item: ListItem, offset: number) => {
          const absoluteIndex = viewport.start + offset
          const isSelected = absoluteIndex === effectiveSelectedIndex
          if (item.type === 'header') {
            return (
              <ModelPickerHeaderRow
                key={`header-${item.provider ?? item.label}`}
                label={item.label}
                theme={theme}
              />
            )
          }
          return (
            <ModelPickerModelRow
              key={`${item.provider}:${item.model.id}`}
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
})
