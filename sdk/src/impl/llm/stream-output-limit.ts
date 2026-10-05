// FID-2026-1005-001: output-limit tracking for `promptAiSdkStream`,
// extracted so stream.ts stays under the 300-line quality ceiling (the
// same split that produced stream-error-chunk.ts). A provider `finish`
// reason of 'length' on a TEXT-ONLY stream means the response was cut by
// the max-output-token cap — the runtime must see that as an explicit
// error, never as a complete verdict. Tool-call cuts already fail closed
// via the native-incomplete machinery (FID-2026-0909-008), so once any
// tool-call part was seen, the text-fragment error must not double-fire.

/** The structural slice of a fullStream part this tracker inspects. */
type StreamPartLike = {
  type: string
  finishReason?: unknown
}

export function createOutputLimitTracker() {
  let finishReason: string | undefined = undefined
  let sawToolCall = false
  return {
    /**
     * Record the facts a part carries. Returns `'skip'` once BOTH terminal
     * facts are known (nothing later in the stream can change them), so the
     * generator can early-continue without re-inspecting every part.
     */
    observe(part: StreamPartLike): 'skip' | 'ok' {
      if (part.type === 'finish' && typeof part.finishReason === 'string') {
        finishReason = part.finishReason
      }
      if (part.type === 'tool-call') sawToolCall = true
      return finishReason !== undefined && sawToolCall ? 'skip' : 'ok'
    },
    /** True when the stream ended as a length-cut text-only response. */
    requiresExplicitError(): boolean {
      return finishReason === 'length' && !sawToolCall
    },
    /** The agent-facing message for an output-limit cut. */
    errorMessage(): string {
      return (
        'Output limit reached: the model response was cut off by the ' +
        'max-output-token cap before it completed. The text above is a ' +
        'partial fragment, not a complete answer.'
      )
    },
  }
}
