import type { JSONObject } from '@savant-code/common/types/json'

function createSseTransformStream(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let buffer = ''
  let responseId: string | null = null
  let responseModel: string | null = null
  let nextToolCallIndex = 0
  const outputIndexToToolIndex = new Map<number, number>()
  let emittedRole = false

  function emit(
    controller: TransformStreamDefaultController<Uint8Array>,
    chunk: JSONObject,
  ) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
  }

  function processEvent(
    controller: TransformStreamDefaultController<Uint8Array>,
    data: JSONObject,
  ) {
    const type = data.type as string | undefined
    if (!type) return

    switch (type) {
      case 'response.created': {
        const resp = data.response as JSONObject | undefined
        responseId = (resp?.id as string) ?? null
        responseModel = (resp?.model as string) ?? null
        if (!emittedRole) {
          emit(controller, {
            id: responseId,
            model: responseModel,
            choices: [
              { index: 0, delta: { role: 'assistant' }, finish_reason: null },
            ],
          })
          emittedRole = true
        }
        break
      }

      case 'response.output_text.delta': {
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: { content: data.delta as string },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.reasoning_summary_text.delta': {
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: { reasoning_content: data.delta as string },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.output_item.added': {
        const item = data.item as JSONObject | undefined
        if (item?.type === 'function_call') {
          const tcIndex = nextToolCallIndex++
          const outputIdx = (data.output_index as number) ?? 0
          outputIndexToToolIndex.set(outputIdx, tcIndex)
          emit(controller, {
            id: responseId,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: tcIndex,
                      id: (item.call_id as string) ?? (item.id as string),
                      function: {
                        name: item.name as string,
                        arguments: '',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          })
        }
        break
      }

      case 'response.function_call_arguments.delta': {
        const outputIdx = (data.output_index as number) ?? 0
        const tcIdx = outputIndexToToolIndex.get(outputIdx) ?? 0
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: tcIdx,
                    function: { arguments: data.delta as string },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.completed':
      case 'response.done': {
        const resp = data.response as JSONObject | undefined
        const usage = resp?.usage as JSONObject | undefined
        const status = resp?.status as string | undefined

        let finishReason = 'stop'
        if (status === 'incomplete') {
          finishReason = 'length'
        } else if (nextToolCallIndex > 0) {
          finishReason = 'tool_calls'
        }

        const chunk: JSONObject = {
          id: responseId,
          choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
        }

        if (usage) {
          const outputDetails = usage.output_tokens_details as
            JSONObject | undefined
          chunk.usage = {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
            ...(outputDetails?.reasoning_tokens != null && {
              completion_tokens_details: {
                reasoning_tokens: outputDetails.reasoning_tokens,
              },
            }),
          }
        }

        emit(controller, chunk)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        break
      }

      case 'response.failed': {
        const resp = data.response as JSONObject | undefined
        const errorObj = (resp?.error ?? data.error) as JSONObject | undefined
        emit(controller, {
          error: {
            message:
              (errorObj?.message as string) ?? 'ChatGPT backend request failed',
            type: (errorObj?.type as string) ?? 'server_error',
          },
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        break
      }

      case 'error': {
        const errorObj = (data.error ?? data) as JSONObject
        emit(controller, {
          error: {
            message:
              (errorObj.message as string) ??
              'Unknown error from ChatGPT backend',
            type: (errorObj.type as string) ?? 'server_error',
          },
        })
        break
      }

      // Skip all other events silently (content_part.added, output_text.done, etc.)
    }
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          continue
        }

        try {
          const parsed = JSON.parse(jsonStr) as JSONObject
          processEvent(controller, parsed)
        } catch {
          // Skip unparseable lines
        }
      }
    },

    flush(controller) {
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6).trim()
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr) as JSONObject
            processEvent(controller, parsed)
          } catch {
            // skip
          }
        }
      }
    },
  })
}

export function transformResponseStream(
  inputStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const transform = createSseTransformStream()
  // FID-2026-0803-003 SDK-5: don't unconditionally swallow the upstream stream
  // error. The pipe already rejects (and by spec aborts the transform), but
  // explicitly cancel the readable with the error so consumers fail loudly
  // instead of hanging on a half-closed stream.
  inputStream.pipeTo(transform.writable).catch((error: unknown) => {
    void transform.readable.cancel(error).catch(() => {})
  })
  return transform.readable
}
