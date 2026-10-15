import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { runSidecarBuild, SIDECAR_TARGETS } from './build-sidecar'

const family = process.platform === 'win32' ? 'windows' : process.platform
const nativeTarget = SIDECAR_TARGETS.find(
  (target) => target.bun === `bun-${family}-${process.arch}`,
)
if (!nativeTarget) {
  throw new Error(
    `Unsupported sidecar test platform: ${family}-${process.arch}`,
  )
}

const desktopRoot = path.resolve(import.meta.dir, '..')
const buildStatus = runSidecarBuild({
  entry: 'cli/src/server-command.ts',
  target: nativeTarget.bun,
  outDir: path.join(desktopRoot, 'src-tauri', 'binaries'),
})
if (buildStatus !== 0) {
  process.exitCode = buildStatus
} else {
  const result = spawnSync(
    process.execPath,
    ['test', 'scripts/', 'src/', ...process.argv.slice(2)],
    { cwd: desktopRoot, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}
