#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

export type HygieneIssue = {
  code: 'stale-reference' | 'production-placeholder' | 'scratchpad-clutter'
  file: string
  message: string
}

const root = path.resolve(import.meta.dir, '..')
const sourceRoots = [
  'agents',
  'common/src',
  'packages/agent-runtime/src',
  'sdk/src',
  'cli/src',
]
const currentDocs = ['README.md', 'ECHO-single-agent.md', 'AGENTS.md']
const stalePatterns = [
  'FREEREADME.md',
  'ECHO-freebuff.md',
  'freebuff.protocol',
  'dev/nova/specs/echo-v0.1.2-single-agent.md',
]
const actionablePatterns = [
  /\b(TODO|FIXME|HACK|XXX)\b/,
  /\bnot implemented\b/i,
] as const
/**
 * Exact, provenance-scoped exceptions for protocol vocabulary and generated
 * tool documentation. A filename alone is intentionally not an exemption.
 */
const intentionalLinePatterns = new Map<string, readonly RegExp[]>([
  [
    'agents/types/tools.ts',
    [
      /write_todos/,
      /Write a todo list to track/,
      /List of todos with their completion/,
    ],
  ],
  ['agents/verifier/verifier.ts', [/No TODOs without FID references/]],
  [
    'common/src/templates/initial-agents-dir/types/tools.ts',
    [
      /write_todos/,
      /Write a todo list to track/,
      /List of todos with their completion/,
    ],
  ],
  ['common/src/tools/params/tool/code-search.ts', [/pattern: ['"]TODO['"]/]],
  [
    'common/src/tools/params/tool/write-todos.ts',
    [
      /write_todos/,
      /List of todos with their completion status\. Add ALL/,
      /Write a todo list to track tasks for multi-step implementations\./,
      /After completing each todo step, call this tool again/,
      /Use this tool frequently as you work through tasks/,
    ],
  ],
  [
    'cli/src/components/tools/write-todos.tsx',
    [
      /^\s*TODOs\s*$/,
      /^\s*\{\s*\/\*\s*Todo items\s*\*\/\s*\}\s*$/,
      /key=\{`todo-\$\{index\}`\}/,
    ],
  ],
  [
    'common/src/tools/safety-registry.ts',
    [
      /write_todos/,
      /Write a todo list to track/,
      /List of todos with their completion/,
    ],
  ],
  [
    'common/src/providers/validate.ts',
    [/deliberately NOT implemented/, /\{ENV_VAR\}/, /replace placeholders/],
  ],
  [
    'common/src/testing/fixtures/agent-runtime.ts',
    [/not implemented in test runtime/],
  ],
  [
    'packages/agent-runtime/src/echo/fid-validator.ts',
    [/placeholder text/, /PLACEHOLDER_PATTERN/, /Contains placeholder text/],
  ],
  [
    'packages/agent-runtime/src/echo/post-write-scanners.ts',
    [/TODOs, or placeholders/, /TODO\|FIXME/],
  ],
  [
    'packages/agent-runtime/src/templates/strings.ts',
    [/PLACEHOLDER/, /placeholderValues/, /toInject/],
  ],
  ['sdk/src/run/tool-call.ts', [/Tool not implemented in SDK/]],
])
const excludedPath =
  /(^|[\\/])(__tests__|node_modules|generated)([\\/]|$)|\.test\.ts$|\.spec\.ts$|\.generated\.(ts|tsx)$/

function sourceFiles(scanRoot: string): string[] {
  const files: string[] = []
  const visit = (directory: string): void => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (
        /\.(ts|tsx|md)$/.test(entry.name) &&
        !excludedPath.test(fullPath)
      ) {
        files.push(fullPath)
      }
    }
  }
  for (const sourceRoot of sourceRoots) visit(path.join(scanRoot, sourceRoot))
  return files.sort()
}

function isIntentionalLine(relative: string, line: string): boolean {
  return (intentionalLinePatterns.get(relative) ?? []).some((pattern) =>
    pattern.test(line),
  )
}

/**
 * P36 (FID-2026-0901-006, operator: "looking in this folder it looks like
 * absolute madness - is this not auto-managed?"): the scratchpad is a
 * convention-managed area — its root must stay at README + active/ +
 * archive/ (+ .gitkeep for git). Loose probes, specs, screenshots, and
 * ad-hoc folders at the root are how it decayed into 35+ orphans across
 * sessions. Enforced mechanically here: every foreign root entry is a
 * `scratchpad-clutter` issue. Sessions must drop live artifacts in /tmp (or
 * a purpose folder under archive/) — never at the root. Hygiene never
 * deletes; the operator decides retention.
 */
const SCRATCHPAD_ROOT_ENTRIES = new Set([
  'README.md',
  'active',
  'archive',
  '.gitkeep',
])

export function collectScratchpadIssues(
  scanRoot: string = root,
): HygieneIssue[] {
  const scratchpad = path.join(scanRoot, 'dev', 'scratchpad')
  const issues: HygieneIssue[] = []
  if (!fs.existsSync(scratchpad)) return issues
  for (const entry of fs.readdirSync(scratchpad)) {
    if (SCRATCHPAD_ROOT_ENTRIES.has(entry)) continue
    issues.push({
      code: 'scratchpad-clutter',
      file: `dev/scratchpad/${entry}`,
      message:
        'Scratchpad root must stay README + active/ + archive/ — move this under archive/ (or active/ for reusable validation tooling). Live probes belong in /tmp.',
    })
  }
  return issues
}

export function collectHygieneIssues(scanRoot: string = root): HygieneIssue[] {
  const issues: HygieneIssue[] = []
  const scanFiles = [
    ...sourceFiles(scanRoot),
    ...currentDocs.map((relative) => path.join(scanRoot, relative)),
  ].filter((filePath) => fs.existsSync(filePath))

  for (const filePath of scanFiles) {
    const relative = path.relative(scanRoot, filePath).replaceAll(path.sep, '/')
    const content = fs.readFileSync(filePath, 'utf8')
    for (const stalePattern of stalePatterns) {
      if (content.includes(stalePattern)) {
        issues.push({
          code: 'stale-reference',
          file: relative,
          message: `Current governed content contains stale reference ${stalePattern}.`,
        })
      }
    }
    const offendingLine = content
      .split(/\r?\n/)
      .find(
        (line) =>
          actionablePatterns.some((pattern) => pattern.test(line)) &&
          !isIntentionalLine(relative, line),
      )
    if (offendingLine !== undefined) {
      const match = actionablePatterns
        .map((pattern) => offendingLine.match(pattern))
        .find((result) => result !== null)
      issues.push({
        code: 'production-placeholder',
        file: relative,
        message: `Current production content contains unresolved placeholder-like token ${match?.[0] ?? 'marker'}.`,
      })
    }
  }
  return [...issues, ...collectScratchpadIssues(scanRoot)]
}

if (import.meta.main) {
  const issues = collectHygieneIssues()
  if (issues.length === 0) {
    console.log(
      'hygiene: PASS (current references and production placeholders)',
    )
  } else {
    console.error(`hygiene: FAIL (${issues.length} issue(s))`)
    for (const issue of issues)
      console.error(`- [${issue.code}] ${issue.file}: ${issue.message}`)
    process.exitCode = 1
  }
}
