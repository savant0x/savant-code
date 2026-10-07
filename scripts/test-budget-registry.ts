/**
 * The budgeted-function registry for `./audit-test-budget-injection.ts`,
 * which generalizes the pin-hardening lesson from FID-2026-1006-004 (Law 15
 * capture/reconcile budgets). Split from the scanner for the 300-line ceiling.
 *
 * FID-2026-1006-004's pins are deterministic because they INJECT the budget
 * (`budgetMs: 0`, `budgetMs: PIN_BUDGET_MS`) instead of inheriting the
 * production default. Its Loop 2 audit named why: a pin that exercises a
 * budgeted function without injecting the budget races a wall clock, so it is
 * flaky by construction — and the flake is invisible in a green run.
 *
 * The hazard is worse in a HELPER. A test body that omits the budget races the
 * clock once, where its author can see it; a helper that omits it silently
 * imposes that race on every test that ever calls the helper, with the missing
 * argument a file away from the failure.
 *
 * A "budgeted function" is a function whose time budget has a production
 * default, i.e. omitting the argument silently spends the production number.
 */

export type BudgetedFunction = {
  /** Function name as called from test code. */
  name: string
  /** The parameter that carries the injectable budget. */
  param: string
  /** Production default it silently inherits when the parameter is omitted. */
  defaultConstant: string
  /** Repo-relative path of the declaring module (self-verifying). */
  source: string
}

/**
 * Every function in the tree whose budget has a production default. Adding an
 * entry is the extension point; the guard verifies each `source` still declares
 * `param`, so a renamed or dropped seam cannot leave the guard silently green.
 *
 * Deliberately absent: `maybeCaptureWorktreeBaseline`, which forwards to
 * `captureWorktreeBaseline` and exposes no budget parameter of its own — a
 * caller cannot inject what the signature does not accept, so registering it
 * would produce an unfixable finding. The remedy there is the owner threading
 * the budget through, not the call site.
 */
export const BUDGETED_FUNCTIONS: readonly BudgetedFunction[] = [
  {
    name: 'captureWorktreeBaseline',
    param: 'budgetMs',
    defaultConstant: 'CAPTURE_BUDGET_MS',
    source: 'packages/agent-runtime/src/echo/enforcement/worktree-capture.ts',
  },
  {
    name: 'reconcileWorktree',
    param: 'budgetMs',
    defaultConstant: 'RECONCILE_BUDGET_MS',
    source: 'packages/agent-runtime/src/echo/enforcement/worktree-reconcile.ts',
  },
  {
    name: 'runGitFileList',
    param: 'budgetMs',
    defaultConstant: 'CAPTURE_BUDGET_MS',
    source: 'packages/agent-runtime/src/echo/enforcement/worktree-git.ts',
  },
  {
    name: 'runGitStatusList',
    param: 'budgetMs',
    defaultConstant: 'RECONCILE_BUDGET_MS',
    source: 'packages/agent-runtime/src/echo/enforcement/worktree-git.ts',
  },
  {
    name: 'childProcessToPromise',
    param: 'timeoutMs',
    defaultConstant: 'CHILD_PROCESS_TIMEOUT_MS',
    source: 'sdk/src/run-state/child-process.ts',
  },
]

/** A call names its budget, or names an uppercase BUDGET/TIMEOUT constant. */
const NAMED_CONSTANT = /\b[A-Z][A-Z0-9_]*(?:BUDGET|TIMEOUT)[A-Z0-9_]*\b/

export function hasInjectedBudget(argText: string, param: string): boolean {
  return (
    new RegExp(`\\b${param}\\b`).test(argText) || NAMED_CONSTANT.test(argText)
  )
}
