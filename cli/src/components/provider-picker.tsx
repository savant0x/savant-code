import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'

import type { ProviderSetupName } from '../utils/provider-setup'
import type { KeyEvent } from '@opentui/core'

interface ProviderPickerProps {
  providers: Array<{
    name: ProviderSetupName
    label: string
    configured: boolean
  }>
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onSelect: (provider: ProviderSetupName) => void
  onClose: () => void
}

/**
 * Interactive provider picker for the /provider command.
 *
 * - Shows all providers with ✓/✗ configuration status.
 * - Arrow / Tab navigation with Enter to select, Escape to close.
 * - Follows the same keyboard pattern as ModelPicker.
 */
export const ProviderPicker: React.FC<ProviderPickerProps> = ({
  providers,
  selectedIndex,
  onSelectIndex,
  onSelect,
  onClose,
}) => {
  const theme = useTheme()

  const commit = useCallback(
    (index: number) => {
      const provider = providers[index]
      if (provider) onSelect(provider.name)
    },
    [providers, onSelect],
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
            (selectedIndex - 1 + providers.length) % providers.length,
          )
          return
        }
        if (name === 'down' || (name === 'tab' && !key.shift)) {
          prevent()
          onSelectIndex((selectedIndex + 1) % providers.length)
          return
        }
        if (name === 'return' || name === 'enter') {
          prevent()
          commit(selectedIndex)
          return
        }
      },
      [selectedIndex, commit, onClose, onSelectIndex, providers.length],
    ),
  )

  return (
    <box
      style={{
        flexDirection: 'column',
        width: 50,
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
        Select a provider (↑/↓, Enter, Esc)
      </text>
      {providers.map((provider, idx) => {
        const isSelected = idx === selectedIndex
        const status = provider.configured ? '✓' : '✗'
        const statusColor = provider.configured ? theme.success : theme.muted

        return (
          <Button
            key={provider.name}
            onClick={() => commit(idx)}
            style={{
              width: '100%',
              paddingLeft: 1,
              paddingRight: 1,
              backgroundColor: isSelected ? theme.surfaceHover : theme.surface,
              flexDirection: 'row',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <text fg={theme.primary} wrapMode="none" selectable={false}>
              {isSelected ? '› ' : '  '}
            </text>
            <text fg={statusColor} wrapMode="none" selectable={false}>
              {status}
            </text>
            <text
              fg={isSelected ? theme.foreground : theme.muted}
              attributes={isSelected ? 1 : 0}
              wrapMode="none"
              selectable={false}
            >
              {provider.label}
            </text>
            <text fg={theme.muted} wrapMode="none" selectable={false}>
              ({provider.name})
            </text>
          </Button>
        )
      })}
    </box>
  )
}
