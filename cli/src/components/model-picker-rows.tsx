import { Button } from './button'
import { Badge } from './savant-ui/data-display/badge'

import type { ModelProvider, ModelItem } from './model-picker-grouping'
import type { ChatTheme } from '../types/theme-system'

interface ModelPickerHeaderRowProps {
  provider: ModelProvider
  theme: ChatTheme
}

export const ModelPickerHeaderRow = ({
  provider,
  theme,
}: ModelPickerHeaderRowProps) => (
  <box
    style={{
      width: '100%',
      paddingLeft: 1,
      paddingTop: 0,
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
      {provider.toUpperCase()}
    </text>
  </box>
)

interface ModelPickerModelRowProps {
  item: ModelItem
  isSelected: boolean
  onCommit: (index: number) => void
  index: number
  theme: ChatTheme
}

export const ModelPickerModelRow = ({
  item,
  isSelected,
  onCommit,
  index,
  theme,
}: ModelPickerModelRowProps) => {
  const { model, provider } = item
  return (
    <Button
      key={model.id}
      onClick={() => onCommit(index)}
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
      {/* Marker + model ID */}
      <box style={{ flexDirection: 'row', flexShrink: 0, gap: 0 }}>
        <text fg={theme.primary} wrapMode="none" selectable={false}>
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
        <text fg={theme.muted} wrapMode="char" selectable={false}>
          {model.name}
        </text>
      </box>
    </Button>
  )
}
