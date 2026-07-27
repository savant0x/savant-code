import { writeFile } from 'node:fs/promises'
import type { HarnessResult, TaskResult } from './harness'

/**
 * Write the raw harness result as JSON.
 */
export async function writeJsonReport(
  result: HarnessResult,
  filePath: string,
): Promise<void> {
  const json = JSON.stringify(result, null, 2)
  await writeFile(filePath, json, 'utf-8')
}

/**
 * Write a human-readable Markdown summary of the harness run.
 */
export async function writeMarkdownReport(
  result: HarnessResult,
  filePath: string,
): Promise<void> {
  const lines: string[] = []

  lines.push('# Savant-Code Benchmark v2 Results')
  lines.push('')
  lines.push(`**Total:** ${result.total}`)
  lines.push(`**Passed:** ${result.passed}`)
  lines.push(`**Failed:** ${result.failed}`)
  lines.push(`**Errors:** ${result.errors}`)
  lines.push(`**Timeouts:** ${result.timeouts}`)
  lines.push(`**Duration:** ${(result.duration_ms / 1000).toFixed(2)}s`)
  lines.push('')

  lines.push(
    '| Task ID | Category | Difficulty | Status | Verification | Metrics | Duration | Cost |',
  )
  lines.push(
    '|---------|----------|------------|--------|--------------|---------|----------|------|',
  )

  for (const r of result.results) {
    const verification = r.verification?.status ?? '-'
    const metrics = r.metrics ? (r.metrics.passed ? 'Yes' : 'No') : '-'
    const duration = r.trace?.metadata.duration_ms
      ? `${(r.trace.metadata.duration_ms / 1000).toFixed(1)}s`
      : '-'
    const cost =
      r.trace?.metadata.cost_usd !== undefined
        ? `$${r.trace.metadata.cost_usd.toFixed(4)}`
        : '-'

    lines.push(
      `| ${r.task_id} | ${r.task.category} | ${r.task.difficulty} | ${r.status} | ${verification} | ${metrics} | ${duration} | ${cost} |`,
    )
  }

  lines.push('')

  const failures = result.results.filter(
    (r) => r.status !== 'PASS',
  )
  if (failures.length > 0) {
    lines.push('## Failures')
    lines.push('')
    for (const r of failures) {
      lines.push(`### ${r.task_id}`)
      lines.push(`- **Status:** ${r.status}`)
      if (r.error) lines.push(`- **Error:** ${r.error}`)
      if (r.verification) {
        lines.push(`- **Verification:** ${r.verification.status}`)
      }
      if (r.metrics && !r.metrics.passed) {
        lines.push(`- **Metrics passed:** ${r.metrics.passed}`)
        if (r.metrics.fsm.invalid_transitions > 0) {
          lines.push(
            `  - Invalid FSM transitions: ${r.metrics.fsm.invalid_transitions}`,
          )
        }
        if (r.metrics.fsm.write_in_red_violations > 0) {
          lines.push(
            `  - Write outside allowed phase: ${r.metrics.fsm.write_in_red_violations}`,
          )
        }
        if (!r.metrics.subagent.utilization_passed) {
          lines.push(`  - Subagent utilization failed`)
        }
      }
      lines.push('')
    }
  }

  await writeFile(filePath, lines.join('\n'), 'utf-8')
}
