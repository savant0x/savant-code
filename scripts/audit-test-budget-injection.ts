/**
 * Test-time budget injection audit — generalizes the pin-hardening lesson from
 * FID-2026-1006-004 (see `./test-budget-registry.ts` for the doctrine, the
 * budgeted-function registry and `hasInjectedBudget`; `./test-budget-scan.ts`
 * for the text primitives; this module was split from both for the 300-line
 * ceiling).
 *
 * One question per helper call site: does it inject the budget, or does it
 * silently inherit the production default and race a wall clock?
 *
 * Scope, stated so the rule cannot be over-read:
 *   - a "test helper" is (a) a non-test module inside a test directory (the
 *     shared fixtures/harnesses), or (b) a top-level `function`/const-arrow
 *     declaration in a test file — the local wrappers;
 *   - a call INSIDE a test body (`it(...)`, `describe(...)`) is deliberately
 *     out of scope: a test may legitimately exercise the production default,
 *     and its author is looking at the call site. A helper may not — it
 *     multiplies one un-injected call across every test that uses it.
 *
 * The registry is self-verifying: each entry names its source file, and the
 * guard fails when the named parameter is no longer declared there, so renaming
 * or dropping a seam cannot leave this guard silently green.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  BUDGETED_FUNCTIONS,
  hasInjectedBudget,
} from './test-budget-registry.js'
import {
  FRAMEWORK_CALLS,
  callArgumentTexts,
  isHelperModule,
  maskNonCode,
  ownerLines,
  testSurfaceFiles,
} from './test-budget-scan.js'

export type BudgetInjectionIssue = { code: string; message: string }

export {
  BUDGETED_FUNCTIONS,
  hasInjectedBudget,
} from './test-budget-registry.js'
export {
  callArgumentTexts,
  isHelperModule,
  isTestFile,
  maskNonCode,
  testSurfaceFiles,
} from './test-budget-scan.js'

/** Each registry entry must still describe a real seam, or the guard lies. */
function registryIssues(root: string): BudgetInjectionIssue[] {
  const issues: BudgetInjectionIssue[] = []
  for (const entry of BUDGETED_FUNCTIONS) {
    let source: string
    try {
      source = fs.readFileSync(path.join(root, entry.source), 'utf8')
    } catch {
      issues.push({
        code: 'test-budget.registry-missing-source',
        message: `budget registry entry ${entry.name} names ${entry.source}, which does not exist — the entry is stale.`,
      })
      continue
    }
    if (!new RegExp(`\\b${entry.param}\\b`).test(source)) {
      issues.push({
        code: 'test-budget.registry-stale',
        message: `budget registry entry ${entry.name} declares parameter \`${entry.param}\`, which ${entry.source} no longer has — the registry is stale, so this guard no longer tests what it claims.`,
      })
    }
  }
  return issues
}

/** Offsets where each line of `masked` starts, for line attribution. */
function lineStarts(masked: string): number[] {
  const starts = [0]
  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] === '\n') starts.push(i + 1)
  }
  return starts
}

function lineOf(starts: number[], offset: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (starts[mid] <= offset) low = mid
    else high = mid - 1
  }
  return low
}

export function collectTestBudgetIssues(root: string): BudgetInjectionIssue[] {
  const issues = registryIssues(root)

  for (const relative of testSurfaceFiles(root)) {
    const masked = maskNonCode(
      fs.readFileSync(path.join(root, relative), 'utf8'),
    )
    const owners = ownerLines(masked)
    const starts = lineStarts(masked)
    const helperModule = isHelperModule(relative)

    for (const entry of BUDGETED_FUNCTIONS) {
      const pattern = new RegExp(`(?<![\\w$.])${entry.name}\\s*\\(`, 'g')
      for (const match of masked.matchAll(pattern)) {
        const line = lineOf(starts, match.index)
        const owner = owners[line] ?? ''
        // A test body may exercise the production default on purpose.
        if (!helperModule && (owner === '' || FRAMEWORK_CALLS.has(owner))) {
          continue
        }
        const [args] = callArgumentTexts(masked.slice(match.index), entry.name)
        if (args === undefined || hasInjectedBudget(args, entry.param)) continue
        const where =
          `test helper \`${owner}\`` + ` calls \`${entry.name}\` without`
        issues.push({
          code: 'test-budget.uninjected-helper-call',
          message:
            `${relative}:${line + 1}: ` +
            (helperModule ? 'test helper module' : where) +
            ` injecting \`${entry.param}\`, so every caller silently inherits the production default ${entry.defaultConstant} and races a wall clock (FID-2026-1006-004). Inject the budget — name the seam (\`${entry.param}: PIN_BUDGET_MS\`) as that record's pins do.`,
        })
      }
    }
  }

  return issues
}

/** Print the findings and return the exit code (0 clean, 1 with findings). */
export function reportTestBudgetIssues(root: string): number {
  const issues = collectTestBudgetIssues(root)
  for (const issue of issues) console.log(`- [${issue.code}] ${issue.message}`)
  console.log(
    issues.length === 0
      ? 'test-budget-injection: PASS (no helper silently inherits a production budget)'
      : `test-budget-injection: FAIL (${issues.length} issue(s))`,
  )
  return issues.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exitCode = reportTestBudgetIssues(process.cwd())
}
