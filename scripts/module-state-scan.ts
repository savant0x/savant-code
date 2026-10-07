/**
 * @module module-state-scan
 *
 * FID-2026-1007-002 — the scanner half of the module-state audit (split from
 * `./audit-module-state.ts` for the 300-line ceiling).
 *
 * `bun test` loads every file of a workspace into ONE process, so a
 * module-scope `Map`/`Set`/array/`let` that accumulates is process-lifetime
 * state every suite inherits. That is not a theory: the agent-runtime suite was
 * red with 76 failures because one registry of circuit breakers kept an OPEN
 * circuit for a key the shared fixtures reuse across unrelated files
 * (FID-2026-1007-001). The registry above that fix is legitimate production
 * design; what was missing was a way to return it to its start state at the
 * test boundary, so a suite's verdict depended on file order.
 *
 * Two decidable questions per module-scope binding:
 *   - is it MUTATED after initialization (a `set`/`add`/`delete`/`clear`/`push`
 *     member call, an index write, or any reassignment)? A read-only constant
 *     typed as a container is not state, so the mutating use is the evidence,
 *     never the type.
 *   - does the same file expose a reset that NAMES it? `reset*` and the older
 *     `clear*` / `__reset*` test seams all count — a seam that already exists
 *     is coverage, and reporting it as a gap would have minted duplicates.
 */
import fs from 'node:fs'
import path from 'node:path'

import { analyzeSource } from './module-state-analyze.js'
import { maskNonCode } from './test-budget-scan.js'

import type {
  CuredBinding,
  ModuleStateFinding,
} from './module-state-analyze.js'

export type {
  CuredBinding,
  ModuleStateClass,
  ModuleStateFinding,
  ModuleStateKind,
} from './module-state-analyze.js'

/** Trees that hold no authored production source, or none a test loads. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.turbo',
  'target',
  'resources',
  'website',
  'docs',
  'dev',
  '.agents',
  'coverage',
])

const SOURCE_FILE = /\.tsx?$/
const TEST_FILE = /\.(test|spec)\.tsx?$/
/** Shared helper modules under a test directory are test infrastructure. */
const HELPER_DIRS = new Set(['__tests__', 'test', 'testing'])

export type ModuleStateScan = {
  findings: ModuleStateFinding[]
  cured: CuredBinding[]
  /** Module-scope bindings that are never mutated: scanned, not findings. */
  constants: number
  /** Program entrypoints: their module state dies with the process they start. */
  entrypoints: number
  scanned: number
}

/**
 * A program entrypoint (`if (import.meta.main) …`) is executed by a shell, not
 * loaded into a test process, so its module-scope state cannot outlive the
 * process that owns it.
 */
const ENTRYPOINT = /^\s*if\s*\(\s*import\.meta\.main/m

export function isEntrypoint(source: string): boolean {
  return ENTRYPOINT.test(maskNonCode(source))
}

/**
 * A `scripts/` directory inside a workspace holds build/program tooling that is
 * executed as a program (`cli/scripts/build-binary-opentui.ts`); the root
 * `scripts/` tree holds gate tooling that tests DO import, so only the nested
 * form is skipped.
 */
function isWorkspaceTooling(relativePath: string): boolean {
  const segments = relativePath.split('/')
  return (
    segments.length > 1 &&
    segments[0] !== 'scripts' &&
    segments.includes('scripts')
  )
}

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), root, out)
      continue
    }
    if (!SOURCE_FILE.test(entry.name)) continue
    const relative = path.relative(root, path.join(dir, entry.name))
    const posix = relative.split(path.sep).join('/')
    if (TEST_FILE.test(posix)) continue
    if (isWorkspaceTooling(posix)) continue
    const segments = posix.split('/').slice(0, -1)
    if (segments.some((segment) => HELPER_DIRS.has(segment))) continue
    out.push(posix)
  }
}

/** Roots that hold authored production source a test in this repo can load. */
export function scanRoots(root: string): string[] {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  ) as { workspaces?: string[] }
  return [...(packageJson.workspaces ?? []), 'scripts']
}

/** Every module-scope mutable binding, with the resets that cover it. */
export function scanModuleState(root: string): ModuleStateScan {
  const files: string[] = []
  for (const scanRoot of scanRoots(root)) {
    const absolute = path.join(root, scanRoot)
    if (!fs.existsSync(absolute)) continue
    walk(absolute, root, files)
  }
  const findings: ModuleStateFinding[] = []
  const cured: CuredBinding[] = []
  let constants = 0
  let entrypoints = 0
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    if (isEntrypoint(source)) {
      entrypoints += 1
      continue
    }
    const result = analyzeSource(source)
    constants += result.constants
    for (const finding of result.findings) findings.push({ ...finding, file })
    for (const binding of result.cured) cured.push({ ...binding, file })
  }
  return { findings, cured, constants, entrypoints, scanned: files.length }
}
