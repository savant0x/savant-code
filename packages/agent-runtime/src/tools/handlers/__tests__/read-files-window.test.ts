import { getEmbeddedGroundingFile } from '@savant-code/common/util/embedded-protocol'
import { describe, expect, it } from 'bun:test'

import { handleReadFiles } from '../tool/read-files'

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

// LF-001 (FID-2026-1012-007): the window belongs to whoever still holds the
// complete content. Filesystem reads carry it into the request (the SDK
// boundary slices before it caps) and the responder's result is used as-is —
// re-slicing an already-windowed response silently drops lines. Embedded
// grounding reads never cross that boundary, so this handler windows them.
type ReadFilesOutput = SavantCodeToolOutput<'read_files'>

function firstContent(output: ReadFilesOutput): string {
  const [entry] = output as Array<{
    value: Array<{ path: string; content: string }>
  }>
  return entry.value[0]?.content ?? ''
}

describe('handleReadFiles line windows (LF-001)', () => {
  it('forwards the window to the fetch boundary and does not re-slice its response', async () => {
    const calls: Array<{
      filePaths: string[]
      offset?: number
      limit?: number
    }> = []

    const result = await handleReadFiles({
      previousToolCallFinished: Promise.resolve(),
      toolCall: { input: { paths: ['big.md'], offset: 1750, limit: 2 } },
      agentState: { protocolSource: 'local' },
      fileContext: { projectRoot: '/project', tokenCallers: {} },
      requestFiles: async (input: {
        filePaths: string[]
        offset?: number
        limit?: number
      }) => {
        calls.push(input)
        // What a window-serving boundary returns for offset 1750, limit 2.
        return { 'big.md': 'LINE-1750\nLINE-1751\n' }
      },
    } as never)

    expect(calls).toEqual([{ filePaths: ['big.md'], offset: 1750, limit: 2 }])
    // Both lines survive: a second slice with the same offset over this
    // two-line response would leave nothing behind.
    expect(firstContent(result.output)).toBe('LINE-1750\nLINE-1751\n')
  })

  it('windows an embedded grounding read locally', async () => {
    const served = getEmbeddedGroundingFile('architecture.md')
    expect(served).toBeDefined()
    const firstLine = served!.content.split('\n')[0] as string

    const result = await handleReadFiles({
      previousToolCallFinished: Promise.resolve(),
      toolCall: { input: { paths: ['architecture.md'], offset: 1, limit: 1 } },
      agentState: { protocolSource: 'embedded' },
      fileContext: { projectRoot: '/project', tokenCallers: {} },
      requestFiles: async () => {
        throw new Error('embedded grounding reads must not hit the filesystem')
      },
    } as never)

    const content = firstContent(result.output)
    expect(content).toBe(`${firstLine}\n`)
    expect(content.length).toBeLessThan(served!.content.length)
  })

  it('leaves an unwindowed read untouched', async () => {
    const result = await handleReadFiles({
      previousToolCallFinished: Promise.resolve(),
      toolCall: { input: { paths: ['small.md'] } },
      agentState: { protocolSource: 'local' },
      fileContext: { projectRoot: '/project', tokenCallers: {} },
      requestFiles: async () => ({ 'small.md': 'a\nb\nc\n' }),
    } as never)

    expect(firstContent(result.output)).toBe('a\nb\nc\n')
  })
})
