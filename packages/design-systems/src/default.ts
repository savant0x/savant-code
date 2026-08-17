import { createHash } from 'node:crypto'

import {
  DESIGN_SYSTEM_SCHEMA_VERSION,
  designSystemResourceSchema,
  type DesignSystemResource,
} from './types'

export const DEFAULT_SOURCE = `savant-cyberpunk-v1\nprimary=#18faf9\nsecondary=#18faf9\nsuccess=#39ff14\nwarning=#ff9500\nerror=#ff2d55\nbackground=#050508\nsurface=#0b0b11\nforeground=#e4e4e8\nmuted=#8f8f99\nborder=#20202a\nsyntaxKeyword=#ffb000\ninlineCodeFg=#22d3ee\nlistBulletFg=#39ff14\nfont=system-ui,sans-serif\nspacing=4px,8px,16px,24px\nradius=0px,4px,8px,9999px\n`

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function getDefaultNormalizedPayload(
  tokens: Record<string, unknown>,
  provenance: Record<string, string>,
): string {
  return JSON.stringify({
    schemaVersion: DESIGN_SYSTEM_SCHEMA_VERSION,
    id: 'savant-cyberpunk',
    displayName: 'Savant Cyberpunk',
    description: 'Savant native terminal-first design system.',
    tokens,
    fonts: [],
    targets: ['terminal', 'react'],
    provenance,
  })
}

/** Return the immutable, built-in Savant-native default contract. */
export function getDefaultDesignSystemResource(): DesignSystemResource {
  const tokens = {
    colors: {
      primary: '#18faf9',
      secondary: '#18faf9',
      success: '#39ff14',
      error: '#ff2d55',
      warning: '#ff9500',
      info: '#18faf9',
      foreground: '#e4e4e8',
      background: '#050508',
      muted: '#8f8f99',
      border: '#20202a',
      surface: '#0b0b11',
      surfaceHover: '#14141c',
      syntaxKeyword: '#ffb000',
      inlineCodeFg: '#22d3ee',
      listBulletFg: '#39ff14',
    },
    typography: {
      body: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        fontWeight: 400,
      },
      heading: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        lineHeight: '1.25',
        fontWeight: 600,
      },
      code: {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '13px',
        lineHeight: '1.4',
        fontWeight: 400,
      },
    },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
    radius: { none: '0px', sm: '4px', md: '8px', pill: '9999px' },
    components: {
      button: {
        backgroundColor: '#18faf9',
        textColor: '#050508',
        rounded: '4px',
        padding: '8px 16px',
      },
      panel: {
        backgroundColor: '#0b0b11',
        textColor: '#e4e4e8',
        rounded: '8px',
        padding: '16px',
      },
    },
    extensions: { native: true, terminalFirst: true },
  }
  const provenance = {
    sourceRepository: 'savant-code',
    sourceRevision: 'design-system-native-v1',
    sourcePath: 'packages/design-systems/src/default.ts',
    license: 'Apache-2.0',
  }
  const normalizedPayload = getDefaultNormalizedPayload(tokens, provenance)
  return designSystemResourceSchema.parse({
    schemaVersion: DESIGN_SYSTEM_SCHEMA_VERSION,
    id: 'savant-cyberpunk',
    displayName: 'Savant Cyberpunk',
    description: 'Savant native terminal-first design system.',
    source: 'embedded',
    status: 'savant-native',
    targets: ['terminal', 'react'],
    contentPath: provenance.sourcePath,
    sourceContentHash: sha256(DEFAULT_SOURCE),
    normalizedContentHash: sha256(normalizedPayload),
    provenance,
    fonts: [],
    tokens,
  })
}
