import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { PRIMARY_KNOWLEDGE_FILE_NAME } from '@savant-code/common/constants/knowledge'

import { COMMON_TYPE_FILES } from './init-type-files'
import { getProjectRoot } from '../project-files'
import { trackEvent } from '../utils/analytics'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'

import type { PostUserMessageFn } from '../types/contracts/send-message'

const brandName = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
const INITIAL_KNOWLEDGE_FILE = `# Project knowledge

This file gives ${brandName} context about your project: goals, commands, conventions, and gotchas.

## Quickstart
- Setup:
- Dev:
- Test:

## Architecture
- Key directories:
- Data flow:

## Conventions
- Formatting/linting:
- Patterns to follow:
- Things to avoid:
`

export function handleInitializationFlowLocally(
  options: { force?: boolean } = {},
): {
  postUserMessage: PostUserMessageFn
} {
  const force = options.force === true
  const projectRoot = getProjectRoot()
  const knowledgePath = path.join(projectRoot, PRIMARY_KNOWLEDGE_FILE_NAME)
  const messages: string[] = []

  if (existsSync(knowledgePath)) {
    messages.push(`📋 \`${PRIMARY_KNOWLEDGE_FILE_NAME}\` already exists.`)
    if (force) {
      messages.push(
        `📋 \`${PRIMARY_KNOWLEDGE_FILE_NAME}\` left untouched — \`--force\` refreshes the \`.agents/types/\` scaffold only.`,
      )
    }
  } else {
    writeFileSync(knowledgePath, INITIAL_KNOWLEDGE_FILE)
    messages.push(`✅ Created \`${PRIMARY_KNOWLEDGE_FILE_NAME}\``)

    // Track knowledge file creation
    trackEvent(AnalyticsEvent.KNOWLEDGE_FILE_UPDATED, {
      action: 'created',
      fileName: PRIMARY_KNOWLEDGE_FILE_NAME,
      fileSizeBytes: Buffer.byteLength(INITIAL_KNOWLEDGE_FILE, 'utf8'),
    })
  }

  const agentsDir = path.join(projectRoot, '.agents')
  const agentsTypesDir = path.join(agentsDir, 'types')

  if (existsSync(agentsDir)) {
    messages.push('📋 `.agents/` already exists.')
  } else {
    mkdirSync(agentsDir, { recursive: true })
    messages.push('✅ Created `.agents/`')
  }

  if (existsSync(agentsTypesDir)) {
    messages.push('📋 `.agents/types/` already exists.')
  } else {
    mkdirSync(agentsTypesDir, { recursive: true })
    messages.push('✅ Created `.agents/types/`')
  }

  for (const { fileName, source } of COMMON_TYPE_FILES) {
    const targetPath = path.join(agentsTypesDir, fileName)
    const existed = existsSync(targetPath)
    if (existed && !force) {
      messages.push(`📋 \`.agents/types/${fileName}\` already exists.`)
      continue
    }

    try {
      if (!source || source.trim().length === 0) {
        throw new Error('Source content is empty')
      }
      writeFileSync(targetPath, source)
      messages.push(
        existed
          ? `🔄 Refreshed \`.agents/types/${fileName}\` from the current template`
          : `✅ Copied \`.agents/types/${fileName}\``,
      )
    } catch (error) {
      messages.push(
        `⚠️ Failed to copy \`.agents/types/${fileName}\`: ${
          error instanceof Error ? error.message : String(error ?? 'Unknown')
        }`,
      )
    }
  }

  const postUserMessage: PostUserMessageFn = (prev) => [
    ...prev,
    ...messages.map((message) => getSystemMessage(message)),
  ]
  return { postUserMessage }
}
