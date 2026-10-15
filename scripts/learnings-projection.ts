import fs from 'node:fs'
import path from 'node:path'

import {
  BOOT_LEARNINGS_MAX_CHARACTERS,
  BOOT_LEARNINGS_PATH,
} from '@savant-code/common/constants/learnings-boot'

import { wrapLearningMarkdown } from './learnings-markdown.js'
import { readCanonicalRuleCatalog } from './learnings-rules.js'
import { validateEmbeddedLearningSource } from './learnings-validation.js'

import type { LearningIssue } from './learnings-types.js'

export const EMBEDDED_LEARNINGS_PATH = BOOT_LEARNINGS_PATH
export const PROJECTION_REGENERATION_COMMAND =
  'bun scripts/learnings-projection-check.ts --write'

export type EmbeddedLearningProjectionWriteResult = {
  content: string
  issues: LearningIssue[]
  wrote: boolean
}

export function renderEmbeddedLearningProjection(root: string): {
  content: string
  issues: LearningIssue[]
} {
  const catalog = readCanonicalRuleCatalog(root)
  const issues = [...catalog.issues]
  const bootRules = catalog.rules.filter((rule) => rule.tier === 'boot')
  if (bootRules.length === 0) {
    issues.push({
      code: 'learning.projection.empty',
      message: 'The boot tier must contain at least one canonical rule.',
    })
  }
  const lines = [
    '# Embedded Learning Guidance',
    '',
    'This file is generated from the boot-tier rules in',
    '`dev/LEARNING-RULES.md`. It is the public runtime-facing projection of',
    'durable engineering rules, not a hand-edited incident archive.',
    '',
  ]
  for (const rule of bootRules) {
    lines.push(
      `## Rule: ${rule.name}`,
      '',
      `- **Tier:** ${rule.tier}`,
      `- **Tier reason:** ${rule.tierReason}`,
      `- **Authority:** ${rule.authority}`,
      `- **Validation:** ${rule.validation}`,
      ...(rule.invariant ? [`- **Invariant:** ${rule.invariant}`] : []),
      ...(rule.guard ? [`- **Guard:** ${rule.guard}`] : []),
      '- **Scope:** embedded',
      '',
    )
    if (rule.failureClasses.length > 0) {
      lines.splice(
        lines.length - 2,
        0,
        `- **Failure classes:** ${rule.failureClasses.join(', ')}`,
      )
    }
  }
  const content = wrapLearningMarkdown(lines)
  if (content.length > BOOT_LEARNINGS_MAX_CHARACTERS)
    issues.push({
      code: 'learning.boot.budget',
      message: `Boot digest has ${content.length}/${BOOT_LEARNINGS_MAX_CHARACTERS} JavaScript characters; reduce the reviewed boot selection and regenerate with ${PROJECTION_REGENERATION_COMMAND}.`,
    })
  issues.push(
    ...validateEmbeddedLearningSource(EMBEDDED_LEARNINGS_PATH, content),
  )
  return { content, issues }
}

export function collectEmbeddedProjectionIssues(root: string): LearningIssue[] {
  const projection = renderEmbeddedLearningProjection(root)
  const destination = path.join(root, EMBEDDED_LEARNINGS_PATH)
  if (!fs.existsSync(destination)) {
    return [
      ...projection.issues,
      {
        code: 'learning.projection.missing',
        message: `${EMBEDDED_LEARNINGS_PATH} is missing.`,
      },
    ]
  }
  try {
    const actual = fs.readFileSync(destination, 'utf8')
    return actual === projection.content
      ? projection.issues
      : [
          ...projection.issues,
          {
            code: 'learning.projection.drift',
            message: `${EMBEDDED_LEARNINGS_PATH} is stale; regenerate with ${PROJECTION_REGENERATION_COMMAND}.`,
          },
        ]
  } catch {
    return [
      ...projection.issues,
      {
        code: 'learning.projection.read',
        message: `Unable to read ${EMBEDDED_LEARNINGS_PATH}.`,
      },
    ]
  }
}

export function writeEmbeddedLearningProjection(
  root: string,
): EmbeddedLearningProjectionWriteResult {
  const projection = renderEmbeddedLearningProjection(root)
  if (projection.issues.length > 0) return { ...projection, wrote: false }

  const destination = path.join(root, EMBEDDED_LEARNINGS_PATH)
  try {
    if (fs.existsSync(destination)) {
      const actual = fs.readFileSync(destination, 'utf8')
      if (actual === projection.content) return { ...projection, wrote: false }
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true })
    }
    fs.writeFileSync(destination, projection.content, 'utf8')
    return { ...projection, wrote: true }
  } catch {
    return {
      ...projection,
      issues: [
        ...projection.issues,
        {
          code: 'learning.projection.write',
          message: `Unable to write ${EMBEDDED_LEARNINGS_PATH}.`,
        },
      ],
      wrote: false,
    }
  }
}
