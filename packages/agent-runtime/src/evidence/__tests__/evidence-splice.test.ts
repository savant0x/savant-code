import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  EVIDENCE_MAX_RECORD_BYTES,
  evidenceFilePath,
  parseEvidenceFile,
  recordEvidence,
} from '../spill'
import { buildRestoredEvidenceNote, spliceRawEvidence } from '../splice'

describe('evidence spill + splice (FID-2026-0824-026)', () => {
  test('recordEvidence appends parseable JSONL and round-trips', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'evidence-'))

    const ok = await recordEvidence({
      projectRoot: root,
      runId: 'r1',
      agentId: 'a1',
      toolCallId: 't1',
      toolName: 'read_files',
      raw: '{"v":1}',
    })

    expect(ok).toBe(true)
    const text = await readFile(evidenceFilePath(root, 'r1'), 'utf8')
    const records = parseEvidenceFile(text)
    expect(records).toHaveLength(1)
    expect(records[0]?.toolCallId).toBe('t1')
    expect(records[0]?.sha256).toHaveLength(64)
  })

  test('oversized records are rejected without throwing', async () => {
    const root = path.join(tmpdir(), 'evidence-oversize')
    await mkdir(root, { recursive: true })

    const ok = await recordEvidence({
      projectRoot: root,
      runId: 'r',
      agentId: 'a',
      toolCallId: 't',
      toolName: 'x',
      raw: 'y'.repeat(EVIDENCE_MAX_RECORD_BYTES + 1),
    })

    expect(ok).toBe(false)
  })

  test('splice restores sentinels from records and skips live results', () => {
    const messages = [
      { role: 'user', content: 'hi' },
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 't1',
        content: [{ type: 'json', value: '[compacted]' }],
      },
      {
        role: 'tool',
        toolName: 'run_terminal_command',
        toolCallId: 't2',
        content: [{ type: 'json', value: { exitCode: 0 } }],
      },
    ]
    const records = new Map([
      [
        't1',
        {
          ts: 1,
          runId: 'r',
          agentId: 'a',
          toolCallId: 't1',
          toolName: 'read_files',
          byteSize: 14,
          sha256: 'z',
          raw: '{"body":"real data"}',
        },
      ],
    ])

    const { messages: out, restoredToolCallIds } = spliceRawEvidence(
      messages,
      records,
    )

    expect(restoredToolCallIds).toEqual(['t1'])
    const restoredContent = JSON.stringify(out[1]?.content)
    expect(restoredContent).toContain('"body":"real data"')
    expect(restoredContent).not.toContain('[compacted]')
    expect(JSON.stringify(out[2]?.content)).toContain('exitCode')
  })

  test('splice restores an omission-marked message, not only a sentinel', () => {
    // FID-2026-1007-004 step 5: the trim pass and the four transforms never
    // write a `[compacted]` sentinel — they replace the payload with a bounded
    // kept value plus an `omitted` marker. Before this pin the splice skipped
    // every one of them, so a stored original could not be restored over the
    // marker that had taken its place.
    const messages = [
      {
        role: 'tool',
        toolName: 'code_search',
        toolCallId: 't9',
        content: [
          {
            type: 'json',
            value: {
              omitted: {
                reason: 'output exceeded 50000 bytes',
                originalChars: 60_000,
                keptChars: 500,
                omittedChars: 59_500,
                preview: 'x',
                retained: {
                  ok: true,
                  file: 'f',
                  toolCallId: 't9',
                  sha256: 'h',
                  bytes: 60_000,
                  redacted: false,
                },
              },
            },
          },
        ],
      },
    ]
    const records = new Map([
      [
        't9',
        {
          ts: 1,
          runId: 'r',
          agentId: 'a',
          toolCallId: 't9',
          toolName: 'code_search',
          byteSize: 17,
          sha256: 'h',
          raw: '{"body":"all of it"}',
        },
      ],
    ])

    const { messages: out, restoredToolCallIds } = spliceRawEvidence(
      messages,
      records,
    )

    expect(restoredToolCallIds).toEqual(['t9'])
    expect(JSON.stringify(out[0]?.content)).toContain('all of it')
  })

  test('restored-evidence note is bounded and null when empty', () => {
    expect(buildRestoredEvidenceNote(['t1', 't9'])).toContain('count="2"')
    expect(buildRestoredEvidenceNote([])).toBeNull()
  })
})
