/**
 * FID-2026-0824-019 — SWE-rebench-style capability ingestion.
 *
 * Offline-first: an operator supplies a JSON export of closed issues
 * (time-windowed); this module converts curated items into v2 task YAML
 * drafts for registry review like any hand-written task. Ideas-not-ports:
 * original implementation; upstream licenses verified under A7
 * (SWE-rebench MIT/CC-BY-4.0) and recorded in NOTICE.
 *
 * Split contract: items WITH a `test_command` become registry-valid tasks;
 * items WITHOUT one land in `drafts` — their YAML intentionally fails
 * `taskDefinitionSchema` until an operator adds real deterministic checks.
 */

import { createHash } from 'node:crypto'

import { stringify as stringifyYaml } from 'yaml'

import type { TaskDefinition } from '../schema'

export interface ClosedIssueInput {
  /** Repository slug, e.g. "owner/name". */
  repo: string
  number: number
  title: string
  body: string
  /** ISO timestamp when the issue was closed. */
  closed_at: string
  labels?: readonly string[]
  /** Operator-supplied verification command; presence promotes to curated. */
  test_command?: string
}

export interface IngestWindow {
  /** ISO timestamps; both bounds inclusive. */
  start: string
  end: string
}

export interface IngestProvenance {
  source: string
  issue_number: number
  window_start: string
  window_end: string
  content_hash: string
}

/** Keyword→category rules; first match wins, security checked first. */
const CLASSIFIER_RULES: readonly {
  pattern: RegExp
  category:
    | 'security_remediation'
    | 'dependency_tracing'
    | 'cross_repo_navigation'
    | 'codebase_comprehension'
}[] = [
  {
    pattern: /\b(security|cve|xss|sql.?inject|auth.?bypass|sanitiz)/i,
    category: 'security_remediation',
  },
  {
    pattern:
      /\b(dependency|lockfile|transitive|package\.json|import.{0,20}cycle)/i,
    category: 'dependency_tracing',
  },
  {
    pattern:
      /\b(multi.?repo|cross.?repo|monorepo|another (file|module|package))/i,
    category: 'cross_repo_navigation',
  },
  {
    pattern: /\b(comprehension|explain|document|architecture|onboard)/i,
    category: 'codebase_comprehension',
  },
]

const FALLBACK_CATEGORY = 'pure_coding' as const

/** CodeScaleBench-inspired heuristic mapping; wrong labels misreport only. */
export function classifyIssue(issue: ClosedIssueInput): string {
  const haystack = `${issue.title}\n${issue.body}\n${(issue.labels ?? []).join(' ')}`
  for (const rule of CLASSIFIER_RULES) {
    if (rule.pattern.test(haystack)) return rule.category
  }
  return FALLBACK_CATEGORY
}

function slugifyRepo(repo: string): string {
  return repo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stable content identity: sha256 over repo#number + title + body. */
export function contentHash(issue: ClosedIssueInput): string {
  const canonical = `${issue.repo}#${issue.number}\n${issue.title}\n${issue.body}`
  return createHash('sha256').update(canonical).digest('hex')
}

export function withinWindow(closedAt: string, window: IngestWindow): boolean {
  const t = closedAt.slice(0, 10)
  return t >= window.start.slice(0, 10) && t <= window.end.slice(0, 10)
}

export function issueToTask(
  issue: ClosedIssueInput,
  window: IngestWindow,
): TaskDefinition & { yaml: string } {
  const category = classifyIssue(issue)
  const taskId = `ingested-${slugifyRepo(issue.repo)}-${issue.number}`
  const provenance: IngestProvenance = {
    source: issue.repo,
    issue_number: issue.number,
    window_start: window.start,
    window_end: window.end,
    content_hash: contentHash(issue),
  }
  const prompt = [
    `Resolve the following closed issue from ${issue.repo}#${issue.number}.`,
    '',
    issue.title,
    '',
    issue.body.trim(),
  ].join('\n')
  const definition = {
    schema_version: '2.0' as const,
    task_id: taskId,
    category,
    difficulty: 'hard' as const,
    description: `Ingested from ${issue.repo}#${issue.number} (closed ${issue.closed_at}).`,
    environment: { network_disabled: true },
    inputs: { prompt },
    validation: {
      timeout_seconds: 600,
      ...(issue.test_command !== undefined && issue.test_command.trim() !== ''
        ? {
            deterministic_checks: [
              {
                command: issue.test_command,
                expected_exit_code: 0,
                retry_count: 0,
                retry_condition: 'infra' as const,
              },
            ],
          }
        : {}),
    },
    ingest_provenance: provenance,
  } as TaskDefinition
  return { ...definition, yaml: stringifyYaml(definition) }
}

export interface IngestResult {
  /** Registry-valid tasks (had test commands). */
  curated: ReturnType<typeof issueToTask>[]
  /** Missing deterministic checks — operator must complete before use. */
  drafts: ReturnType<typeof issueToTask>[]
  /** Rejected inputs with reasons (window miss / allowlist). */
  skipped: { issue: ClosedIssueInput; reason: string }[]
}

export function ingestIssues(
  issues: readonly ClosedIssueInput[],
  opts: {
    window: IngestWindow
    /** Operator-curated repository slugs; empty allows all. */
    allowlist?: readonly string[]
  },
): IngestResult {
  const allowlist = opts.allowlist ?? []
  const result: IngestResult = { curated: [], drafts: [], skipped: [] }
  for (const issue of issues) {
    if (!withinWindow(issue.closed_at, opts.window)) {
      result.skipped.push({ issue, reason: 'outside ingestion window' })
      continue
    }
    if (allowlist.length > 0 && !allowlist.includes(issue.repo)) {
      result.skipped.push({
        issue,
        reason: `repo not allowlisted: ${issue.repo}`,
      })
      continue
    }
    const built = issueToTask(issue, opts.window)
    if (issue.test_command === undefined || issue.test_command.trim() === '') {
      result.drafts.push(built)
    } else {
      result.curated.push(built)
    }
  }
  return result
}
