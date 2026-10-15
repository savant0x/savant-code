import { z } from 'zod/v4'

export const DESIGN_SYSTEM_SCHEMA_VERSION = '1'
export const DESIGN_SYSTEM_MANIFEST_VERSION = '1'
export const BUILT_IN_DESIGN_SYSTEM_COUNT = 74
export const DEFAULT_DESIGN_SYSTEM_ID = 'savant-cyberpunk'

export const designSystemIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const designTargetSchema = z.enum(['terminal', 'react', 'web'])
export type DesignTarget = z.infer<typeof designTargetSchema>

export const designSystemSourceSchema = z.enum(['embedded', 'project', 'user'])
export type DesignSystemSource = z.infer<typeof designSystemSourceSchema>

export const designSystemStatusSchema = z.enum([
  'curated-reference',
  'savant-native',
  'custom',
])
export type DesignSystemStatus = z.infer<typeof designSystemStatusSchema>

export const designSystemScopeSchema = z.enum([
  'session',
  'project',
  'user',
  'default',
])
export type DesignSystemScope = z.infer<typeof designSystemScopeSchema>

export const designSystemProvenanceSchema = z.object({
  sourceRepository: z.string().min(1),
  sourceRevision: z.string().min(1),
  sourcePath: z.string().min(1),
  license: z.string().min(1),
  notice: z.string().optional(),
})
export type DesignSystemProvenance = z.infer<
  typeof designSystemProvenanceSchema
>

export const canonicalDesignTokensSchema = z.object({
  colors: z.record(z.string(), z.string()),
  typography: z.record(z.string(), z.record(z.string(), z.unknown())),
  spacing: z.record(z.string(), z.string()),
  radius: z.record(z.string(), z.string()),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  extensions: z.record(z.string(), z.unknown()),
})
export type CanonicalDesignTokens = z.infer<typeof canonicalDesignTokensSchema>

export const fontReferenceSchema = z.object({
  family: z.string().min(1),
  fallback: z.array(z.string()).min(1),
  redistributable: z.boolean(),
  evidence: z.string().optional(),
})
export type FontReference = z.infer<typeof fontReferenceSchema>

export const designSystemResourceSchema = z.object({
  schemaVersion: z.literal(DESIGN_SYSTEM_SCHEMA_VERSION),
  id: designSystemIdSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  source: designSystemSourceSchema,
  status: designSystemStatusSchema,
  targets: z.array(designTargetSchema).min(1),
  contentPath: z.string().min(1),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  normalizedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: designSystemProvenanceSchema,
  fonts: z.array(fontReferenceSchema),
  tokens: canonicalDesignTokensSchema,
})
export type DesignSystemResource = z.infer<typeof designSystemResourceSchema>

export const designSystemManifestEntrySchema = designSystemResourceSchema.omit({
  tokens: true,
})
export type DesignSystemManifestEntry = z.infer<
  typeof designSystemManifestEntrySchema
>

export const designSystemManifestSchema = z.object({
  manifestVersion: z.literal(DESIGN_SYSTEM_MANIFEST_VERSION),
  generatedFrom: z.string().min(1),
  nativeDefaultId: z.literal(DEFAULT_DESIGN_SYSTEM_ID),
  rawCount: z.number().int().nonnegative(),
  admittedCount: z.number().int().nonnegative(),
  resources: z.array(designSystemManifestEntrySchema),
})
export type DesignSystemManifest = z.infer<typeof designSystemManifestSchema>

export type ActiveDesignSystem = DesignSystemResource & {
  selectionScope: DesignSystemScope
}

export function toDesignContract(
  resource: DesignSystemResource | ActiveDesignSystem,
) {
  return {
    id: resource.id,
    displayName: resource.displayName,
    targets: resource.targets,
    colors: resource.tokens.colors,
    typography: resource.tokens.typography,
    spacing: resource.tokens.spacing,
    radius: resource.tokens.radius,
    components: resource.tokens.components,
    accessibility:
      resource.tokens.extensions.accessibility &&
      typeof resource.tokens.extensions.accessibility === 'object' &&
      !Array.isArray(resource.tokens.extensions.accessibility)
        ? (resource.tokens.extensions.accessibility as Record<string, unknown>)
        : undefined,
    source: resource.source,
    status: resource.status,
    selectionScope:
      'selectionScope' in resource ? resource.selectionScope : undefined,
    sourceContentHash: resource.sourceContentHash,
    normalizedContentHash: resource.normalizedContentHash,
    provenance: resource.provenance,
  }
}

export type DesignSystemDiagnostic = {
  path?: string
  code: string
  message: string
}

export type DesignSystemValidationResult = {
  valid: boolean
  diagnostics: DesignSystemDiagnostic[]
  resource?: DesignSystemResource
}
