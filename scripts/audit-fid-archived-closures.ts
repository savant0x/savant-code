/**
 * audit-fid-archived-closures — standalone probe for the archived-FID
 * closure guard (FID-2026-0928-013).
 *
 * The probe route (FID-2026-0915-004): makes the validate:repository check
 * independently runnable so a FID's Verification Gates can declare it —
 * exit 0 clean, exit 1 with issues. Never re-enters FID verification
 * (C3 self-recursion boundary, Lesson in FID-2026-0915-004).
 */
import path from 'node:path'

import { validateArchivedFidClosures } from './fid-gates'

const root = path.resolve(import.meta.dir, '..')
const issues = validateArchivedFidClosures(root)
if (issues.length > 0) {
  console.log(`archived-FID closure guard: FAIL (${issues.length} issue(s))`)
  for (const issue of issues) {
    console.log(`  - [${issue.code}] ${issue.message}`)
  }
  process.exit(1)
}
console.log(
  'archived-FID closure guard: PASS — every archived record created ' +
    'on/after 2026-09-15 reads closed, or carries the dated ' +
    'operator-decline marker (FID-2026-0928-013)',
)
