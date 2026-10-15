import { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'

import {
  answerOptions,
  answerText,
  draftSeed,
  formatMap,
  keepOrText,
  parseMap,
  parseNestedMap,
  parseObject,
} from './design-authoring-input'
import { questionsFor } from './design-authoring-questions'
import {
  clearCustomDesignDraft,
  saveCustomDesignDraft,
  saveCustomDesignSystem,
  validateDesignInput,
} from '../utils/design-system-service'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-shared'
import type { AskResponse } from './design-authoring-input'
import type { DesignAuthoringInputV1 } from '@savant-code/design-systems'

function answerToInput(
  response: AskResponse,
  existing?: DesignAuthoringInputV1,
): DesignAuthoringInputV1 {
  const scopeText = answerText(response, 2)
  const scope = (
    scopeText === 'user' || scopeText === 'project'
      ? scopeText
      : (existing?.scope ?? 'project')
  ) as 'project' | 'user'
  const targets = answerOptions(response, 4).filter(
    (item): item is 'terminal' | 'react' | 'web' =>
      item === 'terminal' || item === 'react' || item === 'web',
  )
  const id = keepOrText(response, 0, existing?.id ?? '', [
    'Choose a new id',
    'Enter a value',
  ])
  const displayName = keepOrText(response, 1, existing?.displayName ?? '', [
    'Choose a new name',
    'Enter a value',
  ])
  const description = keepOrText(
    response,
    3,
    existing?.description ?? `Custom ${displayName} design system.`,
    ['Choose a new description', 'Enter a description', 'Enter a value'],
  )
  const colors = parseMap(
    keepOrText(response, 5, formatMap(existing?.colors ?? {})),
  )
  const typographyInput = parseMap(
    keepOrText(response, 6, formatMap(existing?.typography ?? {})),
  )
  const typography = Object.fromEntries(
    Object.entries(typographyInput).map(([key, value]) => {
      try {
        const parsed = JSON.parse(value)
        return [
          key,
          parsed && typeof parsed === 'object' ? parsed : { fontFamily: value },
        ]
      } catch {
        return [key, { fontFamily: value }]
      }
    }),
  )
  return {
    schemaVersion: '1',
    id,
    displayName,
    description,
    scope,
    targets:
      targets.length > 0
        ? targets
        : (existing?.targets ?? ['terminal', 'react']),
    colors,
    typography,
    spacing: parseMap(
      keepOrText(response, 7, formatMap(existing?.spacing ?? {})),
    ),
    radius: parseMap(
      keepOrText(response, 8, formatMap(existing?.radius ?? {})),
    ),
    components: parseNestedMap(
      keepOrText(response, 9, formatMap(existing?.components ?? {})),
    ),
    accessibility: parseObject(
      keepOrText(response, 10, JSON.stringify(existing?.accessibility ?? {})),
    ),
    activate: answerText(response, 11) === 'Save and activate',
    ...(existing?.provenance ? { provenance: existing.provenance } : {}),
  }
}

function previewLines(input: DesignAuthoringInputV1): string {
  return [
    `Design system: ${input.displayName} (${input.id})`,
    `Scope: ${input.scope} | Targets: ${input.targets.join(', ')}`,
    `Colors: ${Object.keys(input.colors).length} | Typography: ${Object.keys(input.typography).length} | Components: ${Object.keys(input.components).length}`,
    `Accessibility requirements: ${Object.keys(input.accessibility).length}`,
  ].join('\\n')
}

export async function authorInteractively(
  params: RouterParams,
  existing?: DesignAuthoringInputV1,
  draftId?: string,
): Promise<boolean> {
  const response = await AskUserBridge.request(
    'design-authoring',
    questionsFor(existing),
  )
  if (response.skipped) {
    const seed = draftSeed(existing)
    try {
      const draft = saveCustomDesignDraft(seed.scope, seed, draftId)
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `Design authoring cancelled; draft ${draft.id} is available via /design resume ${draft.id}. No files were changed.`,
        ),
      ])
    } catch (error) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `Design authoring cancelled, but the draft could not be saved: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ])
    }
    return false
  }

  const input = answerToInput(response, existing)

  const validation = validateDesignInput(input)
  if (!validation.ok) {
    try {
      const draft = saveCustomDesignDraft(input.scope, input, draftId)
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `${validation.code}: ${validation.message} Draft ${draft.id} was saved; resume it with /design resume ${draft.id}.`,
        ),
      ])
    } catch (error) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `${validation.code}: ${validation.message} Draft persistence also failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ])
    }
    return false
  }

  const preview = previewLines(input)
  const review = await AskUserBridge.request('design-authoring-review', [
    {
      question: `Review this validated design-system contract before saving:\\n\\n${preview}`,
      header: 'Review',
      options: [
        { label: 'Save and continue' },
        { label: 'Cancel and keep draft' },
      ],
      multiSelect: false,
    },
  ])
  if (review.skipped || answerText(review, 0) !== 'Save and continue') {
    try {
      const draft = saveCustomDesignDraft(input.scope, input, draftId)
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `Review cancelled; draft ${draft.id} is available via /design resume ${draft.id}. No files were changed.`,
        ),
      ])
    } catch (error) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `Review cancelled, but the draft could not be saved: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ])
    }
    return false
  }

  const saved = saveCustomDesignSystem(input)
  if (draftId) clearCustomDesignDraft(input.scope, draftId)
  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(
      `Saved ${saved.displayName} (${saved.id})${input.activate ? ' and activated it' : ''}.`,
    ),
  ])
  return true
}
