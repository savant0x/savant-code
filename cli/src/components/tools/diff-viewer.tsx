import { useMemo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { createSyntaxStyle } from '../../utils/syntax-theme'

interface DiffViewerProps {
  diffText: string
}

export const DiffViewer = ({ diffText }: DiffViewerProps) => {
  const theme = useTheme()
  const syntaxStyle = useMemo(() => createSyntaxStyle(theme), [theme])

  return (
    <box
      style={{ flexDirection: 'column', gap: 0, width: '100%', flexGrow: 1 }}
    >
      <code content={diffText} filetype="diff" syntaxStyle={syntaxStyle} />
    </box>
  )
}
