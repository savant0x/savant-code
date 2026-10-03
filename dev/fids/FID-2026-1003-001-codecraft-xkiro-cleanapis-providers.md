# FID: Add CodeCraft API, xKiro, and complete CleanAPIs support

**Filename:** `FID-2026-1003-001-codecraft-xkiro-cleanapis-providers.md`
**ID:** FID-2026-1003-001
**Severity:** medium
**Status:** verified
**Created:** 2026-10-03 00:42
**Automation level:** 3
**YAGNI-Compliance:** Verified: shared parsing serves two measured identical schemas;
prefix-map dispatch is required by xKiro's live catalog and the operator's multi choice.

---

## Summary

Register CodeCraft API and xKiro as built-in providers with live catalogs,
credential setup in `/provider`, exact model-ID routing, and generated
references. Include CleanAPIs by validating and correcting its existing
integration. Preserve the previous conversation's explicit xKiro
multi-protocol-map choice. The operator's resume authorizes implementation
of this converged plan, followed by verification and bounded live acceptance.
Scope item: T119.

The requested provider scope contains **three confirmed services: CodeCraft
API, xKiro, and CleanAPIs**. CleanAPIs counts toward this scope despite its
existing registration. The operator recalls possibly a fourth provider;
all user messages in the root transcript were rechecked, and only CodeCraft
and xKiro were named there. A fourth name or URL is awaiting clarification
and will be incorporated into this same plan when supplied.

## Environment

- **OS:** Windows; PowerShell in `C:\Users\spenc\dev\savant-code`.
- **Language/Runtime:** TypeScript monorepo; Bun 1.3.14.
- **Tool Versions:** Repository provider registry, SDK factories, CLI catalog
  wrappers, FID ledger, scope checks, and Markdown lint.
- **Commit/State:** Existing working tree contains substantial unrelated
  changes. This integration preserves them and does not commit or push.
- **Governance:** Single-agent ECHO, read through EOF before planning.

## Detailed Description

### Problem

CodeCraft API and xKiro are absent from the built-in registry. CleanAPIs is
already registered, but its parser needs comparison against the current
documented and authenticated catalog schema. Provider setup alone is
insufficient: catalog discovery, persisted selection, credentials, SDK
dispatch, wire model IDs, and generated references must agree.

### Operator decisions and intake

The root transcript is `old-chat.txt`; no `old-chat.md` was present. Its
entire contents were read. Retained decisions from `old-chat.txt:7311-7318`:

- CodeCraft catalog: **Live catalog**.
- xKiro protocol: **multi (protocol map)**.
- Credentials: the operator will supply keys; both belong in `/provider`.

The transcript also requests blank local key entries at
`old-chat.txt:9831` and `old-chat.txt:10010`. The current operator repeated
that instruction and added CleanAPIs via its dashboard URL. Preserve the
existing `CLEANAPIS_API_KEY` entry and value; add only missing empty
`CODECRAFT_API_KEY=` and `XKIRO_API_KEY=` entries. Empty placeholders must
retain normal missing-key behavior. Catalog wrappers resolve environment
credentials rather than opening `.env.local` themselves.

### Expected Behavior

| Provider | Registry ID | Credential | API root | Catalog | Routing |
|---|---|---|---|---|---|
| CodeCraft API | `codecraft` | `CODECRAFT_API_KEY` | `https://codecraftapi.com/v1` | Authenticated live `/models` | OpenAI chat |
| xKiro | `xkiro` | `XKIRO_API_KEY` | `https://api.xkiro.com/v1` | Public live `/models` | Explicit multi-protocol map |
| Clean APIs | `cleanapis` (existing) | `CLEANAPIS_API_KEY` | `https://cleanapis.com/v1` | Authenticated live `/models` | Existing OpenAI chat |

All three appear in provider setup and use the existing key persistence,
environment precedence, readiness guidance, ordering, and model selection.
Prepend one internal provider namespace to the exact upstream catalog ID;
strip exactly that namespace before transmission. Preserve xKiro's upstream
`vendor/model` component, including nested slashes. A failed catalog must
not corrupt another provider's results or imply successful inference.

### Root Cause

At intake, the two requested additions had not been implemented. Existing live
catalogs require explicit CLI fanout and exception-manifest registration
beyond registry derivation. CleanAPIs' wrapper maps an older OpenRouter-like
price/architecture shape; current documentation publishes a different
shape. The authenticated follow-up below resolves that initial concern:
both price schemas exist on the wire, but capability and creation metadata
still required normalization.

### Evidence

- `common/src/providers/registry-partitioned-2.ts:81`: existing `cleanapis`
  entry uses `CLEANAPIS_API_KEY`, live catalog, `setupAvailable: true`, and
  `idTransform: 'strip'`. Registry search for `codecraft|xkiro` found no
  entries during intake.
- `cli/src/utils/openrouter-models/cleanapis.ts:122-145`: current mapping
  accepts context aliases, reads `pricing.prompt` / `pricing.completion`,
  nested `architecture`, and a string `created` value. It does not map the
  documented per-1,000-token prices or top-level capability array.
- `common/src/providers/provider-exception-manifest.ts:112`: CleanAPIs already
  owns a `live-catalog` exception. New live wrappers and xKiro map dispatch
  need their own explicit manifest evidence.
- `cli/src/utils/openrouter-models/gateway.ts:142-155`: live sources use
  `Promise.allSettled`; CleanAPIs is fetched at line 152 and reset at 231.
  `gateway-live-results.ts` assigns positional results, so additions must
  update fanout, extraction, merge, and resets together.
- `sdk/src/impl/model-provider/model-factories.ts:245-255`: protocol maps
  look up full prefixed IDs and throw for unknown models. A growing live
  xKiro catalog needs a deliberate coverage policy before convergence.

Fresh keyless GET probes on 2026-10-03:

| Endpoint | Actual result | Interpretation |
|---|---|---|
| `https://codecraftapi.com/v1/models` | HTTP 401; `missing_api_key` | Auth boundary observed; no live catalog captured |
| `https://api.xkiro.com/v1/models` | HTTP 200; 129 rows, all `modality: chat` | Live public catalog captured; no inference or account entitlement proved |
| `https://cleanapis.com/v1/models` | HTTP 401; `missing_api_key` | Auth boundary observed; no live catalog captured |

The public dashboard fetch resolves to a login page. Its URL identifies
the requested service; it is not the inference base URL.

Authenticated catalog follow-up, 2026-10-03 00:53 local: the operator filled
the keys and requested endpoint pings and model lists. Direct Bearer-key
GETs returned 200 for all three: CodeCraft **33**, xKiro **129**, CleanAPIs
**33**. JSON parsing confirmed unique, nonempty IDs. Raw snapshots and the
complete ID lists are in `dev/scratchpad/active/provider-catalogs-2026-10-03/`
(`codecraft.json`, `xkiro.json`, `cleanapis.json`, and `README.md` with hashes).
No supplied key occurs in the saved responses; these catalog probes made no
inference calls. Subsequent inference results are recorded below.
xKiro's public catalog does not validate its key or establish model access.

**Correction to the documentation-only pricing concern:** CodeCraft and
CleanAPIs both return `pricing.prompt` / `pricing.completion` per-token
strings alongside per-1,000-token aliases; every alias pair agrees. Thus
CleanAPIs' existing price mapping is supported by the current wire response.
Both expose the same 33 IDs, context aliases, nested architecture,
capability arrays, and numeric `created`; all separate output caps are null.
xKiro includes context/output limits for all 129 rows and access tiers:
55 free, 63 paid, 11 premium. Use these measured shapes for the integration
and preserve unknown CodeCraft/CleanAPIs output caps.

Source-backed catalog contracts checked on 2026-10-03:

- [CodeCraft models](https://codecraftapi.com/docs/models): map `name`,
  `context_window`, capability strings, and numeric creation time. Convert
  `input_per_1k` / `output_per_1k` to per-token values by dividing by 1,000.
  No separate output limit is established by this schema.
- [xKiro models](https://docs.xkiro.com/api/list-models/): map `display_name`,
  `context_length`, `max_output_tokens`, capability booleans, reasoning
  controls, and access tier. USD `per_1m_tokens` prices divide by 1,000,000.
  Missing verified limits remain unknown. Public catalog membership does
  not establish account access.
- [CleanAPIs models](https://cleanapis.com/docs/models): the published schema
  uses `context_window`, a capability-string array, numeric `created`, and
  `input_per_1k` / `output_per_1k`. Compare authenticated results with this
  contract before replacing support for previously observed fields.
- [xKiro Messages](https://docs.xkiro.com/api/messages/): every model can use
  Anthropic Messages. The historical claim that family mandates protocol
  is unsupported. The explicit map is the operator's routing preference.
  This page warns about SDK-specific `/v1` handling; measure our installed
  AI SDK's outbound path instead of copying another SDK's base-URL rule.
- [xKiro API overview](https://docs.xkiro.com/api/overview/): chat and messages
  use `/v1/chat/completions` and `/v1/messages`, with either Bearer or API-key
  authentication. [Chat documentation](https://docs.xkiro.com/api/chat-completions/)
  provides the OpenAI request contract.

## Impact Assessment

### Affected Components

- `common/src/providers/`: registry partitions, validation, derivation, audit,
  exception manifest, and provider tests.
- `common/src/constants/model-config/`: protocol-map declarations and exports.
- `cli/src/utils/openrouter-models/`: live wrappers, fanout, extraction,
  normalized metadata, cache resets, and picker lookup.
- CLI provider setup, commands, persisted settings, and associated tests.
- SDK registry routing and generic factory dispatch, with request-budget
  compatibility for known and unknown limits.
- `.env.local`, generated `.env.example`, `cli/release/README.md`, provider
  runbook, active FID, and scope register.

### Risk Level

Medium: incorrect ID stripping, price units, output limits, protocol mapping,
or catalog-result positions can break model selection or route requests
incorrectly. Existing provider contracts must retain their behavior.

## Proposed Solution

### Approach

Follow [Adding a New LLM Provider](../../docs/archive/design/Adding%20New%20Providers.md)
in order, adapting its paths to the current partitioned tree. Keep registry
derivation authoritative. Reuse CleanAPIs rather than adding a duplicate;
add live wrappers and exception owners where actual code requires them.

### Steps

1. **Intake and local placeholders.** Preserve the transcript decisions,
   register T119, create this FID, and add missing blank keys without changing
   existing entries. Completed for planning; validate document and key shape.
2. **Runbook step 1: registry.** Add `codecraft` and `xkiro` gateway entries,
   environment credentials, strip transforms, live URLs, labels/domains,
   `setupAvailable: true`, and intentional picker order. Retain CleanAPIs.
   Let setup, routing prefixes, guidance, and valid-provider IDs derive.
3. **Runbook step 2: live catalogs.** Add provider wrappers using the existing
   live-fetch/cache helper and environment resolvers; normalize measured
   schemas, units, capabilities, missing limits, and exact upstream IDs.
   Extend gateway fanout/results/merge/reset and manifest owners. Revalidate
   CleanAPIs, preserving older field support where evidence justifies it.
4. **Runbook step 3: xKiro protocol map.** Preserve `multi` plus a named map
   keyed by full `xkiro/vendor/model` IDs. Resolve dynamic-catalog coverage,
   unknown/new model behavior, and any required shared dispatch adaptation
   before declaring convergence. Capture actual outbound chat/messages URLs,
   auth headers, IDs, and bodies using the installed SDK. Do not silently
   remove discovered models or change to OpenAI-only routing.
5. **Runbook step 4: generated references.** Run
   `bun run generate:provider-docs`; verify `.env.example` and release README
   derive from the registry. Update hand-maintained provider mentions in
   README files, `docs/index.md`, `docs/sdk-overview.md`, `docs/installation.md`,
   and `docs/features.md` as required by the drift checker. Document provider
   use and current live catalog/manifest obligations. Do not hand-edit
   generated provider tables.
6. **Runbook step 5: additive tests and verification.** Extend the suites
   declared below to prove registry parity, exception ownership, `/provider`
   setup/persistence, credentials, parser units/limits, cached refresh,
   failed-source isolation, exact ID roundtrips, and both xKiro protocols.
   Trace catalog → selection → persisted provider → SDK loop → factory →
   HTTP request. Run root typecheck across all workspaces and hard gates.
7. **Live acceptance and closure evidence.** Once keys are filled, capture
   authenticated catalogs and bounded streaming/tool-call acceptance for
   CodeCraft, both xKiro routes, and CleanAPIs. Record outcomes and failures
   without logging keys. Catalog success is not inference success. Stamp
   verification only after implementation; archive only with protocol-required
   evidence and commit authority.

### Verification

All 23 declared gates executed successfully at 2026-10-03T06:27:12.737Z;
the raw results are in `dev/scratchpad/active/provider-integration-closure-gates.log`.
Workspace tests ran from their workspace roots. Full root typecheck across
13 workspaces plus scripts, generated-reference check, zero-warning ESLint,
Markdown lint, and formatting passed. Broader suites: common providers
72 pass; related CLI 170 pass; full SDK 577 pass, one POSIX-only skip.
The SDK Windows process-tree test required an unrestricted rerun after its
sandbox-only failure; that complete rerun passed with zero failures.

Live catalogs and tool-call acceptance are separate evidence. CodeCraft,
CleanAPIs, and xKiro chat passed. A free xKiro model also passed through an
explicit Messages test override. The mapped Claude route reached Messages
but returned account-entitlement HTTP 403; successful Claude inference
remains blocked on the operator's paid access.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/provider-registry-gateways.test.ts
- gate: test common/src/providers/__tests__/provider-contract-pins.test.ts
- gate: test common/src/providers/__tests__/provider-audit.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-gateways.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/commands/__tests__/provider-list.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts
- gate: test scripts/__tests__/provider-docs-drift.test.ts
- gate: test common/src/providers/__tests__/provider-protocol-patterns.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-codecraft-xkiro.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-codecraft-xkiro.test.ts
- gate: test cli/src/utils/__tests__/provider-setup-codecraft-xkiro.test.ts
- gate: test packages/agent-runtime/src/templates/__tests__/strings-model-info.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED and draft solution

- **RED:** Two registry additions missing; existing CleanAPIs parser differs
  from current docs; static protocol-map lookup conflicts with live growth.
- **GREEN:** Draft the registry-led integration recipe, retain operator
  choices, prepare blank keys, and separate live/catalog/inference evidence.
- **AUDIT:** Current source inspections and fresh keyless probes cited above
  establish intake facts. No implementation tests or live inference PASS.
- **ADVERSARIAL:** Archived recipe does not automatically create live wrappers
  or exception owners. Registry-only success would leave catalog wiring
  incomplete. Family-based protocol necessity is rejected by current docs.
- **CHANGE DELTA:** Initial document; no convergence percentage claimed.

### Missed Questions

1. Is CleanAPIs new? No: retain its registry, wrapper, and manifest owner;
   compare current schema and repair verified gaps.
2. Can catalog metadata be copied from snapshots? No: use live sources and
   preserve unknown limits. Documentation examples are fixtures, not rosters.
3. Does xKiro require different protocols by family? Its Messages endpoint
   accepts every model; explicit multi-map routing remains the user choice.
4. How will new live IDs get protocol coverage? Explicit prefix-map entries:
   `xkiro/anthropic/*` uses Messages; `xkiro/*` uses chat. Exact entries win,
   then the longest matching terminal-wildcard prefix. Other providers have
   no wildcard entries and retain unknown-ID rejection. A shared resolver
   serves both registry coverage validation and SDK dispatch.
5. Are dummy values needed for all three env keys? Add blank missing entries
   only; CleanAPIs already has an entry. Preserve its value and missing-key
   semantics; never overwrite an operator credential.
6. Does an SDK base URL necessarily omit `/v1`? No: SDK path conventions
   differ. Capture this repository's actual outgoing paths for both dialects.
7. How many services were requested? Three are identifiable: CodeCraft API,
   xKiro, and CleanAPIs. The fourth, if intended, needs a name or URL; do not
   infer it from unrelated providers appearing in tool dumps.

### Implementation Evidence

- **Steps 1–2 implemented:** blank slots were prepared before the operator
  supplied keys. CodeCraft and xKiro are registered with setup, credentials,
  live URLs, domains, and one-prefix stripping at
  `common/src/providers/registry-partitioned-2.ts:15` and `:32`.
- **Step 3 implemented:** shared CodeCraft/CleanAPIs parsing handles both
  measured price schemas, capabilities, epoch creation times, and unknown
  limits. xKiro preserves vendor IDs, limits, USD units, capability booleans,
  tiers, and reported reasoning efforts. Independent live wrappers feed
  `cli/src/utils/openrouter-models/gateway.ts:155`; positional extraction,
  merge, resets, and manifest ownership agree.
- **Step 4 implemented:** `XKIRO_PROTOCOLS` and the shared resolver at
  `common/src/constants/model-config/provider-protocols.ts:118` support
  exact entries then longest terminal prefix. Validator and SDK factory
  call the same resolver; existing exact-only maps remain fail-closed.
- **Step 5 implemented:** registry-generated environment/reference surfaces
  and hand-maintained English/Chinese provider mentions are updated.
  The runbook now describes current partitions, live wiring, and map exports.
  The closure follow-up adds `docs/providers.md`, updates unreleased release
  notes and relevant workspace READMEs, and documents SDK modelInfoText.
  CLI and runtime metadata fallbacks now describe provider-neutral absence.
- **Step 6 implemented:** additive registry, setup/persistence, parser/cache,
  custom-tail ordering, and installed-SDK serialization tests pass alongside
  existing suites and all declared gates.
- **Step 7 partially implemented, external acceptance blocked:** authenticated
  catalogs and streaming tool calls are recorded below. Mapped Claude
  inference needs paid xKiro access. Commit, closure, and archival require
  G2 operator authority; no commit or archive was made.

### Code Verification Evidence

Production reachability was checked with source searches:
`cli/src/index.tsx:183` and the `/model` handler at
`cli/src/commands/defs/model-provider-commands.ts:55` call `fetchGatewayModels`;
the new wrappers join its fanout, merge, and reset paths at
`gateway.ts:155`, `:202`, and `:240`. Model selection at
`cli/src/chat/use-chat-pickers.ts:211` calls `applyModelPickerSelection`,
which activates configured providers at `cli/src/utils/provider-setup.ts:177`.
The runtime calls `getModelForRequest` and the generic provider factory at
`sdk/src/impl/model-provider.ts:55` and `:112`; multi dispatch invokes the
shared resolver at `model-factories.ts:254`. Catalog capabilities reach
system prompts through `cli/src/hooks/helpers/send-message-run-config.ts:170`.

Manual re-read confirmed matching fanout/result positions, custom sources
last, isolated credential/cache instances, safe malformed-input handling,
unknown-cap omission, and protocol precedence. Installed-SDK tests capture
both URL/auth contracts and exact stripped IDs without real keys.

Actual catalog normalization retained all IDs: CodeCraft 33/33, CleanAPIs
33/33, xKiro 129/129, with zero unrouteable xKiro IDs. CodeCraft/CleanAPIs
still report no separate output caps; none are fabricated. Live results:

| Route | Model | Actual outcome |
|---|---|---|
| CodeCraft chat | `gpt-5.6-luna` | Tool call passed, 4,136 ms, 1,229 reported tokens |
| CleanAPIs chat | `gpt-5.6-luna` | Tool call passed, 2,962 ms, 1,166 reported tokens |
| xKiro mapped chat | `mistralai/ministral-14b` | Tool call passed, 1,411 ms; usage unreported |
| xKiro mapped Messages | `anthropic/claude-haiku-4.5` | HTTP 403: active paid plan or real deposited balance required |
| xKiro Messages test override | `mistralai/ministral-14b` | Tool call passed, 1,546 ms, 11 reported tokens |

The last row explicitly overrides the test configuration to exercise the
Messages transport using a free model. Production maps that Mistral ID to
chat; this result does not establish Claude entitlement. The bounded smoke
script suppresses raw SDK errors and redacts credentials. An initial named
tool-choice rejection on CodeCraft/CleanAPIs was resolved by using the
runtime's supported `auto` tool choice in the smoke, without changing app code.

Live tmux checks opened a 2,046-model catalog, filtered xKiro to 129 rows,
kept the selected row visible after 20 paced Down presses, and retained
single-line geometry after resizing from 100×28 to 60×24. The native scroll
regression suite additionally covers wheel, scrollbar, filters, and selection.

### Loop 2 — design corrections

- **RED:** Exact maps cannot cover an evolving live roster. The two compatible
  catalogs share a schema; documentation-only price concerns were overstated.
- **GREEN:** Use explicit provider-scoped prefix rules for xKiro, a shared
  parser for CodeCraft/CleanAPIs, and independent live-fetcher instances.
  Prices normalize to USD per token; missing limits remain unknown. Retain
  capabilities, access tier, and reasoning-effort metadata and expose reported
  values in the existing model-info prompt block. These metadata fields do
  not fabricate request controls or assert account entitlement.
- **AUDIT:** Installed SDK factory measured with dummy credentials and a
  captured transport: chat requests `https://api.xkiro.com/v1/chat/completions`
  with Bearer auth; Anthropic requests `https://api.xkiro.com/v1/messages`
  with `x-api-key`. Both send `anthropic/test-model`, stripping one prefix.
  Snapshot schemas and units agree; CodeCraft/CleanAPIs output caps are null.
- **ADVERSARIAL:** Terminal wildcard rules must be provider-scoped; longest
  prefix and exact-key precedence need regression tests. Preserve nested
  vendor IDs, unknown limits, stale-cache degradation, and custom-result
  position. Reject invalid/negative prices and non-chat xKiro rows. Treat
  xKiro `created: 1` as a placeholder, not a meaningful creation date.
- **CHANGE DELTA:** Material design correction; not a stability pass.

### Loops 3 and 4 — independent design re-audits

Source tracing confirms registry derivation covers setup, saved provider IDs,
credentials, domains, and prefixes; explicit wrappers/manifest/fanout/reset
are the remaining integration seams. Exact-map providers keep their existing
fail-closed behavior. The generic SDK owns URL assembly; no xKiro-only
transport or speculative Responses path is needed. Shared parsing has two
production callers; prefix matching has validator and factory callers.
Additive tests listed above cover unknown IDs, schema omissions, price units,
credential lifecycle, failed sources, and actual SDK request serialization.
Two re-audits propose no further design changes: delta 0% and 0%, below 2%.
These design audits preceded implementation. The implementation and live
outcomes are now evidenced above; the receipt records the executed gates.

### Documentation and closure follow-up

Operator request 2026-10-03: "if it's completed, update the changelog, readme
and model info project wide and close the fid". The confirmed integrations
are implemented and verified. Update the unreleased CHANGELOG with severity,
resolution, and measured validation; add a current-development notice without
relabeling the published version; link a shared provider/model guide from
English/Chinese and workspace READMEs and the docs index. Document exact IDs,
price units, unknown limits, metadata, SDK modelInfoText, and xKiro access tiers.
Correct the CLI and runtime unknown-model prompts' OpenRouter-only wording without changing
metadata or request semantics. This extends the already-converged documentation
and shared formatter work; no new API or provider routing is introduced.

Closure is explicitly requested, but ECHO G2 requires the changes committed
locally with a hash in Resolution. Prepare the reviewed change set and rerun
verification before requesting commit authorization. Mapped Claude acceptance
and the unnamed possible fourth provider remain recorded boundaries; neither
is silently marked successful or removed by a documentation edit.

This documentation/model-information follow-up is implemented. All 23 gates,
fresh full root typecheck, zero-warning ESLint, Markdown lint, changed-source
formatting, generated-reference check, and both scope probes pass. Production
metadata still flows through the CLI run configuration and the runtime's
`PLACEHOLDER.MODEL_INFO` injector at `placeholder-injectors.ts:145`; the supplied
block wins over the fallback. The existing runtime substitution suite is now
an explicit gate. The CHANGELOG labels the implementation verified and
unreleased rather than claiming uncommitted FID closure.

### Verification Receipt

- fingerprint: sha256:356047721e25efcc94ab7a641a25195a1fee2def64af05983e73da1ac7381cf4
- verified: 2026-10-03T06:27:12.737Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry-gateways.test.ts: exit 0
- test common/src/providers/__tests__/provider-contract-pins.test.ts: exit 0
- test common/src/providers/__tests__/provider-audit.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode-gateways.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/commands/__tests__/provider-list.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts: exit 0
- test scripts/__tests__/provider-docs-drift.test.ts: exit 0
- test common/src/providers/__tests__/provider-protocol-patterns.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-codecraft-xkiro.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-codecraft-xkiro.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup-codecraft-xkiro.test.ts: exit 0
- test packages/agent-runtime/src/templates/__tests__/strings-model-info.test.ts: exit 0
- quality: exit 0

## Resolution

Implementation verified under T119: CodeCraft and xKiro are integrated;
CleanAPIs catalog normalization is completed. Catalog, routing, setup,
generated references, additive tests, and all declared gates pass. Live tool
calls pass for all three services and both xKiro transports, with the explicit
free-model Messages override distinguished from the mapped Claude route.
Mapped Claude live acceptance remains blocked by HTTP 403 account access.
The possible fourth provider still needs a name or URL. The FID stays active
pending these external boundaries and G2 commit/closure authority.

## Lessons Learned

Read the previous operator decisions before repeating discovery questions.
Verify current provider state before creating a duplicate. A live catalog
and a finite protocol map need an explicit growth policy. Validate documented
price units and capabilities against the authenticated wire response.
