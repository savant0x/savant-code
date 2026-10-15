/**
 * FID-2026-0927-003 F2 — attribute a failed verification run to the files it
 * names.
 *
 * The Law 3 gate blocks re-editing a file that is dirty-and-unverified. When a
 * verification run FAILS, credit is withheld, so the file the run is complaining
 * about becomes unwritable — and editing that file is the only legal repair. The
 * gate therefore needs to know WHICH files the failure belongs to, so it can
 * distinguish "the test is wrong, fix it" from "the code is wrong, do not edit
 * the test to hide it".
 *
 * This module does the attribution and nothing else: text in, path list out. It
 * never decides whether a write is permitted — `runLaw3Gate` owns that decision,
 * so the policy and the parsing cannot drift apart.
 *
 * Recognised shapes (the two this repo actually emits):
 *   - bun test:  `src/__tests__/tick.test.ts:` on its own line (file header)
 *   - tsc:       `src/provider.ts(12,5): error TS2307: ...`
 *   - generic:   `path/to/file.ts:12:5: message`
 *
 * Deliberately conservative: a path is only attributed when it looks like a
 * source file this repo would contain (has a code extension, and no spaces or
 * angle brackets). Attribution is a permission WIDENER, so a loose match would
 * hand back the masking vector this whole mechanism exists to close.
 */

/** Extensions we are willing to attribute a failure to. */
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.toml',
  '.yaml',
  '.yml',
])

/** A source-ish path: has a code extension and no whitespace/brackets. */
const PATH_SHAPE = /^[A-Za-z0-9._/-]+$/

function hasCodeExtension(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return false
  return CODE_EXTENSIONS.has(path.slice(dot).toLowerCase())
}

/**
 * Normalise to forward slashes and strip a leading `./` so a repo-relative
 * path compares cleanly against the forms a write tool may report.
 */
function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * Extract the repo-relative source paths a verification failure names.
 *
 * Returns them de-duplicated and in first-seen order so the message the gate
 * emits is stable across runs.
 */
export function extractFailingPaths(output: string | undefined): string[] {
  if (!output) return []
  const found: string[] = []
  const seen = new Set<string>()

  const add = (raw: string) => {
    const path = normalize(raw)
    if (!path || seen.has(path)) return
    if (!PATH_SHAPE.test(path) || !hasCodeExtension(path)) return
    seen.add(path)
    found.push(path)
  }

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // tsc: `path.ts(12,5): error TSxxxx: message`
    const tsc = trimmed.match(/^([A-Za-z0-9._/-]+)\(\d+,\d+\):\s/)
    if (tsc?.[1]) {
      add(tsc[1])
      continue
    }

    // bun test file header: `src/__tests__/tick.test.ts:` on its own line.
    const header = trimmed.match(/^([A-Za-z0-9._/-]+\.[A-Za-z0-9]+):\s*$/)
    if (header?.[1]) {
      add(header[1])
      continue
    }

    // generic: `path.ts:12:5: message`
    const generic = trimmed.match(/^([A-Za-z0-9._/-]+\.[A-Za-z0-9]+):\d/)
    if (generic?.[1]) {
      add(generic[1])
    }
  }

  return found
}

/**
 * Collect the human-readable output a tool result value carries, including the
 * batch form where `run_readonly_command` nests one value per command under
 * `results`.
 *
 * This exists because the Law 3 gate previously received NO output on this
 * path: `result-lifecycle` sets `result.text` only when the tool content is a
 * bare string, and a terminal command's content is a `json` array. So the
 * enforcement layer could not have attributed a failure even in principle.
 */
function collectOutputText(value: Record<string, unknown>): string[] {
  const chunks: string[] = []
  for (const key of ['stdout', 'stderr'] as const) {
    const text = value[key]
    if (typeof text === 'string' && text.length > 0) chunks.push(text)
  }
  if (Array.isArray(value.results)) {
    for (const entry of value.results) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        chunks.push(...collectOutputText(entry as Record<string, unknown>))
      }
    }
  }
  return chunks
}

/**
 * Extract the source paths a FAILED tool result names, reading them out of the
 * tool result content itself. Returns `[]` for content shapes carrying no
 * output, which is the correct answer for a command that failed without
 * naming a file — the `self_correct` fallback covers that case.
 */
export function extractFailingPathsFromContent(content: unknown): string[] {
  if (!Array.isArray(content)) return []
  const found: string[] = []
  const seen = new Set<string>()
  for (const part of content) {
    if (!part || typeof part !== 'object' || !('value' in part)) continue
    const value = part.value
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const text = collectOutputText(value as Record<string, unknown>).join('\n')
    for (const path of extractFailingPaths(text)) {
      if (seen.has(path)) continue
      seen.add(path)
      found.push(path)
    }
  }
  return found
}
