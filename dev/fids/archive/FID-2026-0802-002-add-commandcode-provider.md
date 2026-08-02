# FID: Add CommandCode.ai as a New LLM Provider

**Filename:** `FID-2026-0802-002-add-commandcode-provider.md`
**ID:** FID-2026-0802-002
**Severity:** medium
**Status:** closed
**Created:** 2026-08-02 12:00
**Author:** Savant (Orchestrator)

---

## Summary

Add CommandCode.ai as a new LLM provider gateway, following the established pattern used by TokenRouter, NVIDIA NIM,
OpenCode Go, and Cloudflare Workers AI. CommandCode.ai offers 50+ models at competitive pricing with OpenAI-compatible
and Anthropic-compatible API endpoints. Claude models require the Anthropic endpoint (`/v1/messages`), all others use
OpenAI format (`/v1/chat/completions`).

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** Bun ≥ 1.3.11, TypeScript strict
- **Commit/State:** main branch

## Detailed Description

### Problem

Savant-Code does not currently support CommandCode.ai as a provider. Users who want to use CommandCode's competitive
pricing (discounts up to 85% on premium models) and free tier models cannot route requests through it.

### Expected Behavior

Users should be able to:

1. Set `COMMAND_CODE_API_KEY` env var to authenticate
2. Select `commandcode` as a provider via the CLI `/provider` command
3. Use model IDs prefixed with `commandcode/` (e.g., `commandcode/deepseek/deepseek-v4-pro`)
4. Claude models automatically route through the Anthropic-compatible endpoint

### Root Cause

No CommandCode provider integration exists in the codebase.

### Evidence

CommandCode.ai Provider API documentation:

- OpenAI endpoint: `https://api.commandcode.ai/provider/v1/chat/completions`
- Anthropic endpoint: `https://api.commandcode.ai/provider/v1/messages`
- Models endpoint: `GET https://api.commandcode.ai/provider/v1/models`
- Auth: `Authorization: Bearer <CMD_API_KEY>` or env `COMMAND_CODE_API_KEY`

## Impact Assessment

### Affected Components

- `common/src/constants/model-config.ts` — Add `commandcode/` prefix, model catalog, domain, logo routing
- `sdk/src/env.ts` — Add `getCommandCodeApiKeyFromEnv()`
- `sdk/src/impl/model-provider.ts` — Add `isCommandCodeModel()`, `createCommandCodeModel()`, wire into `getModelForRequest()`
- `cli/src/utils/provider-setup.ts` — Add `commandcode` to `PROVIDER_SETUP_CONFIG`
- `cli/src/utils/openrouter-models.ts` — Add `COMMANDCODE_CATALOG`, `fetchCommandCodeModels()`, wire into `fetchGatewayModels()`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Follow the exact same pattern as OpenCode Go (dual-protocol provider). CommandCode has both OpenAI and Anthropic
endpoints, just like OpenCode Go.

### Steps

1. Add `'commandcode'` to `ALLOWED_MODEL_PREFIXES` in `model-config.ts`
2. Add `commandcodeModels` catalog with model IDs
3. Add `COMMANDCODE_PROTOCOLS` map (Claude → anthropic, all others → openai)
4. Add `getCommandCodeApiKeyFromEnv()` in `sdk/src/env.ts`
5. Add `isCommandCodeModel()`, `createCommandCodeModel()` in `model-provider.ts`
6. Wire CommandCode check into `getModelForRequest()` before the default backend path
7. Add `commandcode` to `PROVIDER_SETUP_CONFIG` in `provider-setup.ts`
8. Add `COMMANDCODE_CATALOG`, `fetchCommandCodeModels()` in `openrouter-models.ts`
9. Wire into `fetchGatewayModels()`
10. Add logo routing in `getLogoForModel()`
11. Add domain mapping in `providerDomains`

### Verification

- Typecheck: `cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../packages/agent-runtime && bun
  run typecheck && cd ../../cli && bun run typecheck`
- Lint: `bun x eslint . --max-warnings 0`

## Perfection Loop

### Loop 1 — Ground-truth implementation audit (2026-08-02)

- **RED:** The original document described an unimplemented provider, but the current worktree already contains the
  CommandCode prefix, 28-model catalog, API-key helper, dual-protocol SDK routing, CLI setup metadata, picker catalog,
  provider preference, logo/domain mapping, tests, and release documentation. The only concrete design defect found is
  an unused duplicate `commandcodeGatewayModels` catalog in `common/src/constants/model-config.ts`; read-only call-graph
  search found no consumer for it. A numerical audit found exact 28-model/28-protocol parity with no missing or extra
  IDs and no duplicate model values.
- **GREEN:** Retain the active `commandcodeModels` catalog as the single source of truth, remove only the unused
  `commandcodeGatewayModels` definition, and add a regression assertion that every CommandCode catalog value has a
  protocol entry. Keep all existing provider routing and CLI behavior unchanged.
- **SELF-CORRECT:** The initial FID incorrectly treated the entire provider as pending and proposed a new
  implementation. Corrected the plan to a minimal cleanup-and-proof change based on current source ground truth; no
  provider behavior is to be reimplemented or duplicated.
- **AUDIT:** Independent call-graph evidence shows `commandcodeModels` is consumed by `fetchCommandCodeModels()`, while
  `commandcodeGatewayModels` has no consumers. The SDK fails closed when a CommandCode model lacks a protocol. The
  parity audit is currently 28/28; the new test will make that invariant executable. No unresolved design blocker
  remains.
- **CONVERGENCE:** PASS. The FID is ready for the bounded duplicate-catalog removal and protocol-coverage regression test.

### Loop 2 — FreeBuff protocol correction and RED re-audit (2026-08-02)

- **RED:** The prior review identified that the FID needed to name the FreeBuff
  protocol explicitly rather than relying on the Savant harness protocol label.
- **GREEN:** Corrected the FID to reference FreeBuff ECHO v0.1.2-freebuff and
  retained the minimal single-catalog cleanup plan.
- **SELF-CORRECT:** Added the explicit protocol correction to the FID loop and
  preserved the implementation scope: remove the unused duplicate and prove
  catalog/protocol parity without changing provider behavior.
- **AUDIT:** Re-read the affected source, confirmed the duplicate catalog has no
  production callers, confirmed 28 active model IDs have 28 protocol entries,
  and verified the regression test, common/CLI/SDK validation, and Markdownlint.
- **CONVERGENCE:** PASS; no unresolved design or implementation issue remained.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created,
  but failed to?"*

1. What is the exact model ID format for CommandCode models? → Use namespaced format matching the upstream API (e.g.,
   `deepseek/deepseek-v4-pro`, `claude-opus-5`)
2. Does CommandCode's `/v1/models` endpoint require auth? → Yes, requires `COMMAND_CODE_API_KEY`. Use hardcoded catalog
   like TokenRouter/OpenCode Go.
3. What context windows do CommandCode models have? → Inferred from model family (same as other gateways)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists.

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Current implementation contains all proposed provider surfaces
- [x] Read-only call-graph audit found no consumer of `commandcodeGatewayModels`
- [x] Current protocol coverage is exact: 28 catalog IDs, 28 protocol entries, zero missing/extra IDs
- [x] Duplicate catalog removed and regression test added
- [x] Common/SDK/CLI typechecks and focused tests pass after implementation
- [x] FID status updated to reflect actual implementation state

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-02
- **Fix Description:** Removed the unused duplicate `commandcodeGatewayModels` catalog and added a regression test
  proving every active CommandCode model has exactly one protocol mapping.
- **Tests Added:** Yes — common model-config catalog parity coverage.
- **Verified By:** Independent code review; common model-config tests/typecheck, focused CLI catalog tests/typecheck,
  SDK typecheck, Markdownlint, and declared-file diff checks.
- **Commit/PR:** None; no commit or remote operation authorized
- **CHANGELOG:** `CHANGELOG.md` → `v0.0.15`
- **Archived:** 2026-08-02 — moved to `dev/fids/archive/` after the v0.0.15 CHANGELOG entry was added

Archived to `dev/fids/archive/` after the v0.0.15 CHANGELOG entry was added.

## Lessons Learned

What can we learn from this finding? How can we prevent similar issues?
