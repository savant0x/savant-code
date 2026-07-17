import { useKeyboard } from '@opentui/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
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

/**
 * Interactive, searchable model picker for the /model command.
 *
 * - Filters the FULL live catalog by substring (id or name) — no truncation.
 * - Arrow / Tab navigation with a viewport that keeps the focus in view.
 * - Enter (or click) selects; Escape closes.
 *
 * Kept generic and provider-agnostic; the parent wires persistence via
 * onSelect. Mirrors the keyboard/focus pattern of FreebuffModelSelector and
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    )
  }, [models, query])

  // Keep the selected index valid as the filter narrows the list.
  useEffect(() => {
    if (selectedIndex > filtered.length - 1) {
      onSelectIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex, onSelectIndex])

  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const needsScroll = filtered.length > MAX_VISIBLE
  const viewportHeight = needsScroll ? MAX_VISIBLE : Math.max(filtered.length, 1)
  const start = needsScroll
    ? Math.min(
        Math.max(selectedIndex - Math.floor((MAX_VISIBLE - 1) / 2), 0),
        Math.max(filtered.length - MAX_VISIBLE, 0),
      )
    : 0
  const visible = filtered.slice(start, start + viewportHeight)

  useEffect(() => {
    const sb = scrollRef.current
    if (!sb) return
    sb.scrollTop = start
  }, [start])

  const commit = useCallback(
    (index: number) => {
      const model = filtered[index]
      if (model) onSelect(model)
    },
    [filtered, onSelect],
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
          onSelectIndex(
            filtered.length === 0
              ? 0
              : (selectedIndex - 1 + filtered.length) % filtered.length,
          )
          return
        }
        if (name === 'down' || (name === 'tab' && !key.shift)) {
          prevent()
          onSelectIndex(
            filtered.length === 0 ? 0 : (selectedIndex + 1) % filtered.length,
          )
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
          key.name === 'space'
        ) {
          prevent()
          commit(selectedIndex)
          return
        }
        // Printable characters build the filter query. OpenTUI routes keys
        // globally; while the picker is open the text input is blurred
        // (chat.tsx sets inputFocused false), so these land here.
        const ch = key.sequence ?? (key as typeof key & { input?: string }).input ?? ''
        if (ch && ch.length === 1 && !key.ctrl && !key.meta && !(key as typeof key & { alt?: boolean }).alt) {
          prevent()
          onQueryChange(query + ch)
        }
      },
      [filtered.length, selectedIndex, commit, onClose, onSelectIndex, query, onQueryChange],
    ),
  )

  const menuWidth = Math.max(20, Math.min(terminalWidth - 4, 120))
  const maxIdLen = filtered.reduce(
    (max, m) => Math.max(max, m.id.length),
    0,
  )

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
          ? `Filter: "${query}"  ·  ${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
          : `Select a model (↑/↓, Enter, Esc)  ·  ${filtered.length} models`}
      </text>
      <scrollbox
        ref={scrollRef}
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{ visible: needsScroll, trackOptions: { width: 1 } }}
        style={{
          height: viewportHeight + 1,
          flexShrink: 0,
          rootOptions: { flexDirection: 'row', backgroundColor: 'transparent' },
          wrapperOptions: { border: false, backgroundColor: 'transparent' },
          contentOptions: {
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0,
            backgroundColor: 'transparent',
          },
        }}
      >
        {visible.map((model, idx) => {
          const absoluteIndex = start + idx
          const isSelected = absoluteIndex === selectedIndex
          const pad = ' '.repeat(Math.max(0, maxIdLen - model.id.length))
          return (
            <Button
              key={model.id}
              onClick={() => commit(absoluteIndex)}
              style={{
                width: '100%',
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: isSelected ? theme.surfaceHover : theme.surface,
              }}
            >
              <text style={{ fg: isSelected ? theme.foreground : theme.inputFg }}>
                <span fg={theme.primary}>{isSelected ? '› ' : '  '}</span>
                <span fg={theme.foreground} attributes={isSelected ? 1 : 0}>
                  {model.id}
                </span>
                <span>{pad}  </span>
                <span fg={theme.muted}>{model.name}</span>
              </text>
            </Button>
          )
        })}
      </scrollbox>
    </box>
  )
}
