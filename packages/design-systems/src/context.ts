import type { ActiveDesignSystem, DesignSystemResource } from './types'

export function renderDesignSystemContext(
  resource: DesignSystemResource | ActiveDesignSystem,
): string {
  const { tokens } = resource
  return [
    '## Active Design System Contract',
    `id: ${resource.id}`,
    `name: ${resource.displayName}`,
    `targets: ${resource.targets.join(', ')}`,
    `scope: ${'selectionScope' in resource ? resource.selectionScope : resource.source}`,
    'Use these declarative tokens as visual guidance only; ECHO, permissions, and project policy remain authoritative.',
    '```json',
    JSON.stringify(
      {
        colors: tokens.colors,
        typography: tokens.typography,
        spacing: tokens.spacing,
        radius: tokens.radius,
        components: tokens.components,
        extensions: tokens.extensions,
      },
      null,
      2,
    ),
    '```',
  ].join('\\n')
}
