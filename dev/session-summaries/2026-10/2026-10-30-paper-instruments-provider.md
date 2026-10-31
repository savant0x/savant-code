# Session — Paper Instruments (Ultramarine) provider

**Date:** 2026-10-30
**FID:** FID-2026-1030-005 (closed, archived)
**Implementation:** `42b1a2c9`

## What was asked

Evaluate `https://docs.paperinstruments.com/docs` as a new built-in provider,
determine whether it can be called, and only then add it. The operator then
added `PAPERINSTRUMENTS_API_KEY` to `.env.local` and challenged an assumed
100k context window: "setting a model to 100k will kill this model especially if
it's as verbose as stated."

## What was measured

With the operator key, on 2026-10-30:

- `GET /v1/models` -> 200, one row (`ultramarine-1-flash`), fields
  `id`/`object`/`created`/`owned_by` only. No window field.
- `GET /v1/models/ultramarine-1-flash` -> 200, same three fields.
- `GET /v1/usage` -> 200, `billing_status: "none"`,
  `available_nanodollars: 0`, limits 60 rpm / 4M tpm.
- `POST /v1/chat/completions` (`max_completion_tokens: 16`) ->
  `429 insufficient_quota`, `x-should-retry: false`, "can cost up to
  $0.000218".

Window research, in precedence order:

1. `feather-harness/docs/evaluation.md` (vendor repo): "This 131K harness
   budget deliberately compacts earlier than the public deployment's
   262,144-token total window."
2. Ultramarine blog: training context 131,072; PI Knowledge Work evaluation
   harness at 262,144.
3. `zai-org/GLM-5.3-Flash` `config.json`: `max_position_embeddings: 1048576`
   (architecture ceiling, not the served limit).
4. Aggregator "1.3M" figures: no primary source, rejected.

## What shipped

Static single-row catalog (`paperinstruments/ultramarine-1-flash`), window
262,144 in the fallback table, `table-section` coverage with the provenance in
the register note, picker builder wired in the same change as the registry
entry, generated + hand-maintained docs synced, two new suites and three
extended suites.

Static was chosen over a live leg because the catalog publishes no window field
(so a fetch adds nothing) and because static builders never enter the positional
`restResults` ladder in `gateway-live-results.ts`.

## Gates

All exit 0: common provider suites (123 tests), CLI catalog/window/setup suites
(5 + 5 + 27), SDK routing suite (2), `providers:parity` (3,987 rows,
`paperinstruments: 1`), `generate:provider-docs:check`, typecheck across all 14
workspaces plus scripts, eslint, markdownlint, prettier, `validate:repository`,
and the stamped FID receipt (11 gates).

## Open

Inference acceptance is unobserved: the account balance is zero and the vendor
returns a terminal quota error rather than an auth or routing error. Tracked as
OBS-003 in `dev/tracking/internal-followups.json`. A funded run should record
the status, `finish_reason`, whether `delta.reasoning_content` arrives, and how
the model behaves under Savant's system prompt — the vendor warns that prompts
tuned for other models overdeliver into verbosity.
