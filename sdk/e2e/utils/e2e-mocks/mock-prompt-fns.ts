// FID-2026-0819-005 Loop 273: the three mock prompt fns (stream, blocking,
// structured), extracted verbatim from e2e-mocks.ts. Behavior synthesis is
// delegated to the pure helpers in ./mock-behavior.
import { promptSuccess } from '@savant-code/common/util/error'

import {
  buildMockResponseText,
  buildMockToolCall,
  getAllText,
  getLatestUserText,
  getPromptText,
  splitTextIntoChunks,
} from './mock-behavior'

import type {
  PromptAiSdkFn,
  PromptAiSdkStreamFn,
  PromptAiSdkStructuredInput,
} from '@savant-code/common/types/contracts/llm'
import type { ParamsOf } from '@savant-code/common/types/function-params'

export async function* promptAiSdkStreamMock(
  params: ParamsOf<PromptAiSdkStreamFn>,
): ReturnType<PromptAiSdkStreamFn> {
  const agentChunkMetadata =
    params.agentId != null ? { agentId: params.agentId } : undefined

  const latestUserText = getLatestUserText(params.messages)
  const allText = getAllText(params.messages)
  const promptText = getPromptText(latestUserText, allText)
  const hasToolResult = params.messages.some(
    (message) => message.role === 'tool',
  )

  const toolCall = buildMockToolCall({
    tools: params.tools as Record<string, unknown> | undefined,
    latestUserText: promptText,
    hasToolResult,
  })

  const responseText = buildMockResponseText({
    latestUserText: promptText,
    allText,
    toolName: toolCall?.toolName,
  })

  if (toolCall) {
    yield {
      type: 'tool-call',
      toolCallId: `mock-tool-${Math.random().toString(36).slice(2, 10)}`,
      toolName: toolCall.toolName,
      input: toolCall.input,
    }
  }

  for (const chunk of splitTextIntoChunks(responseText)) {
    yield {
      type: 'text',
      text: chunk,
      ...(agentChunkMetadata ?? {}),
    }
  }

  if (params.onCostCalculated) {
    await params.onCostCalculated(0)
  }

  return promptSuccess(
    `mock-message-${Math.random().toString(36).slice(2, 10)}`,
  )
}

export async function promptAiSdkMock(
  params: ParamsOf<PromptAiSdkFn>,
): ReturnType<PromptAiSdkFn> {
  const latestUserText = getLatestUserText(params.messages)
  const allText = getAllText(params.messages)
  const promptText = getPromptText(latestUserText, allText)
  const responseText = buildMockResponseText({
    latestUserText: promptText,
    allText,
  })

  if (params.onCostCalculated) {
    await params.onCostCalculated(0)
  }

  if (params.n && params.n > 1) {
    return promptSuccess(
      JSON.stringify(Array.from({ length: params.n }, () => responseText)),
    )
  }

  return promptSuccess(responseText)
}

export async function promptAiSdkStructuredMock<T>(
  params: PromptAiSdkStructuredInput<T>,
): Promise<T> {
  const parsed = params.schema.safeParse({})
  if (params.onCostCalculated) {
    await params.onCostCalculated(0)
  }
  return parsed.success ? parsed.data : ({} as T)
}
