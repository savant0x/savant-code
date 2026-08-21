import { z } from 'zod/v4'

export const openaiCompatibleTokenUsageSchema = z
  .object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish(),
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish(),
        accepted_prediction_tokens: z.number().nullish(),
        rejected_prediction_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .nullish()

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const OpenAICompatibleChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant').nullish(),
        content: z.string().nullish(),
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiCompatibleTokenUsageSchema,
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const createOpenAICompatibleChatChunkSchema = <
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
          delta: z
            .object({
              role: z.enum(['assistant']).nullish(),
              content: z.string().nullish(),
              // Most openai-compatible models set `reasoning_content`, but some
              // providers serving `gpt-oss` set `reasoning`. See #7866
              reasoning_content: z.string().nullish(),
              reasoning: z.string().nullish(),
              tool_calls: z
                .array(
                  z.object({
                    index: z.number(),
                    id: z.string().nullish(),
                    function: z.object({
                      name: z.string().nullish(),
                      arguments: z.string().nullish(),
                    }),
                  }),
                )
                .nullish(),
            })
            .nullish(),
          finish_reason: z.string().nullish(),
        }),
      ),
      usage: openaiCompatibleTokenUsageSchema,
    }),
    errorSchema,
  ])
