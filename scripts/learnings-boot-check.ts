import fs from 'node:fs'
import path from 'node:path'

import { BOOT_LEARNINGS_MAX_CHARACTERS } from '@savant-code/common/constants/learnings-boot'

import {
  collectEmbeddedProjectionIssues,
  EMBEDDED_LEARNINGS_PATH,
} from './learnings-projection'

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const issues = collectEmbeddedProjectionIssues(root)
  const file = path.join(root, EMBEDDED_LEARNINGS_PATH)
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (content.length > BOOT_LEARNINGS_MAX_CHARACTERS)
    issues.push({
      code: 'learning.boot.budget',
      message: 'Stored boot digest exceeds the budget.',
    })
  console.log(
    `boot digest: ${issues.length ? 'FAIL' : 'PASS'} (${content.length}/${BOOT_LEARNINGS_MAX_CHARACTERS} JavaScript characters, ${Buffer.byteLength(content, 'utf8')} UTF-8 bytes; ${BOOT_LEARNINGS_MAX_CHARACTERS - content.length} characters headroom)`,
  )
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`)
  process.exitCode = issues.length ? 1 : 0
}
