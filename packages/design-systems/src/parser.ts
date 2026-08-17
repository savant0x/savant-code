import { createHash } from 'node:crypto'
import path from 'node:path'

import matter from 'gray-matter'

import {
  DESIGN_SYSTEM_SCHEMA_VERSION,
  canonicalDesignTokensSchema,
  designSystemIdSchema,
  designSystemResourceSchema,
  type CanonicalDesignTokens,
  type DesignSystemDiagnostic,
  type DesignSystemProvenance,
  type DesignSystemResource,
  type DesignSystemStatus,
  type DesignSystemValidationResult,
  type DesignTarget,
  type FontReference,
} from './types'

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i
const UNSAFE_CONTENT = /<script\b|javascript:|data:text\/html|<iframe\b/i
const ABSOLUTE_PATH = /^(?:[a-zA-Z]:[\\/]|[\\/]{2,}|\/)/

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asStringRecord(value: unknown): Record<string, string> {
  const record: Record<string, string> = {}
  for (const [key, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string' || typeof item === 'number') {
      record[key] = String(item)
    }
  }
  return record
}

function normalizeNestedRecord(
  value: unknown,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, item] of Object.entries(asRecord(value))) {
    const record = asRecord(item)
    if (Object.keys(record).length > 0) result[key] = sortRecord(record)
  }
  return result
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, T>
}

function normalizeTokens(
  data: Record<string, unknown>,
  source: string,
): CanonicalDesignTokens {
  const known = new Set([
    'colors',
    'typography',
    'spacing',
    'rounded',
    'radius',
    'components',
  ])
  const extensions = Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !known.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  const extractedColors = [...source.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(
    (match) => match[0]!,
  )
  const colors = sortRecord(asStringRecord(data.colors))
  if (Object.keys(colors).length === 0 && extractedColors.length > 0) {
    colors.primary = extractedColors[0]!
    colors.foreground = extractedColors[1] ?? '#e4e4e8'
    colors.background = extractedColors[2] ?? '#050508'
  }
  const typography = normalizeNestedRecord(data.typography)
  if (Object.keys(typography).length === 0) {
    typography.body = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      lineHeight: '1.5',
    }
  }
  const spacing = sortRecord(asStringRecord(data.spacing))
  if (Object.keys(spacing).length === 0) spacing.md = '16px'
  const radius = sortRecord(asStringRecord(data.radius ?? data.rounded))
  if (Object.keys(radius).length === 0) radius.md = '8px'
  return canonicalDesignTokensSchema.parse({
    colors,
    typography,
    spacing,
    radius,
    components: normalizeNestedRecord(data.components),
    extensions,
  })
}

function collectFonts(tokens: CanonicalDesignTokens): FontReference[] {
  const families = new Set<string>()
  for (const typography of Object.values(tokens.typography)) {
    const family = typography.fontFamily
    if (typeof family === 'string') {
      for (const item of family.split(',')) {
        const cleaned = item.trim().replace(/^['"]|['"]$/g, '')
        if (
          cleaned &&
          !/^(system-ui|-apple-system|sans-serif|serif|monospace|ui-sans-serif)$/i.test(
            cleaned,
          )
        ) {
          families.add(cleaned)
        }
      }
    }
  }
  return [...families]
    .sort((left, right) => left.localeCompare(right))
    .map((family) => ({
      family,
      fallback: ['system-ui', 'sans-serif'],
      redistributable: false,
    }))
}

function inferTargets(tokens: CanonicalDesignTokens): DesignTarget[] {
  const serialized = JSON.stringify(tokens).toLowerCase()
  const targets: DesignTarget[] = ['terminal', 'react']
  if (serialized.includes('css') || serialized.includes('web'))
    targets.push('web')
  return targets
}

function inferId(
  filePath: string,
  frontmatter: Record<string, unknown>,
): string {
  const value = typeof frontmatter.id === 'string' ? frontmatter.id : undefined
  const name =
    typeof frontmatter.name === 'string' ? frontmatter.name : undefined
  const candidate = value ?? name ?? path.basename(filePath, '.design.md')
  const normalized = candidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return designSystemIdSchema.parse(normalized || 'design-system')
}

function inferDisplayName(
  id: string,
  frontmatter: Record<string, unknown>,
): string {
  if (
    typeof frontmatter.displayName === 'string' &&
    frontmatter.displayName.trim()
  ) {
    return frontmatter.displayName.trim()
  }
  if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
    return frontmatter.name.trim()
  }
  return id
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

export function parseDesignSystemSource(params: {
  sourceContent: string
  sourcePath: string
  sourceRepository?: string
  sourceRevision?: string
  license?: string
  status?: DesignSystemStatus
  source?: 'embedded' | 'project' | 'user'
}): DesignSystemValidationResult {
  const diagnostics: DesignSystemDiagnostic[] = []
  if (UNSAFE_CONTENT.test(params.sourceContent)) {
    diagnostics.push({
      code: 'UNSAFE_CONTENT',
      message: 'Executable or HTML payload markers are not admitted.',
    })
  }
  if (
    ABSOLUTE_PATH.test(params.sourcePath) ||
    params.sourcePath.includes('..')
  ) {
    diagnostics.push({
      code: 'UNSAFE_PATH',
      path: params.sourcePath,
      message: 'Source paths must be relative and contained.',
    })
  }

  let parsed: { data: Record<string, unknown>; content: string }
  try {
    const document = matter(params.sourceContent)
    parsed = { data: asRecord(document.data), content: document.content }
  } catch {
    // Several admitted reference documents are Markdown-only or contain prose
    // that is not valid YAML frontmatter. Treat those as plain Markdown rather
    // than losing the document; token signals below still decide admission.
    parsed = { data: {}, content: params.sourceContent }
  }

  const tokens = normalizeTokens(parsed.data, params.sourceContent)
  const hasColorSignal =
    Object.keys(asStringRecord(parsed.data.colors)).length > 0 ||
    /#[0-9a-f]{3,8}\b/i.test(params.sourceContent)
  const hasTypographySignal =
    Object.keys(normalizeNestedRecord(parsed.data.typography)).length > 0 ||
    /font|typeface|typography/i.test(params.sourceContent)
  const hasSpacingSignal =
    Object.keys(asStringRecord(parsed.data.spacing)).length > 0 ||
    /spacing|padding|margin|gap/i.test(params.sourceContent)
  const colorValues = Object.values(tokens.colors)
  const invalidColors = colorValues.filter(
    (value) => value.startsWith('#') && !HEX_COLOR.test(value),
  )
  if (invalidColors.length > 0) {
    diagnostics.push({
      code: 'INVALID_COLOR',
      message: `Invalid color values: ${invalidColors.join(', ')}`,
    })
  }
  if (!hasColorSignal) {
    diagnostics.push({
      code: 'MISSING_COLORS',
      message: 'At least one color token or documented color is required.',
    })
  }
  if (!hasTypographySignal) {
    diagnostics.push({
      code: 'MISSING_TYPOGRAPHY',
      message: 'At least one typography or font reference is required.',
    })
  }
  if (!hasSpacingSignal) {
    diagnostics.push({
      code: 'MISSING_SPACING',
      message: 'At least one spacing or layout reference is required.',
    })
  }

  const id = inferId(params.sourcePath, parsed.data)
  const displayName = inferDisplayName(id, parsed.data)
  const provenance: DesignSystemProvenance = {
    sourceRepository: params.sourceRepository ?? 'local-staged-corpus',
    sourceRevision: params.sourceRevision ?? 'working-tree',
    sourcePath: params.sourcePath.replaceAll('\\', '/'),
    license: params.license ?? 'MIT',
  }
  const normalizedPayload = JSON.stringify({
    schemaVersion: DESIGN_SYSTEM_SCHEMA_VERSION,
    id,
    displayName,
    description:
      typeof parsed.data.description === 'string'
        ? parsed.data.description
        : `Design system ${displayName}`,
    tokens,
    fonts: collectFonts(tokens),
    targets: inferTargets(tokens),
    provenance,
  })
  const resource: DesignSystemResource = {
    schemaVersion: DESIGN_SYSTEM_SCHEMA_VERSION,
    id,
    displayName,
    description:
      typeof parsed.data.description === 'string'
        ? parsed.data.description
        : `Design system ${displayName}`,
    source: params.source ?? 'embedded',
    status: params.status ?? 'curated-reference',
    targets: inferTargets(tokens),
    contentPath: params.sourcePath.replaceAll('\\', '/'),
    sourceContentHash: sha256(params.sourceContent),
    normalizedContentHash: sha256(normalizedPayload),
    provenance,
    fonts: collectFonts(tokens),
    tokens,
  }

  const result = designSystemResourceSchema.safeParse(resource)
  if (!result.success) {
    diagnostics.push({ code: 'SCHEMA_ERROR', message: result.error.message })
  }
  return diagnostics.length > 0
    ? { valid: false, diagnostics }
    : { valid: true, diagnostics: [], resource }
}

export function normalizeDesignSystemSource(params: {
  sourceContent: string
  sourcePath: string
  sourceRepository?: string
  sourceRevision?: string
  license?: string
}): DesignSystemResource {
  const result = parseDesignSystemSource({
    sourceContent: params.sourceContent,
    sourcePath: params.sourcePath,
    sourceRepository: params.sourceRepository,
    sourceRevision: params.sourceRevision,
    license: params.license,
    source: 'embedded',
  })
  if (!result.valid || !result.resource) {
    throw new Error(result.diagnostics.map((item) => item.message).join('; '))
  }
  return result.resource
}
