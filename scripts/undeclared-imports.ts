import { builtinModules } from 'node:module'

/** One import specifier, with the 1-based line it appears on. */
export type Specifier = {
  line: number
  specifier: string
}

/**
 * How the install satisfies a package the importing manifest never named.
 *
 * `workspace` — a member of the repository's `workspaces`, which the root
 * install links whatever any single manifest declares. Resolves; not a finding.
 *
 * `declared` — some manifest declares it, so the root `node_modules` has it.
 * The importing package does not own the declaration, which is the ordinary
 * shape of a monorepo (`cli` imports `lodash`, the root devDependencies
 * declare it). Resolves; not a finding.
 *
 * `transitive` — NO manifest names it; it is in the tracked lockfile only
 * because some dependency pulled it in. This is the v0.0.35 `ajv` exactly:
 * eslint's tree supplied ajv 6, `packages/connectors` wanted the v8
 * `dist/2020.js`, and no manifest described the difference. It resolves today
 * and breaks the moment any dependency changes its own graph. Fails the gate.
 *
 * `absent` — not in the lockfile either, so a clean install never provides it.
 * This is the v0.0.24 `@noble/hashes` class verbatim ("only resolved from a
 * node_modules outside the repo"): it works on the machine that once installed
 * it, and fails in CI. Fails the gate.
 */
export type UndeclaredTier = 'workspace' | 'declared' | 'transitive' | 'absent'

/** A bare specifier no manifest in the repository declares. */
export type UndeclaredImport = {
  file: string
  line: number
  specifier: string
  packageName: string
  tier: UndeclaredTier
  /** Manifests that declare the package, for the report. */
  owners: readonly string[]
}

/** What the repository declares, what it installs, and what it links. */
export type ImportContext = {
  /** Declared as a dependency by at least one manifest in the repository. */
  provided: ReadonlySet<string>
  /** Package names the tracked lockfile records. */
  installed: ReadonlySet<string>
  /** Members of the root `workspaces`, linked into the root install. */
  linked: ReadonlySet<string>
  /** Which manifests declare each name, for the report. */
  owners: ReadonlyMap<string, readonly string[]>
}

/**
 * The code shape that makes the string after it a module id: `from 'x'`,
 * `import 'x'`, `import('x')`, `require('x')`.
 *
 * The leading character class is load-bearing, and every character in it is
 * there for a case seen in this repository. Without `\w` and `$`, a property
 * call reads as an import (`Array.from(['a'])` → package `a`, `x.from('y')` →
 * `y`). Without `.` the same. Without `/`, `|`, `'` and `"`, an import
 * written INSIDE a literal reads as one — `expect(src).not.toMatch(/from
 * '\.\/office\/office-scene'/)` in `desktop/src/floor/__tests__/office-lazy
 * .test.tsx`, and the minified sigma chunks under `cli/src/constants/`. Those
 * two are the largest false-positive classes this audit has, and both live in
 * files nobody can review by eye.
 */
const IMPORT_SITE_PATTERN = /(?:^|[^\w$./|'"])(?:from|import|require)\s*\(?\s*$/

const NODE_BUILTINS = new Set(builtinModules)

/**
 * Every statically-named import specifier in a source file.
 *
 * One pass over the raw text that skips comments and string bodies and accepts
 * a string as a specifier ONLY when the code immediately before it is an
 * import site.
 *
 * A computed `await import(name)` names no module id, so no manifest can be
 * checked against it; template-literal ids are skipped for the same reason.
 */
export function extractSpecifiers(source: string): Specifier[] {
  const found: { index: number; specifier: string }[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      index = skipToLineEnd(source, index)
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index = skipBlockComment(source, index)
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      const end = skipString(source, index)
      const lineStart = source.lastIndexOf('\n', index - 1) + 1
      const site = char !== '`' && isImportSite(source.slice(lineStart, index))
      if (site && source[end - 1] === char) {
        found.push({ index, specifier: source.slice(index + 1, end - 1) })
      }
      index = end
      continue
    }
    index += 1
  }
  return found.map((entry) => ({
    line: lineAt(source, entry.index),
    specifier: entry.specifier,
  }))
}

/** The 1-based line an offset sits on. */
function lineAt(source: string, index: number): number {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') line += 1
  }
  return line
}

function isImportSite(linePrefix: string): boolean {
  return IMPORT_SITE_PATTERN.test(linePrefix)
}

/** Advance past a quoted run to just after its closing quote. */
function skipString(source: string, start: number): number {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === quote) return index + 1
    index += 1
  }
  return index
}

function skipToLineEnd(source: string, start: number): number {
  let index = start
  while (index < source.length && source[index] !== '\n') index += 1
  return index
}

function skipBlockComment(source: string, start: number): number {
  let index = start + 2
  while (index < source.length) {
    if (source[index] === '*' && source[index + 1] === '/') return index + 2
    index += 1
  }
  return index
}

/** True when a specifier names a package rather than a path or subpath import. */
export function isBareSpecifier(specifier: string): boolean {
  if (specifier === '') return false
  return !/^[./#]/.test(specifier)
}

/**
 * The package a bare specifier names, or null when it names no package.
 * `@scope/pkg/sub` → `@scope/pkg`; `pkg/dist/2020.js` → `pkg`; a relative
 * path, an absolute path, `#subpath-import` and a bare `@scope` → null.
 */
export function packageNameOf(specifier: string): string | null {
  if (!isBareSpecifier(specifier)) return null
  const [first, second] = specifier.split('/')
  if (first === undefined) return null
  if (!first.startsWith('@')) return first
  return second === undefined ? null : `${first}/${second}`
}

/**
 * True for a Node builtin, a `node:`/`bun:`-prefixed module and the `bun`
 * global itself. `bun:sqlite` is why the prefix test is not enough on its own:
 * Bun's own modules are absent from Node's builtin list.
 */
export function isRuntimeBuiltin(specifier: string): boolean {
  if (specifier === 'bun') return true
  if (specifier.startsWith('node:') || specifier.startsWith('bun:')) return true
  return NODE_BUILTINS.has(specifier)
}

/**
 * True when a manifest declares the package, or declares its types.
 *
 * The `@types/<name>` alias is TypeScript's own fallback for an import whose
 * package is absent — `cli/src/utils/markdown-inline.ts` imports `type { Root }
 * from 'mdast'`, and `mdast` is not installed at all while `@types/mdast` is.
 * The alias is read from `installed` as well as `provided` because a types
 * package routinely arrives transitively. Deliberately lenient: a VALUE import
 * of a package that only has types would pass here, and the bundler gate is
 * what catches that.
 */
export function isProvided(
  packageName: string,
  context: ImportContext,
): boolean {
  if (context.provided.has(packageName)) return true
  return (
    context.provided.has(`@types/${packageName}`) ||
    context.installed.has(`@types/${packageName}`)
  )
}

/** How the install satisfies a package the importing manifest never named. */
export function tierOf(
  packageName: string,
  context: ImportContext,
): UndeclaredTier {
  if (context.linked.has(packageName)) return 'workspace'
  if (isProvided(packageName, context)) return 'declared'
  return context.installed.has(packageName) ? 'transitive' : 'absent'
}

/**
 * Grade one file. Pure: the same source and the same context give the same
 * answer on a developer machine, in a clean CI checkout and in a tarball —
 * which is exactly the property the v0.0.24 gate lacked when it resolved
 * against whatever `node_modules` happened to sit on disk.
 */
export function findUndeclaredImports(
  file: string,
  source: string,
  context: ImportContext,
): UndeclaredImport[] {
  const issues: UndeclaredImport[] = []
  for (const { line, specifier } of extractSpecifiers(source)) {
    const packageName = packageNameOf(specifier)
    if (packageName === null || isRuntimeBuiltin(specifier)) continue
    const tier = tierOf(packageName, context)
    if (tier === 'workspace' || tier === 'declared') continue
    issues.push({
      file,
      line,
      specifier,
      packageName,
      tier,
      owners: context.owners.get(packageName) ?? [],
    })
  }
  return issues
}
