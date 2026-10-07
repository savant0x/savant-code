/**
 * FID-2026-1007-006 — the CLI test process must not be able to resolve the
 * operator's config directory.
 *
 * Per-file overrides are not isolation: only the files that set
 * `SAVANT_CODE_CONFIG_DIR` were protected, and every other file resolved
 * `~/.savant-code-dev` (the suffix `getConfigDir()` appends outside prod) for
 * anything that goes through it — settings, credentials, `message-history.json`,
 * project data, and the gateway disk warm-start cache. The workspace preload
 * (`cli/src/test-setup.ts`) now owns the override, so this pin is asserted from
 * a file that sets nothing at all: it fails on the pre-fix tree, where the same
 * assertion returns `<homedir>/.savant-code-dev`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { SAVANT_CODE_CONFIG_DIR_NAME } from '@savant-code/common/constants/savant-code-config'
import { describe, expect, test } from 'bun:test'

import { getConfigDir } from '../config-dir'

describe('cli test config-dir isolation (FID-2026-1007-006)', () => {
  test('a file that sets nothing still gets a suite-owned config dir', () => {
    const dir = getConfigDir()

    // The operator's own directory is unreachable, with or without the
    // environment suffix `getConfigDir()` appends outside prod.
    expect(
      dir.startsWith(path.join(os.homedir(), SAVANT_CODE_CONFIG_DIR_NAME)),
    ).toBe(false)

    // It is the real, absolute, existing directory the preload created under
    // the OS temp root — not an inherit-the-machine default.
    expect(path.isAbsolute(dir)).toBe(true)
    expect(dir.startsWith(os.tmpdir())).toBe(true)
    expect(fs.existsSync(dir)).toBe(true)
  })
})
