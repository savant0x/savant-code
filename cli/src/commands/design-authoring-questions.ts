import { formatMap } from './design-authoring-input'

import type { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'
import type { DesignAuthoringInputV1 } from '@savant-code/design-systems'

export function questionsFor(
  existing?: DesignAuthoringInputV1,
): Parameters<typeof AskUserBridge.request>[1] {
  const value = (current: string): { label: string; description: string } => ({
    label: current ? `Keep current: ${current}` : 'Enter a value',
    description:
      'Choose this to keep the current value, or type a replacement.',
  })
  return [
    {
      question: 'Stable design-system id (lowercase kebab-case)',
      header: 'Identity',
      options: [value(existing?.id ?? ''), { label: 'Choose a new id' }],
      multiSelect: false,
      validation: {
        pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
        patternError: 'Use lowercase kebab-case.',
      },
    },
    {
      question: 'Display name',
      header: 'Name',
      options: [
        value(existing?.displayName ?? ''),
        { label: 'Choose a new name' },
      ],
      multiSelect: false,
    },
    {
      question: 'Scope for this saved system',
      header: 'Scope',
      options: [
        { label: existing?.scope ?? 'project' },
        { label: existing?.scope === 'project' ? 'user' : 'project' },
      ],
      multiSelect: false,
    },
    {
      question: 'Description',
      header: 'Description',
      options: [
        value(existing?.description ?? ''),
        { label: 'Enter a description' },
      ],
      multiSelect: false,
    },
    {
      question: 'Targets',
      header: 'Targets',
      options: [{ label: 'terminal' }, { label: 'react' }, { label: 'web' }],
      multiSelect: true,
    },
    {
      question: 'Semantic colors as comma-separated key=#hex pairs',
      header: 'Colors',
      options: [
        value(formatMap(existing?.colors ?? {})),
        { label: 'Enter colors' },
      ],
      multiSelect: false,
    },
    {
      question: 'Typography as role=font-family pairs',
      header: 'Typography',
      options: [
        value(formatMap(existing?.typography ?? {})),
        { label: 'Enter typography' },
      ],
      multiSelect: false,
    },
    {
      question: 'Spacing as comma-separated key=value pairs',
      header: 'Spacing',
      options: [
        value(formatMap(existing?.spacing ?? {})),
        { label: 'Enter spacing' },
      ],
      multiSelect: false,
    },
    {
      question: 'Radius as comma-separated key=value pairs',
      header: 'Radius',
      options: [
        value(formatMap(existing?.radius ?? {})),
        { label: 'Enter radius' },
      ],
      multiSelect: false,
    },
    {
      question: 'Component guidance as role={JSON object} pairs',
      header: 'Components',
      options: [
        value(formatMap(existing?.components ?? {})),
        { label: 'Enter component guidance' },
      ],
      multiSelect: false,
    },
    {
      question: 'Accessibility requirements as a JSON object',
      header: 'Accessibility',
      options: [
        value(JSON.stringify(existing?.accessibility ?? {})),
        { label: 'Enter accessibility requirements' },
      ],
      multiSelect: false,
    },
    {
      question: 'Save this validated contract?',
      header: 'Confirm',
      options: [
        { label: 'Save and activate' },
        { label: 'Save without activating' },
        { label: 'Cancel' },
      ],
      multiSelect: false,
    },
  ]
}
