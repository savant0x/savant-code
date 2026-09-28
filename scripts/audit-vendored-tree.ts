/**
 * FID-2026-0927-002 step 1b — foreign top-level tree audit.
 *
 * A 77 MB / 4,150-file vendored third-party repository (`cline-main/`) sat at the
 * repo root, untracked and unignored, one level above the `/resources/` rule that
 * would have covered it. It sat inside the release automation's `git add --all`
 * blast radius (`git-publish.ts:78`), and the only fatal response to unexpected
 * staged content is the credential scan (`:89`) — the never-committed disclosure
 * (`:104-111`) only warns. The operator resolved that instance by moving the tree
 * under `resources/`; this probe is the mechanism so the next one is caught before
 * a release rather than after.
 *
 * Three signals, because no single one covers every shape (all measured on the
 * live tree, not estimated):
 *
 *   1. `untracked`      — no tracked file at all. A pure accidental clone.
 *   2. `nested-git`     — the root contains a `.git` entry, so it is a real
 *                         clone, unless it is a declared submodule. This catches
 *                         the case the first signal misses: a tree where files
 *                         were `git add`-ed before the walk-away, which made a
 *                         4,150-file payload invisible to signal 1 alone.
 *   3. `bulk-untracked` — many untracked files. Needed because
 *                         `resources/cline-main` is a plain *directory copy* with
 *                         NO `.git`, so a nested-git test alone would have missed
 *                         the original incident entirely.
 *
 * The candidate set is the UNION of tracked and untracked roots, not the untracked
 * listing alone. Deriving candidates from untracked files only is a real defect and
 * was caught in review: a foreign root whose files all happen to be tracked (or
 * which currently has none untracked) never enters consideration and is therefore
 * invisible to every signal. A root only becomes interesting when it is a clone or
 * carries bulk, and both must be decidable for a root with an empty untracked set.
 *
 * The threshold is bracketed by measurement, not taste: the largest untracked
 * run in a legitimate root is 12 files (`scripts/`), while the vendored tree is
 * 4,150. 250 sits ~20x above the legitimate maximum and ~16x below that sample.
 *
 * HONEST LIMITATION: 4,150 is one observation, not a floor for all vendored trees.
 * Signal 3 therefore catches LARGE trees only — a small third-party snapshot of
 * fewer than 250 files with no `.git` and some tracked file is not detected. That
 * residual is deliberate: a structural alternative (flagging roots that carry their
 * own `package.json`) was rejected because legitimate roots such as `cli/` do too,
 * so it would false-positive on the monorepo itself.
 *
 * Every legitimate root has tracked content by construction, and an ignored root
 * (`resources/`, `node_modules/`) is excluded by construction, so the check needs
 * no hardcoded list of project roots and stays self-maintaining.
 *
 * Exit 0 clean / 1 with findings, so it can serve as a `probe` gate (the
 * `audit-gate-env-parity.ts` pattern).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Untracked files in one top-level root above which the root is treated as a
 * vendored payload rather than work in progress. See the measurement table in
 * the module header: legitimate max 12, vendored min 4,150.
 */
const BULK_UNTRACKED_THRESHOLD = 250

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

/** Top-level directory names that contain at least one tracked file. */
function trackedRoots(cwd: string): Set<string> {
  const roots = new Set<string>()
  for (const line of git(cwd, 'ls-files').split('\n')) {
    const [first] = line.split('/')
    if (first) roots.add(first)
  }
  return roots
}

/** Per-root count of files git reports as untracked AND not ignored. */
function untrackedCounts(cwd: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const line of git(
    cwd,
    'ls-files',
    '--others',
    '--exclude-standard',
  ).split('\n')) {
    const [first] = line.split('/')
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return counts
}

/** Whether `root` holds a `.git` entry — the marker of an actual clone. */
function hasNestedGit(cwd: string, root: string): boolean {
  return fs.existsSync(path.join(cwd, root, '.git'))
}

/**
 * Roots declared as submodules in `.gitmodules` — the one legitimate cause of a
 * nested `.git` entry. A declared submodule is committed deliberately, so it is
 * exempt from signal 2.
 */
function submoduleRoots(cwd: string): Set<string> {
  const file = path.join(cwd, '.gitmodules')
  if (!fs.existsSync(file)) return new Set()
  const roots = new Set<string>()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*path\s*=\s*(.+?)\s*$/.exec(line)
    const first = match?.[1]?.split('/')[0]
    if (first) roots.add(first)
  }
  return roots
}

/** One top-level root, reduced to the three signals the rule reads. */
export type ForeignRootInput = {
  /** Top-level directory name. */
  root: string
  /** Untracked, non-ignored file count within the root. */
  untracked: number
  /** Whether the root contains a `.git` entry. */
  nestedGit: boolean
}

export type ForeignRootReason = 'untracked' | 'nested-git' | 'bulk-untracked'

export type ForeignRootFinding = { root: string; reason: ForeignRootReason }

/**
 * The rule, kept pure so it is testable without a git repository: a root is
 * foreign when nothing in it is tracked, when it is a clone, or when it carries
 * a bulk of untracked files. Any one signal is sufficient.
 */
export function collectForeignRoots(
  roots: readonly ForeignRootInput[],
  tracked: ReadonlySet<string>,
  threshold = BULK_UNTRACKED_THRESHOLD,
): ForeignRootFinding[] {
  const findings: ForeignRootFinding[] = []
  for (const { root, untracked, nestedGit } of [...roots].sort((a, b) =>
    a.root.localeCompare(b.root),
  )) {
    // Signal 1 is about the ROOT, not its untracked file count: `untrackedCounts`
    // only ever contains roots with at least one untracked file, so testing
    // `untracked === 0` here would be dead code. The question is whether ANY
    // file in the root is tracked.
    if (!tracked.has(root)) {
      findings.push({ root, reason: 'untracked' })
    } else if (nestedGit) {
      findings.push({ root, reason: 'nested-git' })
    } else if (untracked >= threshold) {
      findings.push({ root, reason: 'bulk-untracked' })
    }
  }
  return findings
}

const REASON_TEXT: Record<ForeignRootReason, string> = {
  untracked:
    'it has no tracked files at all, so it is a foreign tree rather than project work',
  'nested-git':
    'it contains a `.git` entry, so it is a cloned third-party repository',
  'bulk-untracked': `it carries ${BULK_UNTRACKED_THRESHOLD}+ untracked files, the shape of a vendored snapshot rather than work in progress`,
}

export type VendoredTreeIssue = { code: string; message: string }

export function auditVendoredTrees(cwd = process.cwd()): VendoredTreeIssue[] {
  let tracked: Set<string>
  let counts: Map<string, number>
  try {
    tracked = trackedRoots(cwd)
    counts = untrackedCounts(cwd)
  } catch (error) {
    // Law 14: a git failure must surface as a gate verdict, not a stack trace.
    return [
      {
        code: 'vendored.tree.scan-failed',
        message:
          `could not read the git index in \`${cwd}\`, so no top-level tree could ` +
          `be audited: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]
  }
  const submodules = submoduleRoots(cwd)
  // Candidates are the UNION of tracked and untracked roots. Deriving them from
  // the untracked listing alone made a root with no untracked files invisible to
  // every signal, which review caught as a real blind spot.
  const candidates = new Set<string>([...tracked, ...counts.keys()])
  const roots: ForeignRootInput[] = [...candidates]
    .filter((root) => !submodules.has(root))
    .map((root) => ({
      root,
      untracked: counts.get(root) ?? 0,
      nestedGit: hasNestedGit(cwd, root),
    }))
  return collectForeignRoots(roots, tracked).map(({ root, reason }) => ({
    code: 'vendored.tree.foreign-root',
    message:
      `top-level directory \`${root}/\` is not a project root: ${REASON_TEXT[reason]}. ` +
      'It is not gitignored, so `git add --all` in the release automation would ' +
      'stage it whole. A vendored third-party tree belongs under `resources/` ' +
      '(ignored) or gets its own ignore entry; a real new root should be committed ' +
      'deliberately.',
  }))
}

if (import.meta.main) {
  const issues = auditVendoredTrees()
  for (const issue of issues) console.log(`- [${issue.code}] ${issue.message}`)
  console.log(
    issues.length === 0
      ? 'vendored-tree: PASS (no foreign top-level trees)'
      : `vendored-tree: FAIL (${issues.length} issue(s))`,
  )
  process.exitCode = issues.length === 0 ? 0 : 1
}
