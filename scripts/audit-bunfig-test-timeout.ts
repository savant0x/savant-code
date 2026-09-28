/**
 * FID-2026-0927-002 step 2 — inert `[test] timeout` audit.
 *
 * `cli/bunfig.toml` is where a per-test budget belongs, so it is where the next
 * author will put one. Bun 1.3.14 does not read it. Proven by mutation:
 *
 *   cli/bunfig.toml  timeout = 1
 *   $ bun test src/__tests__/headless-control.test.ts
 *    6 pass / 0 fail      ← a 36 ms test sailed past a 1 ms budget
 *
 * The hazard is not the ignored key; it is the false belief it leaves behind. A
 * well-meaning `timeout = 30000` added there would appear to harden the suite and
 * change nothing, which is harder to notice than a missing timeout. The honoured
 * mechanism is the per-test third argument (`test(name, fn, 60_000)`), proven in
 * the other direction: the same 1 ms mutation on those constants yields 4/2 and
 * 3/10 failures.
 *
 * This replaces the hand-written comment that was the only guard, with a
 * mechanical one. Exit 0 clean / 1 with findings (`audit-gate-env-parity` pattern).
 */
import fs from 'node:fs'
import path from 'node:path'

export type BunfigTimeoutIssue = { code: string; message: string }

/**
 * A `timeout` key inside a `[test]` table. Scoped to the table so a `timeout`
 * elsewhere in the file (there is no other table today) is not misread.
 */
export function findInertTestTimeout(toml: string): boolean {
  const lines = toml.split(/\r?\n/)
  let inTestTable = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inTestTable = line === '[test]'
      continue
    }
    if (!inTestTable) continue
    // Strip a trailing comment before reading the key, so prose that merely
    // mentions `timeout` is not a finding.
    const code = line.split('#')[0]?.trim() ?? ''
    if (/^timeout\s*=/.test(code)) return true
  }
  return false
}

export function auditBunfigTestTimeout(root: string): BunfigTimeoutIssue[] {
  const bunfig = path.join(root, 'cli', 'bunfig.toml')
  let content: string
  try {
    content = fs.readFileSync(bunfig, 'utf8')
  } catch {
    return []
  }
  if (!findInertTestTimeout(content)) return []
  return [
    {
      code: 'bunfig.test-timeout.inert',
      message:
        'cli/bunfig.toml declares a `[test] timeout`, which bun 1.3.14 does not ' +
        'read for this suite (measured: `timeout = 1` left a 36 ms test passing). ' +
        'It will look like a per-test budget and change nothing. Pass the budget ' +
        'as the third argument to `test`/`it` instead — that is honoured.',
    },
  ]
}

if (import.meta.main) {
  const issues = auditBunfigTestTimeout(process.cwd())
  for (const issue of issues) console.log(`- [${issue.code}] ${issue.message}`)
  console.log(
    issues.length === 0
      ? 'bunfig-test-timeout: PASS (no inert [test] timeout declared)'
      : `bunfig-test-timeout: FAIL (${issues.length} issue(s))`,
  )
  process.exitCode = issues.length === 0 ? 0 : 1
}
