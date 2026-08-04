import * as fs from 'fs'
import * as path from 'path'

import { Language, Parser, Query } from 'web-tree-sitter'

import { initTreeSitterForNode } from './init-node'
// eslint-disable-next-line import/order -- pre-existing edge case: eslint-plugin-import incorrectly flags last sibling import when newlines-between: always
import { DEBUG_PARSING } from './parse'

/* ------------------------------------------------------------------ */
/* 1. Query imports (these work in all bundled environments)         */
/* ------------------------------------------------------------------ */
import csharpQuery from './tree-sitter-queries/tree-sitter-c_sharp-tags.scm'
import cppQuery from './tree-sitter-queries/tree-sitter-cpp-tags.scm'
import goQuery from './tree-sitter-queries/tree-sitter-go-tags.scm'
import javaQuery from './tree-sitter-queries/tree-sitter-java-tags.scm'
import javascriptQuery from './tree-sitter-queries/tree-sitter-javascript-tags.scm'
import pythonQuery from './tree-sitter-queries/tree-sitter-python-tags.scm'
import rubyQuery from './tree-sitter-queries/tree-sitter-ruby-tags.scm'
import rustQuery from './tree-sitter-queries/tree-sitter-rust-tags.scm'
import typescriptQuery from './tree-sitter-queries/tree-sitter-typescript-tags.scm'
import { getDirnameDynamically } from './utils'

/* ------------------------------------------------------------------ */
/* 2. Types and interfaces                                           */
/* ------------------------------------------------------------------ */
export interface LanguageConfig {
  extensions: string[]
  wasmFile: string
  queryPathOrContent: string

  /* Loaded lazily ↓ */
  parser?: Parser
  query?: Query
  language?: Language
  /** In-flight lazy-init promise — dedupes concurrent createLanguageConfig
   *  calls so the wasm/parser/query are built once (CM-5, FID-2026-0803-006). */
  initPromise?: Promise<void>
}

export interface RuntimeLanguageLoader {
  loadLanguage(wasmFile: string): Promise<Language>
  initParser(): Promise<void>
}

/* ------------------------------------------------------------------ */
/* 3. WASM file manifest                                             */
/* ------------------------------------------------------------------ */
export const WASM_FILES = {
  'tree-sitter-c-sharp.wasm': 'tree-sitter-c-sharp.wasm',
  'tree-sitter-cpp.wasm': 'tree-sitter-cpp.wasm',
  'tree-sitter-go.wasm': 'tree-sitter-go.wasm',
  'tree-sitter-java.wasm': 'tree-sitter-java.wasm',
  'tree-sitter-javascript.wasm': 'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm': 'tree-sitter-python.wasm',
  'tree-sitter-ruby.wasm': 'tree-sitter-ruby.wasm',
  'tree-sitter-rust.wasm': 'tree-sitter-rust.wasm',
  'tree-sitter-tsx.wasm': 'tree-sitter-tsx.wasm',
  'tree-sitter-typescript.wasm': 'tree-sitter-typescript.wasm',
} as const

/* ------------------------------------------------------------------ */
/* 4. Language table                                                 */
/* ------------------------------------------------------------------ */
export const languageTable: LanguageConfig[] = [
  {
    extensions: ['.ts'],
    wasmFile: WASM_FILES['tree-sitter-typescript.wasm'],
    queryPathOrContent: typescriptQuery,
  },
  {
    extensions: ['.tsx'],
    wasmFile: WASM_FILES['tree-sitter-tsx.wasm'],
    queryPathOrContent: typescriptQuery,
  },
  {
    extensions: ['.js', '.jsx'],
    wasmFile: WASM_FILES['tree-sitter-javascript.wasm'],
    queryPathOrContent: javascriptQuery,
  },
  {
    extensions: ['.py'],
    wasmFile: WASM_FILES['tree-sitter-python.wasm'],
    queryPathOrContent: pythonQuery,
  },
  {
    extensions: ['.java'],
    wasmFile: WASM_FILES['tree-sitter-java.wasm'],
    queryPathOrContent: javaQuery,
  },
  {
    extensions: ['.cs'],
    wasmFile: WASM_FILES['tree-sitter-c-sharp.wasm'],
    queryPathOrContent: csharpQuery,
  },
  {
    extensions: ['.cpp', '.hpp'],
    wasmFile: WASM_FILES['tree-sitter-cpp.wasm'],
    queryPathOrContent: cppQuery,
  },
  {
    extensions: ['.rs'],
    wasmFile: WASM_FILES['tree-sitter-rust.wasm'],
    queryPathOrContent: rustQuery,
  },
  {
    extensions: ['.rb'],
    wasmFile: WASM_FILES['tree-sitter-ruby.wasm'],
    queryPathOrContent: rubyQuery,
  },
  {
    extensions: ['.go'],
    wasmFile: WASM_FILES['tree-sitter-go.wasm'],
    queryPathOrContent: goQuery,
  },
  // ESM/CJS + TS module variants (CM-6, FID-2026-0803-006) — same grammars,
  // previously silently unindexed. Out of scope: C-family (.c/.cc/.cxx/.h),
  // Kotlin, Swift, PHP, CSS — no matching wasm in @vscode/tree-sitter-wasm
  // and no in-repo queries (feature track, not hygiene).
  {
    extensions: ['.mjs', '.cjs'],
    wasmFile: WASM_FILES['tree-sitter-javascript.wasm'],
    queryPathOrContent: javascriptQuery,
  },
  {
    extensions: ['.mts', '.cts'],
    wasmFile: WASM_FILES['tree-sitter-typescript.wasm'],
    queryPathOrContent: typescriptQuery,
  },
]

/* ------------------------------------------------------------------ */
/* 5. WASM directory management                                      */
/* ------------------------------------------------------------------ */
let customWasmDir: string | undefined

/**
 * Set a custom WASM directory for loading tree-sitter WASM files.
 * This can be useful for custom packaging or deployment scenarios.
 */
export function setWasmDir(dir: string): void {
  customWasmDir = dir
}

export function getWasmDir(): string | undefined {
  return customWasmDir
}

/* ------------------------------------------------------------------ */
/* 6. WASM path resolver                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve the path to a WASM file in a Node.js or Bun environment.
 * Works for both ESM and CJS builds of the SDK.
 */
function resolveWasmPath(wasmFileName: string): string {
  const customWasmDirPath = getWasmDir()
  if (customWasmDirPath) {
    return path.join(customWasmDirPath, wasmFileName)
  }

  // Try environment variable override
  const envWasmDir = process.env.SAVANT_CODE_WASM_DIR
  if (envWasmDir) {
    return path.join(envWasmDir, wasmFileName)
  }

  // Get the directory of this module
  const moduleDir = (() => {
    const dirname = getDirnameDynamically()
    if (typeof dirname !== 'undefined') {
      return dirname
    }
    // For ESM builds, we can't reliably get the module directory in all environments
    // So we fall back to process.cwd() which works for our use case
    return process.cwd()
  })()

  // For bundled SDK: WASM files are in a shared wasm directory
  const possiblePaths = [
    // Shared WASM directory (new approach to avoid duplication)
    path.join(moduleDir, '..', 'wasm', wasmFileName),
    // WASM files in the same directory as this module (for bundled builds)
    path.join(moduleDir, 'wasm', wasmFileName),
    // Development scenario - shared wasm directory in SDK dist
    path.join(process.cwd(), 'dist', 'wasm', wasmFileName),
  ]

  // Only the first candidate is returned: Language.load() failure falls back
  // to tryResolveFromPackage. The previous loop claimed to "try each path"
  // but always returned possiblePaths[0] (its try/catch could never throw) —
  // collapsed to be explicit (CM-3, FID-2026-0803-006).
  return possiblePaths[0]
}

/**
 * Fallback: try to resolve from the original package for development
 */
function tryResolveFromPackage(wasmFileName: string): string | null {
  try {
    // This works in development/monorepo scenarios
    return require.resolve(`@vscode/tree-sitter-wasm/wasm/${wasmFileName}`)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* 7. One-time library init                                          */
/* ------------------------------------------------------------------ */
// Initialize tree-sitter with Node.js-specific configuration

/* ------------------------------------------------------------------ */
/* 8. Unified runtime loader                                         */
/* ------------------------------------------------------------------ */
class UnifiedLanguageLoader implements RuntimeLanguageLoader {
  private parserReady: Promise<void> | undefined

  async initParser(): Promise<void> {
    if (!this.parserReady) {
      const p = initTreeSitterForNode()
      this.parserReady = p
      // Never cache a rejection (CM-2, FID-2026-0803-006): a later call must
      // be able to retry — the self-heal download may fix the wasm between
      // calls. Concurrent callers still share the same in-flight promise.
      p.catch(() => {
        if (this.parserReady === p) {
          this.parserReady = undefined
        }
      })
    }
    await this.parserReady
  }

  async loadLanguage(wasmFile: string): Promise<Language> {
    // Resolve WASM file path
    let wasmPath = resolveWasmPath(wasmFile)

    // Try to load the language using Node.js-specific method if available
    let lang: Language
    try {
      lang = await Language.load(wasmPath)
    } catch (err) {
      // Fallback: try resolving from the original package (development)
      const fallbackPath = tryResolveFromPackage(wasmFile)
      if (fallbackPath) {
        lang = await Language.load(fallbackPath)
      } else {
        throw err
      }
    }

    return lang
  }
}

/* ------------------------------------------------------------------ */
/* 9. Helper functions                                               */
/* ------------------------------------------------------------------ */
export function findLanguageConfigByExtension(
  filePath: string,
): LanguageConfig | undefined {
  const ext = path.extname(filePath)
  return languageTable.find((c) => c.extensions.includes(ext))
}

/* ------------------------------------------------------------------ */
/* 10. Language configuration loader                                 */
/* ------------------------------------------------------------------ */
export async function createLanguageConfig(
  filePath: string,
  runtimeLoader: RuntimeLanguageLoader,
): Promise<LanguageConfig | undefined> {
  const cfg = findLanguageConfigByExtension(filePath)
  if (!cfg) {
    return undefined
  }

  if (!cfg.parser) {
    // Dedupe concurrent inits (CM-5, FID-2026-0803-006): the first caller
    // builds the parser/query once; the rest await the same promise.
    cfg.initPromise ??= (async () => {
      await runtimeLoader.initParser()

      // Load the language using the runtime-specific loader
      const lang = await runtimeLoader.loadLanguage(cfg.wasmFile)

      // Create parser and query
      const parser = new Parser()
      parser.setLanguage(lang)

      // When loaded with bun, the queryText is a path to the file, not the content of the file.
      const queryContent = path.isAbsolute(cfg.queryPathOrContent)
        ? fs.readFileSync(cfg.queryPathOrContent, 'utf8')
        : cfg.queryPathOrContent

      cfg.language = lang
      cfg.parser = parser
      cfg.query = new Query(lang, queryContent)
    })()
    try {
      await cfg.initPromise
    } catch (err) {
      // Let a later call retry (the self-heal download may have succeeded
      // since), and let the runtime-specific implementation surface the error.
      cfg.initPromise = undefined
      throw err
    }
  }

  return cfg
}

/* ------------------------------------------------------------------ */
/* 11. Public API                                                    */
/* ------------------------------------------------------------------ */
const unifiedLoader = new UnifiedLanguageLoader()

// One-time diagnostic so a silently-degrading subsystem surfaces its cause
// (CM-2, FID-2026-0803-006) without spamming per-file errors.
let warnedInitFailure = false

export async function getLanguageConfig(
  filePath: string,
): Promise<LanguageConfig | undefined> {
  try {
    return await createLanguageConfig(filePath, unifiedLoader)
  } catch (err) {
    if (DEBUG_PARSING) {
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error('[tree-sitter] Load error for', filePath, err)
    }
    if (!warnedInitFailure) {
      warnedInitFailure = true
      // eslint-disable-next-line no-console -- one-time diagnostic
      console.warn(
        '[tree-sitter] code-map language init failed; symbol scoring disabled for this process (set SAVANT_CODE_TREE_SITTER_WASM_PATH or check the wasm bundle)',
        err,
      )
    }
    return undefined
  }
}
