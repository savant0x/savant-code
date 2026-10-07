/**
 * FID-2026-1006-005 steps 5-6 (Phase 1a/1b) — the model-facing tool payload and
 * `stableHash` must be canonical, so `toolsHash` changes only when the tool set
 * really changes.
 *
 * The snapshot-level cases go through the real production path: the same
 * `createCacheDebugSnapshot` writer the runtime uses with
 * CACHE_DEBUG_FULL_LOGGING on, read back with
 * `loadCacheDebugSnapshotHashPair`, and fed to the live consumer
 * `CacheHitRateMonitor.onPrefixStability` that raises the prefix-stability
 * warning in `run-agent-step/cache-debug.ts`.
 */
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterAll, describe, expect, it } from 'bun:test'

import { CANONICAL_TOOL_PAYLOAD } from '../constants'
import {
  canonicalizeToolSet,
  modelFacingToolSet,
  toToolDefinitions,
} from '../tools/canonical-tool-set'
import {
  createCacheDebugSnapshot,
  loadCacheDebugSnapshotHashPair,
} from '../util/cache-debug'
import { stableHash } from '../util/cache-debug-serialize'
import { CacheHitRateMonitor } from '../util/token-telemetry'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ToolSet } from 'ai'

const warnings: string[] = []
const logger: Logger = {
  debug: () => {},
  info: () => {},
  error: () => {},
  warn: (data, msg) => warnings.push(String(msg ?? data)),
}

function tool(description: string, schema: Record<string, unknown>) {
  return { description, inputSchema: schema as unknown }
}

/** Same three tools, same schemas — only the insertion order differs. */
const ordered = {
  read_files: tool('Read files', {
    type: 'object',
    properties: { paths: { type: 'array' }, cwd: { type: 'string' } },
    required: ['paths'],
  }),
  write_file: tool('Write a file', {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  }),
  glob: tool('Glob', {
    type: 'object',
    properties: { pattern: { type: 'string' } },
    required: ['pattern'],
  }),
} as unknown as ToolSet

const reordered = Object.fromEntries(
  Object.entries(ordered).reverse(),
) as unknown as ToolSet

/** Identical tools, nested schema keys reordered. */
const nestedReordered = {
  read_files: tool('Read files', {
    required: ['paths'],
    properties: { cwd: { type: 'string' }, paths: { type: 'array' } },
    type: 'object',
  }),
  write_file: ordered.write_file,
  glob: ordered.glob,
} as unknown as ToolSet

/** A genuinely different tool set: one description changed. */
const changed = {
  ...ordered,
  glob: tool('Glob patterns in the workspace', {
    type: 'object',
    properties: { pattern: { type: 'string' } },
    required: ['pattern'],
  }),
} as unknown as ToolSet

const projectRoot = mkdtempSync(join(tmpdir(), 'savant-tool-payload-'))
afterAll(() => rmSync(projectRoot, { recursive: true, force: true }))

/** The production payload: seam ordering + the shared derivation. */
const payload = (tools: ToolSet) =>
  JSON.stringify(toToolDefinitions(modelFacingToolSet(tools)))

function toolsHashFor(tools: ToolSet, tag: string): string | undefined {
  return loadCacheDebugSnapshotHashPair(
    createCacheDebugSnapshot({
      agentType: 'test',
      system: 'identical system prefix',
      toolDefinitions: toToolDefinitions(
        modelFacingToolSet(tools),
      ) as unknown as Record<string, never>,
      messages: [],
      logger,
      projectRoot,
      userInputId: 'test',
      agentStepId: tag,
    }),
  ).toolsHash
}

function monitorWarningFor(a: ToolSet, b: ToolSet): boolean {
  warnings.length = 0
  const monitor = new CacheHitRateMonitor({ logger })
  monitor.onPrefixStability({ toolsHash: toolsHashFor(a, 'first') })
  monitor.onPrefixStability({ toolsHash: toolsHashFor(b, 'second') })
  return warnings.length > 0
}

describe('canonical tool payload (P2, FID-2026-1006-005 step 5)', () => {
  it('orders the model-facing tool set by name regardless of insertion order', () => {
    expect(Object.keys(canonicalizeToolSet(ordered))).toEqual([
      'glob',
      'read_files',
      'write_file',
    ])
    expect(Object.keys(canonicalizeToolSet(reordered))).toEqual([
      'glob',
      'read_files',
      'write_file',
    ])
  })

  it('emits byte-identical payloads for two tool sets differing only in insertion order', () => {
    expect(payload(ordered)).toBe(payload(reordered))
  })

  it('keeps the derivation faithful: description + inputSchema per tool', () => {
    expect(Object.keys(toToolDefinitions(ordered))).toEqual([
      'read_files',
      'write_file',
      'glob',
    ])
    expect(toToolDefinitions(ordered).glob.description).toBe('Glob')
  })

  it('ships with the Phase 1a rollback flag on, and the seam honors it', () => {
    // Flipping this constant is the documented rollback; assert the shipped
    // default rather than leaving the flag's effect unobserved.
    expect(CANONICAL_TOOL_PAYLOAD).toBe(true)
    expect(Object.keys(modelFacingToolSet(reordered))).toEqual([
      'glob',
      'read_files',
      'write_file',
    ])
  })
})

describe('canonical stableHash (P3, FID-2026-1006-005 step 6)', () => {
  it('hashes a reordered tool set identically', () => {
    expect(stableHash(toToolDefinitions(ordered) as never)).toBe(
      stableHash(toToolDefinitions(reordered) as never),
    )
  })

  it('hashes reordered nested schema keys identically (recursive)', () => {
    expect(stableHash(toToolDefinitions(nestedReordered) as never)).toBe(
      stableHash(toToolDefinitions(ordered) as never),
    )
    expect(stableHash({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableHash({ a: { c: 3, d: 2 }, b: 1 }),
    )
  })

  it('still changes when the payload really changes (detector not blinded)', () => {
    expect(stableHash(toToolDefinitions(changed) as never)).not.toBe(
      stableHash(toToolDefinitions(ordered) as never),
    )
    const dropped = { ...ordered } as Record<string, unknown>
    delete dropped.glob
    expect(stableHash(toToolDefinitions(dropped as ToolSet) as never)).not.toBe(
      stableHash(toToolDefinitions(ordered) as never),
    )
  })
})

describe('prefix stability through the cache-debug snapshot (FID-2026-1006-005)', () => {
  it('sees the same toolsHash for a reorder-only difference and does not warn', () => {
    expect(toolsHashFor(ordered, 'a')).toBe(toolsHashFor(reordered, 'b'))
    expect(monitorWarningFor(ordered, reordered)).toBe(false)
  })

  it('still warns when the tool set really changed', () => {
    expect(toolsHashFor(ordered, 'c')).not.toBe(toolsHashFor(changed, 'd'))
    expect(monitorWarningFor(ordered, changed)).toBe(true)
  })
})
