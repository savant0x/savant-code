import fs from 'node:fs'
import path from 'node:path'

import {
  validateEmbeddedLearningSource,
  validateLearnings,
} from './learnings-core'
import {
  collectEmbeddedProjectionIssues,
  EMBEDDED_LEARNINGS_PATH,
} from './learnings-projection'

/** Shared ledger/public-projection check; callers decide how to surface warnings. */
export function validateLearningArtifacts(root: string, content?: string) {
  const result = validateLearnings(
    content ?? fs.readFileSync(path.join(root, 'dev/LEARNINGS.md'), 'utf8'),
    root,
  )
  const sourcePath = path.join(root, EMBEDDED_LEARNINGS_PATH)
  result.issues.push(
    ...(fs.existsSync(sourcePath)
      ? validateEmbeddedLearningSource(
          EMBEDDED_LEARNINGS_PATH,
          fs.readFileSync(sourcePath, 'utf8'),
        )
      : [
          {
            code: 'learning.embedded.missing',
            message: `${EMBEDDED_LEARNINGS_PATH} is missing.`,
          },
        ]),
  )
  result.issues.push(...collectEmbeddedProjectionIssues(root))
  return result
}
