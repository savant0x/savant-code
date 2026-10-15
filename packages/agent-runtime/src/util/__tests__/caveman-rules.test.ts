/**
 * FID-2026-0806-003 Phase 6 (P5f) — Caveman rules module tests.
 *
 * The caveman block is opt-in via protocol.config.yaml `caveman.enabled`,
 * applies only to Orchestrator/Detective/Scribe, and carries Auto-Clarity
 * bypasses (code/paths/errors/security stay byte-exact).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  __resetCavemanConfigCacheForTests,
  buildCavemanRulesBlock,
  getCavemanRulesBlockForAgent,
  isCavemanTargetAgent,
} from '../caveman-rules'

const temporaryDirectories: string[] = []

afterEach(() => {
  __resetCavemanConfigCacheForTests()
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function makeProjectRoot(configLines: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caveman-rules-'))
  temporaryDirectories.push(dir)
  fs.mkdirSync(path.join(dir, 'dev', 'fids'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'protocol.config.yaml'),
    [...configLines, ''].join('\n'),
  )
  return dir
}

describe('buildCavemanRulesBlock (P5f)', () => {
  test('returns empty when disabled', () => {
    expect(buildCavemanRulesBlock({ enabled: false, autoClarity: true })).toBe(
      '',
    )
  })

  test('emits the telegraphic ruleset when enabled', () => {
    const block = buildCavemanRulesBlock({
      enabled: true,
      autoClarity: true,
    })
    expect(block).toContain('Caveman Output Rules')
    expect(block).toContain('telegraphic')
    expect(block).toContain('sentence fragments')
  })

  test('FID-2026-0806-016: carries the ADHD-friendly structure rules when enabled', () => {
    // Idea perfected into our system (not a port): number multi-step tasks,
    // cap lists at 5, end with one concrete next step ride the same opt-in
    // caveman flag. Time estimates deliberately NOT adopted (no wall-clock
    // grounding for an agent).
    const block = buildCavemanRulesBlock({
      enabled: true,
      autoClarity: true,
    })
    expect(block).toContain('number multi-step tasks')
    expect(block).toContain('cap lists at 5 items')
    expect(block).toContain('end with one concrete next step')
    expect(block).not.toContain('time estimates')
  })

  test('Auto-Clarity bypasses keep code/paths/errors byte-exact when on', () => {
    const block = buildCavemanRulesBlock({
      enabled: true,
      autoClarity: true,
    })
    expect(block).toContain('byte-for-byte exact')
    expect(block).toContain('security warnings')
  })

  test('Auto-Clarity bypass section is omitted when off', () => {
    const block = buildCavemanRulesBlock({
      enabled: true,
      autoClarity: false,
    })
    expect(block).not.toContain('byte-for-byte exact')
  })
})

describe('isCavemanTargetAgent (P5f)', () => {
  test('targets the orchestrator variants, detective, and scribe', () => {
    for (const id of [
      'savant',
      'savant-free',
      'savant-analyze',
      'savant-scaffold',
      'savant-strict',
      'detective',
      'scribe',
    ]) {
      expect(isCavemanTargetAgent(id)).toBe(true)
    }
  })

  test('excludes other agents and undefined', () => {
    for (const id of ['forge', 'verifier', 'thinker', 'context-pruner']) {
      expect(isCavemanTargetAgent(id)).toBe(false)
    }
    expect(isCavemanTargetAgent(undefined)).toBe(false)
  })
})

describe('getCavemanRulesBlockForAgent (P5f)', () => {
  test('returns empty when config is disabled', () => {
    const root = makeProjectRoot(['caveman:', '  enabled: false'])
    expect(getCavemanRulesBlockForAgent('savant', root)).toBe('')
  })

  test('returns the block for a target agent when enabled', () => {
    const root = makeProjectRoot(['caveman:', '  enabled: true'])
    const block = getCavemanRulesBlockForAgent('savant', root)
    expect(block).toContain('Caveman Output Rules')
  })

  test('never applies to non-target agents even when enabled', () => {
    const root = makeProjectRoot(['caveman:', '  enabled: true'])
    expect(getCavemanRulesBlockForAgent('forge', root)).toBe('')
  })

  test('falls back to defaults (disabled) without a config file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'caveman-rules-'))
    temporaryDirectories.push(root)
    expect(getCavemanRulesBlockForAgent('savant', root)).toBe('')
  })

  test('caches per project root', () => {
    const root = makeProjectRoot(['caveman:', '  enabled: true'])
    expect(getCavemanRulesBlockForAgent('detective', root)).toContain(
      'Caveman Output Rules',
    )
    // Second call hits the cache — same result, no re-read.
    expect(getCavemanRulesBlockForAgent('detective', root)).toContain(
      'Caveman Output Rules',
    )
  })
})
