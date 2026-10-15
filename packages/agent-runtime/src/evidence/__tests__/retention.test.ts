// FID-2026-1007-004 — the retention seam's contract.
//
// The record's verification property is: for every payload a destructive path
// would discard, EITHER the original bytes are recoverable from the handle the
// marker carries, OR the payload was not discarded and the refusal is named.
// These pins cover the first half at its source — the seam — because a marker is
// only as good as the handle it was handed.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  lookupRetention,
  rememberRetention,
  resetRetentionRegistry,
} from '../retention-registry'
import {
  EVIDENCE_MAX_RECORD_BYTES,
  evidenceFilePath,
  loadEvidenceRecords,
  resetEvidenceRecordCache,
  retainOriginal,
  sha256Hex,
} from '../spill'

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'savant-retention-'))
}

const base = {
  runId: 'run-1',
  agentId: 'agent-1',
  toolCallId: 'call-1',
  toolName: 'code_search',
}

describe('retainOriginal — a handle, never a silent boolean', () => {
  it('returns a handle whose sha256 and bytes match the stored record', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ matches: ['a', 'b'] })

    const result = await retainOriginal({ ...base, projectRoot: root, raw })

    expect(result.retained).toBe(true)
    if (!result.retained) throw new Error('unreachable')
    expect(result.handle.sha256).toBe(sha256Hex(raw))
    expect(result.handle.bytes).toBe(raw.length)
    expect(result.handle.toolCallId).toBe('call-1')
    expect(result.handle.file).toBe(evidenceFilePath(root, 'run-1'))

    // The handle must resolve: the bytes come back out of the store it names.
    const records = await loadEvidenceRecords(root, 'run-1')
    expect(records).toHaveLength(1)
    expect(records[0]?.raw).toBe(raw)
    expect(records[0]?.sha256).toBe(result.handle.sha256)
  })

  it('refuses with a named reason when there is no project root', async () => {
    const result = await retainOriginal({ ...base, projectRoot: '', raw: 'x' })
    expect(result).toEqual({ retained: false, reason: 'no-project-root' })
  })

  it('refuses with a named reason when the record exceeds the cap', async () => {
    const root = await tempRoot()
    const raw = 'x'.repeat(EVIDENCE_MAX_RECORD_BYTES + 1)

    const result = await retainOriginal({ ...base, projectRoot: root, raw })

    expect(result).toEqual({ retained: false, reason: 'record-too-large' })
    // A refusal must not have written anything.
    expect(await loadEvidenceRecords(root, 'run-1')).toHaveLength(0)
  })

  it('refuses with a named reason when the store cannot be written', async () => {
    const root = await tempRoot()
    // A FILE where the store's parent directory must be, so mkdir fails.
    const blocker = path.join(root, 'blocker')
    await writeFile(blocker, 'not a directory', 'utf8')

    const result = await retainOriginal({
      ...base,
      projectRoot: blocker,
      raw: 'x',
    })

    expect(result).toEqual({ retained: false, reason: 'io-error' })
    expect(await readFile(blocker, 'utf8')).toBe('not a directory')
  })

  it('appends rather than replacing, so a second payload keeps the first', async () => {
    const root = await tempRoot()
    await retainOriginal({ ...base, projectRoot: root, raw: 'first' })
    await retainOriginal({
      ...base,
      toolCallId: 'call-2',
      projectRoot: root,
      raw: 'second',
    })

    const records = await loadEvidenceRecords(root, 'run-1')
    expect(records.map((record) => record.raw)).toEqual(['first', 'second'])
  })

  it('serves repeated loadEvidenceRecords from cache and invalidates when shard size grows (FID-2026-1013-010 W1-3)', async () => {
    const root = await tempRoot()
    resetEvidenceRecordCache()
    await retainOriginal({ ...base, projectRoot: root, raw: 'alpha' })

    const firstRead = await loadEvidenceRecords(root, 'run-1')
    const secondRead = await loadEvidenceRecords(root, 'run-1')
    expect(firstRead.map((r) => r.raw)).toEqual(['alpha'])
    expect(secondRead.map((r) => r.raw)).toEqual(['alpha'])

    // Appending within the same millisecond changes `size`, invalidating the cache.
    await retainOriginal({
      ...base,
      toolCallId: 'call-2',
      projectRoot: root,
      raw: 'beta',
    })
    const thirdRead = await loadEvidenceRecords(root, 'run-1')
    expect(thirdRead.map((r) => r.raw)).toEqual(['alpha', 'beta'])
  })
})

describe('retention registry — the in-process transport for a handle', () => {
  it('round-trips an outcome by toolCallId and clears on reset', () => {
    resetRetentionRegistry()
    expect(lookupRetention('call-9')).toBeUndefined()

    rememberRetention('call-9', {
      retained: true,
      handle: {
        file: '/tmp/x.jsonl',
        toolCallId: 'call-9',
        sha256: 'abc',
        bytes: 3,
        redacted: false,
      },
    })
    expect(lookupRetention('call-9')?.retained).toBe(true)

    resetRetentionRegistry()
    expect(lookupRetention('call-9')).toBeUndefined()
  })

  it('never invents an outcome for a missing identity', () => {
    resetRetentionRegistry()
    expect(lookupRetention(undefined)).toBeUndefined()
    expect(lookupRetention('')).toBeUndefined()
    rememberRetention('', { retained: false, reason: 'io-error' })
    expect(lookupRetention('')).toBeUndefined()
  })
})
