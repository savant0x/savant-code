import type { ToolName } from '@savant-code/common/tools/constants'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { z } from 'zod/v4'

export type CustomToolDefinition<
  N extends string = string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance (W3-3): `Args` is inferred through `z.ZodType<Args, Input>` and then consumed contravariantly by `execute: (params: Args)`; a `unknown` constraint/default would make every definition require an explicit annotation at the call site instead of inferring from `inputSchema`.
  Args extends any = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance (W3-3): `Input` is the schema's pre-parse type, inferred from the caller's `z.ZodType<Args, Input>` argument; `unknown` would erase that inference for the same reason as `Args` above.
  Input extends any = any,
> = {
  toolName: N
  inputSchema: z.ZodType<Args, Input>
  description: string
  endsAgentStep: boolean
  exampleInputs: Input[]
  execute: (params: Args) => Promise<ToolResultOutput[]>
}

/**
 * Creates a CustomToolDefinition object
 *
 * @param toolName the name of the tool
 * @param inputSchema a Zod4 schema describing the input of the tool.
 * @param description a description of the tool to be passed to the LLM. This should describe what the tool does and when to use it.
 * @param endsAgentStep whether the tool ends the agent step. If `true`, this will be used as a "stop sequence" for the LLM. i.e. it will not be able to call any other tools after this one in a single step and must wait for the tool results. Used for tools that give more information to the LLM.
 * @param exampleInputs an array of example inputs for the tool.
 * @param execute what to do when the tool is called. Can be either a sync or async. Must return an array of {@linkcode ToolResultOutput}
 * @returns a {@linkcode CustomToolDefinition} object
 */
export function getCustomToolDefinition<
  TN extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance (W3-3): the factory's `Args` is inferred from the `inputSchema` argument and flows contravariantly into `execute(params: Args)` and `exampleInputs`; see CustomToolDefinition above.
  Args extends any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance (W3-3): the factory's `Input` is inferred from `z.ZodType<Args, Input>`; see CustomToolDefinition above.
  Input extends any,
>({
  toolName,
  inputSchema,
  description,
  endsAgentStep = true,
  exampleInputs = [],
  execute,
}: {
  toolName: TN extends ToolName
    ? TN & {
        error: `Hi there. This is a message from the SavantCode team: You have used a custom tool where you needed to use overrideTools instead for name: ${TN}`
      }
    : TN
  inputSchema: z.ZodType<Args, Input>
  description: string
  endsAgentStep?: boolean
  exampleInputs?: Input[]
  execute: (params: Args) => Promise<ToolResultOutput[]> | ToolResultOutput[]
}): CustomToolDefinition<TN, Args, Input> {
  return {
    toolName,
    inputSchema,
    description,
    endsAgentStep,
    exampleInputs,
    execute: async (params) => {
      return await execute(params)
    },
  }
}
