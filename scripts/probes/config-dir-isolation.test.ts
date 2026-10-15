/**
 * Config-dir test-isolation canary (FID-2026-0913-003).
 *
 * This file deliberately lives inside the repository (so `@savant-code/*`
 * imports resolve through the hoisted workspace node_modules) and is meant
 * to be exercised from the REPO ROOT: it is the sentinel that fails whenever
 * a root-cwd test run inherits `NEXT_PUBLIC_CB_ENVIRONMENT=prod` — the exact
 * condition under which `getConfigDir()` ignores the `SAVANT_CODE_CONFIG_DIR`
 * override and CLI tests would read/write the real `~/.savant-code/`
 * directory. The public-release pipeline runs precisely that shape (public
 * profile + root-cwd bunfig preload), and the fid-gate live re-runs execute
 * CLI test pins from the root. The companion executable probe
 * `scripts/probes/release-gate-isolation-probe.ts` reproduces the shape on
 * demand with byte-level no-pollution assertions.
 *
 * `getConfigDir()` snapshots the environment at module load (via
 * `@savant-code/common/env`), so this assertion pins the full chain:
 * root bunfig preload → env demotion → override honored.
 */
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { getConfigDir } from '../../cli/src/utils/config-dir'

describe('config-dir test isolation (FID-2026-0913-003)', () => {
  test('SAVANT_CODE_CONFIG_DIR override is honored regardless of inherited environment', () => {
    const original = process.env.SAVANT_CODE_CONFIG_DIR
    const marker = path.join(os.tmpdir(), 'savant-config-isolation-canary')
    process.env.SAVANT_CODE_CONFIG_DIR = marker
    try {
      expect(getConfigDir()).toBe(marker)
    } finally {
      if (original === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = original
    }
  })
})
