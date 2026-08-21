import { z } from 'zod/v4'

import { jsonValueSchema } from '../types/json'

import type { DesignContract } from '../types/design-system'
import type { JSONValue } from '../types/json'
import type { SkillsMap } from '../types/skill'

export const FileTreeNodeSchema: z.ZodType<FileTreeNode> = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory']),
  children: z.lazy(() => z.array(FileTreeNodeSchema).optional()),
  filePath: z.string(),
})

export interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  filePath: string
  lastReadTime?: number
  children?: FileTreeNode[]
}

export interface DirectoryNode extends FileTreeNode {
  type: 'directory'
  children: FileTreeNode[]
}

export interface FileNode extends FileTreeNode {
  type: 'file'
  lastReadTime: number
}

export const FileVersionSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export type FileVersion = z.infer<typeof FileVersionSchema>

export const customToolDefinitionsSchema = z
  .record(
    z.string(),
    z.object({
      // inputSchema can be a Zod schema (from MCP tools) or a JSON Schema object
      // (from SDK custom tools that have been serialized). The agent-runtime
      // converts JSON schemas to Zod using ensureZodSchema() before use.
      inputSchema: z.custom<z.ZodType | Record<string, JSONValue>>(),
      endsAgentStep: z.boolean().optional().default(false),
      description: z.string().optional(),
      /** Host-declared effect and approval policy for extension tools. */
      effect: z.enum(['read', 'write', 'shell', 'network', 'mixed']).optional(),
      permission: z.enum(['allow', 'prompt', 'deny']).optional(),
      exampleInputs: z.record(z.string(), jsonValueSchema).array().optional(),
    }),
  )
  .default(() => ({}))
export type CustomToolDefinitions = NonNullable<
  z.input<typeof customToolDefinitionsSchema>
>

export const ProjectFileContextSchema = z.object({
  projectRoot: z.string(),
  cwd: z.string(),
  fileTree: z.array(z.custom<FileTreeNode>()),
  fileTokenScores: z.record(z.string(), z.record(z.string(), z.number())),
  tokenCallers: z
    .record(z.string(), z.record(z.string(), z.array(z.string())))
    .optional(),
  knowledgeFiles: z.record(z.string(), z.string()),
  userKnowledgeFiles: z.record(z.string(), z.string()).optional(),
  agentTemplates: z.record(z.string(), z.custom<object>()).default(() => ({})),
  customToolDefinitions: customToolDefinitionsSchema,
  skills: z.custom<SkillsMap>().optional(),
  gitChanges: z.object({
    status: z.string(),
    diff: z.string(),
    diffCached: z.string(),
    lastCommitMessages: z.string(),
  }),
  changesSinceLastChat: z.record(z.string(), z.string()),
  shellConfigFiles: z.record(z.string(), z.string()),
  systemInfo: z.object({
    platform: z.string(),
    shell: z.string(),
    nodeVersion: z.string(),
    arch: z.string(),
    homedir: z.string(),
    cpus: z.number(),
    chromeAvailable: z.boolean(),
  }),
  /** Dev override flag — bypasses all FSM tool gating and agent tool restrictions when true. */
  devMode: z.boolean().optional(),
  /** Sandbox permission mode: safe = deny risky, prompt = ask when possible, unsafe = allow. */
  permissionMode: z.enum(['safe', 'prompt', 'unsafe']).optional(),
  /** Active design contract; only the selected system is transported. */
  designContract: z.custom<DesignContract>().optional(),
  /** Rendered active design guidance injected into agent prompts. */
  designSystemContext: z.string().optional(),
})

export type ProjectFileContext = {
  projectRoot: string
  cwd: string
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, Record<string, number>>
  tokenCallers?: Record<string, Record<string, string[]>>
  knowledgeFiles: Record<string, string>
  userKnowledgeFiles?: Record<string, string>
  agentTemplates: Record<string, object>
  customToolDefinitions: CustomToolDefinitions
  skills?: SkillsMap
  gitChanges: {
    status: string
    diff: string
    diffCached: string
    lastCommitMessages: string
  }
  changesSinceLastChat: Record<string, string>
  shellConfigFiles: Record<string, string>
  systemInfo: {
    platform: string
    shell: string
    nodeVersion: string
    arch: string
    homedir: string
    cpus: number
    chromeAvailable: boolean
  }
  /** Dev override flag — bypasses all FSM tool gating and agent tool restrictions when true. */
  devMode?: boolean
  /** Sandbox permission mode: safe = deny risky, prompt = ask when possible, unsafe = allow. */
  permissionMode?: 'safe' | 'prompt' | 'unsafe'
  /** Active design contract; only the selected system is transported. */
  designContract?: DesignContract
  /** Rendered active design guidance injected into agent prompts. */
  designSystemContext?: string
}

export const getStubProjectFileContext = (): ProjectFileContext => ({
  // FID-2026-0718-013 v3 Q13: must be a non-empty absolute path so that
  // resolveAndContain's F1 invariants (reject missing/non-absolute) don't
  // cascade into test failures for any test fixture that exercises the
  // write-tool gate. Production populates this from CLI boot.
  projectRoot: '/mock/project/root',
  cwd: '',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  skills: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: '',
    shell: '',
    nodeVersion: '',
    arch: '',
    homedir: '',
    cpus: 0,
    chromeAvailable: false,
  },
  devMode: undefined,
  permissionMode: undefined,
  designContract: undefined,
  designSystemContext: undefined,
})
