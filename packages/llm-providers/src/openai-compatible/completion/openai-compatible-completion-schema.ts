import { z } from 'zod/v4'

const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const openaiCompatibleCompletionResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      text: z.string(),
      finish_reason: z.string(),
    }),
  ),
  usage: usageSchema.nullish(),
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const createOpenAICompatibleCompletionChunkSchema = <
  ERROR_SCHEMA extends z.core.$ZodType,
>(
  errorSchema: ERROR_SCHEMA,
) =>
  z.union([
    z.object({
      id: z.string().nullish(),
      created: z.number().nullish(),
      model: z.string().nullish(),
      choices: z.array(
        z.object({
          text: z.string(),
          finish_reason: z.string().nullish(),
          index: z.number(),
        }),
      ),
      usage: usageSchema.nullish(),
    }),
    errorSchema,
  ])
