import { execFile } from 'node:child_process'

import { buildChildEnv } from '../env'
import { resolveCodeSearchRipgrep } from '../tools/code-search/executor'

import type {
  CapabilitySnapshot,
  ProbeClientCapabilitiesFn,
} from '@savant-code/common/util/capability-notice'

export const RIPGREP_PREFLIGHT_TIMEOUT_MS = 1_000
const MAX_VERSION_BYTES = 4_096
const SEARCH_REPAIR =
  "Repair the configured ripgrep binary with 'bun run --cwd=sdk fetch-ripgrep' or SAVANT_CODE_RG_PATH; use file reads meanwhile."

/** No shell, network, search, or credential-bearing child environment. */
function startsRipgrep(binary: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      binary,
      ['--version'],
      {
        encoding: 'utf8',
        env: buildChildEnv(),
        timeout: RIPGREP_PREFLIGHT_TIMEOUT_MS,
        maxBuffer: MAX_VERSION_BYTES,
        windowsHide: true,
        signal,
      },
      (error, stdout) => resolve(error === null && /^ripgrep\b/.test(stdout)),
    )
  })
}

/** Cache only inside one SDK run; a changed local configuration re-probes. */
export function createClientCapabilityProbe(
  options: { overriddenSearch: boolean; signal?: AbortSignal },
  deps = { resolve: resolveCodeSearchRipgrep, starts: startsRipgrep },
): ProbeClientCapabilitiesFn {
  let signature: string | undefined
  let pending: Promise<CapabilitySnapshot[]> | undefined
  return async (tools) => {
    if (!tools.includes('code_search')) return []
    if (options.overriddenSearch || options.signal?.aborted)
      return [
        {
          capability: 'code_search',
          state: 'unverified',
          reason: options.overriddenSearch
            ? 'Host override configured; the bundled binary was not probed.'
            : 'Run cancelled; availability was not probed.',
        },
      ]
    const current = JSON.stringify([
      process.env.SAVANT_CODE_RG_PATH,
      process.env.PATH,
      process.env.PATHEXT,
      process.cwd(),
    ])
    if (current !== signature || !pending) {
      signature = current
      pending = probeSearch(deps, options.signal)
    }
    return pending
  }
}

async function probeSearch(
  deps: {
    resolve: () => string
    starts: (path: string, signal?: AbortSignal) => Promise<boolean>
  },
  signal?: AbortSignal,
): Promise<CapabilitySnapshot[]> {
  try {
    if (await deps.starts(deps.resolve(), signal))
      return [
        {
          capability: 'code_search',
          state: 'ready',
          reason: 'Local ripgrep starts; no search was performed.',
        },
      ]
  } catch {
    // Probe errors are deliberately not rendered: host errors can carry secrets.
  }
  return [
    {
      capability: 'code_search',
      state: signal?.aborted ? 'unverified' : 'unavailable',
      reason: 'Local ripgrep could not be verified as executable.',
      action: SEARCH_REPAIR,
    },
  ]
}
