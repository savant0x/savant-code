/**
 * @module audit-module-state
 *
 * FID-2026-1007-002 — module-scope state is shared by every test file.
 *
 * `bun test` loads every file of a workspace into ONE process, so a
 * module-scope `Map`/`Set`/array/`let` that accumulates is process-lifetime
 * state every suite inherits. The agent-runtime suite was red with 76 failures
 * because one breaker registry kept an OPEN circuit for a key the shared
 * fixtures reuse across unrelated files (FID-2026-1007-001). The registry above
 * that fix is legitimate production design; what was missing was a way to
 * return it to its start state at the test boundary, so a suite's verdict
 * depended on which files ran first.
 *
 * Three decidable legs, in `./module-state-scan.ts` and
 * `./module-state-wiring.ts` (split for the 300-line ceiling):
 *
 *   1. **Reset coverage** — every module-scope MUTATED binding must have a
 *      same-file `reset*`/`clear*` seam, or an entry in
 *      `./module-state-exemptions.ts` whose reason is a documented behaviour a
 *      reset would break. Exemptions are self-verifying, so they cannot rot.
 *   2. **Wiring** — every reset a test preload imports must still exist and be
 *      called; a renamed reset would otherwise leave the suite unisolated while
 *      the import sits there looking correct.
 *   3. **Reach** — bindings whose reset exists but whose module NO preload
 *      loads are reported by name and count. That is the honest boundary of the
 *      isolation claim: a reset that no test process ever calls changes nothing.
 *
 * Boundaries, stated because they are real: the scan reads author-written
 * modules only (test helpers, vendored/generated trees and workspace program
 * tooling are skipped); a binding mutated only inside a program entrypoint is
 * not state a test can inherit; and a cache typed as something other than a
 * `Map`/`Set`/array/object literal (an LRU wrapper, a class instance) is not
 * matched — the scan enumerates the shapes it can prove, and `Reach` reports
 * what the preloads cover, never what they might.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  MODULE_STATE_EXEMPTIONS,
  UNWIRED_MODULE_REASONS,
} from './module-state-exemptions.js'
import { scanModuleState } from './module-state-scan.js'
import { wiredModules, wiringIssues } from './module-state-wiring.js'
import { maskNonCode } from './test-budget-scan.js'

import type { CuredBinding, ModuleStateFinding } from './module-state-scan.js'

export type ModuleStateReport = {
  findings: ModuleStateFinding[]
  /** Cured bindings whose module no preload loads — the isolation boundary. */
  unwired: CuredBinding[]
  /** Unreached modules with a recorded reason for not being reached. */
  unwiredReasons: Map<string, string>
  wired: number
  /** Preload imports that name a reset which is missing or never called. */
  wiringIssues: string[]
  constants: number
  entrypoints: number
  scanned: number
}

function exemptionIssues(root: string): string[] {
  const issues: string[] = []
  for (const exemption of MODULE_STATE_EXEMPTIONS) {
    const absolute = path.join(root, exemption.file)
    if (!fs.existsSync(absolute)) {
      issues.push(
        `exemption ${exemption.file} → ${exemption.name} names a file that does not exist — the exemption is stale.`,
      )
      continue
    }
    const source = maskNonCode(fs.readFileSync(absolute, 'utf8'))
    if (!new RegExp(`(?<![\\w$.])${exemption.name}(?![\\w$])`).test(source)) {
      issues.push(
        `exemption ${exemption.file} → ${exemption.name} names a binding that file no longer declares — the exemption is stale.`,
      )
    }
  }
  return issues
}

/** Every module-scope mutable binding, its coverage, and the wiring state. */
export function collectModuleStateAudit(root: string): ModuleStateReport {
  const scan = scanModuleState(root)
  const exempt = new Set(
    MODULE_STATE_EXEMPTIONS.map((entry) => `${entry.file}\u0000${entry.name}`),
  )
  const findings = scan.findings.filter(
    (finding) => !exempt.has(`${finding.file}\u0000${finding.name}`),
  )
  const wired = wiredModules(root)
  const unwired = scan.cured.filter((binding) => !wired.has(binding.file))
  const unwiredReasons = new Map(
    UNWIRED_MODULE_REASONS.map((entry) => [entry.file, entry.reason]),
  )
  // Every unreached module needs a recorded reason, and every recorded reason
  // needs a module that is still real: otherwise the remainder can grow, or the
  // record can describe code that no longer exists.
  const unreachedFiles = [...new Set(unwired.map((binding) => binding.file))]
  const unreasonedFiles = unreachedFiles.filter(
    (file) => !unwiredReasons.has(file),
  )
  const staleReasons = UNWIRED_MODULE_REASONS.filter(
    (entry) => !unreachedFiles.includes(entry.file),
  ).map(
    (entry) =>
      `unwired reason ${entry.file}: the module IS reached by a preload now — the recorded reason is stale.`,
  )
  return {
    findings,
    unwired,
    unwiredReasons,
    wired: scan.cured.length - unwired.length,
    wiringIssues: [
      ...wiringIssues(root),
      ...exemptionIssues(root),
      ...unreasonedFiles.map(
        (file) =>
          `reach: ${file} owns resettable state no preload loads and has no recorded reason — wire its reset or record why it must not be loaded.`,
      ),
      ...staleReasons,
    ],
    constants: scan.constants,
    entrypoints: scan.entrypoints,
    scanned: scan.scanned,
  }
}

export function formatModuleStateReport(report: ModuleStateReport): string {
  const lines: string[] = []
  const problems = report.findings.length + report.wiringIssues.length
  lines.push(
    problems === 0
      ? `module-state: PASS (${String(report.scanned)} production files scanned; ` +
          `${String(report.constants)} read-only constants; ` +
          `${String(report.entrypoints)} program entrypoints skipped; ` +
          `${String(report.wired)} of ` +
          `${String(report.wired + report.unwired.length)} ` +
          'resettable bindings wired into a test preload)'
      : `module-state: FAIL (${String(report.findings.length)} uncured binding(s), ` +
          `${String(report.wiringIssues.length)} wiring issue(s))`,
  )
  for (const issue of report.wiringIssues) lines.push(`  ${issue}`)
  for (const finding of report.findings) {
    lines.push(
      `  ${finding.file}:${String(finding.line)} — ${finding.name} ` +
        `(${finding.stateClass}) has no reset in this file`,
    )
  }
  if (report.unwired.length > 0) {
    lines.push(
      `  reach: ${String(report.unwired.length)} resettable binding(s) sit in ` +
        'modules no preload loads (state a test process never inherits):',
    )
    for (const file of [...new Set(report.unwired.map((b) => b.file))]) {
      const names = report.unwired
        .filter((binding) => binding.file === file)
        .map((binding) => binding.name)
        .join(', ')
      const reason = report.unwiredReasons.get(file)
      lines.push(
        `    ${file} — ${names}${reason ? ` (by design: ${reason})` : ''}`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}

/** Print the report and return the exit code (0 clean, 1 with findings). */
export function reportModuleState(root: string): number {
  const report = collectModuleStateAudit(root)
  process.stdout.write(formatModuleStateReport(report))
  return report.findings.length + report.wiringIssues.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exitCode = reportModuleState(process.cwd())
}
