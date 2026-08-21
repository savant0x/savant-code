import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'

// ---------------------------------------------------------------------------
// elkjs worker loading (Bun interop workaround — see layout.ts header)
// ---------------------------------------------------------------------------

export interface GwtWorkerLike {
  postMessage: (msg: unknown) => void
  onmessage: ((ev: { data: unknown }) => void) | null
}

let workerClassPromise: Promise<new () => GwtWorkerLike> | null = null

/** Resolve the GWT worker bundle path (sibling file next to a compiled binary). */
function resolveElkWorkerPath(): string {
  // Compiled binaries cannot read node_modules at runtime (bun --compile);
  // build-binary.ts ships `elk-worker.min.js` as a sibling of the binary, the
  // same pattern used for tree-sitter.wasm.
  if (process.env.SAVANT_CODE_IS_BINARY === 'true') {
    const sibling = path.join(
      path.dirname(process.execPath),
      'elk-worker.min.js',
    )
    if (fs.existsSync(sibling)) return sibling
  }
  // Resolve relative to this module so it works regardless of the CLI's cwd
  // (the CLI runs with `--cwd ..` from the cli/ workspace in dev).
  const cliRequire = createRequire(import.meta.url)
  return cliRequire.resolve('elkjs/lib/elk-worker.min.js')
}

/**
 * Evaluate the GWT worker bundle and extract the in-process fake `Worker`
 * class. `self`/`document`/`window` are shadowed as undefined so the bundle
 * takes its CJS export branch instead of the web-worker branch (see layout.ts
 * header). Memoized per process — one evaluation, reused across exports.
 */
export function getElkWorkerClass(): Promise<new () => GwtWorkerLike> {
  if (workerClassPromise) return workerClassPromise
  workerClassPromise = (async () => {
    const bundle = resolveElkWorkerPath()
    const src = fs.readFileSync(bundle, 'utf8')
    const fakeModule: { exports: Record<string, unknown> } = { exports: {} }

    const fn = new Function(
      'module',
      'exports',
      'require',
      '__filename',
      '__dirname',
      'self',
      'document',
      'window',
      src,
    )
    fn(
      fakeModule,
      fakeModule.exports,
      (id: string) => id, // the GWT bundle never requires at runtime
      bundle,
      path.dirname(bundle),
      undefined,
      undefined,
      undefined,
    )
    const Worker = fakeModule.exports.Worker
    if (typeof Worker !== 'function') {
      throw new Error(
        'elkjs worker bundle did not export a Worker class under Bun ' +
          '(SAVANT_CODE_IS_BINARY=' +
          process.env.SAVANT_CODE_IS_BINARY +
          '). Layout fallback is d3-force.',
      )
    }
    return Worker as new () => GwtWorkerLike
  })()
  return workerClassPromise
}
