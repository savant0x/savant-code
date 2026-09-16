# FID: gateway catalog re-alignment — commandcode stale roster, tokenharbor dead free channel, opencode zen free-tier gate

**Filename:** `FID-2026-0916-004-gateway-catalog-realignment.md`
**ID:** FID-2026-0916-004
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-16 20:10
**YAGNI-Compliance:** Pending

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
- gate: test cli/src/utils/openrouter-models/__tests__
- gate: quality

## Perfection Loop

### Loop 1 — RED

(pending — pins authored after operator curation ruling)

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

## Resolution

- **Fix Description:** —
- **Fixed Date:** —
