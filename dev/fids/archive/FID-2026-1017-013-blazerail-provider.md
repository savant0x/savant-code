# FID: BlazeRail built-in provider

**Filename:** `FID-2026-1017-013-blazerail-provider.md`
**ID:** FID-2026-1017-013
**Severity:** medium
**Status:** closed
**Created:** 2026-10-17
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Add BlazeRail through the unified provider registry and documented live-catalog
seams. The operator explicitly excludes key probes and live inference. Completion
means verified implementation, without a claim of successful account inference.

## Environment

- **Commit/State:** `8741613e` (implementation), `26bbc577` (closure).

Windows, TypeScript, Bun 1.3.14; starting commit `6d4e3cff`.

## Detailed Description

### Problem and Root Cause

BlazeRail is absent from the shipped registry, so its setup, routing and picker
surfaces do not derive. The guide `docs/adding-a-provider.md` was read in full.

### Expected Behavior

`/provider blazerail` saves `BLAZERAIL_API_KEY`; `blazerail/<upstream-id>` routes
through OpenAI chat at `https://api.blazerail.com/v1` with Bearer auth. The public
catalog populates without a key. Media rows do not appear in the coding picker.

### Evidence

Primary vendor sources read 2026-10-17:

- <https://www.blazerail.com/> documents the API root and environment name.
- <https://www.blazerail.com/docs> loads its API reference from
  <https://api.blazerail.com/api-docs.json> (the public frontend bundle names it).
- The OpenAPI security scheme and operation security require BearerAuth. Legacy
  operation prose still shows x-api-key; use the current scheme and quick start.
- Public GET <https://api.blazerail.com/v1/models>: HTTP 200, 302 rows on
  2026-10-17. A keyless public-catalog census on 2026-10-18 retained 183 chat/coding
  rows after media and coding-policy filtering; 179 publish positive
  context_length values, with four exact ids left unknown. Categories include image,
  video and audio. Pricing.prompt/completion are decimal strings per token;
  created is epoch seconds; top_provider carries max_completion_tokens.
- Documentation declares namespaces and :free/:nitro/:floor variants verbatim.
  Free deposit requirements conflict between homepage and API prose, so do not
  promise account eligibility or a numeric deposit threshold.

## Impact Assessment

Registry partition five, exception manifest, coverage register, shared chat parser,
live wrapper, settled ladder, merge, cache reset, provider setup and SDK tests,
generated and hand-maintained docs. Medium feature addition. No new dependency,
request factory, protocol map, quota endpoint or inference body option is needed.

## Proposed Solution

1. Add the keyed single-protocol registry entry with strip transform and live URL.
2. Reuse the measured-compatible shared chat parser; filter explicit media
   categories plus the existing coding-name policy before parsing. Keep positive
   published windows, nested output limits, zero prices and exact upstream IDs.
3. Wire before custom-catalog tail, including merge, stale-cache fallback and reset;
   add live-catalog ownership and honest coverage after a complete public census.
4. Test malformed metadata, media filtering, suffix preservation, cache/merge,
   registry derivation, saved setup keys, missing-key refusal and captured SDK wire.
5. Regenerate provider docs, update manual surfaces, run gates and review the diff.
   Commit implementation, close/archive and push normally. Never ping a real key.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/blazerail-catalog.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:bef84c3e422ae5eaa4bfd611c7110d4397724bbc1f3ffb46d8cf66cdbecf6296
- verified: 2026-10-18T01:36:36.937Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/blazerail-catalog.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-free-mode.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Public API schema and measured list differ in richness; list includes
  non-chat media. Existing shared parser already maps prices, windows and epoch.
  Gateway fan-out, resolver, assembler and reset are separate named consumers.
- **GREEN:** Extend the shared parser's provider union, filter categories in a
  thin wrapper, register all four consumers; use the generic SDK factory.
- **AUDIT:** Read registry partition, chat parser, live fetcher, gateway ladder,
  assembler and reset. Registry factories use Bearer auth and strip one prefix;
  no per-provider SDK implementation is justified.
- **ADVERSARIAL:** Preserve paid/free distinction; never infer tool support,
  invent windows or treat catalog availability as inference acceptance. Public
  catalog fetch sends no account credential. Operator excludes live key checks.
- **CHANGE DELTA:** Initial convergence, before production edits.

### Missed Questions

1. Does a namespaced upstream id require native Anthropic routing? No: the
   published gateway contract uses OpenAI chat for every text model.
2. Can free ids become paid? Keep every suffix and strip only blazerail/.
3. Can lack of account access block implementation closure? No: per the explicit
   operator instruction, record live authentication/inference as unverified.

### Code Verification Evidence

- `fid:verify --write`: all 10 declared gates PASS; receipt recorded above.
- Full repository `bun run typecheck`: exit 0 across all 14 workspaces and
  `scripts/` typecheck.
- Full repository `bun run test`: exit 0 across every workspace.
- `bun x eslint . --max-warnings 0`, `bun run lint:md`,
  `bunx prettier --check .`, `bun run validate:repository`, provider-doc drift,
  and `bun run quality:report`: all exit 0.
- Keyless catalog census: HTTP 200, 302 rows, 183 retained, 179 published
  context windows, four unknown; 30 retained `:free` variants. No key was read
  or sent and no inference request was made.
- Mocked SDK request: `Bearer` auth, `https://api.blazerail.com/v1/chat/completions`,
  exact vendor namespaces and suffixes preserved; missing key fails before request.
- Implementation commit: `8741613e`.

## Resolution

Implementation is committed as `8741613e`, all declared gates pass, and this FID
is archived. The keyless catalog census observed 183 retained chat/coding rows
and four missing windows. Authentication and inference remain unverified by
operator instruction.

## Lessons Learned

Use vendor security schemes over stale example snippets and public catalog
metadata over an assumed OpenAI ids-only schema.
