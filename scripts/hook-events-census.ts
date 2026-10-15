import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HOOK_EVENTS } from '@savant-code/common/types/hooks'

/**
 * FID-2026-0919-030 / FID-2026-0919-031 — the hook event census: which events
 * the runtime actually fires, read from the source.
 *
 * `HOOK_EVENTS` is the parse-time vocabulary, so an event listed there validates
 * and loads. Nothing used to relate that list to the wiring: five of the twelve
 * entries had no firing site anywhere in the runtime, and `docs/design/
 * hook-system.md` documented all five as active. A hook declared for one of them
 * was **silently inert** — no parse error, no warning, nothing to observe.
 *
 * The census answers the question the vocabulary cannot, and the probe that
 * reports it is `scripts/hook-events-check.ts` (which also re-exports these
 * functions, so the shipped check and the tests share ONE authority):
 *
 * - **A site is a call, not a mention.** FID-2026-0919-031 wired five events
 *   through shared helpers (`hooks/lifecycle-hooks.ts`) instead of inline
 *   `buildHookInput({ event: 'X' })` calls. A helper module necessarily NAMES
 *   every event it can fire — in its own parameter types — and naming an event
 *   is exactly what a type annotation does without ever firing it. So a mention
 *   inside a hook-helper module counts only when the helper that owns the
 *   mention is called from somewhere else, and — when the helper is
 *   event-parameterized — only when the caller passes that event. Reachability,
 *   not spelling.
 * - **The classification must match.** The probe compares this census against
 *   `FIRED_HOOK_EVENTS` / `NEVER_FIRED_HOOK_EVENTS`, so wiring an event (or
 *   un-wiring one) fails until the classification is updated.
 */

/** Roots scanned for `event: '<Name>'` wiring. Runtime wiring lives here. */
const SOURCE_ROOTS = [
  'packages/agent-runtime/src',
  'cli/src',
  'sdk/src',
  'common/src',
]

const isTestPath = (path: string): boolean =>
  path.includes('__tests__') ||
  path.includes('test-harness') ||
  /\.(test|spec)\.tsx?$/.test(path)

function collectTypeScriptFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (isTestPath(path)) continue
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      collectTypeScriptFiles(path, out)
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path)
    }
  }
  return out
}

/**
 * Every non-test runtime source, repo-relative, read once, line comments
 * stripped.
 *
 * The census is textual, so a helper named in a COMMENT must not pass for a
 * call — that was a real hole: `// fireCompactionHook({…})` (or any other dead
 * text) satisfied the reachability rule. This catches drift; it is not an
 * adversarial analysis, and the pins in the suites are what prove behavior.
 */
function readSources(root: string): Map<string, string> {
  const sources = new Map<string, string>()
  for (const sourceRoot of SOURCE_ROOTS) {
    for (const file of collectTypeScriptFiles(join(root, sourceRoot))) {
      sources.set(
        file.slice(root.length + 1).replaceAll('\\', '/'),
        readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, ''),
      )
    }
  }
  return sources
}

/**
 * A module that exports event-firing helpers. Its mentions of an event are
 * declarations (which events the helper can fire), not call sites — so they are
 * only credited once the helper is called from outside the module.
 */
function isHookHelperModule(text: string): boolean {
  return (
    /\bexport function fire[A-Z]\w*\s*\(/.test(text) &&
    text.includes('buildHookInput')
  )
}

/** The `export function NAME(` that owns a line — the helper, if there is one. */
function enclosingExportedFunction(
  lines: string[],
  index: number,
): string | undefined {
  for (let i = index; i >= 0; i--) {
    const match = /^export function (\w+)\s*\(/.exec(lines[i])
    if (match) return match[1]
  }
  return undefined
}

export type HookEventSite = {
  event: string
  file: string
  helper?: string
  /** Why this mention is NOT a firing site. Absent = it is one. */
  reason?: string
}

/**
 * Every mention of a declared event in an `event:` line, with the verdict on
 * whether it is a real firing site.
 *
 * Two kinds of mention:
 * - **call site** — an `event: 'X'` argument in a module that is not a hook
 *   helper module. Live by construction; this is the shape every inline site has.
 * - **helper mention** — a mention inside a hook-helper module (its `event:`
 *   parameter type, or the `buildHookInput` call that consumes it). Naming an
 *   event in a parameter type is what a type annotation does without firing
 *   anything, so it is credited only on two conditions: some other non-test file
 *   calls the helper, and — when the helper is *event-parameterized* — the caller
 *   actually passes this event. Without the second condition, deleting one
 *   `event: 'Stop'` call while `event: 'Interrupt'` remains would keep the census
 *   green; a helper nothing calls is the original defect wearing a new name.
 */
export function hookEventSites(root: string): HookEventSite[] {
  const declared = new Set<string>(HOOK_EVENTS)
  const sources = readSources(root)
  const sites: HookEventSite[] = []

  for (const [file, text] of sources) {
    if (!text.includes('event:')) continue
    const lines = text.split('\n')
    const helperModule = isHookHelperModule(text)
    for (const [index, line] of lines.entries()) {
      if (!line.includes('event:')) continue
      for (const match of line.matchAll(/'([A-Za-z]+)'/g)) {
        const event = match[1]
        if (!declared.has(event)) continue
        const helper = helperModule
          ? enclosingExportedFunction(lines, index)
          : undefined
        const reason = helper
          ? helperVerdict(sources, file, helper, event)
          : undefined
        sites.push({
          event,
          file,
          ...(helper ? { helper } : {}),
          ...(reason ? { reason } : {}),
        })
      }
    }
  }
  return sites
}

/** Why a helper mention is not a site — `undefined` when it is one. */
function helperVerdict(
  sources: Map<string, string>,
  ownFile: string,
  helper: string,
  event: string,
): string | undefined {
  const callArguments = helperCallArguments(sources, ownFile, helper)
  if (callArguments === undefined) {
    return `${helper} is not called outside ${ownFile}`
  }
  if (!isEventParameterized(sources, ownFile, helper)) return undefined
  if (!callArguments.includes(`'${event}'`)) {
    return `${helper} is event-parameterized but no caller passes '${event}'`
  }
  return undefined
}

/**
 * The text following each `helper(` call outside its own module, or `undefined`
 * when there is no such call.
 */
function helperCallArguments(
  sources: Map<string, string>,
  ownFile: string,
  helper: string,
): string | undefined {
  const pattern = new RegExp(`\\b${helper}\\s*\\(`, 'g')
  const windows: string[] = []
  for (const [file, text] of sources) {
    if (file === ownFile) continue
    for (const match of text.matchAll(pattern)) {
      windows.push(text.slice(match.index, match.index + 400))
    }
  }
  return windows.length > 0 ? windows.join('\n') : undefined
}

/** Does the helper's own module declare it against more than one event? */
function isEventParameterized(
  sources: Map<string, string>,
  ownFile: string,
  helper: string,
): boolean {
  const text = sources.get(ownFile) ?? ''
  const lines = text.split('\n')
  const start = lines.findIndex((line) =>
    new RegExp(`^export function ${helper}\\s*\\(`).test(line),
  )
  if (start === -1) return false
  const declared = new Set<string>()
  for (let i = start; i < lines.length; i++) {
    if (i > start && /^export function \w+\s*\(/.test(lines[i])) break
    if (!lines[i].includes('event:')) continue
    for (const match of lines[i].matchAll(/'([A-Za-z]+)'/g)) {
      if ((HOOK_EVENTS as readonly string[]).includes(match[1])) {
        declared.add(match[1])
      }
    }
  }
  return declared.size > 1
}

/**
 * The events the source actually fires, mapped to their live site files.
 *
 * `packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts`
 * asserts the classification against THIS census rather than a
 * reimplementation — one authority, so a test can never quietly disagree with
 * the shipped check.
 */
export function firedEventsFromSource(root: string): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const site of hookEventSites(root)) {
    if (site.reason !== undefined) continue
    const sites = found.get(site.event) ?? []
    if (!sites.includes(site.file)) found.set(site.event, [...sites, site.file])
  }
  return found
}
