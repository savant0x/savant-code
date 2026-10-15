import { TextAttributes } from '@opentui/core'

import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'
import {
  isEnvTemplateFile,
  isSensitiveFile,
} from '../../utils/create-run-config'
import { TrafficLightPanel } from '../traffic-light-panel'

import type { ToolRenderConfig } from './types'

function FilePathsDescription({ filePaths }: { filePaths: string[] }) {
  const theme = useTheme()

  return (
    <text style={{ wrapMode: 'word' }}>
      {filePaths.map((fp, idx) => {
        const isLast = idx === filePaths.length - 1
        const separator = isLast ? '' : ', '

        if (isSensitiveFile(fp)) {
          return (
            <span key={fp}>
              <span fg={theme.muted} attributes={TextAttributes.STRIKETHROUGH}>
                {fp}
              </span>
              <span fg={theme.muted}> (blocked)</span>
              <span fg={theme.foreground}>{separator}</span>
            </span>
          )
        }

        if (isEnvTemplateFile(fp)) {
          return (
            <span key={fp}>
              <span fg={theme.foreground}>{fp}</span>
              <span fg={theme.muted}> (allowed - example only)</span>
              <span fg={theme.foreground}>{separator}</span>
            </span>
          )
        }

        return (
          <span key={fp} fg={theme.foreground}>
            {fp}
            {separator}
          </span>
        )
      })}
    </text>
  )
}

/**
 * UI component for read_files tool.
 *
 * FID-2026-0822-011: framed in the unified TrafficLightPanel chrome (was a
 * bare SimpleToolCallItem). Displays file paths with labels for
 * blocked/template files.
 */
function FramedPaths({ filePaths }: { filePaths: string[] }) {
  const theme = useTheme()

  return (
    <TrafficLightPanel>
      <box style={{ flexDirection: 'column', gap: 0 }}>
        <text fg={theme.muted}>Read</text>
        <FilePathsDescription filePaths={filePaths} />
      </box>
    </TrafficLightPanel>
  )
}

export const ReadFilesComponent = defineToolComponent({
  toolName: 'read_files',

  render(toolBlock): ToolRenderConfig {
    const rawPaths = toolBlock.input?.paths

    // Extract file paths from input
    const filePaths: string[] = Array.isArray(rawPaths)
      ? rawPaths
          .filter((path): path is string => typeof path === 'string')
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      : []

    if (filePaths.length === 0) {
      return { content: null }
    }

    return {
      content: <FramedPaths filePaths={filePaths} />,
    }
  },
})
