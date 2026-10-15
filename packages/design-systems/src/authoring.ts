import { createHash } from 'node:crypto'

import { z } from 'zod/v4'

import { normalizeDesignSystemSource } from './parser'
import {
  designSystemIdSchema,
  designTargetSchema,
  type DesignSystemResource,
} from './types'

export const designAuthoringInputV1Schema = z.object({
  schemaVersion: z.literal('1'),
  id: designSystemIdSchema,
  displayName: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  scope: z.enum(['project', 'user']),
  targets: z.array(designTargetSchema).min(1),
  colors: z
    .record(z.string(), z.string())
    .refine((value) => Object.keys(value).length > 0),
  typography: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .refine((value) => Object.keys(value).length > 0),
  spacing: z
    .record(z.string(), z.string())
    .refine((value) => Object.keys(value).length > 0),
  radius: z
    .record(z.string(), z.string())
    .refine((value) => Object.keys(value).length > 0),
  components: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .default({}),
  accessibility: z.record(z.string(), z.unknown()).default({}),
  activate: z.boolean(),
  /** Optional provenance carried forward when cloning/importing an existing system. */
  provenance: z
    .object({
      sourceRepository: z.string().min(1),
      sourceRevision: z.string().min(1),
      sourcePath: z.string().min(1),
      license: z.string().min(1),
      notice: z.string().optional(),
    })
    .optional(),
})

export type DesignAuthoringInputV1 = z.infer<
  typeof designAuthoringInputV1Schema
>

export type DesignAuthoringResult =
  | { ok: true; resource: DesignSystemResource; source: string }
  | {
      ok: false
      code: 'DESIGN_INPUT_INVALID' | 'INTERACTIVE_INPUT_REQUIRED'
      message: string
    }

function quote(value: unknown): string {
  return JSON.stringify(value)
}

/** Render a complete declarative contract from the validated authoring DTO. */
export function renderDesignAuthoringSource(
  input: DesignAuthoringInputV1,
): string {
  return [
    '---',
    `name: ${input.id}`,
    `displayName: ${quote(input.displayName)}`,
    `description: ${quote(input.description)}`,
    `targets: ${quote(input.targets)}`,
    `colors:`,
    ...Object.entries(input.colors).map(
      ([key, value]) => `  ${key}: ${quote(value)}`,
    ),
    'typography:',
    ...Object.entries(input.typography).flatMap(([key, value]) => [
      `  ${key}:`,
      ...Object.entries(value).map(
        ([field, fieldValue]) => `    ${field}: ${quote(fieldValue)}`,
      ),
    ]),
    'spacing:',
    ...Object.entries(input.spacing).map(
      ([key, value]) => `  ${key}: ${quote(value)}`,
    ),
    'radius:',
    ...Object.entries(input.radius).map(
      ([key, value]) => `  ${key}: ${quote(value)}`,
    ),
    'components:',
    ...Object.entries(input.components).flatMap(([key, value]) => [
      `  ${key}:`,
      ...Object.entries(value).map(
        ([field, fieldValue]) => `    ${field}: ${quote(fieldValue)}`,
      ),
    ]),
    'accessibility:',
    ...Object.entries(input.accessibility).map(
      ([key, value]) => `  ${key}: ${quote(value)}`,
    ),
    '---',
    '',
    `# ${input.displayName}`,
    '',
    input.description,
    '',
  ].join('\n')
}

/** Validate a headless or interactive DTO through the same parser pipeline. */
export function validateDesignAuthoringInput(
  input: unknown,
): DesignAuthoringResult {
  if (
    !input ||
    typeof input !== 'object' ||
    !Object.prototype.hasOwnProperty.call(input, 'activate')
  ) {
    return {
      ok: false,
      code: 'INTERACTIVE_INPUT_REQUIRED',
      message: 'The activate field is required.',
    }
  }
  const parsed = designAuthoringInputV1Schema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'DESIGN_INPUT_INVALID',
      message: parsed.error.message,
    }
  }
  const source = renderDesignAuthoringSource(parsed.data)
  try {
    const resource = normalizeDesignSystemSource({
      sourceContent: source,
      // Absolute/imported provenance is metadata only. The parser receives a
      // trusted relative persistence path so its containment guard remains
      // active while the original source path survives in the returned record.
      sourcePath: `custom/${parsed.data.scope}/${parsed.data.id}.design.md`,
      sourceRepository:
        parsed.data.provenance?.sourceRepository ?? 'local-custom',
      sourceRevision:
        parsed.data.provenance?.sourceRevision ??
        `source-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`,
      license: parsed.data.provenance?.license ?? 'user-authored',
    })
    return {
      ok: true,
      resource: {
        ...resource,
        source: parsed.data.scope === 'project' ? 'project' : 'user',
        status: 'custom',
        targets: parsed.data.targets,
        provenance: parsed.data.provenance ?? resource.provenance,
      },
      source,
    }
  } catch (error) {
    return {
      ok: false,
      code: 'DESIGN_INPUT_INVALID',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
