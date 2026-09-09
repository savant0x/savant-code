// FID-2026-0909-002 (Step 3) — gate-environment parity audit.
//
// The v0.0.30 incident class: three defects that only the release-gate
// environment could see (PowerShell env casing, sanitized secret-stripped
// spawn env, the SDK build's plain-TS dts program) shipped green through
// every local gate. The durable defense is a static audit that refuses the
// two mechanically-expressible defect classes at commit time:
//
//   class 1 — bare runtime-name spawns (`spawn('bun')`) that resolve PATH
//             only in dev shells and die with uv_spawn ENOENT under the
//             gate's sanitized environment. Fix: `process.execPath` or an
//             explicitly resolved runtime path.
//   class 2 — Bun-only `import.meta` properties (`dir`, `main`) in
//             `common/src` production sources, the input set of the SDK
//             build's plain-TS dts program where they are TS2339. Fix:
//             standard `import.meta.url` derivation.
//
// Class 3 (process.env shape-dependence) is deliberately NOT grepped: the
// same source shape is both the legitimate env-passthrough pattern and the
// incident shape, so a ban would be false positives (see FID Loop 1); it
// is behaviorally pinned by the env-bootstrap suite instead.
//
// One reasoned exemption: `scripts/public-release-pinned-bun.test.ts` is
// the pinned-runtime CONTRACT probe — it asserts the environment on
// purpose, path-exact, not pattern-wide.
//
// Detector is pure text-in/issues-out; the collector resolves tracked
// surfaces via `git ls-files` (dev/LEARNINGS.md: filesystem grep is not
// git state) and normalizes separators before matching.

import fs from 'node:fs'
import path from 'node:path'

export interface GateEnvParityIssue {
  file: string
  line: number
  message: string
}

export interface SourceLines {
  file: string
  lines: string[]
}

/** Class 1: a child spawn whose runtime is a bare, PATH-resolved name. */
const BARE_RUNTIME_SPAWN_PATTERN =
  /(?:\bspawn(?:Sync)?\s*\(\s*['"]bun['"])|(?:Bun\.spawn(?:Sync)?\s*\(\s*\[\s*['"]bun['"])/

/** Class 2: Bun-only `import.meta` properties (TS2339 under a plain-TS program). */
const BUN_ONLY_IMPORT_META_PATTERN = /import\.meta\.(?:dir|main)/

/** Class 2 scope: the dts program's input set — common/src, production only. */
const COMMON_SRC_PATTERN = /^common\/src\//

/** Test-file markers that lift a path out of class-2 production scope. */
const TEST_PATH_PATTERN =
  /(?:^|\/)(?:__tests__|tests|testing)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/

/** Shell/TS comment prefixes that exempt a line from the audit. The
 * `*` alternative covers block-comment/JSDoc continuation lines — their
 * content is documentation, and the detector's own JSDoc must be allowed
 * to name the patterns it detects (self-scan). */
const COMMENT_PATTERN = /^\s*(?:#|\/\/|\*)/

/**
 * The pinned-runtime contract probe (scripts/public-release-pinned-bun.test.ts):
 * its `spawnSync('bun', ...)` is the release contract itself — it asserts
 * the environment on purpose. Exempted by exact path, never by pattern.
 */
export const PINNED_BUN_PROBE_PATH = 'scripts/public-release-pinned-bun.test.ts'

/** Tracked source extensions the audit covers. */
export const GATE_ENV_SURFACE_ARGS = [
  '*.ts',
  '*.tsx',
  '*.mts',
  '*.cts',
  '*.js',
  '*.mjs',
]

/** True when a normalized repo-relative path is a common/src test surface. */
function isCommonSrcTestPath(normalizedFile: string): boolean {
  return (
    COMMON_SRC_PATTERN.test(normalizedFile) &&
    TEST_PATH_PATTERN.test(normalizedFile)
  )
}

/**
 * Pure detector: flag the class-1 bare-runtime spawn anywhere on the
 * audited surface (the incident WAS a test file) and the class-2 Bun-only
 * `import.meta` property inside common/src production. Comment lines are
 * exempt (documented allowlist; a commented example is not executable).
 */
export function detectGateEnvParityIssues(
  source: SourceLines,
): GateEnvParityIssue[] {
  const issues: GateEnvParityIssue[] = []
  const normalizedFile = source.file.replaceAll('\\', '/')
  if (normalizedFile === PINNED_BUN_PROBE_PATH) return issues
  const class2Applies =
    COMMON_SRC_PATTERN.test(normalizedFile) &&
    !isCommonSrcTestPath(normalizedFile)
  source.lines.forEach((rawLine, index) => {
    const lineNumber = index + 1
    if (COMMENT_PATTERN.test(rawLine)) return
    if (BARE_RUNTIME_SPAWN_PATTERN.test(rawLine)) {
      issues.push({
        file: source.file,
        line: lineNumber,
        message:
          "bare runtime-name spawn: `'bun'` is PATH-resolvable only in dev shells — under the release gate's sanitized spawn environment this dies with uv_spawn ENOENT (v0.0.30 incident). Spawn `process.execPath` or an explicitly resolved runtime path.",
      })
      return
    }
    if (class2Applies && BUN_ONLY_IMPORT_META_PATTERN.test(rawLine)) {
      issues.push({
        file: source.file,
        line: lineNumber,
        message:
          'Bun-only `import.meta` property in common/src production: the SDK build recompiles this file under a plain-TS dts program where it is TS2339 (v0.0.30 incident). Derive from standard `import.meta.url`.',
      })
    }
  })
  return issues
}

/**
 * Resolve the audited file list from git (tracked state, per the learnings
 * rule). Injectable runner for tests; sync spawn matches the repo's
 * validate scripts. Non-git environments fail closed with an empty list +
 * a returned error message (auditability is unprovable there).
 */
export function collectGateEnvSurfaceFiles(
  root: string,
  runner: (
    command: string,
    args: string[],
    cwd: string,
  ) => {
    status: number | null
    stdout: string
    stderr: string
  } = defaultRunner,
): { files: string[]; error?: string } {
  const result = runner(
    'git',
    ['ls-files', '--', ...GATE_ENV_SURFACE_ARGS],
    root,
  )
  if ((result.status ?? 1) !== 0) {
    return {
      files: [],
      error: `Unable to list tracked audit surfaces (git ls-files exit ${result.status}): ${result.stderr.trim()}`,
    }
  }
  return {
    files: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((file) => file.replaceAll('\\', '/')),
  }
}

/** Read + normalize the audited files that exist on disk. */
export function readGateEnvSurfaceFiles(
  root: string,
  files: string[],
): SourceLines[] {
  const sources: SourceLines[] = []
  for (const file of files) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue
    sources.push({
      file,
      lines: fs.readFileSync(full, 'utf8').split(/\r?\n/),
    })
  }
  return sources
}

export function auditGateEnvParity(
  root: string,
  runner?: (
    command: string,
    args: string[],
    cwd: string,
  ) => { status: number | null; stdout: string; stderr: string },
): GateEnvParityIssue[] {
  const { files, error } = collectGateEnvSurfaceFiles(root, runner)
  if (error) {
    return [
      {
        file: '(audit surfaces)',
        line: 0,
        message: error,
      },
    ]
  }
  return readGateEnvSurfaceFiles(root, files).flatMap((source) =>
    detectGateEnvParityIssues(source),
  )
}

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const spawned = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    status: spawned.exitCode,
    stdout: spawned.stdout.toString(),
    stderr: spawned.stderr.toString(),
  }
}
