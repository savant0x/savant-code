import { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'

import { clearInput, defineCommandWithArgs } from './command-shared'
import { authorInteractively } from './design-authoring'
import {
  answerText,
  parseScopedValue,
  resourceToAuthoringInput,
} from './design-authoring-input'
import {
  discardCustomDesignDraft,
  getCustomDesignDraft,
  importCustomDesignSystem,
  listCustomDesignDrafts,
  listDesignSystems,
  resolveCurrentDesignSystem,
  resolveDesignSystemReference,
  resetDesignSystemSelection,
  setDesignSystemSelection,
} from '../utils/design-system-service'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-shared'

export function isDesignCreateIntent(input: string): boolean {
  return /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:create|make|start)\s+(?:a|an|my)\s+(?:custom\s+design|design\s+system)[.!?]?$/i.test(
    input.trim(),
  )
}

export async function handleDesignCreateIntent(
  params: RouterParams,
): Promise<boolean> {
  if (!isDesignCreateIntent(params.inputValue)) return false
  const response = await AskUserBridge.request('design-intent-confirm', [
    {
      question: 'Open the guided custom design-system creator?',
      header: 'Design',
      options: [{ label: 'Open creator' }, { label: 'Keep chatting' }],
      multiSelect: false,
    },
  ])
  if (!response.skipped && answerText(response, 0) === 'Open creator') {
    await authorInteractively(params)
  } else {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage('No design-system changes were made.'),
    ])
  }
  clearInput(params)
  return true
}

export const DESIGN_COMMANDS = [
  defineCommandWithArgs({
    name: 'design',
    aliases: ['ds'],
    handler: async (params, args) => {
      const [subcommand = 'current', ...rest] = args.trim().split(/\s+/)
      const value = rest.join(' ')
      if (subcommand === 'list') {
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            listDesignSystems()
              .map(
                (item) => `${item.id} — ${item.displayName} [${item.source}]`,
              )
              .join('\n'),
          ),
        ])
      } else if (subcommand === 'current') {
        const current = resolveCurrentDesignSystem()
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Active design system: ${current.displayName} (${current.id}, ${current.selectionScope})`,
          ),
        ])
      } else if (subcommand === 'use' && value) {
        const scoped = parseScopedValue(rest)
        const resource = resolveDesignSystemReference(
          scoped.value,
          scoped.scope,
        )
        if (!resource)
          throw new Error(`Design system not found: ${scoped.value}`)
        setDesignSystemSelection(
          resource.source === 'user' ? 'user' : scoped.scope,
          resource.id,
        )
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Active design system: ${resource.displayName} (${resource.id})`,
          ),
        ])
      } else if (subcommand === 'create') {
        await authorInteractively(params)
      } else if (subcommand === 'edit' && value) {
        const scoped = parseScopedValue(rest)
        const resource = resolveDesignSystemReference(
          scoped.value,
          scoped.scope,
        )
        if (!resource)
          throw new Error(`Design system not found: ${scoped.value}`)
        const scope = resource.source === 'user' ? 'user' : scoped.scope
        await authorInteractively(
          params,
          resourceToAuthoringInput(
            resource,
            scope,
            resource.source === 'embedded',
          ),
        )
      } else if (subcommand === 'import' && rest[0]) {
        const scope = rest.includes('--user') ? 'user' : 'project'
        const sourcePath = rest.filter((item) => item !== '--user').join(' ')
        const imported = importCustomDesignSystem(sourcePath, scope, false)
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Imported ${imported.displayName} (${imported.id}).`,
          ),
        ])
      } else if (subcommand === 'validate' && value) {
        const scoped = parseScopedValue(rest)
        const resource = resolveDesignSystemReference(
          scoped.value,
          scoped.scope,
        )
        if (!resource)
          throw new Error(`Design system not found: ${scoped.value}`)
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Valid design system: ${resource.displayName} (${resource.id}).`,
          ),
        ])
      } else if (subcommand === 'drafts') {
        const scope = rest.includes('--user') ? 'user' : 'project'
        const drafts = listCustomDesignDrafts(scope)
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            drafts.length === 0
              ? 'No resumable design-system drafts found.'
              : drafts
                  .map((draft) => `${draft.id} — ${draft.updatedAt}`)
                  .join('\n'),
          ),
        ])
      } else if (subcommand === 'resume' && value) {
        const scoped = parseScopedValue(rest)
        const scope = scoped.scope
        const draftId = scoped.value
        const draft = getCustomDesignDraft(scope, draftId)
        if (!draft)
          throw new Error(`Design-system draft is unavailable: ${draftId}`)
        await authorInteractively(params, draft.input, draft.id)
      } else if (subcommand === 'discard' && value) {
        const scoped = parseScopedValue(rest)
        const scope = scoped.scope
        const draftId = scoped.value
        if (!discardCustomDesignDraft(scope, draftId)) {
          throw new Error(`Design-system draft is unavailable: ${draftId}`)
        }
      } else if (subcommand === 'reset') {
        const scope =
          value === '--project' || value === '--user' ? value.slice(2) : 'all'
        resetDesignSystemSelection(scope as 'project' | 'user' | 'all')
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage('Design-system selection reset.'),
        ])
      } else {
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(
            'Usage: /design list | current | use <id> | create | edit <id> | import <path> [--user] | validate <id> | drafts | resume <draft-id> | discard <draft-id> | reset [--project|--user]',
          ),
        ])
      }
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
]
