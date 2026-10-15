/**
 * @module module-state-wiring
 *
 * FID-2026-1007-002, second half. `audit-module-state.ts` finds module-scope
 * state with no reset; a reset that no test preload calls changes nothing. This
 * module reads the repository's `bunfig.toml` preload lists, resolves what each
 * preload actually imports, and answers two decidable questions:
 *
 *   1. **Rot** — does every `reset*`/`clear*` a preload imports still exist as
 *      an exported function in the module it names, and is it actually called?
 *      A renamed reset would otherwise leave the preload importing nothing and
 *      the suite silently unisolated.
 *   2. **Coverage** — which modules that own resettable state is NO preload
 *      loading? Those are the suites still exposed to cross-file leakage, and
 *      naming them is the difference between an audit and a claim.
 *
 * Boundaries: relative specifiers only (the preloads in this repository import
 * their own workspace sources relatively); a module loaded transitively by a
 * preload is not walked, because what a reset needs is the module whose
 * `beforeEach` calls it.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Directories whose `bunfig.toml` may declare a test preload. */
function bunfigFiles(root: string): string[] {
  const dirs = ['.']
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    ) as { workspaces?: string[] }
    dirs.push(...(pkg.workspaces ?? []))
  } catch {
    // A missing package.json simply means no workspace list to add.
  }
  return dirs
    .map((dir) => path.join(dir, 'bunfig.toml'))
    .filter((relative) => fs.existsSync(path.join(root, relative)))
}

/** Preload entries of one bunfig, resolved relative to the bunfig's directory. */
export function preloadsOf(root: string, bunfigRelative: string): string[] {
  const source = fs.readFileSync(path.join(root, bunfigRelative), 'utf8')
  const array = /preload\s*=\s*\[([^\]]*)\]/s.exec(source)?.[1]
  if (array === undefined) return []
  const dir = path.dirname(bunfigRelative)
  const found: string[] = []
  for (const match of array.matchAll(/["']([^"']+)["']/g)) {
    const specifier = match[1]
    if (!specifier) continue
    const resolved = path.isAbsolute(specifier)
      ? path.relative(root, specifier)
      : path.relative(root, path.resolve(root, dir, specifier))
    found.push(resolved.split(path.sep).join('/'))
  }
  return found
}

/** Every test preload module in the repository, repo-relative. */
export function preloadModules(root: string): string[] {
  const found: string[] = []
  for (const bunfig of bunfigFiles(root)) {
    for (const preload of preloadsOf(root, bunfig)) found.push(preload)
  }
  return [...new Set(found)]
}

/** Resolve a relative import specifier to a real source file, or undefined. */
export function resolveModule(
  root: string,
  fromFile: string,
  specifier: string,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const base = path.resolve(root, path.dirname(fromFile), specifier)
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate))
      return path.relative(root, candidate).split(path.sep).join('/')
  }
  return undefined
}

type PreloadImport = { name: string; local: string; module: string }

/**
 * Named imports of a preload, with the exported name and the local alias. Two
 * bindings share a name across modules (`resetActiveInstances` in two desktop
 * modules), so an aliased import is normal and must still count as wiring — the
 * local name is what the call check looks for.
 */
function resetImports(root: string, preload: string): PreloadImport[] {
  const source = fs.readFileSync(path.join(root, preload), 'utf8')
  const found: PreloadImport[] = []
  for (const match of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    const names = match[1] ?? ''
    const specifier = match[2] ?? ''
    const module = resolveModule(root, preload, specifier)
    if (module === undefined) continue
    for (const entry of names.split(',')) {
      const [name, local] = entry.split(/\s+as\s+/).map((part) => part.trim())
      if (name === undefined || !/^(?:__)?(?:reset|clear)[\w$]*$/.test(name))
        continue
      found.push({ name, local: local ?? name, module })
    }
  }
  return found
}

/** The modules some preload imports a reset from. */
export function wiredModules(root: string): Map<string, string[]> {
  const wired = new Map<string, string[]>()
  for (const preload of preloadModules(root)) {
    if (!fs.existsSync(path.join(root, preload))) continue
    for (const entry of resetImports(root, preload)) {
      const names = wired.get(entry.module) ?? []
      for (const name of [entry.name, entry.local]) {
        if (!names.includes(name)) names.push(name)
      }
      wired.set(entry.module, names)
    }
  }
  return wired
}

/** Wiring rot: an imported reset that no longer exists, or is never called. */
export function wiringIssues(root: string): string[] {
  const issues: string[] = []
  for (const preload of preloadModules(root)) {
    if (!fs.existsSync(path.join(root, preload))) continue
    const source = fs.readFileSync(path.join(root, preload), 'utf8')
    for (const { name, local, module } of resetImports(root, preload)) {
      const target = fs.readFileSync(path.join(root, module), 'utf8')
      const declared = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`,
      ).test(target)
      if (!declared) {
        issues.push(
          `${preload}: imports ${name} from ${module}, which does not export it — the preload is stale and that state is no longer reset.`,
        )
        continue
      }
      if (!new RegExp(`(?<![\\w$.])${local}\\s*\\(`).test(source)) {
        issues.push(
          `${preload}: imports ${name} but never calls it — the reset exists and does nothing.`,
        )
      }
    }
  }
  return issues
}
