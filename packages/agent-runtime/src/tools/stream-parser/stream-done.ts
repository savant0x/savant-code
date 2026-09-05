/**
 * Holds the `streamDonePromise` / `previousToolCallFinished` chain
 * (FID-2026-0819-005 Loop 299: extracted verbatim in behavior from
 * `tools/stream-parser.ts`'s mutable-state block).
 *
 * - `previous` is the current tail of the sequential tool-execution chain.
 * - `isFirstCall()` reports whether the tail still points at the
 *   stream-done promise (used by XML mode: the first tool call must not
 *   wait for the stream to complete).
 * - `set(p)` advances the tail; `resolve()` settles the stream-done
 *   promise (idempotent via Promise.withResolvers semantics).
 */
export type StreamDoneHolder = {
  readonly promise: Promise<void>
  readonly previous: Promise<void>
  isFirstCall: () => boolean
  set: (p: Promise<void>) => void
  resolve: () => void
}

export function createStreamDoneHolder(): StreamDoneHolder {
  const { promise: streamDonePromise, resolve: resolveStreamDonePromise } =
    Promise.withResolvers<void>()
  let previousToolCallFinished: Promise<void> = streamDonePromise
  return {
    promise: streamDonePromise,
    get previous() {
      return previousToolCallFinished
    },
    isFirstCall: () => previousToolCallFinished === streamDonePromise,
    set: (p: Promise<void>) => {
      previousToolCallFinished = p
    },
    resolve: resolveStreamDonePromise,
  }
}
