import matter from 'gray-matter'

import {
  ABSOLUTE_PATH,
  HEX_COLOR,
  UNSAFE_CONTENT,
  asRecord,
  asStringRecord,
  collectFonts,
  inferDisplayName,
  inferId,
  inferTargets,
  normalizeNestedRecord,
  normalizeTokens,
  sha256,
} from './parse-helpers'
import {
  DESIGN_SYSTEM_SCHEMA_VERSION,
  designSystemResourceSchema,
  type DesignSystemDiagnostic,
  type DesignSystemProvenance,
  type DesignSystemResource,
  type DesignSystemStatus,
  type DesignSystemValidationResult,
} from './types'

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
