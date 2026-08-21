import { resolveDesignSystemReference } from '../utils/design-system-service'

import type {
  DesignAuthoringInputV1,
  DesignSystemResource,
} from '@savant-code/design-systems'

export type Answer = {
  questionIndex: number
  selectedOption?: string
  selectedOptions?: string[]
  otherText?: string
}

export type AskResponse = { answers?: Answer[]; skipped?: boolean }

export function answerText(response: AskResponse, index: number): string {
  const answer = response.answers?.find((item) => item.questionIndex === index)
  return answer?.otherText?.trim() ?? answer?.selectedOption?.trim() ?? ''
}

export function answerOptions(response: AskResponse, index: number): string[] {
  return (
    response.answers?.find((item) => item.questionIndex === index)
      ?.selectedOptions ?? []
  )
}

export function parseMap(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split(/,(?=\s*[^,{]+\s*=)/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=')
        const key = separator >= 0 ? part.slice(0, separator).trim() : ''
        const item = separator >= 0 ? part.slice(separator + 1).trim() : ''
        return [key, item.replace(/^"|"$/g, '')]
      })
      .filter(([key, item]) => key.length > 0 && item.length > 0),
  )
}

export function formatMap(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key}=${JSON.stringify(item)}`)
    .join(', ')
}

export function parseNestedMap(
  value: string,
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(parseMap(value)).flatMap(([key, item]) => {
      try {
        const parsed: unknown = JSON.parse(item)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? [[key, parsed as Record<string, unknown>]]
          : []
      } catch {
        return []
      }
    }),
  )
}

export function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseScopedValue(values: string[]): {
  value: string
  scope: 'project' | 'user'
} {
  const scope = values.includes('--user') ? 'user' : 'project'
  return {
    scope,
    value: values.filter((item) => item !== '--user').join(' '),
  }
}

export function draftSeed(
  existing?: DesignAuthoringInputV1,
): DesignAuthoringInputV1 {
  return (
    existing ?? {
      schemaVersion: '1',
      id: 'custom-design-system',
      displayName: 'Custom Design System',
      description: 'A custom design system draft.',
      scope: 'project',
      targets: ['terminal', 'react'],
      colors: { primary: '#00d4ff' },
      typography: { body: { fontFamily: 'system-ui, sans-serif' } },
      spacing: { sm: '8px' },
      radius: { sm: '4px' },
      components: {},
      accessibility: { contrastReview: true },
      activate: false,
    }
  )
}

export function resourceToAuthoringInput(
  resource: DesignSystemResource,
  scope: 'project' | 'user',
  cloneBuiltIn = false,
): DesignAuthoringInputV1 {
  let id = resource.id
  if (cloneBuiltIn) {
    id = `${resource.id}-custom`
    let suffix = 2
    while (resolveDesignSystemReference(id, scope)) {
      id = `${resource.id}-custom-${suffix}`
      suffix += 1
    }
  }
  return {
    schemaVersion: '1',
    id,
    displayName: resource.displayName,
    description: resource.description,
    scope,
    targets: resource.targets,
    colors: resource.tokens.colors,
    typography: resource.tokens.typography,
    spacing: resource.tokens.spacing,
    radius: resource.tokens.radius,
    components: resource.tokens.components,
    accessibility:
      resource.tokens.extensions.accessibility &&
      typeof resource.tokens.extensions.accessibility === 'object'
        ? (resource.tokens.extensions.accessibility as Record<string, unknown>)
        : {},
    activate: true,
    provenance: resource.provenance,
  }
}

export function keepOrText(
  response: AskResponse,
  index: number,
  fallback: string,
  labels: string[] = [],
): string {
  const text = answerText(response, index)
  if (!text || text.startsWith('Keep current: ') || labels.includes(text)) {
    return fallback
  }
  return text
}
