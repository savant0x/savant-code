# Request token budgets

Savant enforces known token limits immediately before SDK-backed model
dispatch. The shared wrapper in `sdk/src/impl/model-provider/request-budget.ts`
covers streaming, text generation, structured generation, subsequent SDK steps,
and subagents. It counts the final SDK prompt after message/tool conversion.

For a known or explicitly requested output ceiling, the allowance is:

```text
min(caller ceiling, model output cap, context window - estimated input - reserve)
reserve = min(4096, ceil(context window * 0.01))
```

Absent ceilings are excluded from the minimum. If neither a caller nor the
catalog supplies an output cap, Savant leaves it omitted and the provider's
default governs. Guessing an output capability from a context-window fraction
can violate a separate output-only limit. A known model cap becomes an explicit
ceiling even when a child using another model receives no parent output cap.

The input estimate includes system/user/assistant content, reasoning, tool
arguments/results, function and provider-tool definitions, and structured
response instructions. Text uses the existing conservative token counter.
Images/files/media use the existing 1,600-token estimate; large documents and
provider-specific tokenizers can still differ. The guard rejects exhausted input
locally with `context_length_exceeded`, which reaches existing reactive
compaction. Lowering a large output reservation keeps the prompt intact.

## Serving limits and routing

Fresh and disk-warmed CLI catalogs publish exact model limits into the shared
`ModelRequestLimitsStore`. Budgets accept positive safe integers only. Direct
gateway limits bound broader upstream capabilities. Output lookup excludes
family/name guesses. OpenRouter catalog IDs have a serving namespace so an
upstream `openai/gpt-5` row cannot overwrite direct OpenAI's limit. Bare-slug
active providers select their own namespace; OAuth is isolated from API routes.

Without catalog metadata, SDK callers can supply `contextWindow`. Otherwise
the existing exact fallback table applies, with its documented 200,000-token
default when unresolved. The guard also bounds recognized output overrides
in provider options, including OpenAI's `maxCompletionTokens`.

An explicit token-limit rejection can correct stale metadata. Savant remembers
the smaller window/cap for that model and serving endpoint in a bounded
process-local cache; catalog refresh cannot enlarge a learned limit. Endpoint
identity is hashed and credentials/prompt content are never logged by this
guard. Reported input usage applies only to the rejected prompt.

The guard retries an initial rejected dispatch once, only if its corrected
output allowance is smaller. It never retries after a stream has been returned.
An exhausted corrected input budget goes through compaction instead. Unknown
errors, aborts, and unhelpful corrections propagate normally.

## Boundaries and evidence

Known budgets are enforced against an estimate, rather than an exact remote
tokenizer. Missing/stale serving metadata and provider-selected defaults can
still cause rejection. The ChatGPT OAuth transport deliberately omits output
parameters unsupported by that service; its existing conversion remains intact,
so this route retains input protection without a wire-level output guarantee.

The recorded failure requested 112,977 input + 943,717 output against a
1,048,576 combined limit. The policy now allows 931,503 output, leaving 4,096
tokens of reserve. Tests cover this arithmetic, final prompts/tools, invalid
budgets, route isolation, one rejection correction, and no replay after stream
delivery. Offline transport tests inspect actual HTTP bodies through all three
SDK entry points and a child-model route. See `FID-2026-1002-003` for gate receipts.
