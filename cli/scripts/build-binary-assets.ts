import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { createRequire } from 'module'
import { join } from 'path'

import { log, logAlways } from './build-binary-runtime'

export function cpDirectory(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name)
    const destinationPath = join(destination, entry.name)
    if (entry.isDirectory()) {
      cpDirectory(sourcePath, destinationPath)
    } else {
      copyFileSync(sourcePath, destinationPath)
    }
  }
}

export function findElkWorkerBundle(cliRoot: string): string {
  const candidates = [
    join(cliRoot, 'node_modules', 'elkjs', 'lib', 'elk-worker.min.js'),
    join(cliRoot, '..', 'node_modules', 'elkjs', 'lib', 'elk-worker.min.js'),
    join(
      cliRoot,
      '..',
      'sdk',
      'node_modules',
      'elkjs',
      'lib',
      'elk-worker.min.js',
    ),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  try {
    const cliRequire = createRequire(join(cliRoot, 'package.json'))
    return cliRequire.resolve('elkjs/lib/elk-worker.min.js')
  } catch (err) {
    throw new Error(
      `Could not locate elkjs/lib/elk-worker.min.js. Searched:\n  - ` +
        candidates.join('\n  - ') +
        `\nAnd createRequire failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function findWebTreeSitterWasm(cliRoot: string): string {
  const candidates = [
    join(cliRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    join(cliRoot, '..', 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    join(
      cliRoot,
      '..',
      'sdk',
      'node_modules',
      'web-tree-sitter',
      'tree-sitter.wasm',
    ),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  try {
    const cliRequire = createRequire(join(cliRoot, 'package.json'))
    return cliRequire.resolve('web-tree-sitter/tree-sitter.wasm')
  } catch (err) {
    throw new Error(
      `Could not locate web-tree-sitter/tree-sitter.wasm. Searched:\n  - ` +
        candidates.join('\n  - ') +
        `\nAnd createRequire failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function patchOpenTuiAssetPaths(cliRoot: string): void {
  const coreDir = join(cliRoot, 'node_modules', '@opentui', 'core')
  if (!existsSync(coreDir)) {
    log('OpenTUI core package not found; skipping asset patch')
    return
  }

  const indexFile = readdirSync(coreDir).find(
    (file) => file.startsWith('index') && file.endsWith('.js'),
  )
  if (!indexFile) {
    log('OpenTUI core index bundle not found; skipping asset patch')
    return
  }

  const indexPath = join(coreDir, indexFile)
  const content = readFileSync(indexPath, 'utf8')
  const absolutePathPattern =
    /var __dirname = ".*?packages\/core\/src\/lib\/tree-sitter\/assets";/
  if (!absolutePathPattern.test(content)) {
    log('OpenTUI core bundle already has relative asset paths')
    return
  }

  const replacement =
    'var __dirname = path3.join(path3.dirname(fileURLToPath(new URL(".", import.meta.url))), "lib/tree-sitter/assets");'
  writeFileSync(indexPath, content.replace(absolutePathPattern, replacement))
  logAlways('Patched OpenTUI core tree-sitter asset paths')
}
