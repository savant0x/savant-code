/**
 * FID-2026-1004-001 — the sanitized discovery announce decision pins.
 *
 * Rebuilt to the FID-2026-0914-003 MQ5 spec after the 9f1b8068 batch
 * orphaned the original chat-mount wiring: the harvester's
 * `agent-context.txt` artifact (line 1 = candidate-set key, remainder =
 * sanitized block) surfaces exactly when its set key differs from the
 * persisted `.announced-key` sidecar. All pure logic over a temp-dir
 * fixture — no network, no React.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  buildDiscoveryAnnouncement,
  readAnnouncedKey,
  writeAnnouncedKey,
} from '../../utils/discovery-announce'

describe('discovery announce decision (FID-2026-1004-001, MQ5)', () => {
  let tempRepoRoot = ''

  beforeEach(() => {
    tempRepoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-discovery-announce-'),
    )
  })

  afterEach(() => {
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  })

  function seedAgentContext(setKey: string, block: string): void {
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
      `${setKey}\n${block}\n`,
      'utf8',
    )
  }

  test('returns the block on a key miss (never announced)', () => {
    seedAgentContext('set-1', '3 discovery candidates (see report.md)')
    expect(
      buildDiscoveryAnnouncement({
        repoRoot: tempRepoRoot,
        lastAnnouncedKey: null,
      }),
    ).toEqual({
      setKey: 'set-1',
      block: '3 discovery candidates (see report.md)',
    })
  })

  test('returns null on a key hit (already announced)', () => {
    seedAgentContext('set-1', '3 discovery candidates (see report.md)')
    expect(
      buildDiscoveryAnnouncement({
        repoRoot: tempRepoRoot,
        lastAnnouncedKey: 'set-1',
      }),
    ).toBeNull()
  })

  test('returns null for an absent artifact', () => {
    expect(
      buildDiscoveryAnnouncement({
        repoRoot: tempRepoRoot,
        lastAnnouncedKey: null,
      }),
    ).toBeNull()
  })

  test('returns null for a malformed artifact with no key/block split', () => {
    seedAgentContext('only-one-line-with-no-newline', '')
    fs.writeFileSync(
      path.join(
        tempRepoRoot,
        'dev',
        'provider-candidates',
        'agent-context.txt',
      ),
      'only-one-line-with-no-newline',
      'utf8',
    )
    expect(
      buildDiscoveryAnnouncement({
        repoRoot: tempRepoRoot,
        lastAnnouncedKey: null,
      }),
    ).toBeNull()
  })

  test('returns null when the block is blank', () => {
    seedAgentContext('set-1', '   ')
    expect(
      buildDiscoveryAnnouncement({
        repoRoot: tempRepoRoot,
        lastAnnouncedKey: null,
      }),
    ).toBeNull()
  })

  test('the sidecar round-trips: write then read returns the same key', () => {
    // The announce only ever persists after a successful artifact read, so
    // the candidate dir exists in every production call — mirror that here.
    fs.mkdirSync(path.join(tempRepoRoot, 'dev', 'provider-candidates'), {
      recursive: true,
    })
    expect(readAnnouncedKey(tempRepoRoot)).toBeNull()
    writeAnnouncedKey(tempRepoRoot, 'set-7')
    expect(readAnnouncedKey(tempRepoRoot)).toBe('set-7')
  })
})
