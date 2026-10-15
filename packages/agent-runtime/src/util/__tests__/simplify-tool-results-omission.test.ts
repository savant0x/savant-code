// FID-2026-1007-004 step 3 — one omission marker, and no drop without a handle.
//
// The record's verification property: for every payload a destructive path would
// discard, EITHER the original bytes are recoverable from the handle the marker
// carries, OR the payload was not discarded and the refusal is named. These pins
// drive the four SHIPPED transforms through both legs, with a real store behind
// the first leg — the handle is not asserted against a stub.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  lookupRetention,
  rememberRetention,
} from '../../evidence/retention-registry'
import { resolveRetainedPayload, retainOriginal } from '../../evidence/spill'
import {
  TOOL_OUTPUT_LIMITS,
  simplifyReadFileResults,
  simplifyTerminalCommandResults,
  simplifyVerboseToolResults,
  truncateToolOutputValue,
} from '../simplify-tool-results'

import type { OmissionMarker } from '../simplify-tool-results'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const LONG = 'x'.repeat(60_000)

/**
 * Store `raw` for REAL through the boundary seam, then hand the transform the
 * same verdict the boundary hands it in production.
 */
async function withHandle(toolCallId: string, raw: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'savant-omission-'))
  const result = await retainOriginal({
    projectRoot: root,
    runId: 'run-1',
    agentId: 'agent-1',
    toolCallId,
    toolName: 'code_search',
    raw,
  })
  if (!result.retained) throw new Error('fixture retention failed')
  rememberRetention(toolCallId, result)
  return result
}

function omissionOf(value: JSONValue): OmissionMarker {
  return (value as Record<string, unknown>).omitted as OmissionMarker
}

describe('the omission marker — a locator or a refusal, never a promise', () => {
  it('a dropped payload carries a handle that resolves to the bytes it took', async () => {
    const raw = JSON.stringify(LONG)
    const retained = await withHandle('call-string', raw)

    const marker = omissionOf(truncateToolOutputValue(LONG, {}, 'call-string'))

    expect(marker.omittedChars).toBeGreaterThan(0)
    expect(marker.reason).toContain('bytes')
    // The marker's locator IS the boundary's handle — byte for byte.
    expect(marker.retained).toEqual({ ok: true, ...retained.handle })

    // ...and the locator resolves: the bytes come back out of the store.
    const resolved = await resolveRetainedPayload(retained.handle)
    expect(resolved.found).toBe(true)
    if (resolved.found) expect(resolved.raw).toBe(raw)
  })

  it('never advertises a location it cannot compute: fullOutput is gone', async () => {
    await withHandle('call-string-2', JSON.stringify(LONG))
    const marker = omissionOf(
      truncateToolOutputValue(LONG, {}, 'call-string-2'),
    )
    expect(marker).not.toHaveProperty('fullOutput')
  })

  it('refuses to drop a payload with no retention verdict at all', () => {
    const value: JSONValue = LONG
    // No handle, no proof, no drop — returned by reference, untouched.
    expect(truncateToolOutputValue(value)).toBe(value)
  })

  it('refuses to drop when the boundary refused, and the refusal is nameable', () => {
    rememberRetention('call-refused', {
      retained: false,
      reason: 'record-too-large',
    })
    const value: JSONValue = LONG

    expect(truncateToolOutputValue(value, {}, 'call-refused')).toBe(value)
    expect(lookupRetention('call-refused')).toEqual({
      retained: false,
      reason: 'record-too-large',
    })
  })

  it('never reports a byte-cap truncation next to zero omitted characters', async () => {
    const big = { data: 'x'.repeat(TOOL_OUTPUT_LIMITS.maxBytes + 100) }
    await withHandle('call-object', JSON.stringify(big))

    const marker = omissionOf(truncateToolOutputValue(big, {}, 'call-object'))

    expect(marker.omittedChars).toBe(0)
    expect(marker.reason).not.toContain('bytes')
    expect(marker.retained).toEqual(
      expect.objectContaining({ ok: true, bytes: JSON.stringify(big).length }),
    )
  })

  it('threads the tool identity, so the verbose pre-pass drops only what was retained', async () => {
    // A string payload, because it is the shape that REPLACES bytes with the
    // marker (the object branch is additive and needs no handle).
    const payload = 'file.ts:1\n'.repeat(TOOL_OUTPUT_LIMITS.maxLines + 10)
    const content = [{ type: 'json' as const, value: payload }]

    // No verdict for this tool call: the content is returned by reference.
    expect(simplifyVerboseToolResults({ messageContent: content })).toBe(
      content,
    )

    await withHandle('call-verbose', JSON.stringify(payload))
    const out = simplifyVerboseToolResults({
      messageContent: content,
      toolCallId: 'call-verbose',
    })
    expect(out).not.toBe(content)
    const part = (out[0] as unknown as { value: JSONValue }).value
    expect(omissionOf(part).retained.ok).toBe(true)
  })

  it('drops read_files content only with a handle, and names it when it does', async () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      { type: 'json', value: [{ path: 'a.ts', content: 'x'.repeat(40_000) }] },
    ]
    expect(simplifyReadFileResults({ messageContent: input })).toBe(input)

    await withHandle('call-read', JSON.stringify(input))
    const out = simplifyReadFileResults({
      messageContent: input,
      toolCallId: 'call-read',
    })

    const entry = (out[0]?.value as unknown[])[0] as Record<string, unknown>
    expect(entry.path).toBe('a.ts')
    expect(entry.contentOmittedForLength).toBe(true)
    expect(entry).not.toHaveProperty('content')
    const marker = entry.omitted as OmissionMarker
    expect(marker.retained.ok).toBe(true)
    expect(marker.omittedChars).toBe(40_000)
  })

  it('drops terminal stdout only with a handle, and names it when it does', async () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: { command: 'npm test', stdout: 'x'.repeat(60_000), exitCode: 0 },
      },
    ]
    expect(
      simplifyTerminalCommandResults({ messageContent: input, logger }),
    ).toBe(input)

    await withHandle('call-term', JSON.stringify(input))
    const out = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: 'call-term',
    })
    const value = (out[0] as { value: Record<string, unknown> }).value

    expect(value.command).toBe('npm test')
    expect(value.stdoutOmittedForLength).toBe(true)
    expect(value).not.toHaveProperty('stdout')
    expect((value.omitted as OmissionMarker).retained.ok).toBe(true)
  })
})
