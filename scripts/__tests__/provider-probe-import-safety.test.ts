import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, test } from 'bun:test'

describe('provider probes run only as explicit programs', () => {
  test.each(['t62f1-case-sensitivity.ts', 't62f1-window-sources.ts'])(
    '%s is inert on import',
    (file) => {
      const target = pathToFileURL(
        path.resolve(import.meta.dir, '../providers/audit-probes', file),
      ).href
      const source = `
      globalThis.fetch = async () => { throw new Error('IMPORT_ATTEMPTED_NETWORK'); };
      await import(process.argv[1]);
      console.log('import-safe');
    `
      const result = Bun.spawnSync([process.execPath, '-e', source, target], {
        timeout: 10_000,
      })
      expect(result.stderr.toString()).not.toContain('IMPORT_ATTEMPTED_NETWORK')
      expect(result.exitCode).toBe(0)
      expect(result.stdout.toString().trim()).toBe('import-safe')
    },
  )
})
