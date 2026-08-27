/**
 * fid-loader tests
 *
 * Covers both FID metadata formats the agent has produced:
 * - legacy `**Field:** value` lines (this repo's archived FIDs)
 * - table `| **Field** | value |` rows with a `## Problem Statement` section
 *   (the format produced in production projects, e.g. savant-gateway)
 *
 * The table-format regression is the headline: the original parser only
 * matched `**Field:**`, so every production FID failed to parse and the
 * sidebar's "Active FIDs" panel always rendered "(none — loop converged)".
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

import { loadFidInventory, loadFids } from '../fid-loader'

const TABLE_FORMAT_FID = `# FID-2026-0804-005 — Semantic Caching Engine

> **Filename:** \`FID-2026-0804-005-semantic-caching-engine.md\`

## Metadata

| Field | Value |
|-------|-------|
| **ID** | FID-2026-0804-005-semantic-caching-engine |
| **Severity** | high |
| **Status** | analyzed |
| **Created** | 2026-08-04 |
| **Author** | Savant |

---

## Problem Statement

The gateway has no semantic caching layer and repeats upstream calls.

## Environment
`

const LEGACY_FORMAT_FID = `# FID: CLI Provider Key Management

**Filename:** \`FID-2026-0804-001-provider-key-management.md\`
**ID:** FID-2026-0804-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-04 11:00
**Author:** Savant Orchestrator

---

## Summary

The CLI needs a reliable way to add or change an inference-provider API key.

## Environment
`

const MALFORMED_FID = `# Not a FID

This file has no metadata fields at all, so it must be skipped.
`

const tempRoot = mkdtempSync(join(tmpdir(), 'fid-loader-'))

function setupFidsDir(): string {
  const dir = join(tempRoot, `case-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(dir, 'archive'), { recursive: true })
  return dir
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('loadFidInventory — table format (production agent output)', () => {
  test('parses ID, status, severity, and summary from ## Problem Statement', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-005-semantic-caching-engine.md'),
      TABLE_FORMAT_FID,
    )

    const { active, archived } = loadFidInventory(dir)

    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('FID-2026-0804-005-semantic-caching-engine')
    expect(active[0].status).toBe('analyzed')
    expect(active[0].severity).toBe('high')
    expect(active[0].summary).toContain('no semantic caching layer')
    expect(archived).toHaveLength(0)
  })
})

describe('loadFidInventory — legacy format (**Field:** value)', () => {
  test('parses ID, status, severity, and summary from ## Summary', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-001-provider-key-management.md'),
      LEGACY_FORMAT_FID,
    )

    const { active } = loadFidInventory(dir)

    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('FID-2026-0804-001')
    expect(active[0].status).toBe('closed')
    expect(active[0].severity).toBe('high')
    expect(active[0].summary).toContain('reliable way to add or change')
  })
})

describe('loadFidInventory — parent metadata', () => {
  test('preserves an optional Parent field for dependency projections', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-009-child.md'),
      LEGACY_FORMAT_FID.replace(
        '**ID:** FID-2026-0804-001',
        '**ID:** FID-2026-0804-009',
      ).replace(
        '**Author:** Savant Orchestrator',
        '**Author:** Savant Orchestrator\n**Parent:** FID-2026-0804-008',
      ),
    )
    expect(loadFids(dir)[0]?.parentId).toBe('FID-2026-0804-008')
  })
})

describe('loadFidInventory — active + archived split', () => {
  test('counts archived FIDs separately from active', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-005-semantic-caching-engine.md'),
      TABLE_FORMAT_FID,
    )
    writeFileSync(
      join(dir, 'archive', 'FID-2026-0804-001-provider-key-management.md'),
      LEGACY_FORMAT_FID,
    )

    const { active, archived } = loadFidInventory(dir)

    expect(active).toHaveLength(1)
    expect(archived).toHaveLength(1)
    expect(archived[0].id).toBe('FID-2026-0804-001')
  })
})

describe('loadFids — backward compatibility', () => {
  test('returns only active FIDs, never archived ones', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-005-semantic-caching-engine.md'),
      TABLE_FORMAT_FID,
    )
    writeFileSync(
      join(dir, 'archive', 'FID-2026-0804-001-provider-key-management.md'),
      LEGACY_FORMAT_FID,
    )

    expect(loadFids(dir)).toHaveLength(1)
  })
})

describe('Law 14 — error paths', () => {
  test('missing directory yields an empty inventory, never throws', () => {
    const missing = join(tempRoot, 'does-not-exist')
    expect(loadFidInventory(missing)).toEqual({ active: [], archived: [] })
    expect(loadFids(missing)).toEqual([])
  })

  test('malformed FID files are skipped without blocking the rest', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-005-semantic-caching-engine.md'),
      TABLE_FORMAT_FID,
    )
    writeFileSync(join(dir, 'FID-2026-0804-099-malformed.md'), MALFORMED_FID)

    const { active } = loadFidInventory(dir)

    expect(active).toHaveLength(1)
    expect(active[0].id).toContain('FID-2026-0804-005')
  })

  test('non-FID files are ignored', () => {
    const dir = setupFidsDir()
    writeFileSync(join(dir, 'README.md'), '# not a FID')

    expect(loadFids(dir)).toEqual([])
  })
})

describe('sorting', () => {
  test('sorts by severity (critical first) then ID', () => {
    const dir = setupFidsDir()
    writeFileSync(
      join(dir, 'FID-2026-0804-007-low.md'),
      LEGACY_FORMAT_FID.replace(
        '**ID:** FID-2026-0804-001',
        '**ID:** FID-2026-0804-007',
      ).replace('**Severity:** high', '**Severity:** low'),
    )
    writeFileSync(
      join(dir, 'FID-2026-0804-008-critical.md'),
      LEGACY_FORMAT_FID.replace(
        '**ID:** FID-2026-0804-001',
        '**ID:** FID-2026-0804-008',
      ).replace('**Severity:** high', '**Severity:** critical'),
    )

    const ids = loadFids(dir).map((f) => f.id)

    // IDs come from the `**ID:**` metadata field, not the filename.
    expect(ids[0]).toBe('FID-2026-0804-008')
    expect(ids[1]).toBe('FID-2026-0804-007')
  })
})
