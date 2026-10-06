import { readFileSync } from 'node:fs'
import path from 'path'

import {
  BRANCH_SUMMARY_PROGRESS_SUBLISTS,
  BRANCH_SUMMARY_SECTIONS,
} from '@savant-code/agent-runtime/context-compactor/branch-summarization'
import { afterEach, describe, expect, test } from 'bun:test'

import { clearActiveRunAborter, setActiveRunAborter } from '../active-run'
import { abandonActiveRun, buildBranchSummary } from '../branch-summary'

import type { ChatMessage } from '../../types/chat'

/**
 * FID-2026-1006-003 WP6: branch summarization must have a real consumer. These
 * tests assert the CALLER, not just the module — the chat-switch paths call
 * `abandonActiveRun`, so removing the wiring fails here instead of only
 * failing the user.
 */
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..', '..')

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const owner = 'branch-summary-wiring'

afterEach(() => {
  clearActiveRunAborter(owner)
})

/** A conversation with one completed call and one still in flight. */
function conversation(): ChatMessage[] {
  return [
    {
      id: 'u1',
      variant: 'user',
      content: 'Wire the uncalled modules',
      timestamp: '2026-10-06T00:00:00.000Z',
    },
    {
      id: 'a1',
      variant: 'ai',
      content: '',
      timestamp: '2026-10-06T00:00:01.000Z',
      blocks: [
        {
          type: 'tool',
          toolCallId: 't1',
          toolName: 'read_files',
          input: { paths: ['cli/src/app.tsx'] },
          output: 'ok',
        },
        {
          type: 'tool',
          toolCallId: 't2',
          toolName: 'str_replace',
          input: { path: 'cli/src/utils/active-run.ts' },
        },
      ],
    },
  ]
}

describe('branch summary wiring (FID-2026-1006-003 WP6)', () => {
  test('the chat-switch paths abandon the run through the summarizer', () => {
    const chatCommand = source('cli/src/commands/defs/chat.ts')
    const app = source('cli/src/app.tsx')

    for (const file of [chatCommand, app]) {
      expect(file).toContain('abandonActiveRun(')
      expect(file).not.toContain('abortActiveRun(')
    }
    expect(chatCommand).toContain("from '../../utils/branch-summary'")
    expect(app).toContain("from './utils/branch-summary'")
  })

  test('a mid-turn switch aborts the run and leaves a summary behind', () => {
    let aborts = 0
    setActiveRunAborter(owner, () => {
      aborts += 1
    })
    const appended: string[] = []
    const persisted: Array<{ chatId: string; text: string }> = []

    const aborted = abandonActiveRun({
      append: (text) => appended.push(text),
      persist: (chatId, text) => persisted.push({ chatId, text }),
      loadMessages: conversation,
      resolveChatId: () => 'chat-abandoned',
    })

    expect(aborted).toBe(true)
    expect(aborts).toBe(1)
    expect(appended).toHaveLength(1)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].chatId).toBe('chat-abandoned')
    expect(persisted[0].text).toBe(appended[0])
  })

  test('the summary keeps the fixed skeleton and verbatim targets', () => {
    const text = buildBranchSummary(conversation())

    for (const section of BRANCH_SUMMARY_SECTIONS) {
      expect(text).toContain(`## ${section}`)
    }
    for (const sublist of BRANCH_SUMMARY_PROGRESS_SUBLISTS) {
      expect(text).toContain(`### ${sublist}`)
    }
    expect(text).toContain('## Goal\nWire the uncalled modules')
    expect(text).toContain('- read_files: cli/src/app.tsx')
    expect(text).toContain('- str_replace: cli/src/utils/active-run.ts')
  })

  test('an empty conversation still renders every section', () => {
    const text = buildBranchSummary([])

    for (const section of BRANCH_SUMMARY_SECTIONS) {
      expect(text).toContain(`## ${section}`)
    }
  })

  test('no live run means nothing is summarized', () => {
    const appended: string[] = []

    const aborted = abandonActiveRun({ append: (text) => appended.push(text) })

    expect(aborted).toBe(false)
    expect(appended).toHaveLength(0)
  })

  test('a persistence failure never breaks the chat switch', () => {
    setActiveRunAborter(owner, () => {})
    const appended: string[] = []

    const aborted = abandonActiveRun({
      append: (text) => appended.push(text),
      persist: () => {
        throw new Error('database unavailable')
      },
      loadMessages: conversation,
      resolveChatId: () => 'chat-abandoned',
    })

    expect(aborted).toBe(true)
    expect(appended).toHaveLength(1)
  })
})
