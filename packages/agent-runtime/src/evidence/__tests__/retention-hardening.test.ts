// FID-2026-1007-004 steps 6 and 7 — the store's Law 12 policy, its ceilings,
// and the resolver a handler's locator is checked against.
//
// The record named two limits here and this file removes both: `store-full` had
// no pin because producing it honestly "needs an 8 MiB fixture" — the caps are
// now injectable, so the refusal is pinned with a three-byte store — and the
// store persisted raw tool output unredacted with no stated policy.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  evidenceFilePath,
  loadEvidenceRecords,
  resolveRetainedPayload,
  retainOriginal,
  sha256Hex,
} from '../spill'

import type { EvidenceSpillRecord } from '../spill'

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'savant-retention-hardening-'))
}

const base = {
  runId: 'run-1',
  agentId: 'agent-1',
  toolCallId: 'call-1',
  toolName: 'code_search',
}

describe('the store states its redaction policy instead of defaulting to none', () => {
  it('redacts a credential before it reaches disk, and says so on the handle', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ token: 'sk-abcdefgh12345' })

    const result = await retainOriginal({ ...base, projectRoot: root, raw })

    expect(result.retained).toBe(true)
    if (!result.retained) throw new Error('unreachable')
    expect(result.handle.redacted).toBe(true)

    const records = await loadEvidenceRecords(root, 'run-1')
    const stored = records[0]?.raw ?? ''
    expect(stored).not.toContain('sk-abcdefgh12345')
    expect(stored).toContain('[REDACTED]')
    // The handle describes what was STORED, not what was handed in.
    expect(result.handle.sha256).toBe(sha256Hex(stored))
    expect(result.handle.bytes).toBe(stored.length)
  })

  it('leaves a payload with no secret byte-identical and marks it unredacted', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ matches: ['a', 'b'] })

    const result = await retainOriginal({ ...base, projectRoot: root, raw })

    if (!result.retained) throw new Error('unreachable')
    expect(result.handle.redacted).toBe(false)
    expect((await loadEvidenceRecords(root, 'run-1'))[0]?.raw).toBe(raw)
  })
})

describe('the ceilings are reported and sharded rather than swallowed', () => {
  it('rotates to a new shard instead of refusing when a shard fills', async () => {
    const root = await tempRoot()

    const first = await retainOriginal({
      ...base,
      projectRoot: root,
      raw: 'a'.repeat(50),
      maxShardBytes: 1,
    })
    const second = await retainOriginal({
      ...base,
      toolCallId: 'call-2',
      projectRoot: root,
      raw: 'b'.repeat(50),
      maxShardBytes: 1,
    })

    if (!first.retained || !second.retained) {
      throw new Error('expected both payloads to be retained')
    }
    // The first shard keeps the canonical name, so existing readers still work.
    expect(first.handle.file).toBe(evidenceFilePath(root, 'run-1'))
    expect(second.handle.file).not.toBe(first.handle.file)

    const records = await loadEvidenceRecords(root, 'run-1')
    expect(records.map((record) => record.raw)).toEqual([
      'a'.repeat(50),
      'b'.repeat(50),
    ])
  })

  it('names store-full only when every shard is full, and writes nothing', async () => {
    const root = await tempRoot()

    await retainOriginal({
      ...base,
      projectRoot: root,
      raw: 'a',
      maxShardBytes: 1,
      maxShards: 1,
    })
    const refused = await retainOriginal({
      ...base,
      toolCallId: 'call-2',
      projectRoot: root,
      raw: 'b',
      maxShardBytes: 1,
      maxShards: 1,
    })

    expect(refused).toEqual({ retained: false, reason: 'store-full' })
    expect(await loadEvidenceRecords(root, 'run-1')).toHaveLength(1)
  })

  it('keeps the record cap measured against the stored bytes', async () => {
    const root = await tempRoot()

    const result = await retainOriginal({
      ...base,
      projectRoot: root,
      raw: 'x'.repeat(101),
      maxRecordBytes: 100,
    })

    expect(result).toEqual({ retained: false, reason: 'record-too-large' })
    expect(await loadEvidenceRecords(root, 'run-1')).toHaveLength(0)
  })
})

describe('a handle resolves for whoever owns the payload', () => {
  it('returns the stored bytes when the handle verifies', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ owned: true })
    const result = await retainOriginal({ ...base, projectRoot: root, raw })
    if (!result.retained) throw new Error('unreachable')

    const resolved = await resolveRetainedPayload(result.handle)

    expect(resolved.found).toBe(true)
    if (resolved.found) {
      expect(resolved.raw).toBe(raw)
      expect(resolved.sha256Verified).toBe(true)
    }
  })

  it('refuses bytes that no longer match the handle hash', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ owned: true })
    const result = await retainOriginal({ ...base, projectRoot: root, raw })
    if (!result.retained) throw new Error('unreachable')

    // Tamper: same store, same identity, different bytes.
    const tampered: EvidenceSpillRecord = {
      ts: 1,
      runId: 'run-1',
      agentId: 'agent-1',
      toolCallId: 'call-1',
      toolName: 'code_search',
      byteSize: raw.length,
      sha256: result.handle.sha256,
      raw: 'tampered',
    }
    await writeFile(result.handle.file, `${JSON.stringify(tampered)}\n`, 'utf8')

    expect(await resolveRetainedPayload(result.handle)).toEqual({
      found: false,
      why: 'sha256-mismatch',
    })
  })

  it('reports a handle the store no longer holds', async () => {
    const root = await tempRoot()
    const raw = JSON.stringify({ owned: true })
    const result = await retainOriginal({ ...base, projectRoot: root, raw })
    if (!result.retained) throw new Error('unreachable')

    expect(
      await resolveRetainedPayload({
        ...result.handle,
        toolCallId: 'call-never-stored',
      }),
    ).toEqual({ found: false, why: 'not-in-store' })
  })

  it('never throws at an unreadable store', async () => {
    const root = await tempRoot()
    const blocker = path.join(root, 'blocker')
    await writeFile(blocker, 'not a directory', 'utf8')

    const resolved = await resolveRetainedPayload({
      file: path.join(blocker, 'nested', 'x.jsonl'),
      toolCallId: 'call-1',
      sha256: 'deadbeef',
      bytes: 1,
      redacted: false,
    })

    expect(resolved).toEqual({ found: false, why: 'io-error' })
    expect(await readFile(blocker, 'utf8')).toBe('not a directory')
  })
})
