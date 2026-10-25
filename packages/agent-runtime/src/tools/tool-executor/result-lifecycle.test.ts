import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  abortForUserCancellation,
  CommandTimeoutError,
} from '@savant-code/common/util/command-execution'
import { describe, expect, it } from 'bun:test'

import { buildLifecycleFixture, withCaptureRoot } from './lifecycle-fixture'
import { runSuccessLifecycle } from './result-lifecycle'
import { runRejectionLifecycle } from './result-rejection-lifecycle'

import type { GateContext } from './gate-context'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/** FID-005 / 024: exercise the real lifecycle and capture hook in a temp project. */

type CapturedRecord = {
  toolName?: string
  errorFirstLine?: string
  classKey?: string
  expectedness?: string
}

async function readCapturedRecords(root: string): Promise<CapturedRecord[]> {
  const file = path.join(root, 'dev', 'experiences', 'raw-traces.jsonl')
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CapturedRecord)
}

/** A readonly batch whose single command failed, so a pin states only what varies. */
function readonlyBatch(
  root: string,
  toolCallId: string,
  signal: AbortSignal = new AbortController().signal,
) {
  const fixture = buildLifecycleFixture(root)
  const toolCall: SavantCodeToolCall<'run_readonly_command'> = {
    toolName: 'run_readonly_command',
    toolCallId,
    input: { commands: ['fixture'], timeout_seconds: 30 },
  }
  const ctx: GateContext<'run_readonly_command'> = {
    ...fixture.ctx,
    toolName: 'run_readonly_command',
    toolCall,
    params: {
      ...fixture.ctx.params,
      toolName: 'run_readonly_command',
      input: toolCall.input,
      signal,
    },
  }
  return { ctx, trace: fixture.trace }
}

/** The command envelope the readonly producer returns on a failed command. */
function failedCommand(stderr: string, refusal = false) {
  return [
    {
      type: 'json' as const,
      value: {
        commands: ['fixture'],
        results: [
          {
            exitCode: 1,
            stderr,
            ...(refusal
              ? {
                  executionOutcome: 'rejected' as const,
                  executionStarted: false,
                  executedToolName: 'run_readonly_command',
                  terminationState: 'not-started' as const,
                  rejectionReason: 'readonly-guard' as const,
                }
              : {}),
          },
        ],
      },
    },
  ]
}

describe('runSuccessLifecycle error-capture wiring', () => {
  it('records the real error line for a soft-failed result', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace, hookProjectRoot, chunks } =
        buildLifecycleFixture(root)
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot },
        [
          { type: 'json', value: { errorMessage: 'HTTP 404: no results' } },
        ] as SavantCodeToolOutput<'web_search'>,
        undefined,
      )
      expect(chunks.some((c) => c.type === 'tool_result')).toBe(true)
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.errorFirstLine).toBe('HTTP 404: no results')
      expect(records[0]?.toolName).toBe('web_search')
    })
  })

  it('records no failure for a successful result', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace, hookProjectRoot } = buildLifecycleFixture(root)
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot },
        [
          { type: 'json', value: { result: 'search returned 3 results' } },
        ] as SavantCodeToolOutput<'web_search'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(0)
    })
  })

  it('records a failed readonly batch through the production hook engine', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace } = readonlyBatch(root, 'batch-failure')
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot: root },
        failedCommand(
          'fixture failed',
        ) as SavantCodeToolOutput<'run_readonly_command'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.toolName).toBe('run_readonly_command')
      expect(records[0]?.errorFirstLine).toBe(
        'Command exited with code 1: fixture failed',
      )
      // FID-2026-1024-001 D2: a genuine host exit is the program's answer —
      // expected, still counted. Its row now forks to the `:expected`
      // sibling class while the historical `:undetermined` key keeps its old
      // rows (D5).
      expect(records[0]?.expectedness).toBe('expected')
      expect(records[0]?.classKey).toBe(
        'v1:run_readonly_command:command-exit:expected',
      )
    })
  })

  it('records a guard refusal as the expected outcome it is', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace } = readonlyBatch(root, 'refusal')
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot: root },
        failedCommand(
          'run_readonly_command rejected: forbidden metacharacters',
          true,
        ) as SavantCodeToolOutput<'run_readonly_command'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.errorFirstLine).toBe(
        'run_readonly_command rejected: forbidden metacharacters',
      )
      expect(records[0]?.expectedness).toBe('expected')
      expect(records[0]?.classKey).toBe(
        'v1:run_readonly_command:refused:expected',
      )
    })
  })

  it('captures a later real failure after an expected refusal in a batch', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace } = readonlyBatch(root, 'mixed-batch')
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot: root },
        [
          {
            type: 'json' as const,
            value: {
              commands: ['forbidden', 'host-failure'],
              results: [
                {
                  exitCode: 1,
                  stderr: 'run_readonly_command rejected: forbidden',
                  executionOutcome: 'rejected' as const,
                  executionStarted: false,
                  executedToolName: 'run_readonly_command',
                  terminationState: 'not-started' as const,
                  rejectionReason: 'readonly-guard' as const,
                },
                { exitCode: 1, stderr: 'host failure' },
              ],
            },
          },
        ] as SavantCodeToolOutput<'run_readonly_command'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.errorFirstLine).toBe(
        'Command exited with code 1: host failure',
      )
      // FID-2026-1024-001: the refusal and the real failure are BOTH expected
      // now; the pinned captor keeps the later (real) outcome so the
      // historical generation is still represented in the forked class (D6),
      // which lands at :expected per D2.
      expect(records[0]?.expectedness).toBe('expected')
      expect(records[0]?.classKey).toBe(
        'v1:run_readonly_command:command-exit:expected',
      )
    })
  })

  it('records a declared, enforced timeout through the rejection path', async () => {
    // FID-2026-1024-001 D4: the rejection lifecycle classifies the timeout by
    // the producer's own evidence — the budget it declared and the termination
    // it requested — so the row lands expected on the same authority the
    // walker uses for batch values.
    await withCaptureRoot(async (root) => {
      const { ctx, trace } = readonlyBatch(root, 'timeout-rejection')
      await runRejectionLifecycle(
        { ctx, trace, hookProjectRoot: root },
        new CommandTimeoutError(1800, 'run_terminal_command', true, 'requested'),
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.expectedness).toBe('expected')
      expect(records[0]?.classKey).toBe(
        'v1:run_readonly_command:timeout:expected',
      )
    })
  })

  it('records only a typed user cancellation as expected', async () => {
    await withCaptureRoot(async (root) => {
      const controller = new AbortController()
      abortForUserCancellation(controller)
      const { ctx, trace } = readonlyBatch(
        root,
        'user-cancel',
        controller.signal,
      )
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot: root },
        [
          {
            type: 'json' as const,
            value: {
              errorMessage: 'Command cancelled: execution did not complete.',
              executionOutcome: 'cancelled',
              executionStarted: false,
              executedToolName: 'run_readonly_command',
              terminationState: 'not-started',
              cancellationReason: 'user-request',
            },
          },
        ] as SavantCodeToolOutput<'run_readonly_command'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.expectedness).toBe('expected')
      expect(records[0]?.classKey).toBe(
        'v1:run_readonly_command:cancelled:expected',
      )
    })
  })
})
