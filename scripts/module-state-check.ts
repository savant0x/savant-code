/**
 * `./audit-module-state.ts` as an independently runnable probe, so a record
 * whose subject is this audit can declare the check — `validate:repository`
 * can never be a `fid:verify` gate (C3 recursion), and the T154 lesson is that
 * a check with no probe cannot be recorded at all.
 *
 * Exit 0 clean / 1 with findings. Never extend this to run
 * `validate:repository`. Same shape as `scripts/test-budget-injection-check.ts`.
 */
import { reportModuleState } from './audit-module-state.js'

process.exitCode = reportModuleState(process.cwd())
