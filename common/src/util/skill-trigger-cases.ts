import { createHash } from 'node:crypto'

import { z } from 'zod'

/** Shared trigger-case contract for the eval runner and operator trust gate. */

export function descriptionSha256(description: string): string {
  return createHash('sha256').update(description).digest('hex')
}

export const positiveCaseSchema = z.object({
  prompt: z.string().min(1),
  topK: z.number().int().min(1).default(3),
})

export const negativeCaseSchema = z.object({
  prompt: z.string().min(1),
  owner: z.string().min(1).optional(),
})

export const behavioralCaseSchema = z
  .object({
    id: z.string().min(1),
    taskId: z.string().min(1),
    kind: z.enum(['execution', 'dialogue']).default('execution'),
    prompt: z.string().min(1),
    expectedOutput: z.string().min(1),
    files: z.array(z.string().min(1)).default([]),
    expectations: z.array(z.string().min(1)).min(1),
    pressure: z.enum(['time', 'sunk-cost', 'authority']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'execution' && value.files.length === 0)
      ctx.addIssue({
        code: 'custom',
        message: 'execution eval requires fixture files',
        path: ['files'],
      })
  })

export const skillCaseSchema = z
  .object({
    skillName: z.string().min(1),
    descriptionSha256: z.string().length(64).optional(),
    trigger: z.object({
      positive: z.array(positiveCaseSchema).min(3),
      negative: z.array(negativeCaseSchema).min(2),
    }),
    behavioral: z.array(behavioralCaseSchema).default([]),
  })
  .superRefine((value, ctx) => {
    for (const negative of value.trigger.negative) {
      if (negative.owner === value.skillName) {
        ctx.addIssue({
          code: 'custom',
          message: `negative owner '${negative.owner}' equals skillName`,
          path: ['trigger', 'negative'],
        })
      }
    }
  })

export type PositiveCase = z.infer<typeof positiveCaseSchema>
export type NegativeCase = z.infer<typeof negativeCaseSchema>
export type SkillCase = z.infer<typeof skillCaseSchema>
export type BehavioralCase = z.infer<typeof behavioralCaseSchema>
