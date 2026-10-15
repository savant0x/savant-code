#!/usr/bin/env bun

import { main } from './build-binary-main'

export {
  CANONICAL_NEXT_PUBLIC_DEFAULTS,
  CANONICAL_RELEASE_RUNTIME_DEFAULTS,
  evaluateBinaryEnvIntegrity,
  findBinaryEnvLeaks,
  getReleaseRuntimeDefaults,
} from './build-binary-env'
export type { BinaryEnvLeak, EnvIntegrityDecision } from './build-binary-env'
export { getOpenTuiNativePackageNames } from './build-binary-opentui'
export type { TargetInfo } from './build-binary-target'

if (import.meta.main) {
  main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  })
}
