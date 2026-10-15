import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  buildRecorderRetryPrompt,
  checkRecorderOutcome,
  RECORDER_STALL_RETRY_LIMIT,
} from '../recorder-stall-check'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const toolCall = (
  toolCallId: string,
  toolName: string,
  input: Record<string, JSONValue>,
): Message => ({
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId, toolName, input }],
})

const toolResult = (
  toolCallId: string,
  toolName: string,
  value: JSONValue,
): Message => ({
  role: 'tool',
  toolCallId,
  toolName,
  content: [{ type: 'json', value }],
})

const readOnlyHistory = (): Message[] => [
  toolCall('read-1', 'read_files', {
    paths: ['dev/fids/FID-test.md'],
  }),
  toolResult('read-1', 'read_files', { file: 'dev/fids/FID-test.md' }),
]

describe('checkRecorderOutcome (FID-2026-0823-008)', () => {
  it('flags a read-only finish as a stall', () => {
    const outcome = checkRecorderOutcome(readOnlyHistory())
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.reason).toContain('Recorder stalled')
      expect(outcome.reason).toContain('read without write')
    }
  })

  it('passes a successful write_file to dev/fids/', () => {
    const history: Message[] = [
      ...readOnlyHistory(),
      toolCall('write-1', 'write_file', {
        path: 'dev/fids/FID-test.md',
        content: '# FID\n',
      }),
      toolResult('write-1', 'write_file', {
        file: 'dev/fids/FID-test.md',
        message: 'Overwrote file successfully.',
      }),
    ]
    expect(checkRecorderOutcome(history)).toEqual({ ok: true })
  })

  it('passes a write_file to the archive path', () => {
    const history: Message[] = [
      toolCall('write-1', 'write_file', {
        path: 'dev/fids/archive/FID-old.md',
        content: '# FID\n',
      }),
      toolResult('write-1', 'write_file', {
        file: 'dev/fids/archive/FID-old.md',
        message: 'Created file successfully.',
      }),
    ]
    expect(checkRecorderOutcome(history)).toEqual({ ok: true })
  })

  it('passes a write_file to CHANGELOG.md', () => {
    const history: Message[] = [
      toolCall('write-1', 'write_file', {
        path: 'CHANGELOG.md',
        content: '# Changelog\n',
      }),
      toolResult('write-1', 'write_file', {
        file: 'CHANGELOG.md',
        message: 'Overwrote file successfully.',
      }),
    ]
    expect(checkRecorderOutcome(history)).toEqual({ ok: true })
  })

  it('does not count writes outside the allowed set (e.g. dev/scratchpad)', () => {
    const history: Message[] = [
      toolCall('write-1', 'write_file', {
        path: 'dev/scratchpad/note.md',
        content: 'note',
      }),
      toolResult('write-1', 'write_file', {
        file: 'dev/scratchpad/note.md',
        message: 'Created file successfully.',
      }),
    ]
    const outcome = checkRecorderOutcome(history)
    expect(outcome.ok).toBe(false)
  })

  it('does not count a failed write_file (errorMessage result)', () => {
    const history: Message[] = [
      toolCall('write-1', 'write_file', {
        path: 'dev/fids/FID-test.md',
        content: '# FID\n',
      }),
      toolResult('write-1', 'write_file', {
        file: 'dev/fids/FID-test.md',
        errorMessage: 'write_file: path rejected',
      }),
    ]
    const outcome = checkRecorderOutcome(history)
    expect(outcome.ok).toBe(false)
  })

  it('passes the scaffold-seal path (set_output only)', () => {
    const history: Message[] = [
      toolCall('seal-1', 'set_output', {
        value: 'Umbrella FID sealed.',
      }),
    ]
    expect(checkRecorderOutcome(history)).toEqual({ ok: true })
  })

  it('flags an empty history as a stall', () => {
    const outcome = checkRecorderOutcome([])
    expect(outcome.ok).toBe(false)
  })
})

describe('buildRecorderRetryPrompt (FID-2026-0823-012 ISSUE-D)', () => {
  const STALL_REASON =
    'Recorder stalled: read without write — no successful write_file to ' +
    'dev/fids/** or CHANGELOG.md and no set_output before the run ended.'

  it('preserves the original prompt verbatim as the prefix', () => {
    const retry = buildRecorderRetryPrompt('Update FID-123 now', STALL_REASON)
    expect(retry.startsWith('Update FID-123 now\n')).toBe(true)
  })

  it('names the exact relay-guard failure reason', () => {
    const retry = buildRecorderRetryPrompt('Update FID-123 now', STALL_REASON)
    expect(retry).toContain(
      `CORRECTIVE RETRY — your previous run FAILED: ${STALL_REASON}`,
    )
  })

  it('restates the write-required terminal contract', () => {
    const retry = buildRecorderRetryPrompt('Update FID-123 now', STALL_REASON)
    expect(retry).toContain(
      'This run succeeds ONLY with a successful write_file to dev/fids/**',
    )
    expect(retry).toContain('write_file IN THE VERY NEXT STEP')
    expect(retry).toContain('set_output seal')
    expect(retry).toContain('Never end this run with a text reply')
  })

  it('is bounded at exactly one corrective retry per stalled spawn', () => {
    expect(RECORDER_STALL_RETRY_LIMIT).toBe(1)
  })
})

describe('checkRecorderOutcome path-form canonicalization (FID-2026-0823-014)', () => {
  const successfulWriteHistory = (writePath: string): Message[] => [
    toolCall('write-1', 'write_file', {
      path: writePath,
      content: '# FID\n',
    }),
    toolResult('write-1', 'write_file', {
      file: writePath,
      message: 'Created file successfully.',
    }),
  ]

  it('counts an SDK-absolutized FID write (the live false-stall form)', () => {
    // Live probe 2026-08-23: the child wrote via an absolutized Windows
    // path and the raw-prefix guard falsely relayed a stall.
    const absolutized = path.resolve('dev/fids/FID-absolutized.md')
    const outcome = checkRecorderOutcome(successfulWriteHistory(absolutized))
    expect(outcome.ok).toBe(true)
  })

  it('counts an absolutized CHANGELOG.md write', () => {
    const absolutized = path.resolve('CHANGELOG.md')
    const outcome = checkRecorderOutcome(successfulWriteHistory(absolutized))
    expect(outcome.ok).toBe(true)
  })

  it('counts an absolutized FID write under an arbitrary NON-cwd root (cwd independence)', () => {
    // Rev 2 regression: rev 1 scoped matches to canonicalizePath('.') — the
    // CLI's launch-dependent cwd — so legit writes missed whenever cwd ≠ repo
    // root. A path under a completely different root must still count.
    const elsewhere = path.resolve(
      '..',
      'some-other-root',
      'dev',
      'fids',
      'x.md',
    )
    const outcome = checkRecorderOutcome(successfulWriteHistory(elsewhere))
    expect(outcome.ok).toBe(true)
  })

  it('rejects paths without any dev/fids segment or CHANGELOG suffix', () => {
    const outside = path.resolve('..', 'outside-repo', 'notes', 'x.md')
    const outcome = checkRecorderOutcome(successfulWriteHistory(outside))
    expect(outcome.ok).toBe(false)
  })

  it('rejects an absolutized non-CHANGELOG markdown path at any root', () => {
    const outside = path.resolve('..', 'outside-repo', 'CHANGELOG.md.bak')
    const outcome = checkRecorderOutcome(successfulWriteHistory(outside))
    expect(outcome.ok).toBe(false)
  })
})
