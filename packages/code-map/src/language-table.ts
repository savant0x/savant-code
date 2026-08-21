import csharpQuery from './tree-sitter-queries/tree-sitter-c_sharp-tags.scm'
import cppQuery from './tree-sitter-queries/tree-sitter-cpp-tags.scm'
import goQuery from './tree-sitter-queries/tree-sitter-go-tags.scm'
import javaQuery from './tree-sitter-queries/tree-sitter-java-tags.scm'
import javascriptQuery from './tree-sitter-queries/tree-sitter-javascript-tags.scm'
import pythonQuery from './tree-sitter-queries/tree-sitter-python-tags.scm'
import rubyQuery from './tree-sitter-queries/tree-sitter-ruby-tags.scm'
import rustQuery from './tree-sitter-queries/tree-sitter-rust-tags.scm'
import typescriptQuery from './tree-sitter-queries/tree-sitter-typescript-tags.scm'

import type { Language, Parser, Query } from 'web-tree-sitter'

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
