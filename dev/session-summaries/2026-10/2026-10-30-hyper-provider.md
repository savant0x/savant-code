# 2026-10-30 — Hyper (Charm) built-in provider (FID-2026-1030-004)

## Intake

The operator supplied `https://hyper.charm.land/docs/` as the provider they
wanted. Reading turned into the full runbook path from
`docs/adding-a-provider.md`: the vendor contract, a live catalog probe, one
registry entry, one live-catalog wrapper, the fan-out/ladder/merge wiring, the
exception manifest, window coverage, pinned tests and the documentation
surfaces. Complex task → FID first, converged before code, then implementation.

## Evidence gathered before editing

- `https://hyper.charm.land/docs/` — base `https://hyper.charm.land/v1`, env var
  `HYPER_API_KEY`, OpenAI-compatible `/v1/chat/completions`.
- `.../docs/api/list-models.html` — `/v1/models`, no authentication, rows carry
  `display_name`, `context_window`, `max_output_tokens`, `capabilities`,
  `reasoning`, `pricing`.
- `.../docs/api/authentication.html` — `Authorization: Bearer`; `/v1/messages`
  also accepts `X-Api-Key`.
- Live probe 2026-10-30, keyless: HTTP 200, 23 coding rows, all publishing a
  positive `context_window`. Catalog reachability measured; inference
  reachability deliberately not claimed.

## Implementation (commit `90768081`)

- `common/src/providers/registry-partitioned-5.ts:193-212` — the `hyper` entry.
- `cli/src/utils/openrouter-models/hyper.ts` — dedicated parser (bare ids,
  `display_name`, per-million pricing, `effort_levels`) over
  `createLiveCatalogFetcher`; no resolver because the catalog is public.
- `gateway-live-results.ts:107/:70/:140/:231`, `gateway-catalog-merge.ts:71`,
  `gateway.ts:33/:127/:264` — fan-out, positional slot 19, merge order, reset.
- `provider-exception-manifest.ts:30-45` — `live-catalog` owner/evidence.
- `window-coverage-register.ts:314-323` — `runtime-published` with the probe
  counts (no fallback table owed).
- Pinned lists: registry keys, setup keys (fifty → fifty-one), order-4 family,
  the four positional ladder tests (custom tail moved 19 → 20).
- New suites: `cli/.../__tests__/hyper-catalog.test.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode-hyper.test.ts` (the SDK lane
  was split out of the 400-line parent file rather than growing it).
- Docs: `generate:provider-docs` (generated surfaces) plus hand edits in
  `README.md`, `README.zh-CN.md`, `cli/release/README.md`, `docs/index.md`,
  `docs/sdk-overview.md`, `docs/installation.md`, `docs/features.md`,
  `docs/providers.md`.

## Gates (all exit 0)

- `cd common && bun test src/providers/__tests__/` — 122 pass
- `cd cli && bun test src/utils/openrouter-models/__tests__/ src/utils/__tests__/provider-setup.test.ts` — 205 pass
- `cd sdk && bun test ...hyper + parent suite` — 17 pass
- `generate:provider-docs:check`, `validate:repository`, `typecheck`,
  `lint:md`, eslint on the touched trees, `prettier --check .`

## Closure

FID verified (`fid:verify --write`), then closed and archived; CHANGELOG entry
added; SCOPE.md item and machine-readable grant released; the write grant text
now records the closure. The unobserved piece — an authenticated vendor
completion — is OBS-002 in `dev/tracking/internal-followups.json`; code closure
does not assert it.

## Notes for the next session

- Hyper publishes `/v1/responses` and `/v1/messages` pass-throughs for the same
  roster. Savant routes everything through chat/completions today; a future
  change that needs Responses or Messages per model would be a real protocol-map
  change, not a config tweak.
- The vendor's 402 is `billing_error` (insufficient Hypercredits). Treat it as
  an entitlement observation when OBS-002 is run, not as a routing defect.
