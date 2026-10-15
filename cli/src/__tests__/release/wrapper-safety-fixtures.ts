import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
export const moduleRequire = createRequire(import.meta.url)

export const wrappers = [
  {
    name: 'savant-code',
    directory: 'cli/release',
    expectedConfig: {
      packageName: 'savant-code',
      displayName: 'SavantCode',
      tempDownloadDirName: '.download-temp',
    },
  },
  {
    name: 'codecane',
    directory: 'cli/release-staging',
    expectedConfig: {
      packageName: 'savant-code-staging',
      displayName: 'Codecane',
      includeTreeSitterWasm: false,
      telemetryProperties: { isStaging: true },
      tempDownloadDirName: '.download-temp-staging',
    },
  },
  {
    name: 'savant-free',
    directory: 'savant-free/cli/release',
    expectedConfig: {
      packageName: 'savant-free',
      displayName: 'SavantFree',
      telemetryEvent: 'cli.update_savant_free_failed',
    },
  },
]
