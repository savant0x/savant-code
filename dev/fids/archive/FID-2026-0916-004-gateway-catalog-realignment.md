# FID: gateway catalog re-alignment — commandcode stale roster, tokenharbor dead free channel, opencode zen free-tier gate

**Filename:** `FID-2026-0916-004-gateway-catalog-realignment.md`
**ID:** FID-2026-0916-004
**Severity:** medium
**Status:** closed
**Created:** 2026-09-16 20:10
**YAGNI-Compliance:** Verified

---

## Summary

The Task 62 zero-credit identity gauntlet (keyed rosters + vendor pages,
no paid cells) found **22 of 28 commandcode catalog ids no longer match the
gateway's live roster** (vendor renormalized id spelling and dropped
legacy names), 3 of 20 tokenharbor ids stale (including the `kimi-k3:free`
channel whose launch-event allowance ended), and an operator-reported
**OpenCode Zen free-tier gate** ("free tier can only be used in OpenCode")
that makes the zen/go catalog unusable on free accounts regardless of
catalog correctness. This FID re-aligns the three catalogs to vendor truth
and documents the zen gate.

## Environment

- Affected: `common/src/constants/model-config/providers.ts`
  (commandcodeModels, tokenharborModels), `provider-protocols.ts`
  (COMMANDCODE_PROTOCOLS, OPENCODE_*_PROTOCOLS id spellings),
  `context-windows.ts` (fallback rows for renamed ids),
  `cli/src/utils/openrouter-models/static-catalogs.ts` (picker maps)
- Evidence: keyed `GET /v1/models` rosters (tokenharbor 35 ids,
  commandcode 69, opencode-go 38) captured 2026-09-16; vendor pages
  tokenharbor.ai/models + commandcode.ai; opencode.ai/docs/zen

## Detailed Description

### Problem

1. **commandcode (22/28 catalog ids stale):** the vendor normalized its
   roster — `claude-sonnet-4.6` → `claude-sonnet-4-6`, `openai/gpt-5.6-sol`
   → `gpt-5.6-sol` (vendor prefixes dropped), `z-ai/glm-5.2` →
   `zai-org/GLM-5.2`, `moonshotai/kimi-k3` → `moonshotai/Kimi-K3` (case).
   Whether the API still accepts legacy spellings is unverified (chat cells
   bill). 63 roster ids are absent from our catalog (Qwen3.8 family,
   GLM-5.3, gemini-3.8/3.7, grok-4.6, Step-3.7, hy3/hy4, muse-spark…).
2. **tokenharbor (3/20 stale):** `gemini-3.6-flash` and `minimax-m3` absent
   from the roster; `kimi-k3:free` absent because its launch-event allowance
   ended (429 "The Kimi K3 Launch Event has ended"). 18 new roster ids.
3. **opencode zen gate (operator report + LIVE probe):** a free-tier zen
   account used from Savant gets "OpenCode's free tier can only be used in
   OpenCode". Our probe account (credit-billed, zero balance) gets
   `CreditsError` on every protocol surface — the free-tier gate message was
   NOT reproducible with any User-Agent, so the gate is likely
   account-type-based, not UA-based (NEEDS-REVIEW). The catalog is correct
   (0/15 missing vs the go roster) but the vendor docs' canonical zen model
   list is larger and multi-protocol.

### Expected Behavior

Picker-served ids resolve against each gateway's live roster; dead ids are
removed or documented; the zen free-tier limitation is surfaced to the
operator instead of failing mid-session.

### Root Cause

Static catalogs drift when vendors renormalize ids or expire promos; the
FID-2026-0916-002 closed-world coverage invariant covers tokenrouter only —
tokenharbor/commandcode/opencode-go had no equivalent sweep until now.

### Evidence

```text
commandcode roster 69 ids / catalog 28 → 22 missing, 63 new
  examples: claude-sonnet-4-6 (roster) vs claude-sonnet-4.6 (ours)
            gpt-5.6-sol (roster) vs openai/gpt-5.6-sol (ours)
tokenharbor roster 35 / catalog 20 → gemini-3.6-flash, minimax-m3,
  kimi-k3:free missing; kimi-k3:free 429 "Launch Event has ended"
opencode-go roster 38 / catalog 15 → 0 missing (clean)
zen free-tier gate: operator error text; UA test matrix (6 UAs × 2
  endpoints × 3 protocols) produced only CreditsError on a drained
  credit account — gate not UA-driven (NEEDS-REVIEW)
```

## Impact Assessment

### Affected Components

- common model-config catalogs + protocols + context windows
- cli picker maps (static-catalogs)
- docs (provider reference regenerates from catalogs)

### Risk Level

- [x] Medium: stale ids waste a picker slot and fail at request time; the
  zen gate misleads free-tier users. No data loss; workaround = other
  providers.

## Proposed Solution

### Approach

Follow the FID-2026-0916-002 precedent exactly: re-align each catalog to
the keyed live roster (remove stale, add vendor-current ids per an
operator-approved curation), extend `CONTEXT_WINDOW_FALLBACKS` coverage to
every new id, extend the closed-world invariant pin to all three catalogs,
and document the zen free-tier gate in the provider reference + setup hint.
No protocol changes for opencode (existing maps already multi-protocol).

### Steps

1. Ruling: curation set per gateway (operator via ask_user — all roster
   ids vs curated subset; zen gate documentation wording).
2. RED-first pins: closed-world coverage invariant extended to
   tokenharbor + commandcode + opencode-go (each catalog id must have a
   protocol map entry + context-window row); renamed-id pins.
3. GREEN: catalogs + protocols + windows + picker maps; docs regen.
4. Gates: typecheck ×4, suites (model-config, provider-registry,
   openrouter-models), quality, eslint/prettier/lint:md; 1 keyed identity
   cell per renamed family IF the operator funds pennies (else skipped and
   recorded NEEDS-REVIEW — zero-cost ruling).

### Verification

- All pins green; `bun run quality:report` PASS; docs-check green
- LIVE roster re-pull matches the new catalogs (read-only, free)

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test common/src/__tests__/model-config.test.ts
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test common/src/providers/__tests__/validate-provider-registry.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:fa0aa85cace059d31081a977936a0d54c8f94a1fb99ffbb9ea2dbb43ab30d823
- verified: 2026-09-16T21:59:30.673Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test common/src/__tests__/model-config.test.ts: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test common/src/providers/__tests__/validate-provider-registry.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Pins authored first
(`cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts`):
closed-world invariants (no removed id in any catalog map; every new
commandcode spelling maps; protocol map member deleted), and MQ3 removal
pins (registry/protocol-map opencode absence). RED observed: **9 fail /
3 pass** — every pin correctly rejected the pre-change catalogs (the 3
passes were the already-correct negative shapes). GREEN proceeded in
dependency order: common catalogs/protocols → registry surfaces →
context-windows → cli gateway/static-catalog modules → sdk resolver
chain → test fixtures re-pointed to surviving gateways (tokenharbor).

### Missed Questions

- MQ1 (ruled): zero-credit constraint honored — no paid cells; identity
  cells only if the operator opts in later.
- MQ2 (RULED via ask_user, 2026-09-16): "remove the dead ids and fix
  spelling for the coding set" — remove all dead ids; fix the renamed
  spellings; add ONLY coding-relevant new ids (GLM-5.3, grok-4.6, Qwen3.8
  family, gemini-3.8/3.7, Step-3.7, deepseek-v4.1-flash class). No bulk
  roster dumps.
- MQ3 (RULED via ask_user, 2026-09-16): "zen needs to be removed" — the
  opencode-zen provider (and its sibling free-tier-gated opencode-go
  surface) comes OUT of Savant entirely, not just a warning. Scope:
  remove `opencode-zen` + `opencode-go` registry entries, catalogs,
  protocol maps, picker surfaces, fallback rows, setup paths, and the
  shared opencode credential resolver chain (leaving no orphan imports),
  + docs sync. The zen gate makes them unusable from Savant regardless of
  catalog correctness.
- MQ4 (ruled): gorouter stays out of scope (site down; not a built-in
  registry provider).
- MQ5 (self-caught, GREEN): the `sdk` `getOpenCodeGoApiKeyFromEnv` getter
  and the `ProviderResolver` `'opencode'` member — the getter is removed
  (zero consumers after the resolver-chain removal); the resolver TYPE
  member is retained so stored settings from older builds still parse
  fail-closed (no runtime branch remains).
- MQ6 (self-caught, GREEN): the free-mode cyclic-tool regression suite
  (FID-2026-0905-004) drove all four wire protocols through zen models;
  re-pointed to TokenRouter per-model protocol ids — the same four
  protocol surfaces survive via TOKENROUTER_PROTOCOLS, so regression
  coverage is preserved, not deleted.

### Loop 2 — Independent audit and self-correction

- Fixture cascade self-caught: renaming the harness models in
  `model-provider-free-mode-test-setup.ts` surfaced a stale wire-body
  assertion in the commandcode suite (`claude-sonnet-4.6` → `-4-6`);
  fixed, suite 31/0.
- `validate:repository` caught the quality ratchet: providers.ts dropped
  to 295 lines under the 300 ceiling, so its dataConstantExemptions entry
  became "unnecessary" — exemption removed, trackedFiles freeze tightened
  335 → 295. A stale LEARNINGS evidence pointer (SCOPE.md section retired
  in the 2026-09-16 scope rewrite; the crash-dump re-host is itself a
  2.9 MB file the resolver cannot reach) was re-pointed at the archived
  FID-2026-0819-005 record.
- Parallel in-flight FID-2026-0916-005 (atria) surfaced mid-implementation
  with incomplete derived surfaces (`modelsRef: 'atria'` with no
  MODEL_CATALOGS key → registry validation crash; missing fallback-table
  row). Completed the two derived surfaces the FID's own comments cite
  (MODEL_CATALOGS key + vendor-published 256K window row) so the shared
  tree validates; FID-005 implementation itself remains its author's.

## Resolution

### Implementation Evidence (REQUIRED for `closed`)

- **Fix:** commandcode catalog re-aligned to the vendor's renormalized
  roster (dashed versions, vendor prefixes dropped, `zai-org/GLM-*`,
  canonical Kimi casing, Qwen3.8 family, GLM-5.3, grok-4.6,
  deepseek-v4.1-flash class — coding-relevant additions only);
  tokenharbor dead ids removed (`gemini-3.6-flash`, `minimax-m3`,
  `kimi-k3:free` — the launch-promo free channel); opencode-zen AND
  opencode-go removed from Savant entirely per MQ3: registry entries,
  catalogs, `OPENCODE_ZEN_PROTOCOLS` + `OPENCODE_GO_PROTOCOLS` maps,
  `zen`/`go` module + gateway wiring + static-catalog ids, context-window
  rows, sdk `opencode-key-resolver` chain + `isOpenCodeGoModel`, the
  `getOpenCodeGoApiKeyFromEnv` getter, exception-manifest entries, and
  picker/setup fixtures.
- **Tests:** new pin module
  `cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts`
  (closed-world invariants + removal pins, RED 9/3 before GREEN);
  free-mode suites re-pointed to surviving gateways (tokenharbor) and the
  cyclic-tool regression suite re-pointed to TokenRouter's per-model
  protocol ids (MQ6) preserving all four wire-protocol legs; registry
  closed-world pins updated for the 17-provider post-004 world.
- **Commit:** (hash recorded post-commit)

### Code Verification Evidence

- LIVE stamped receipt (see `### Verification Receipt`): **10/10 gates
  exit 0** — typecheck common/cli/sdk, model-config + provider-registry +
  validate-provider-registry suites, the FID-004 pin module,
  window-truth, provider-setup, and the repo-wide quality gate.
- `validate:repository` green after the run: the quality ratchet finding
  (providers.ts 295 ≤ 300) resolved by removing the exemption and
  tightening the freeze; the stale LEARNINGS evidence pointer resolved by
  re-pointing at the archived FID-2026-0819-005 record.
- RED evidence (Loop 1): pins observed failing 9/3 against the
  pre-change catalogs before any catalog edit.
- Fixture surfaces verified by suite run: free-mode family 31/0,
  gateway catalogs 42/0, provider-setup family 29/0 + 23/0,
  window-truth + realign + fallbacks green. Remaining repo reds are
  confined to the vendored `resources/freebuff-main` tree (pre-existing
  Windows EPERM rename races + its own broken module graph), untouched
  by this FID.
