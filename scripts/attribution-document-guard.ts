/**
 * Agent-attribution guard — the DOCUMENT surface (FID-2026-1016-008).
 *
 * The commit-message half of the rule could not see the records themselves: on
 * 2026-10-16 the operator swept the governed documents and found the same rule
 * broken inside them — `**Author:** Buffy / Savant` in archived FIDs,
 * `**Author:** Nova` in a build order, `**Author:** Spencer + Nova` in five FID
 * metadata blocks, `**Author:** [Agent name]` in the sweep-prompt template, and
 * `**Verified by:** FreeBuff …` / `**Verified by:** … Nova …` lines in the
 * tracked, published `CHANGELOG.md`. No enforcement point could see any of them:
 * the commit-msg hook reads commit messages, `.githooks/pre-push` scans the
 * pushed range (whose content is committed blobs — the records are gitignored),
 * and every repository gate scanned commit messages only.
 *
 * Two families are judged, and only these two:
 *   1. an attribution FIELD (`**Author:**`, `**Verified By:**`, …) whose VALUE
 *      credits a foreign coding agent — everything the field says about the
 *      credit is in `./attribution-patterns`, never copied here;
 *   2. a watermark or trailer line, judged by the same anchored patterns a
 *      commit message is judged by.
 *
 * Four shapes are deliberately never findings, each pinned by a real line in the
 * suite: Savant's own credit, a human credit, prose that discusses the rule, and
 * a quotation of the very trailer the rule blocks (fenced blocks, inline code
 * spans — including a span that wraps a line, which CommonMark allows — and
 * Savant's own provider id). A guard that flags legitimate records gets disabled
 * rather than fixed, which is the worse failure.
 *
 * Fail-closed: an unreadable tree or a root with no governed tree at all returns
 * an issue instead of an empty result, so an inability to scan can never read as
 * a clean scan.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  AGENT_ATTRIBUTION_PATTERNS,
  ATTRIBUTION_FIELD,
  FOREIGN_AGENT_IN_VALUE,
  PROVENANCE_FIELDS,
  SAVANT_PROVIDER_IDS,
  SELF_DECLARING_AGENT_VALUE,
} from './attribution-patterns'

/**
 * Inline code spans quote, exactly as fenced blocks do: this repository's
 * records quote the very trailers the guard blocks
 * (`` `Co-Authored-By: Codebuff <noreply@codebuff.com>` ``) to document their
 * removal. Every span is replaced by spaces of the same length, newlines
 * included, so the masked text keeps the line structure of the original and a
 * span that wraps a line masks both of its lines.
 */
function maskCodeSpans(text: string): string {
  return text.replace(/`[^`]*`/g, (span) => span.replace(/[^\n]/g, ' '))
}

const DOCUMENT_TREES = ['dev', 'docs', '.agents/skills'] as const
const DOCUMENT_ROOT_FILES = [
  'CHANGELOG.md',
  'SCOPE.md',
  'AGENTS.md',
  'ECHO.md',
  'ARCHITECTURE.md',
  'CONTRIBUTING.md',
  'README.md',
  'README.zh-CN.md',
] as const
const DOCUMENT_FILE_PATTERN = /\.(?:md|mdx)$/i
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])
/**
 * Trees that are verbatim third-party material rather than this repository's
 * records: `dev/scratchpad/` (the ephemeral working area, where whole session
 * transcripts are retained as audit receipts) and `dev/exports/` (raw session
 * exports). A transcript quotes its author on every line; the rule covers the
 * records this repository writes about itself, not the transcripts it keeps.
 */
const SKIPPED_TREES = ['dev/scratchpad', 'dev/exports']

/**
 * Returns the disallowed attribution lines in one document (empty = clean).
 */
export function documentAttributionLines(content: string): string[] {
  const lines = content.split(/\r?\n/)
  // Fenced blocks are line-based, so they are marked first; inline code spans
  // are masked afterwards across the whole document, which is the only way a
  // span wrapping a line is seen as one span.
  const outsideFence: boolean[] = []
  let fence: string | undefined
  for (const rawLine of lines) {
    const fenceMarker = /^(`{3,}|~{3,})/.exec(rawLine.trim())?.[1]
    if (fenceMarker) {
      // One fence state, toggled by its own marker: a `~~~` block opened inside
      // a ``` block is content, and an unterminated fence quotes to EOF.
      if (!fence) fence = fenceMarker[0]
      else if (fence === fenceMarker[0]) fence = undefined
      outsideFence.push(false)
      continue
    }
    outsideFence.push(fence === undefined)
  }
  const maskedLines = maskCodeSpans(lines.join('\n')).split('\n')
  const violations: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim()
    if (!line || !outsideFence[index]) continue
    // Both families read the masked line, so a quotation is never a finding: a
    // record may write `` **Verified By:** `code-reviewer-…` `` or name legacy
    // identifiers (`` `CodebuffClient` ``) without crediting an agent.
    const masked = (maskedLines[index] ?? '').trim()
    if (!masked) continue
    const field = ATTRIBUTION_FIELD.exec(masked)
    if (field) {
      const label = (field[1] ?? '').toLowerCase()
      const value = (field[2] ?? '').replace(SAVANT_PROVIDER_IDS, ' ')
      const creditsForeignAgent =
        FOREIGN_AGENT_IN_VALUE.test(value) ||
        (PROVENANCE_FIELDS.has(label) && SELF_DECLARING_AGENT_VALUE.test(value))
      if (creditsForeignAgent) {
        violations.push(line)
        continue
      }
    }
    for (const pattern of AGENT_ATTRIBUTION_PATTERNS) {
      if (pattern.test(masked)) {
        violations.push(line)
        break
      }
    }
  }
  return violations
}

function collectDocumentFiles(
  root: string,
  directory: string,
  into: string[],
): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      const child = path.join(directory, entry.name)
      const relative = path.relative(root, child).split(path.sep).join('/')
      if (SKIPPED_TREES.includes(relative)) continue
      collectDocumentFiles(root, child, into)
    } else if (DOCUMENT_FILE_PATTERN.test(entry.name)) {
      into.push(path.join(directory, entry.name))
    }
  }
}

/**
 * The repository to scan, resolved from the working directory rather than guessed
 * from `process.cwd()`.
 *
 * Both real callers land inside a repository and disagree about which path means
 * "here": a FID gate runs each suite from its workspace directory
 * (`scripts/`), while `.githooks/pre-push` runs from the top level of the repo
 * being pushed — which is NOT necessarily the repo the hook script itself lives
 * in (`core.hooksPath` may point elsewhere), so the module location cannot be the
 * answer either. `git rev-parse --show-toplevel` is right for both, and the
 * module's own parent is the fallback when the working directory is not in a
 * repository at all.
 */
function repositoryRoot(): string {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  const toplevel = result.status === 0 ? String(result.stdout ?? '').trim() : ''
  return toplevel || path.resolve(import.meta.dir, '..')
}

/**
 * Repository-gate collector over the governed document trees: `dev/` (records,
 * FIDs, session summaries, research, the third-party channel), `docs/`,
 * `.agents/skills/` and the root protocol files. `dev/` is gitignored and
 * therefore absent from a clone — a missing tree is skipped, but finding NO tree
 * at all is an issue, so a mistyped root can never read as a clean scan.
 */
export function collectDocumentAttributionIssues(
  root: string = repositoryRoot(),
): { code: string; message: string }[] {
  const files: string[] = []
  let rootsFound = 0
  try {
    for (const tree of DOCUMENT_TREES) {
      const directory = path.join(root, tree)
      if (!fs.existsSync(directory)) continue
      rootsFound += 1
      collectDocumentFiles(root, directory, files)
    }
    for (const file of DOCUMENT_ROOT_FILES) {
      const candidate = path.join(root, file)
      if (fs.existsSync(candidate)) {
        rootsFound += 1
        files.push(candidate)
      }
    }
    if (rootsFound === 0) {
      return [
        {
          code: 'attribution.document-scan-failed',
          message: `no governed document tree found under ${root} — refusing to report a clean scan`,
        },
      ]
    }
    const issues: { code: string; message: string }[] = []
    for (const file of files) {
      // Forward slashes on every platform: the gate reports `file:line` the way
      // the rest of the repository's checks do, not the OS separator.
      const relative = path.relative(root, file).split(path.sep).join('/')
      const lines = documentAttributionLines(fs.readFileSync(file, 'utf8'))
      for (const line of lines) {
        issues.push({
          code: 'attribution.document-agent-credit',
          message: `${relative}: ${line}`,
        })
      }
    }
    return issues
  } catch (error) {
    return [
      {
        code: 'attribution.document-scan-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    ]
  }
}
