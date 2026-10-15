import fs from 'node:fs'
import path from 'node:path'

import {
  FEATURE_REPORT,
  FEATURE_STORE,
  renderFeatureReport,
  reviewFeaturePipeline,
} from './lesson-feature-pipeline'
import { featureEvidencePath } from './lesson-feature-schema'

/** One read-only check shared by the independent probe and repository gate. */
export function collectFeaturePipelineIssues(
  root: string,
): Array<{ code: string; message: string }> {
  if (!fs.existsSync(path.join(root, FEATURE_STORE)))
    return [
      {
        code: 'learning.features.store-missing',
        message: 'Feature candidate store is missing.',
      },
    ]
  const review = reviewFeaturePipeline(root)
  const issues = review.issues.map((message) => ({
    code: 'learning.features.admission',
    message,
  }))
  try {
    const report = fs.readFileSync(
      featureEvidencePath(root, FEATURE_REPORT),
      'utf8',
    )
    if (report !== renderFeatureReport(review))
      issues.push({
        code: 'learning.features.report-drift',
        message:
          'Feature report is stale; run bun run lessons:features --write.',
      })
  } catch {
    issues.push({
      code: 'learning.features.report-missing',
      message: 'Feature report is missing, unreadable or unsafe.',
    })
  }
  return issues
}

if (import.meta.main) {
  const issues = collectFeaturePipelineIssues(
    path.resolve(import.meta.dir, '..'),
  )
  console.log(
    `lesson feature gate: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} issues)`,
  )
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`)
  process.exitCode = issues.length ? 1 : 0
}
