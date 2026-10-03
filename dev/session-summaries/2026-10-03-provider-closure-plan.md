# Provider and model-picker closure plan — 2026-10-03

The operator requested project-wide CHANGELOG, README, and model-information
updates and closure if completed. The implementation and documentation are
verified in the working tree. No index changes or commits have been made.
ECHO G2 requires committed implementation hashes before closure and archival.

## Verified changes

CodeCraft API and xKiro have registry setup, live catalogs, exact-ID routing,
cache/reset/fanout wiring, and additive tests. CleanAPIs normalization is
completed. Model information exposes reported capabilities, tiers, and
reasoning efforts; CLI and runtime fallbacks describe missing metadata
without implying OpenRouter-only discovery. The model picker uses fixed
one-line rows with native keyboard, wheel, scrollbar, filter, and resize tests.

All 23 provider gates, full root typecheck, zero-warning ESLint, Markdown
lint, generated-reference check, changed-source formatting, and scope probes
pass. Fresh scroll gate results are recorded in the scoped scratchpad.

## Proposed local commits

1. `feat(providers): add CodeCraft and xKiro live catalogs (FID-2026-1003-001)`
2. `fix(cli): keep model picker scroll rows one line tall (FID-2026-1003-004)`
3. After hashes exist, record them in the two FID Resolution sections, close
   and archive completed records, reconcile CHANGELOG and session summaries,
   and remove completed register items while retaining any live blockers.

The source commits are separate logical changes. Shared documentation uses
selective staging to keep each entry with the implementation it describes.

## Provider source and test paths

- `common/src/providers/registry-partitioned-2.ts`
- `common/src/providers/types.ts`
- `common/src/providers/validate.ts`
- `common/src/providers/provider-exception-manifest.ts`
- `common/src/providers/__tests__/provider-registry.test.ts`
- `common/src/providers/__tests__/provider-protocol-patterns.test.ts`
- `common/src/constants/model-config.ts`
- `common/src/constants/model-config/providers.ts`
- `common/src/constants/model-config/provider-protocols.ts`
- `sdk/src/impl/model-provider/model-factories.ts`
- `sdk/src/impl/__tests__/model-provider-codecraft-xkiro.test.ts`
- `cli/src/utils/openrouter-models/catalog-values.ts`
- `cli/src/utils/openrouter-models/chat-catalog.ts`
- `cli/src/utils/openrouter-models/codecraft.ts`
- `cli/src/utils/openrouter-models/cleanapis.ts`
- `cli/src/utils/openrouter-models/xkiro.ts`
- `cli/src/utils/openrouter-models/types.ts`
- `cli/src/utils/openrouter-models/model-info.ts`
- `cli/src/utils/openrouter-models/gateway-live-results.ts`
- `cli/src/utils/__tests__/openrouter-models-codecraft-xkiro.test.ts`
- `cli/src/utils/__tests__/provider-setup-codecraft-xkiro.test.ts`
- `packages/agent-runtime/src/templates/placeholder-injectors.ts`

Select only provider imports/fanout/destructuring/merge/cache-reset changes in
`cli/src/utils/openrouter-models/gateway.ts`. Its request-budget import and
`modelRequestLimits.replaceCatalog` calls belong to the existing budget change.
Provider integration does not require the lookup/model-fields budget changes.

## Scroll source and test paths

- `cli/src/components/model-picker-rows.tsx`
- `cli/src/components/__tests__/model-picker-scroll.test.tsx`

## Documentation and evidence paths

Provider documentation: `.env.example`, `README.md`, `README.zh-CN.md`,
`cli/release/README.md`, `cli/README.md`, `sdk/README.md`, `common/README.md`,
`packages/llm-providers/README.md`, `docs/providers.md`, `docs/index.md`,
`docs/features.md`, `docs/installation.md`, `docs/sdk-overview.md`, and
`docs/archive/design/Adding New Providers.md`.

Record the matching active FID and session summary with each source commit.
`CHANGELOG.md` and `SCOPE.md` require selective staging: the working tree also
contains other active changes. Stage only the two current provider/scroll
entries and their targets, preserving the other tasks' edits. Provider and
scroll README sentences can likewise be separated when staging.

The public environment example contains blank key slots. Keep private
`.env.local`, raw catalogs, smoke logs, and `old-chat.txt` outside these commits.
Review the staged credential scan and exact staged diff before any commit.

## External boundaries

Live tool calls passed for all three services and both xKiro transports.
Mapped Claude Haiku returned HTTP 403 requiring paid account access; the
free-model Messages test was an explicit override. Account entitlement has
not been established. A possible fourth provider still needs its name or URL.
Closing the verified implementation must retain those pending boundaries
explicitly rather than claim successful Claude inference or a fourth addition.
No remote push, publish, or account purchase is included in this plan.
