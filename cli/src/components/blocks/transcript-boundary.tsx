import { isValidElement } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { processBlocks } from '../../utils/block-processor'
import { Button } from '../button'
import { ErrorBoundary } from '../error-boundary'

import type { ContentBlock } from '../../types/chat'
import type { BlockProcessorHandlers } from '../../utils/block-processor'
import type { ReactNode } from 'react'

const MAX_FALLBACK_CHARACTERS = 2000

/** Shared grouping boundary for root messages and nested agent transcripts. */
export function containTranscriptNodes(
  blocks: ContentBlock[],
  handlers: BlockProcessorHandlers,
  label: string,
): ReactNode[] {
  return processBlocks(blocks, handlers).map((node, index) => (
    <TranscriptBoundary
      key={`${label}-group-${isValidElement(node) ? (node.key ?? index) : index}`}
      label={`${label}:${index}`}
      rawContent={() => JSON.stringify(blocks)}
    >
      {node}
    </TranscriptBoundary>
  ))
}

function preview(rawContent: string | (() => string)): string {
  try {
    return (typeof rawContent === 'function' ? rawContent() : rawContent).slice(
      0,
      MAX_FALLBACK_CHARACTERS,
    )
  } catch {
    return 'The original content is preserved in your conversation history.'
  }
}

/** Isolate a faulty transcript group; never unmount the input or discard history. */
export function TranscriptBoundary({
  children,
  rawContent,
  label,
}: {
  children: ReactNode
  rawContent: string | (() => string)
  label: string
}) {
  const theme = useTheme()
  return (
    <ErrorBoundary
      componentName={`Transcript:${label}`}
      fallback={(_error, retry) => (
        <box style={{ flexDirection: 'column', width: '100%' }}>
          <text fg={theme.error}>
            This content could not be displayed. Your session is still active.
          </text>
          <text fg={theme.foreground} style={{ wrapMode: 'word' }}>
            {preview(rawContent)}
          </text>
          <Button id={`transcript-retry:${label}`} onClick={retry}>
            <text fg={theme.link}>Retry display</text>
          </Button>
        </box>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
