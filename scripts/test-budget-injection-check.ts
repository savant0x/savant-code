/**
 * `./audit-test-budget-injection.ts` as an independently runnable probe, so a
 * record whose subject is this guard can declare the check — `validate:repository`
 * can never be a `fid:verify` gate (C3 recursion), and the T154 lesson is that a
 * check with no probe cannot be recorded at all.
 *
 * Exit 0 clean / 1 with findings. Never extend this to run `validate:repository`.
 * Same shape as `scripts/lint-md-check.ts`.
 */
import { reportTestBudgetIssues } from './audit-test-budget-injection.js'

process.exitCode = reportTestBudgetIssues(process.cwd())
