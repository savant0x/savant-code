import os from 'os'
import path from 'path'

import { SAVANT_CODE_CONFIG_DIR_NAME } from '@savant-code/common/constants/savant-code-config'
import { env } from '@savant-code/common/env'

/**
 * Resolve the on-disk config directory for the CLI.
 *
 * Lives in its own module (depending only on `env` and the shared config dir
 * constant) so that low-level helpers — e.g. the persistent analytics id —
 * can read the config dir without pulling in `auth.ts`, which transitively
 * imports the logger and analytics and would otherwise create an import cycle.
 */
export const getConfigDir = (): string => {
  // Allow tests and advanced users to override the config directory in
  // non-production builds. The override is read directly from process.env so it
  // works before the env schema is parsed and avoids os.homedir() caching
  // issues on Windows.
  const override = process.env.SAVANT_CODE_CONFIG_DIR
  if (override && env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
    return override
  }

  const suffix =
    env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod'
      ? `-${env.NEXT_PUBLIC_CB_ENVIRONMENT}`
      : ''
  return path.join(os.homedir(), `${SAVANT_CODE_CONFIG_DIR_NAME}${suffix}`)
}
