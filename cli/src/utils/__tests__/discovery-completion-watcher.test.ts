/**
 * FID-2026-1004-007 Step 7 — completion-watcher pins. The detached harvest
 * can publish `agent-context.txt` long after the chat-mount effects ran, so
 * the watcher (not boot-time routing) owns the post-mount timing boundary:
 * a set-key transition routes the NEW hosts once; the same key never routes
 * twice; each distinct set-key transition routes (downstream coordinator
 * dedup makes repeat observations idempotent); and every failure shape is
 * fail-silent.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { readDiscoveryCounts } from '../discovery-announce'
import { startDiscoveryCompletionWatcher } from '../discovery-completion-watcher'

import type { DiscoveryCounts } from '../discovery-announce'

describe('FID-2026-1004-007: discovery completion watcher', () => {
  let tempRepoRoot = ''

  beforeEach(() => {
    tempRepoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-discovery-completion-'),
    )
  })

  afterEach(() => {
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  })

  function seedAgentContext(setKey: string): void {
    fs.mkdirSync(path.join(tempRepoRoot, 'dev', 'provider-candidates'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(
        tempRepoRoot,
        'dev',
        'provider-candidates',
        'agent-context.txt',
      ),
      `${setKey}\n[provider-discovery] block\n`,
      'utf8',
    )
  }

  async function waitFor(
    condition: () => boolean,
    timeoutMs = 3000,
  ): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (condition()) return true
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return condition()
  }

  test('a post-mount set-key transition routes the new hosts once', async () => {
    seedAgentContext(JSON.stringify([]))
    const routed: DiscoveryCounts[] = []
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: '[]',
      observe: (counts) => {
        routed.push(counts)
      },
      debounceMs: 50,
    })
    try {
      seedAgentContext(JSON.stringify(['a.example:new', 'b.example:changed']))
      expect(await waitFor(() => routed.length > 0)).toBe(true)
      expect(routed[0]?.newHosts).toEqual(['a.example'])
      // The observed key advanced — a later write of the SAME key is a
      // no-op (pinned by the next test), so one transition routes once.
    } finally {
      watcher.close()
    }
  })

  test('the same set key never routes twice (transition dedup)', async () => {
    seedAgentContext(JSON.stringify([]))
    let calls = 0
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify([]),
      observe: () => {
        calls++
      },
      debounceMs: 50,
    })
    try {
      seedAgentContext(JSON.stringify(['a.example:new']))
      expect(await waitFor(() => calls > 0)).toBe(true)
      // Rewrite the same artifact (harvest reruns; key unchanged).
      seedAgentContext(JSON.stringify(['a.example:new']))
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(calls).toBe(1)
    } finally {
      watcher.close()
    }
  })

  test('an artifact key equal to the boot key never routes', async () => {
    seedAgentContext(JSON.stringify([]))
    let calls = 0
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify([]),
      observe: () => {
        calls++
      },
      debounceMs: 50,
    })
    try {
      seedAgentContext(JSON.stringify([]))
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(calls).toBe(0)
    } finally {
      watcher.close()
    }
  })

  test('each distinct set-key transition routes (A→B→A is two transitions)', async () => {
    // The watcher dedups the LAST key per transition; it keeps no history.
    // A→B→A routes twice at this layer by design — the coordinator's
    // fact-value dedup + observedAt monotonicity guard make the second
    // A-observation an idempotent no-op downstream (provider-notifications.ts).
    seedAgentContext(JSON.stringify(['a.example:new']))
    const routed: string[] = []
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify(['a.example:new']),
      observe: (counts) => {
        routed.push(counts.setKey)
      },
      debounceMs: 50,
    })
    try {
      seedAgentContext(JSON.stringify(['b.example:new']))
      expect(await waitFor(() => routed.length > 0)).toBe(true)
      expect(routed[0]).toBe(JSON.stringify(['b.example:new']))
      seedAgentContext(JSON.stringify(['a.example:new']))
      expect(await waitFor(() => routed.length > 1)).toBe(true)
      expect(routed[1]).toBe(JSON.stringify(['a.example:new']))
    } finally {
      watcher.close()
    }
  })

  test('counts read the same artifact the boot path reads (one truth)', () => {
    seedAgentContext(JSON.stringify(['h.example:new', 'x.example:changed']))
    const counts = readDiscoveryCounts(tempRepoRoot)
    expect(counts?.newHosts).toEqual(['h.example'])
    expect(counts?.changedCount).toBe(1)
  })

  test('a throwing observer never propagates (fail-silent)', async () => {
    seedAgentContext(JSON.stringify([]))
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify([]),
      observe: () => {
        throw new Error('sink down')
      },
      debounceMs: 50,
    })
    try {
      seedAgentContext(JSON.stringify(['a.example:new']))
      // The error path must not crash the watcher or the process.
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(true).toBe(true)
    } finally {
      watcher.close()
    }
  })

  test('close() is idempotent and stops further callbacks', async () => {
    seedAgentContext(JSON.stringify([]))
    let calls = 0
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify([]),
      observe: () => {
        calls++
      },
      debounceMs: 50,
    })
    seedAgentContext(JSON.stringify(['a.example:new']))
    expect(await waitFor(() => calls > 0)).toBe(true)
    watcher.close()
    watcher.close()
    const afterClose = calls
    seedAgentContext(JSON.stringify(['b.example:new']))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(calls).toBe(afterClose)
  })

  test('a malformed artifact transition never routes (readDiscoveryCounts null)', async () => {
    seedAgentContext(JSON.stringify([]))
    let calls = 0
    const watcher = startDiscoveryCompletionWatcher({
      repoRoot: tempRepoRoot,
      initialSetKey: JSON.stringify([]),
      observe: () => {
        calls++
      },
      debounceMs: 50,
    })
    try {
      // No newline → the announce reader's malformed-artifact shape.
      fs.writeFileSync(
        path.join(
          tempRepoRoot,
          'dev',
          'provider-candidates',
          'agent-context.txt',
        ),
        'no-newline-key',
        'utf8',
      )
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(calls).toBe(0)
    } finally {
      watcher.close()
    }
  })
})
