import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { describe, it, expect } from 'bun:test'

import { handleReadSubtree } from '../tool/read-subtree'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

// Type for read_subtree result entries
interface ReadSubtreeResultEntry {
  type: 'directory' | 'file'
  path: string
  printedTree?: string
  tokenCount?: number
  truncationLevel?: 'none' | 'unimportant-files' | 'tokens' | 'depth-based'
  variables?: string[]
  errorMessage?: string
}

function createLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
}

function buildMockFileContext() {
  const ctx = getStubProjectFileContext()
  ctx.fileTree = [
    {
      name: 'src',
      type: 'directory',
      filePath: 'src',
      children: [
        {
          name: 'index.ts',
          type: 'file',
          filePath: 'src/index.ts',
          lastReadTime: 0,
        },
        {
          name: 'util.ts',
          type: 'file',
          filePath: 'src/util.ts',
          lastReadTime: 0,
        },
      ],
    },
    {
      name: 'package.json',
      type: 'file',
      filePath: 'package.json',
      lastReadTime: 0,
    },
  ]
  ctx.fileTokenScores = {
    'src/index.ts': { beta: 2.0, alpha: 1.0 },
    'src/util.ts': { helper: 3.0 },
    'package.json': {},
  }
  return ctx
}

// FID-2026-0819-005 Loop 197: maxTokens-budget suite moved verbatim from
// read-subtree.test.ts; harness copied verbatim.

describe('handleReadSubtree', () => {
  it('honors maxTokens by reducing token count under a tiny budget', async () => {
    const fileContext = buildMockFileContext()
    const logger = createLogger()

    // Large budget (baseline)
    const largeToolCall: SavantCodeToolCall<'read_subtree'> = {
      toolName: 'read_subtree',
      toolCallId: 'tc-4a',
      input: { paths: ['src'], maxTokens: 50000 },
    }
    const { output: largeOutput } = await handleReadSubtree({
      previousToolCallFinished: Promise.resolve(),
      toolCall: largeToolCall,
      fileContext,
      logger,
    })
    expect(largeOutput[0].type).toBe('json')
    const largeValue = largeOutput[0].value as ReadSubtreeResultEntry[]
    const largeDirEntry = largeValue.find(
      (v) => v.type === 'directory' && v.path === 'src',
    )
    expect(largeDirEntry).toBeTruthy()

    // Tiny budget
    const tinyBudget = 5
    const smallToolCall: SavantCodeToolCall<'read_subtree'> = {
      toolName: 'read_subtree',
      toolCallId: 'tc-4b',
      input: { paths: ['src'], maxTokens: tinyBudget },
    }
    const { output: smallOutput } = await handleReadSubtree({
      previousToolCallFinished: Promise.resolve(),
      toolCall: smallToolCall,
      fileContext,
      logger,
    })
    expect(smallOutput[0].type).toBe('json')
    const smallValue = smallOutput[0].value as ReadSubtreeResultEntry[]
    const smallDirEntry = smallValue.find(
      (v) => v.type === 'directory' && v.path === 'src',
    )
    expect(smallDirEntry).toBeTruthy()

    // Must honor the tiny budget
    expect(typeof smallDirEntry!.tokenCount).toBe('number')
    expect(smallDirEntry!.tokenCount).toBeLessThanOrEqual(tinyBudget)

    // Typically, token count under tiny budget should be <= baseline
    expect(smallDirEntry!.tokenCount).toBeLessThanOrEqual(
      largeDirEntry!.tokenCount!,
    )
  })
})
