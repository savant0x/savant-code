import { z } from 'zod/v4'

import { sha256 } from '@savant-code/common/util/hash'

export const artifactSchema = z.object({
  taskId: z.string(),
  answer: z.string().min(20),
  citations: z
    .array(
      z.object({
        path: z.string(),
        line: z.number().int().positive(),
        quote: z.string().min(8),
      }),
    )
    .min(2),
  usedHandoffs: z.array(
    z.object({
      taskId: z.string(),
      digest: z.string(),
      finding: z.string().min(10),
    }),
  ),
})

export type Artifact = z.infer<typeof artifactSchema>
export type ScheduleMode = 'batch' | 'completion'
export interface Assignment {
  id: string
  question: string
  files: string[]
  dependsOn: string[]
}
export interface Handoff {
  taskId: string
  digest: string
  artifact: Artifact
}
export interface TaskResult {
  assignment: Assignment
  artifact: Artifact
  startedAt: number
  completedAt: number
  readPaths: string[]
  toolCalls: string[]
}
export type RunBatch = (
  assignments: Assignment[],
  handoffs: Record<string, Handoff[]>,
  signal: AbortSignal,
) => Promise<TaskResult[]>

export function handoffOf(artifact: Artifact): Handoff {
  return {
    taskId: artifact.taskId,
    digest: sha256(JSON.stringify(artifact)),
    artifact,
  }
}
